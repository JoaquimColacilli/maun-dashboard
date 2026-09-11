-- La cascada de distribución, la máquina de estados del proyecto, el cobro y la reapertura.
--
-- La cascada y las transiciones existen también en @maun/domain. Las dos implementaciones no se
-- mantienen por disciplina: packages/db/scripts/comparacion.ts las compara contra la base (en el
-- ensayo, antes de aplicar, y en pnpm verify) y falla si dan distinto en un solo caso. Además,
-- cobrar_proyecto recibe la distribución que calculó la app y rechaza con MN008 si no es la suya.


-- La cascada ---------------------------------------------------------------------------------------

create function private.cascada(
  p_cobrado_centavos bigint,
  p_gastos_centavos bigint,
  p_diezmo_bp integer,
  p_tope_sueldo_centavos bigint,
  p_tope_fijos_centavos bigint,
  out neta_centavos bigint,
  out diezmo_centavos bigint,
  out sueldo_centavos bigint,
  out fijos_centavos bigint,
  out remanente_centavos bigint
)
language plpgsql
immutable
set search_path = ''
as $$
declare
  -- Number.MAX_SAFE_INTEGER: el mayor entero que Money representa exacto. Fuera de ese rango la
  -- cascada de TypeScript corta, así que esta también.
  c_maximo constant bigint := 9007199254740991;
  v_resto bigint;
begin
  if num_nulls(p_cobrado_centavos, p_gastos_centavos, p_diezmo_bp, p_tope_sueldo_centavos, p_tope_fijos_centavos) > 0 then
    raise exception 'La cascada necesita todos sus parámetros' using errcode = '22004';
  end if;

  if p_cobrado_centavos < 0 or p_gastos_centavos < 0 or p_tope_sueldo_centavos < 0 or p_tope_fijos_centavos < 0 then
    raise exception 'La cascada no acepta importes negativos' using errcode = '22023';
  end if;

  if p_diezmo_bp not between 0 and 10000 then
    raise exception 'El diezmo va en puntos básicos entre 0 y 10000' using errcode = '22023';
  end if;

  if greatest(p_cobrado_centavos, p_gastos_centavos, p_tope_sueldo_centavos, p_tope_fijos_centavos) > c_maximo then
    raise exception 'Importe fuera del rango exacto de Money' using errcode = '22003';
  end if;

  neta_centavos := p_cobrado_centavos - p_gastos_centavos;

  -- Sin ganancia no hay nada que repartir: la pérdida entera queda en el remanente, así los
  -- escalones siempre suman la neta (proyectos_distribucion_cuadra).
  if neta_centavos <= 0 then
    diezmo_centavos := 0;
    sueldo_centavos := 0;
    fijos_centavos := 0;
    remanente_centavos := neta_centavos;
    return;
  end if;

  if neta_centavos * p_diezmo_bp + 5000 > c_maximo then
    raise exception 'Importe fuera del rango exacto de Money' using errcode = '22003';
  end if;

  -- Mitad hacia arriba al centavo, en aritmética entera: la misma cuenta que aplicarPorcentaje.
  diezmo_centavos := (neta_centavos * p_diezmo_bp + 5000) / 10000;
  v_resto := neta_centavos - diezmo_centavos;
  sueldo_centavos := least(p_tope_sueldo_centavos, v_resto);
  v_resto := v_resto - sueldo_centavos;
  fijos_centavos := least(p_tope_fijos_centavos, v_resto);
  remanente_centavos := v_resto - fijos_centavos;
end;
$$;

comment on function private.cascada(bigint, bigint, integer, bigint, bigint) is
  'La cascada: neta = cobrado - gastos; diezmo (mitad hacia arriba); sueldo y fijos topeados por lo que queda; remanente. Gemela de calcularDistribucion de @maun/domain, con el mismo rango de importes.';

revoke all on function private.cascada(bigint, bigint, integer, bigint, bigint) from public;


-- La máquina de estados ----------------------------------------------------------------------------

-- Las transiciones que el usuario hace a mano. Llegar a cobrado y salir de cobrado no están: son
-- operaciones (cobrar_proyecto, reabrir_proyecto), no cambios de un campo. Gemela de TRANSICIONES.
create function private.transicion_valida(p_desde public.estado_proyecto, p_hasta public.estado_proyecto)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select exists (
    select 1
    from (
      values
        ('contacto', 'relevamiento'), ('contacto', 'a_presupuestar'), ('contacto', 'presupuesto_enviado'),
        ('contacto', 'en_curso'), ('contacto', 'perdido'),
        ('relevamiento', 'contacto'), ('relevamiento', 'a_presupuestar'), ('relevamiento', 'presupuesto_enviado'),
        ('relevamiento', 'en_curso'), ('relevamiento', 'perdido'),
        ('a_presupuestar', 'contacto'), ('a_presupuestar', 'relevamiento'), ('a_presupuestar', 'presupuesto_enviado'),
        ('a_presupuestar', 'en_curso'), ('a_presupuestar', 'perdido'),
        ('presupuesto_enviado', 'contacto'), ('presupuesto_enviado', 'relevamiento'),
        ('presupuesto_enviado', 'a_presupuestar'), ('presupuesto_enviado', 'en_curso'), ('presupuesto_enviado', 'perdido'),
        ('perdido', 'contacto'), ('perdido', 'relevamiento'), ('perdido', 'a_presupuestar'),
        ('perdido', 'presupuesto_enviado'),
        ('en_curso', 'presupuesto_enviado'), ('en_curso', 'entregado'), ('en_curso', 'perdido'),
        ('entregado', 'en_curso')
    ) as t (desde, hasta)
    where t.desde::public.estado_proyecto = p_desde
      and t.hasta::public.estado_proyecto = p_hasta
  )
$$;

comment on function private.transicion_valida(public.estado_proyecto, public.estado_proyecto) is
  'Transiciones manuales de estado. Gemela de TRANSICIONES de @maun/domain.';

revoke all on function private.transicion_valida(public.estado_proyecto, public.estado_proyecto) from public;
-- La llama private.validar_proyecto(), que corre con el rol de quien edita.
grant execute on function private.transicion_valida(public.estado_proyecto, public.estado_proyecto) to authenticated;


-- Lo que se guarda al reabrir -----------------------------------------------------------------------

-- Reabrir descongela la distribución, pero no puede tirar los parámetros con los que se calculó: si
-- el sueldo subió desde entonces, volver a cobrar con los ajustes de hoy reescribiría la historia
-- (ADR 0003). Estas columnas guardan los topes y la fecha del cobro original hasta el cobro siguiente.
alter table public.proyectos
  add column reapertura_tope_sueldo_centavos bigint,
  add column reapertura_tope_fijos_centavos bigint,
  add column reapertura_fecha_cobro date,
  add constraint proyectos_reapertura_completa check (
    num_nulls(reapertura_tope_sueldo_centavos, reapertura_tope_fijos_centavos, reapertura_fecha_cobro) in (0, 3)
    and (estado <> 'cobrado' or reapertura_fecha_cobro is null)
  );

comment on column public.proyectos.reapertura_tope_sueldo_centavos is
  'Tope de sueldo del cobro que se reabrió. El próximo cobro lo usa en vez del de los ajustes, y lo limpia.';
comment on column public.proyectos.reapertura_tope_fijos_centavos is
  'Tope de costos fijos del cobro que se reabrió. El próximo cobro lo usa en vez del de los ajustes, y lo limpia.';
comment on column public.proyectos.reapertura_fecha_cobro is
  'Fecha del cobro que se reabrió. El próximo cobro conserva esa fecha: corregir no mueve la distribución en el libro mayor.';


-- La guarda de proyectos, ahora con la máquina de estados --------------------------------------------

create or replace function private.validar_proyecto()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_cliente_borrado timestamptz;
begin
  if tg_op = 'INSERT' then
    -- Upsert que choca contra una fila existente: decide la rama UPDATE, que ve la fila vieja.
    perform 1 from public.proyectos where id = new.id;
    if found then
      return new;
    end if;

    -- Un proyecto nace en cualquier estado menos cobrado: cobrar es una operación, no un dato.
    if new.estado = 'cobrado' and new.fecha_cobro is null then
      raise exception 'Un proyecto se cobra con cobrar_proyecto, no se crea cobrado'
        using errcode = 'MN007';
    end if;
  elsif private.es_reenvio(to_jsonb(old), to_jsonb(new)) then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    -- Lo congelado solo se mueve reabriendo, y la reapertura limpia fecha_cobro. Sin esta guarda,
    -- una edición encolada con el estado viejo rebotaría contra un check con un 23514 genérico.
    if old.estado = 'cobrado' and new.fecha_cobro is not null and new.estado <> 'cobrado' then
      raise exception 'El proyecto ya está cobrado: su estado solo cambia al reabrirlo'
        using errcode = 'MN001',
              hint = 'Para corregirlo hay que reabrir el proyecto o registrar un ajuste.';
    end if;

    if old.estado = 'cobrado' and old.deleted_at is null and new.deleted_at is not null then
      raise exception 'Un proyecto cobrado no se borra: tiene la distribución congelada'
        using errcode = 'MN001';
    end if;

    -- La baja se lleva los pagos y gastos, y des-borrar no los trae de vuelta: un proyecto
    -- borrado se queda borrado. Evita que una edición vieja encolada lo resucite vacío.
    if old.deleted_at is not null and new.deleted_at is null then
      raise exception 'El proyecto está borrado'
        using errcode = 'MN002';
    end if;

    if new.estado is distinct from old.estado then
      if new.estado = 'cobrado' then
        -- Solo cobrar_proyecto llega acá con la distribución congelada: el cliente no tiene grant
        -- sobre fecha_cobro.
        if old.estado <> 'entregado' or new.fecha_cobro is null then
          raise exception 'Un proyecto se cobra con cobrar_proyecto, y solo si está entregado'
            using errcode = 'MN007';
        end if;
      elsif old.estado = 'cobrado' then
        -- Solo reabrir_proyecto llega acá, porque es la única que limpia fecha_cobro.
        if new.estado <> 'entregado' then
          raise exception 'Un proyecto cobrado se reabre a entregado'
            using errcode = 'MN007';
        end if;
      elsif not private.transicion_valida(old.estado, new.estado) then
        raise exception 'Un proyecto no pasa de % a %', old.estado, new.estado
          using errcode = 'MN007';
      end if;
    end if;
  end if;

  if new.deleted_at is null and (tg_op = 'INSERT' or new.cliente_id is distinct from old.cliente_id) then
    select c.deleted_at into v_cliente_borrado
    from public.clientes c
    where c.household_id = new.household_id
      and c.id = new.cliente_id
    for share;

    if v_cliente_borrado is not null then
      raise exception 'El cliente está borrado'
        using errcode = 'MN005';
    end if;
  end if;

  return new;
end;
$$;

comment on function private.validar_proyecto() is
  'Guarda de proyectos: un cobrado no cambia de estado ni se borra (MN001), un borrado no revive (MN002), un proyecto vivo no cuelga de un cliente borrado (MN005) y el estado solo sigue transiciones válidas (MN007). Deja pasar el reenvío idéntico de la cola.';


-- Cobrar ------------------------------------------------------------------------------------------

-- security definer: escribe las columnas de la distribución, sobre las que el cliente no tiene
-- grant. Como corre con el dueño de las tablas y saltea la RLS, verifica la pertenencia a mano.
-- Vive en private (la API no la expone) y se llama por el envoltorio public.cobrar_proyecto.
--
-- La app manda lo que le mostró al usuario: la versión del proyecto, los totales, los topes, la
-- fecha y la distribución que calculó @maun/domain. Se congela solo si todo coincide con lo que
-- calcula la base; si no, se rechaza y la app vuelve a mostrar la distribución.
create function private.cobrar_proyecto(
  p_proyecto_id uuid,
  p_version integer,
  p_fecha_cobro date,
  p_cobrado_centavos bigint,
  p_gastos_centavos bigint,
  p_tope_sueldo_centavos bigint,
  p_tope_fijos_centavos bigint,
  p_diezmo_centavos bigint,
  p_sueldo_centavos bigint,
  p_fijos_centavos bigint,
  p_remanente_centavos bigint
)
returns public.proyectos
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_proyecto public.proyectos;
  v_ajustes public.ajustes;
  v_tope_sueldo bigint;
  v_tope_fijos bigint;
  v_fecha date;
  v_cobrado bigint;
  v_gastos bigint;
  v_dist record;
begin
  if num_nulls(
    p_proyecto_id, p_version, p_fecha_cobro, p_cobrado_centavos, p_gastos_centavos,
    p_tope_sueldo_centavos, p_tope_fijos_centavos, p_diezmo_centavos, p_sueldo_centavos,
    p_fijos_centavos, p_remanente_centavos
  ) > 0 then
    raise exception 'cobrar_proyecto necesita todos sus parámetros' using errcode = '22004';
  end if;

  -- Primera sentencia: bloquear el proyecto. La guarda de pagos y gastos toma for share sobre esta
  -- misma fila, así que un pago que llega en el mismo instante espera a que el cobro termine (y
  -- entonces lo ve cobrado), o el cobro espera a que el pago termine (y entonces lo suma).
  select p.* into v_proyecto
  from public.proyectos p
  where p.id = p_proyecto_id
    and p.household_id = any (array(select private.user_household_ids()))
  for update;

  if not found then
    raise exception 'El proyecto no existe o no es tuyo' using errcode = '42501';
  end if;

  -- El reenvío de la cola: este mismo cobro ya se aplicó (la versión subió exactamente uno) y la
  -- respuesta se perdió. Se devuelve la fila tal cual, sin rechazar algo que salió bien.
  if v_proyecto.estado = 'cobrado'
    and v_proyecto.version = p_version + 1
    and (
      v_proyecto.fecha_cobro, v_proyecto.dist_cobrado_centavos, v_proyecto.dist_gastos_centavos,
      v_proyecto.dist_tope_sueldo_centavos, v_proyecto.dist_tope_fijos_centavos,
      v_proyecto.dist_diezmo_centavos, v_proyecto.dist_sueldo_centavos,
      v_proyecto.dist_fijos_centavos, v_proyecto.dist_remanente_centavos
    ) = (
      p_fecha_cobro, p_cobrado_centavos, p_gastos_centavos, p_tope_sueldo_centavos,
      p_tope_fijos_centavos, p_diezmo_centavos, p_sueldo_centavos, p_fijos_centavos,
      p_remanente_centavos
    )
  then
    return v_proyecto;
  end if;

  if v_proyecto.deleted_at is not null then
    raise exception 'El proyecto está borrado' using errcode = 'MN002';
  end if;

  if v_proyecto.estado = 'cobrado' then
    raise exception 'El proyecto ya está cobrado' using errcode = 'MN001';
  end if;

  if v_proyecto.estado <> 'entregado' then
    raise exception 'Solo se cobra un proyecto entregado, y este está en %', v_proyecto.estado
      using errcode = 'MN007';
  end if;

  if v_proyecto.version <> p_version then
    raise exception 'El proyecto cambió desde que lo viste'
      using errcode = 'MN006',
            detail = format('versión vista %s, versión actual %s', p_version, v_proyecto.version);
  end if;

  select a.* into v_ajustes
  from public.ajustes a
  where a.household_id = v_proyecto.household_id;

  if not found then
    raise exception 'El household no tiene ajustes' using errcode = 'P0002';
  end if;

  -- Un proyecto reabierto se vuelve a cobrar con los topes y la fecha de su cobro original.
  v_tope_sueldo := coalesce(v_proyecto.reapertura_tope_sueldo_centavos, v_ajustes.sueldo_mensual_centavos);
  v_tope_fijos := coalesce(v_proyecto.reapertura_tope_fijos_centavos, v_ajustes.costos_fijos_centavos);
  v_fecha := coalesce(v_proyecto.reapertura_fecha_cobro, p_fecha_cobro);

  -- Recién ahora, con el proyecto bloqueado y en sentencias nuevas, se suman pagos y gastos.
  select coalesce(sum(g.monto_centavos), 0) into v_cobrado
  from public.pagos g
  where g.household_id = v_proyecto.household_id
    and g.proyecto_id = v_proyecto.id
    and g.deleted_at is null;

  select coalesce(sum(g.monto_centavos), 0) into v_gastos
  from public.gastos g
  where g.household_id = v_proyecto.household_id
    and g.proyecto_id = v_proyecto.id
    and g.deleted_at is null;

  -- Lo que se congela tiene que salir de lo que el usuario vio: si el total cobrado, el de gastos,
  -- los topes o la fecha cambiaron desde que la app calculó la distribución, se rechaza.
  if v_cobrado <> p_cobrado_centavos
    or v_gastos <> p_gastos_centavos
    or v_tope_sueldo <> p_tope_sueldo_centavos
    or v_tope_fijos <> p_tope_fijos_centavos
    or v_fecha <> p_fecha_cobro
  then
    raise exception 'Los pagos, los gastos, los topes o la fecha cambiaron desde que viste la distribución'
      using errcode = 'MN006',
            detail = format(
              'cobrado %s, gastos %s, tope de sueldo %s, tope de fijos %s, fecha %s',
              v_cobrado, v_gastos, v_tope_sueldo, v_tope_fijos, v_fecha
            );
  end if;

  select * into v_dist
  from private.cascada(v_cobrado, v_gastos, 1000, v_tope_sueldo, v_tope_fijos);

  -- Y la distribución que se le mostró tiene que ser la que calcula la base. Si no, la app y la
  -- base están aplicando reglas distintas (una versión vieja de la app, o un bug): mejor un
  -- rechazo visible que congelar otra cosa.
  if (v_dist.diezmo_centavos, v_dist.sueldo_centavos, v_dist.fijos_centavos, v_dist.remanente_centavos)
    is distinct from (p_diezmo_centavos, p_sueldo_centavos, p_fijos_centavos, p_remanente_centavos)
  then
    raise exception 'La distribución que viste no es la que calcula la base: actualizá la app'
      using errcode = 'MN008',
            detail = format(
              'diezmo %s, sueldo %s, fijos %s, remanente %s',
              v_dist.diezmo_centavos, v_dist.sueldo_centavos, v_dist.fijos_centavos, v_dist.remanente_centavos
            );
  end if;

  update public.proyectos set
    estado = 'cobrado',
    fecha_cobro = v_fecha,
    dist_cobrado_centavos = v_cobrado,
    dist_gastos_centavos = v_gastos,
    dist_diezmo_bp = 1000,
    dist_tope_sueldo_centavos = v_tope_sueldo,
    dist_tope_fijos_centavos = v_tope_fijos,
    dist_diezmo_centavos = v_dist.diezmo_centavos,
    dist_sueldo_centavos = v_dist.sueldo_centavos,
    dist_fijos_centavos = v_dist.fijos_centavos,
    dist_remanente_centavos = v_dist.remanente_centavos,
    reapertura_tope_sueldo_centavos = null,
    reapertura_tope_fijos_centavos = null,
    reapertura_fecha_cobro = null
  where id = v_proyecto.id
  returning * into v_proyecto;

  return v_proyecto;
end;
$$;

comment on function private.cobrar_proyecto(uuid, integer, date, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint) is
  'Cobra un proyecto entregado y congela su distribución. Rechaza con MN006 si la versión del proyecto, el total cobrado, el de gastos, los topes o la fecha no son los que vio el cliente, y con MN008 si la distribución que calculó la app no es la de la base. Reconoce el reenvío idéntico.';

revoke all on function private.cobrar_proyecto(uuid, integer, date, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint) from public;
grant execute on function private.cobrar_proyecto(uuid, integer, date, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint) to authenticated;


create function public.cobrar_proyecto(
  p_proyecto_id uuid,
  p_version integer,
  p_fecha_cobro date,
  p_cobrado_centavos bigint,
  p_gastos_centavos bigint,
  p_tope_sueldo_centavos bigint,
  p_tope_fijos_centavos bigint,
  p_diezmo_centavos bigint,
  p_sueldo_centavos bigint,
  p_fijos_centavos bigint,
  p_remanente_centavos bigint
)
returns public.proyectos
language sql
security invoker
set search_path = ''
as $$
  select *
  from private.cobrar_proyecto(
    p_proyecto_id, p_version, p_fecha_cobro, p_cobrado_centavos, p_gastos_centavos,
    p_tope_sueldo_centavos, p_tope_fijos_centavos, p_diezmo_centavos, p_sueldo_centavos,
    p_fijos_centavos, p_remanente_centavos
  )
$$;

comment on function public.cobrar_proyecto(uuid, integer, date, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint) is
  'RPC de cobro. La app manda la versión del proyecto, los totales, los topes, la fecha y la distribución que le mostró al usuario.';

revoke all on function public.cobrar_proyecto(uuid, integer, date, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint) from public, anon, authenticated;
grant execute on function public.cobrar_proyecto(uuid, integer, date, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint) to authenticated;


-- Reabrir -----------------------------------------------------------------------------------------

create function private.reabrir_proyecto(p_proyecto_id uuid, p_version integer)
returns public.proyectos
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_proyecto public.proyectos;
begin
  if num_nulls(p_proyecto_id, p_version) > 0 then
    raise exception 'reabrir_proyecto necesita todos sus parámetros' using errcode = '22004';
  end if;

  select p.* into v_proyecto
  from public.proyectos p
  where p.id = p_proyecto_id
    and p.household_id = any (array(select private.user_household_ids()))
  for update;

  if not found then
    raise exception 'El proyecto no existe o no es tuyo' using errcode = '42501';
  end if;

  -- El reenvío de la cola: esta misma reapertura ya se aplicó y la respuesta se perdió.
  if v_proyecto.estado = 'entregado'
    and v_proyecto.fecha_cobro is null
    and v_proyecto.reapertura_fecha_cobro is not null
    and v_proyecto.version = p_version + 1
  then
    return v_proyecto;
  end if;

  if v_proyecto.estado <> 'cobrado' then
    raise exception 'Solo se reabre un proyecto cobrado, y este está en %', v_proyecto.estado
      using errcode = 'MN007';
  end if;

  if v_proyecto.version <> p_version then
    raise exception 'El proyecto cambió desde que lo viste'
      using errcode = 'MN006',
            detail = format('versión vista %s, versión actual %s', p_version, v_proyecto.version);
  end if;

  update public.proyectos set
    estado = 'entregado',
    reapertura_tope_sueldo_centavos = dist_tope_sueldo_centavos,
    reapertura_tope_fijos_centavos = dist_tope_fijos_centavos,
    reapertura_fecha_cobro = fecha_cobro,
    fecha_cobro = null,
    dist_cobrado_centavos = null,
    dist_gastos_centavos = null,
    dist_diezmo_bp = null,
    dist_tope_sueldo_centavos = null,
    dist_tope_fijos_centavos = null,
    dist_diezmo_centavos = null,
    dist_sueldo_centavos = null,
    dist_fijos_centavos = null,
    dist_remanente_centavos = null
  where id = v_proyecto.id
  returning * into v_proyecto;

  return v_proyecto;
end;
$$;

comment on function private.reabrir_proyecto(uuid, integer) is
  'Reabre un proyecto cobrado: vuelve a entregado, descongela la distribución y guarda los topes y la fecha del cobro para el cobro siguiente. Rechaza con MN006 si el proyecto cambió. Reconoce el reenvío idéntico.';

revoke all on function private.reabrir_proyecto(uuid, integer) from public;
grant execute on function private.reabrir_proyecto(uuid, integer) to authenticated;


create function public.reabrir_proyecto(p_proyecto_id uuid, p_version integer)
returns public.proyectos
language sql
security invoker
set search_path = ''
as $$
  select * from private.reabrir_proyecto(p_proyecto_id, p_version)
$$;

comment on function public.reabrir_proyecto(uuid, integer) is
  'RPC de reapertura de un proyecto cobrado.';

revoke all on function public.reabrir_proyecto(uuid, integer) from public, anon, authenticated;
grant execute on function public.reabrir_proyecto(uuid, integer) to authenticated;
