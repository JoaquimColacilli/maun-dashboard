-- La fecha de la plata que entra es la del día en que pasó, no la del día en que se cargó (ADR 0063).
--
-- Tres cosas, todas aditivas:
--
-- 1. La base deja de aceptar un pago o una liquidación sin fecha, o con una fecha que todavía no
--    llegó. La fecha la manda la app con la mutación; la base no la inventa con now() ni con
--    current_date. Para saber qué es «futuro» usa el día de hoy en Argentina, donde está el taller.
-- 2. Volver a cobrar un cobro reabierto usa la fecha que se elige en ese momento, y conserva los
--    objetivos del cobro original. Antes la base imponía la fecha original y la app no podía
--    corregirla.
-- 3. Un pago o un reparto de antes de la apertura puede marcarse como «ya estaba en los saldos con
--    los que arrancó la app»: queda en el libro mayor con su fecha pero no mueve los tesoros. Las
--    columnas nacen en false para todas las filas que existen, que es lo que deja los saldos como
--    están.

-- El día de hoy en el taller ------------------------------------------------------------------------

create function private.hoy_en_el_taller()
returns date
language sql
stable
set search_path = ''
as $$
  select coalesce(
    nullif(current_setting('maun.hoy_en_el_taller', true), '')::date,
    (now() at time zone 'America/Argentina/Buenos_Aires')::date
  )
$$;

revoke all on function private.hoy_en_el_taller() from public, anon, authenticated;
grant execute on function private.hoy_en_el_taller() to authenticated;

comment on function private.hoy_en_el_taller() is
  'El día de hoy en Argentina, donde está el taller. Sirve solo para rechazar una fecha que todavía no llegó: la fecha de un pago o de un cobro la manda la app, nunca sale de acá. Los tests la fijan con el setting maun.hoy_en_el_taller, porque sus fechas son fijas y el calendario no.';

-- La apertura ----------------------------------------------------------------------------------------

create function private.fecha_de_apertura(p_household_id uuid)
returns date
language sql
stable
set search_path = ''
as $$
  select min(m.fecha)
  from public.movimientos m
  where m.household_id = p_household_id
    and m.tipo = 'ajuste'
    and m.categoria = 'Apertura'
    and m.deleted_at is null
$$;

revoke all on function private.fecha_de_apertura(uuid) from public, anon, authenticated;
grant execute on function private.fecha_de_apertura(uuid) to authenticated;

comment on function private.fecha_de_apertura(uuid) is
  'El día de la apertura del household: el primer ajuste con la categoría «Apertura», que es lo que escribe la migración del sistema viejo (ADR 0017). Null si el taller no vino de una migración. Gemela de fechaDeApertura de @maun/domain.';

-- Lo que ya estaba en los saldos de la apertura ------------------------------------------------------

alter table public.pagos add column ya_en_la_apertura boolean not null default false;

comment on column public.pagos.ya_en_la_apertura is
  'La plata de este pago ya estaba en los saldos con los que arrancó la app: es de antes de la apertura y el dueño dijo que ya la tenía contada. Queda en el trabajo y en el libro mayor con su fecha, pero no mueve los tesoros. Solo puede ser true con una fecha anterior a la apertura. Las filas que existían al agregar la columna quedaron en false, que es lo que deja los saldos como estaban (ADR 0063).';

grant insert (ya_en_la_apertura), update (ya_en_la_apertura) on public.pagos to authenticated;

alter table public.proyectos add column reparto_ya_en_la_apertura boolean not null default false;

comment on column public.proyectos.reparto_ya_en_la_apertura is
  'El reparto de la liquidación (el diezmo y el sueldo) ya estaba en los saldos con los que arrancó la app: queda en el libro mayor con la fecha del cobro pero no mueve los tesoros. Lo escribe private.liquidar y solo con una fecha anterior a la apertura. Reabrir un cobro lo conserva para que volver a cobrarlo proponga lo mismo; reactivar un perdido lo apaga (ADR 0063).';

-- La guarda de la fecha de un pago -------------------------------------------------------------------

create function private.validar_la_fecha_del_pago()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_apertura date;
begin
  -- En un upsert que choca contra una fila existente, este trigger corre antes de detectar el
  -- conflicto. Se deja pasar y decide el trigger de UPDATE, que ve la fila vieja.
  if tg_op = 'INSERT' then
    perform 1 from public.pagos where id = new.id;
    if found then
      return new;
    end if;
  end if;

  -- Una baja no se revisa: sacar un pago con una fecha rara tiene que poder hacerse siempre.
  if new.deleted_at is not null then
    return new;
  end if;

  if (tg_op = 'INSERT' or new.fecha is distinct from old.fecha)
    and new.fecha > private.hoy_en_el_taller()
  then
    raise exception 'La fecha del pago es de un día que todavía no llegó'
      using errcode = 'MN017',
            detail = format('fecha %s, hoy %s', new.fecha, private.hoy_en_el_taller()),
            hint = 'Poné el día en que te pagaron: hoy o antes.';
  end if;

  if new.ya_en_la_apertura
    and (tg_op = 'INSERT' or new.fecha is distinct from old.fecha or not old.ya_en_la_apertura)
  then
    v_apertura := private.fecha_de_apertura(new.household_id);
    if v_apertura is null or new.fecha >= v_apertura then
      raise exception 'Ese pago no es de antes de que empezaras con la app'
        using errcode = 'MN018',
              detail = format('fecha %s, apertura %s', new.fecha, coalesce(v_apertura::text, 'ninguna')),
              hint = 'Solo la plata de antes de la apertura puede estar en los saldos con los que arrancaste.';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.validar_la_fecha_del_pago() from public, anon, authenticated;

comment on function private.validar_la_fecha_del_pago() is
  'Guarda de la fecha de un pago: no acepta un día que todavía no llegó (MN017) y solo deja marcarlo como ya incluido en la apertura si es de antes de la apertura (MN018). La que falte la fecha la frena guardar_proyecto y el not null de la columna. Deja pasar las bajas.';

create trigger validar_la_fecha
  before insert or update on public.pagos
  for each row execute function private.validar_la_fecha_del_pago();

-- Liquidar: la fecha que manda la app, también al volver a cobrar ------------------------------------

drop function public.cobrar_proyecto(uuid, integer, date, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint);
drop function public.cerrar_perdido(uuid, integer, date, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, integer, bigint, bigint);
drop function private.liquidar(public.estado_proyecto, uuid, integer, date, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, integer, bigint, bigint);

create function private.liquidar(
  p_destino public.estado_proyecto,
  p_proyecto_id uuid,
  p_version integer,
  p_fecha date,
  p_cobrado_centavos bigint,
  p_gastos_centavos bigint,
  p_tope_sueldo_centavos bigint,
  p_tope_fijos_centavos bigint,
  p_diezmo_centavos bigint,
  p_sueldo_centavos bigint,
  p_fijos_centavos bigint,
  p_remanente_centavos bigint,
  p_diezmo_bp integer,
  p_sueldo_previo_centavos bigint default null,
  p_fijos_previo_centavos bigint default null,
  p_ya_en_la_apertura boolean default false
)
returns public.proyectos
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- DIEZMO de @maun/domain.
  c_diezmo_bp constant integer := 1000;
  v_proyecto public.proyectos;
  v_ajustes public.ajustes;
  v_fecha date;
  v_inicio_mes date;
  v_diezmo_bp integer;
  v_objetivo_sueldo bigint;
  v_objetivo_fijos bigint;
  v_sueldo_mensual boolean;
  v_sueldo_previo bigint;
  v_fijos_previo bigint;
  v_topes record;
  v_topes_vistos record;
  v_ajustada boolean := false;
  v_cobrado bigint;
  v_gastos bigint;
  v_dist record;
  v_dist_vista record;
  v_apertura date;
begin
  -- La fecha la manda la app, que es la que sabe qué día pasó. Sin fecha no se liquida: la base no
  -- la inventa.
  if p_fecha is null then
    raise exception 'La liquidación necesita su fecha'
      using errcode = 'MN016',
            hint = 'Poné el día del cobro, o del cierre si lo das por perdido.';
  end if;

  if num_nulls(
    p_destino, p_proyecto_id, p_version, p_cobrado_centavos, p_gastos_centavos,
    p_tope_sueldo_centavos, p_tope_fijos_centavos, p_diezmo_centavos, p_sueldo_centavos,
    p_fijos_centavos, p_remanente_centavos, p_ya_en_la_apertura
  ) > 0 then
    raise exception 'La liquidación necesita todos sus parámetros' using errcode = '22004';
  end if;

  -- El acumulado del mes son dos números o ninguno: con uno solo no se puede saber si la app vio
  -- lo mismo que la base.
  if num_nulls(p_sueldo_previo_centavos, p_fijos_previo_centavos) = 1 then
    raise exception 'El acumulado del mes va entero o no va' using errcode = '22004';
  end if;

  if p_destino not in ('cobrado', 'perdido') then
    raise exception 'Solo se liquida hacia cobrado o perdido' using errcode = '22023';
  end if;

  -- El diezmo de un perdido es un dato (ajustes.perdido_con_diezmo), no una regla: la app manda el
  -- que vio, y si cambió es MN006. En un cobro es la regla (DIEZMO) y no se manda: si cambia, MN008.
  if p_destino = 'perdido' and p_diezmo_bp is null then
    raise exception 'El cierre de un perdido necesita el diezmo que vio el usuario' using errcode = '22004';
  end if;

  -- Primer lock: el proyecto. La guarda de pagos y gastos toma for share sobre esta misma fila, así
  -- que un pago que llega en el mismo instante espera a que la liquidación termine (y entonces lo
  -- ve liquidado), o la liquidación espera a que el pago termine (y entonces lo suma).
  select p.* into v_proyecto
  from public.proyectos p
  where p.id = p_proyecto_id
    and p.household_id = any (array(select private.user_household_ids()))
  for update;

  if not found then
    raise exception 'El proyecto no existe o no es tuyo' using errcode = '42501';
  end if;

  -- El reenvío de la cola: esta misma liquidación ya se aplicó (la versión subió exactamente uno) y
  -- la respuesta se perdió. Se devuelve la fila tal cual, sin rechazar algo que salió bien. Va antes
  -- de mirar la fecha contra hoy: un reenvío que llega días después sigue siendo el mismo cobro.
  if v_proyecto.estado = p_destino
    and v_proyecto.version = p_version + 1
    and (
      v_proyecto.fecha_cobro, v_proyecto.dist_cobrado_centavos, v_proyecto.dist_gastos_centavos,
      v_proyecto.dist_tope_sueldo_centavos, v_proyecto.dist_tope_fijos_centavos,
      v_proyecto.dist_diezmo_centavos, v_proyecto.dist_sueldo_centavos,
      v_proyecto.dist_fijos_centavos, v_proyecto.dist_remanente_centavos,
      v_proyecto.reparto_ya_en_la_apertura
    ) = (
      p_fecha, p_cobrado_centavos, p_gastos_centavos, p_tope_sueldo_centavos,
      p_tope_fijos_centavos, p_diezmo_centavos, p_sueldo_centavos, p_fijos_centavos,
      p_remanente_centavos, p_ya_en_la_apertura
    )
    and (p_diezmo_bp is null or v_proyecto.dist_diezmo_bp = p_diezmo_bp)
  then
    return v_proyecto;
  end if;

  -- El reenvío de una liquidación que salió ajustada. Los topes y los cuatro escalones congelados no
  -- son los que mandó la app —ese es justamente el ajuste—, así que el reenvío se reconoce por las
  -- entradas que la app sí controla. La última condición es la guarda: esta rama solo vale cuando el
  -- acumulado que vio la app no es el que quedó congelado, que es la definición de ajustada. Sin
  -- esto, un cobro ajustado cuya respuesta se perdió rebotaría con MN001 al reintentarlo.
  if p_sueldo_previo_centavos is not null
    and v_proyecto.estado = p_destino
    and v_proyecto.version = p_version + 1
    and (
      v_proyecto.fecha_cobro, v_proyecto.dist_cobrado_centavos, v_proyecto.dist_gastos_centavos,
      v_proyecto.reparto_ya_en_la_apertura
    ) = (
      p_fecha, p_cobrado_centavos, p_gastos_centavos, p_ya_en_la_apertura
    )
    and (p_diezmo_bp is null or v_proyecto.dist_diezmo_bp = p_diezmo_bp)
    and (v_proyecto.dist_sueldo_previo_centavos, v_proyecto.dist_fijos_previo_centavos)
      is distinct from (p_sueldo_previo_centavos, p_fijos_previo_centavos)
  then
    return v_proyecto;
  end if;

  if p_fecha > private.hoy_en_el_taller() then
    raise exception 'La fecha es de un día que todavía no llegó'
      using errcode = 'MN017',
            detail = format('fecha %s, hoy %s', p_fecha, private.hoy_en_el_taller()),
            hint = 'Poné el día en que pasó: hoy o antes.';
  end if;

  if v_proyecto.deleted_at is not null then
    raise exception 'El proyecto está borrado' using errcode = 'MN002';
  end if;

  if v_proyecto.estado in ('cobrado', 'perdido') then
    raise exception 'El proyecto ya está %', v_proyecto.estado using errcode = 'MN001';
  end if;

  if not private.liquidacion_valida(v_proyecto.estado, p_destino) then
    raise exception '%', case p_destino
        when 'cobrado' then format('Solo se cobra un proyecto entregado, y este está en %s', v_proyecto.estado)
        else 'Lo entregado no se da por perdido: se cobra'
      end
      using errcode = 'MN007';
  end if;

  if v_proyecto.version <> p_version then
    raise exception 'El proyecto cambió desde que lo viste'
      using errcode = 'MN006',
            detail = format('versión vista %s, versión actual %s', p_version, v_proyecto.version);
  end if;

  -- Un reparto que ya estaba en los saldos de arranque tiene que ser de antes de la apertura. Si no,
  -- esa plata desaparecería de los tesoros sin que nadie la haya contado.
  if p_ya_en_la_apertura then
    v_apertura := private.fecha_de_apertura(v_proyecto.household_id);
    if v_apertura is null or p_fecha >= v_apertura then
      raise exception 'Ese cobro no es de antes de que empezaras con la app'
        using errcode = 'MN018',
              detail = format('fecha %s, apertura %s', p_fecha, coalesce(v_apertura::text, 'ninguna')),
              hint = 'Solo la plata de antes de la apertura puede estar en los saldos con los que arrancaste.';
    end if;
  end if;

  -- Segundo lock: la fila de ajustes del household. Toda liquidación y toda reversión la toman, así
  -- que dos liquidaciones del mismo household se serializan y la segunda suma el mes después de
  -- que la primera commiteó. for no key update: choca con otra liquidación y con una edición de
  -- los ajustes, no con las foreign keys. Es por household, más grueso que por mes (ADR 0011).
  select a.* into v_ajustes
  from public.ajustes a
  where a.household_id = v_proyecto.household_id
  for no key update;

  if not found then
    raise exception 'El household no tiene ajustes' using errcode = 'P0002';
  end if;

  -- Con qué fecha, diezmo y objetivos se liquida. Gemela de planDeLiquidacion. La fecha es siempre
  -- la que manda la app (ADR 0063): en un cobro reabierto la app propone la del original, y el
  -- dueño la puede corregir.
  v_fecha := p_fecha;
  if p_destino = 'perdido' then
    -- Un cierre como perdido es un evento nuevo: no usa la foto de una reapertura. El sueldo del
    -- perdido es un objetivo en cero cuando perdido_con_sueldo está apagado, no otra cascada.
    v_diezmo_bp := case when v_ajustes.perdido_con_diezmo then c_diezmo_bp else 0 end;
    v_objetivo_sueldo := case when v_ajustes.perdido_con_sueldo then v_ajustes.sueldo_mensual_centavos else 0 end;
    v_objetivo_fijos := v_ajustes.costos_fijos_centavos;
    v_sueldo_mensual := v_ajustes.sueldo_tope_mensual;
  elsif v_proyecto.reapertura_fecha_cobro is not null then
    -- Un cobro reabierto se vuelve a cobrar con los objetivos del original: corregir un gasto no
    -- reescribe el sueldo con los ajustes de hoy (ADR 0003).
    v_diezmo_bp := c_diezmo_bp;
    v_objetivo_sueldo := v_proyecto.reapertura_objetivo_sueldo_centavos;
    v_objetivo_fijos := v_proyecto.reapertura_objetivo_fijos_centavos;
    v_sueldo_mensual := v_proyecto.reapertura_sueldo_mensual;
  else
    v_diezmo_bp := c_diezmo_bp;
    v_objetivo_sueldo := v_ajustes.sueldo_mensual_centavos;
    v_objetivo_fijos := v_ajustes.costos_fijos_centavos;
    v_sueldo_mensual := v_ajustes.sueldo_tope_mensual;
  end if;

  -- Lo que el mes ya lleva liquidado por otros proyectos, en una sentencia posterior al lock de
  -- ajustes. Gemela de liquidadoDelMes. No se guarda en ningún lado: reabrir un proyecto lo saca
  -- de esta suma por el solo hecho de descongelarlo.
  v_inicio_mes := make_date(extract(year from v_fecha)::integer, extract(month from v_fecha)::integer, 1);

  select coalesce(sum(p.dist_sueldo_centavos), 0), coalesce(sum(p.dist_fijos_centavos), 0)
  into v_sueldo_previo, v_fijos_previo
  from public.proyectos p
  where p.household_id = v_proyecto.household_id
    and p.fecha_cobro >= v_inicio_mes
    and p.fecha_cobro < (v_inicio_mes + interval '1 month')::date
    and p.deleted_at is null
    and p.id <> v_proyecto.id;

  select * into v_topes
  from private.topes_de_la_liquidacion(
    v_objetivo_sueldo, v_objetivo_fijos, v_sueldo_mensual, v_sueldo_previo, v_fijos_previo
  );

  -- La liquidación sale ajustada cuando la app mandó el acumulado del mes y no es el de la base.
  -- Es lo único que la app no podía conocer: otra liquidación del mismo mes hecha en otro
  -- dispositivo, o una reapertura que todavía no replicó.
  v_ajustada := p_sueldo_previo_centavos is not null
    and (p_sueldo_previo_centavos, p_fijos_previo_centavos)
      is distinct from (v_sueldo_previo, v_fijos_previo);

  if v_ajustada then
    select * into v_topes_vistos
    from private.topes_de_la_liquidacion(
      v_objetivo_sueldo, v_objetivo_fijos, v_sueldo_mensual,
      p_sueldo_previo_centavos, p_fijos_previo_centavos
    );
  else
    v_topes_vistos := v_topes;
  end if;

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

  -- Lo que se congela tiene que salir de lo que el usuario vio. Un tope distinto quiere decir que
  -- la app no veía otra liquidación del mes (o una reapertura), o que cambiaron los ajustes. Con el
  -- acumulado a la vista eso deja de ser una adivinanza: si el acumulado coincide, un tope distinto
  -- solo puede venir de los objetivos, y sigue siendo MN006.
  if v_cobrado <> p_cobrado_centavos
    or v_gastos <> p_gastos_centavos
    or v_diezmo_bp <> coalesce(p_diezmo_bp, v_diezmo_bp)
    or (
      not v_ajustada
      and (
        v_topes.tope_sueldo_centavos <> p_tope_sueldo_centavos
        or v_topes.tope_fijos_centavos <> p_tope_fijos_centavos
      )
    )
  then
    raise exception 'Los pagos, los gastos, los topes o el diezmo cambiaron desde que viste la distribución'
      using errcode = 'MN006',
            detail = format(
              'cobrado %s, gastos %s, tope de sueldo %s, tope de fijos %s, diezmo %s bp, fecha %s; el mes ya llevaba %s de sueldo y %s de fijos',
              v_cobrado, v_gastos, v_topes.tope_sueldo_centavos, v_topes.tope_fijos_centavos, v_diezmo_bp,
              v_fecha, v_sueldo_previo, v_fijos_previo
            );
  end if;

  -- Una liquidación ajustada no afloja el MN008: la app tiene que haber aplicado bien la regla de
  -- los topes contra su propio acumulado. Si ni eso cierra, no es que vio otro mes: es que está
  -- calculando distinto. Va antes de la cascada porque un tope negativo la cortaría con un 22023.
  if v_ajustada
    and (
      v_topes_vistos.tope_sueldo_centavos <> p_tope_sueldo_centavos
      or v_topes_vistos.tope_fijos_centavos <> p_tope_fijos_centavos
    )
  then
    raise exception 'Los topes que viste no son los que salen de ese acumulado: actualizá la app'
      using errcode = 'MN008',
            detail = format(
              'con el mes en %s de sueldo y %s de fijos, los topes son %s y %s',
              p_sueldo_previo_centavos, p_fijos_previo_centavos,
              v_topes_vistos.tope_sueldo_centavos, v_topes_vistos.tope_fijos_centavos
            );
  end if;

  -- Y la distribución que se le mostró tiene que ser la que calcula la base con las entradas que la
  -- app tenía. Si no, la app y la base están aplicando reglas distintas (una versión vieja de la
  -- app, o un bug): mejor un rechazo visible que congelar otra cosa.
  select * into v_dist_vista
  from private.cascada(v_cobrado, v_gastos, v_diezmo_bp, p_tope_sueldo_centavos, p_tope_fijos_centavos);

  if (v_dist_vista.diezmo_centavos, v_dist_vista.sueldo_centavos, v_dist_vista.fijos_centavos, v_dist_vista.remanente_centavos)
    is distinct from (p_diezmo_centavos, p_sueldo_centavos, p_fijos_centavos, p_remanente_centavos)
  then
    raise exception 'La distribución que viste no es la que calcula la base: actualizá la app'
      using errcode = 'MN008',
            detail = format(
              'diezmo %s, sueldo %s, fijos %s, remanente %s',
              v_dist_vista.diezmo_centavos, v_dist_vista.sueldo_centavos,
              v_dist_vista.fijos_centavos, v_dist_vista.remanente_centavos
            );
  end if;

  -- Recién acá se congela con el acumulado de la base. Cuando no hubo ajuste, es exactamente la
  -- misma cuenta que acaba de pasar el MN008.
  if v_ajustada then
    select * into v_dist
    from private.cascada(v_cobrado, v_gastos, v_diezmo_bp, v_topes.tope_sueldo_centavos, v_topes.tope_fijos_centavos);
  else
    v_dist := v_dist_vista;
  end if;

  update public.proyectos set
    estado = p_destino,
    fecha_cobro = v_fecha,
    dist_cobrado_centavos = v_cobrado,
    dist_gastos_centavos = v_gastos,
    dist_diezmo_bp = v_diezmo_bp,
    dist_tope_sueldo_centavos = v_topes.tope_sueldo_centavos,
    dist_tope_fijos_centavos = v_topes.tope_fijos_centavos,
    dist_diezmo_centavos = v_dist.diezmo_centavos,
    dist_sueldo_centavos = v_dist.sueldo_centavos,
    dist_fijos_centavos = v_dist.fijos_centavos,
    dist_remanente_centavos = v_dist.remanente_centavos,
    dist_objetivo_sueldo_centavos = v_objetivo_sueldo,
    dist_objetivo_fijos_centavos = v_objetivo_fijos,
    dist_sueldo_mensual = v_sueldo_mensual,
    dist_sueldo_previo_centavos = v_sueldo_previo,
    dist_fijos_previo_centavos = v_fijos_previo,
    dist_liquidado_at = clock_timestamp(),
    reparto_ya_en_la_apertura = p_ya_en_la_apertura,
    reapertura_objetivo_sueldo_centavos = null,
    reapertura_objetivo_fijos_centavos = null,
    reapertura_sueldo_mensual = null,
    reapertura_fecha_cobro = null
  where id = v_proyecto.id
  returning * into v_proyecto;

  return v_proyecto;
end;
$$;

revoke all on function private.liquidar(public.estado_proyecto, uuid, integer, date, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, integer, bigint, bigint, boolean) from public, anon, authenticated;
grant execute on function private.liquidar(public.estado_proyecto, uuid, integer, date, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, integer, bigint, bigint, boolean) to authenticated;

comment on function private.liquidar(public.estado_proyecto, uuid, integer, date, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, integer, bigint, bigint, boolean) is
  'Liquida un proyecto hacia cobrado o perdido y congela su distribución con la fecha que manda la app, también al volver a cobrar un reabierto (ADR 0063). Rechaza sin fecha (MN016), con una fecha que todavía no llegó (MN017) y un reparto marcado como ya incluido en la apertura con una fecha que no es anterior a ella (MN018). Bloquea el proyecto y después los ajustes, suma lo liquidado en el mes, y rechaza con MN006 si la versión, los totales o el diezmo no son los que vio el cliente, y con MN008 si la distribución no es la de la base. Si el cliente manda el acumulado del mes que vio y no es el de la base, recalcula los topes con el suyo y congela eso en vez de rechazar: el MN008 se sigue exigiendo contra lo que el cliente vio. Reconoce el reenvío, ajustado o no.';

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
  p_remanente_centavos bigint,
  p_sueldo_previo_centavos bigint default null,
  p_fijos_previo_centavos bigint default null,
  p_ya_en_la_apertura boolean default false
)
returns public.proyectos
language sql
set search_path = ''
as $$
  select *
  from private.liquidar(
    'cobrado', p_proyecto_id, p_version, p_fecha_cobro, p_cobrado_centavos, p_gastos_centavos,
    p_tope_sueldo_centavos, p_tope_fijos_centavos, p_diezmo_centavos, p_sueldo_centavos,
    p_fijos_centavos, p_remanente_centavos, null,
    p_sueldo_previo_centavos, p_fijos_previo_centavos, p_ya_en_la_apertura
  )
$$;

revoke all on function public.cobrar_proyecto(uuid, integer, date, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, boolean) from public, anon, authenticated;
grant execute on function public.cobrar_proyecto(uuid, integer, date, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, boolean) to authenticated;

comment on function public.cobrar_proyecto(uuid, integer, date, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, boolean) is
  'RPC de cobro de un proyecto entregado. La app manda la versión del proyecto, los totales, los topes, la fecha del cobro (la del último pago por defecto, o la del cobro original si fue reabierto), la distribución que le mostró al usuario, el acumulado del mes que vio y si ese reparto ya estaba en los saldos de la apertura. Si el acumulado no es el de la base, la liquidación se congela con el de la base y la app lo ve comparando dist_sueldo_previo_centavos contra lo que mandó.';

create function public.cerrar_perdido(
  p_proyecto_id uuid,
  p_version integer,
  p_fecha date,
  p_cobrado_centavos bigint,
  p_gastos_centavos bigint,
  p_tope_sueldo_centavos bigint,
  p_tope_fijos_centavos bigint,
  p_diezmo_centavos bigint,
  p_sueldo_centavos bigint,
  p_fijos_centavos bigint,
  p_remanente_centavos bigint,
  p_diezmo_bp integer,
  p_sueldo_previo_centavos bigint default null,
  p_fijos_previo_centavos bigint default null,
  p_ya_en_la_apertura boolean default false
)
returns public.proyectos
language sql
set search_path = ''
as $$
  select *
  from private.liquidar(
    'perdido', p_proyecto_id, p_version, p_fecha, p_cobrado_centavos, p_gastos_centavos,
    p_tope_sueldo_centavos, p_tope_fijos_centavos, p_diezmo_centavos, p_sueldo_centavos,
    p_fijos_centavos, p_remanente_centavos, p_diezmo_bp,
    p_sueldo_previo_centavos, p_fijos_previo_centavos, p_ya_en_la_apertura
  )
$$;

revoke all on function public.cerrar_perdido(uuid, integer, date, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, integer, bigint, bigint, boolean) from public, anon, authenticated;
grant execute on function public.cerrar_perdido(uuid, integer, date, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, integer, bigint, bigint, boolean) to authenticated;

comment on function public.cerrar_perdido(uuid, integer, date, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, integer, bigint, bigint, boolean) is
  'RPC de cierre como perdido de un lead o de una obra que se cayó. Liquida la seña retenida con la misma cascada que un cobro, con la fecha del cierre que manda la app. Los mismos parámetros que cobrar_proyecto, más el diezmo que vio el usuario: en un perdido es un dato de los ajustes, no una regla.';

-- Revertir: reabrir conserva la marca de la apertura, reactivar la apaga -----------------------------

create or replace function private.revertir_liquidacion(
  p_proyecto_id uuid,
  p_version integer,
  p_desde public.estado_proyecto,
  p_hacia public.estado_proyecto
)
returns public.proyectos
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_proyecto public.proyectos;
begin
  if num_nulls(p_proyecto_id, p_version, p_desde, p_hacia) > 0 then
    raise exception 'La reversión necesita todos sus parámetros' using errcode = '22004';
  end if;

  select p.* into v_proyecto
  from public.proyectos p
  where p.id = p_proyecto_id
    and p.household_id = any (array(select private.user_household_ids()))
  for update;

  if not found then
    raise exception 'El proyecto no existe o no es tuyo' using errcode = '42501';
  end if;

  -- El reenvío de la cola: esta misma reversión ya se aplicó y la respuesta se perdió. Reabrir un
  -- cobro deja la foto de la reapertura; reactivar un perdido no deja ninguna.
  if v_proyecto.estado = p_hacia
    and v_proyecto.fecha_cobro is null
    and v_proyecto.version = p_version + 1
    and (p_desde = 'cobrado') = (v_proyecto.reapertura_fecha_cobro is not null)
  then
    return v_proyecto;
  end if;

  if v_proyecto.deleted_at is not null then
    raise exception 'El proyecto está borrado' using errcode = 'MN002';
  end if;

  if v_proyecto.estado <> p_desde or not private.reversion_valida(p_desde, p_hacia) then
    raise exception '%', case p_desde
        when 'cobrado' then format('Solo se reabre un proyecto cobrado, y este está en %s', v_proyecto.estado)
        else format('Solo se reactiva un perdido, a un estado de seguimiento: este está en %s y el destino es %s', v_proyecto.estado, p_hacia)
      end
      using errcode = 'MN007';
  end if;

  if v_proyecto.version <> p_version then
    raise exception 'El proyecto cambió desde que lo viste'
      using errcode = 'MN006',
            detail = format('versión vista %s, versión actual %s', p_version, v_proyecto.version);
  end if;

  -- El mismo segundo lock que la liquidación: una liquidación del mismo mes que corre en paralelo
  -- ve el mes con este proyecto adentro o afuera, nunca a medias.
  perform 1
  from public.ajustes a
  where a.household_id = v_proyecto.household_id
  for no key update;

  -- Reabrir un cobro guarda la fecha, los objetivos y el modo del original para el cobro
  -- siguiente (ADR 0003), y conserva si su reparto ya estaba en la apertura: volver a cobrarlo
  -- propone lo mismo. Reactivar un perdido no guarda nada: un lead que revive es un lead vivo otra
  -- vez, y un cierre posterior es un evento nuevo con su fecha.
  update public.proyectos set
    estado = p_hacia,
    reapertura_objetivo_sueldo_centavos = case when p_desde = 'cobrado' then dist_objetivo_sueldo_centavos end,
    reapertura_objetivo_fijos_centavos = case when p_desde = 'cobrado' then dist_objetivo_fijos_centavos end,
    reapertura_sueldo_mensual = case when p_desde = 'cobrado' then dist_sueldo_mensual end,
    reapertura_fecha_cobro = case when p_desde = 'cobrado' then fecha_cobro end,
    reparto_ya_en_la_apertura = case when p_desde = 'cobrado' then reparto_ya_en_la_apertura else false end,
    fecha_cobro = null,
    dist_cobrado_centavos = null,
    dist_gastos_centavos = null,
    dist_diezmo_bp = null,
    dist_tope_sueldo_centavos = null,
    dist_tope_fijos_centavos = null,
    dist_diezmo_centavos = null,
    dist_sueldo_centavos = null,
    dist_fijos_centavos = null,
    dist_remanente_centavos = null,
    dist_objetivo_sueldo_centavos = null,
    dist_objetivo_fijos_centavos = null,
    dist_sueldo_mensual = null,
    dist_sueldo_previo_centavos = null,
    dist_fijos_previo_centavos = null,
    dist_liquidado_at = null
  where id = v_proyecto.id
  returning * into v_proyecto;

  return v_proyecto;
end;
$$;

comment on column public.proyectos.reapertura_fecha_cobro is
  'Fecha del cobro que se reabrió. Volver a cobrarlo la propone por defecto, y el dueño la puede corregir: la fecha la manda la app (ADR 0063).';

-- guardar_proyecto: la fecha de un pago no se inventa, y la marca de la apertura viaja --------------

create or replace function public.guardar_proyecto(
  p_proyecto jsonb,
  p_pagos jsonb,
  p_gastos jsonb,
  p_opciones jsonb default null,
  p_necesidades jsonb default null
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_p record;
  v_actual public.proyectos;
  v_fila public.proyectos;
  v_existia boolean;
  v_sin_cambios boolean;
  v_vencimiento date;
  v_visita_hecha boolean;
  v_sena_bp integer;
  v_entrega_hora time;
  v_visita_hora time;
  v_household_id uuid;
  v_cuantas integer;
  v_aprobadas integer;
  v_monto_aprobado bigint;
  v_presupuesto bigint;
begin
  if p_proyecto is null or jsonb_typeof(p_proyecto) <> 'object' then
    raise exception 'El proyecto va en un objeto jsonb' using errcode = '22023';
  end if;

  if jsonb_typeof(coalesce(p_pagos, 'null'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_gastos, 'null'::jsonb)) <> 'array'
  then
    raise exception 'Los pagos y los gastos van en arrays jsonb' using errcode = '22023';
  end if;

  if p_opciones is not null and jsonb_typeof(p_opciones) <> 'array' then
    raise exception 'Las opciones de presupuesto van en un array jsonb' using errcode = '22023';
  end if;

  if p_necesidades is not null and jsonb_typeof(p_necesidades) <> 'array' then
    raise exception 'Lo que hace falta va en un array jsonb' using errcode = '22023';
  end if;

  -- Las horas se leen como texto por la misma razón que las fechas: un <input type="time"> vacío
  -- manda "" y un cast directo cortaría la llamada entera con 22007, un rechazo definitivo sin
  -- mensaje que tapa la cola (ADR 0015).
  select * into v_p from jsonb_to_record(p_proyecto) as x (
    id uuid,
    version integer,
    cliente_id uuid,
    titulo text,
    descripcion text,
    estado public.estado_proyecto,
    presupuesto_centavos bigint,
    forma_pago public.forma_pago,
    comprobante public.comprobante,
    fecha_visita date,
    ultimo_contacto date,
    fecha_inicio date,
    entrega_estimada date,
    fecha_entrega date,
    direccion_entrega text,
    notas text,
    vencimiento_presupuesto text,
    visita_hecha boolean,
    sena_bp integer,
    entrega_hora text,
    visita_hora text
  );

  if v_p.id is null or v_p.cliente_id is null or v_p.titulo is null or v_p.estado is null then
    raise exception 'El proyecto necesita id, cliente, título y estado' using errcode = '22004';
  end if;

  -- Una fila hija sin id o sin monto rebotaría contra un not null con un 23502 genérico, que no es
  -- un mensaje para el usuario y que tapa la cola igual que cualquier otro rechazo definitivo.
  if exists (
    select 1
    from jsonb_to_recordset(p_pagos) as r (id uuid, monto_centavos bigint, borrado boolean)
    where r.id is null
       or (not coalesce(r.borrado, false) and r.monto_centavos is null)
  ) then
    raise exception 'Cada pago necesita id y monto' using errcode = '22004';
  end if;

  -- La fecha de un pago es el día en que entró la plata, y la sabe la app. Sin ella, o con algo que
  -- no es un día, no se guarda: la base no la inventa (ADR 0063). Se lee como texto por lo mismo
  -- que las horas, y se revisa la forma antes de castear para no cortar con un 22007 sin mensaje.
  if exists (
    select 1
    from jsonb_to_recordset(p_pagos) as r (fecha text, borrado boolean)
    where not coalesce(r.borrado, false)
      and coalesce(r.fecha, '') !~ '^\d{4}-\d{2}-\d{2}$'
  ) then
    raise exception 'Cada pago necesita su fecha'
      using errcode = 'MN016',
            hint = 'Poné el día en que te pagaron.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_gastos) as r (id uuid, fecha text, monto_centavos bigint, borrado boolean)
    where r.id is null
       or (not coalesce(r.borrado, false) and (nullif(r.fecha, '') is null or r.monto_centavos is null))
  ) then
    raise exception 'Cada gasto necesita id, fecha y monto' using errcode = '22004';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_opciones, '[]'::jsonb))
      as r (id uuid, monto_centavos bigint, borrado boolean)
    where r.id is null
       or (not coalesce(r.borrado, false) and r.monto_centavos is null)
  ) then
    raise exception 'Cada opción de presupuesto necesita id y monto' using errcode = '22004';
  end if;

  -- El tipo se lee como texto y se valida contra los valores del enum: castearlo de una cortaría con
  -- un 22P02 crudo, que es definitivo y no tiene traducción. Contra el enum y no contra una lista
  -- escrita acá, para que un tipo nuevo no obligue a reescribir la función (ADR 0060).
  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_necesidades, '[]'::jsonb))
      as r (id uuid, tipo text, nombre text, borrado boolean)
    where r.id is null
       or (
         not coalesce(r.borrado, false)
         and (
           coalesce(r.tipo, '') <> all (enum_range(null::public.tipo_de_necesidad)::text[])
           or btrim(coalesce(r.nombre, '')) = ''
         )
       )
  ) then
    raise exception 'Cada material, herraje o herramienta necesita id, tipo y nombre'
      using errcode = '22004';
  end if;

  -- Primer lock: el proyecto, con for update, la misma disciplina que private.liquidar. La guarda
  -- de pagos y gastos toma for share sobre esta misma fila, así que un cobro que llega en el mismo
  -- instante se serializa con este guardado: o la liquidación espera y suma los pagos nuevos, o
  -- este guardado espera y ve el proyecto ya liquidado, y entonces la guarda lo rechaza con MN001.
  select * into v_actual from public.proyectos p where p.id = v_p.id for update;
  v_existia := found;

  v_vencimiento := case
    when p_proyecto ? 'vencimiento_presupuesto' then nullif(v_p.vencimiento_presupuesto, '')::date
    else v_actual.vencimiento_presupuesto
  end;

  v_visita_hecha := case
    when p_proyecto ? 'visita_hecha' then coalesce(v_p.visita_hecha, false)
    else coalesce(v_actual.visita_hecha, false)
  end;

  -- Como el vencimiento: un bundle viejo que no manda la clave no borra la seña propia del trabajo.
  v_sena_bp := case
    when p_proyecto ? 'sena_bp' then v_p.sena_bp
    else v_actual.sena_bp
  end;

  v_entrega_hora := case
    when p_proyecto ? 'entrega_hora' then nullif(v_p.entrega_hora, '')::time
    else v_actual.entrega_hora
  end;

  v_visita_hora := case
    when p_proyecto ? 'visita_hora' then nullif(v_p.visita_hora, '')::time
    else v_actual.visita_hora
  end;

  v_household_id := coalesce(v_actual.household_id, private.household_actual());

  -- El presupuesto que va a quedar, calculado ANTES de escribir el proyecto y sobre el conjunto de
  -- opciones que va a quedar: las que ya están, más las que vienen, menos las que vienen marcadas de
  -- baja. Si se escribiera después habría que corregir el proyecto con un update más, y ese update
  -- subiría la version una segunda vez: el cliente mandaría la versión vieja en el guardado siguiente
  -- y rebotaría con MN006.
  with entrantes as (
    select r.id, r.monto_centavos, coalesce(r.aprobada, false) as aprobada,
           coalesce(r.borrado, false) as borrado
    from jsonb_to_recordset(coalesce(p_opciones, '[]'::jsonb))
      as r (id uuid, monto_centavos bigint, aprobada boolean, borrado boolean)
  ),
  existentes as (
    select o.id, o.monto_centavos, o.aprobada
    from public.opciones_de_presupuesto o
    where o.household_id = v_household_id
      and o.proyecto_id = v_p.id
      and o.deleted_at is null
  ),
  quedan as (
    select coalesce(e.monto_centavos, x.monto_centavos) as monto_centavos,
           coalesce(e.aprobada, x.aprobada) as aprobada
    from existentes x
    full outer join entrantes e on e.id = x.id
    where not coalesce(e.borrado, false)
  )
  select count(*)::integer,
         count(*) filter (where aprobada)::integer,
         min(monto_centavos) filter (where aprobada)
  into v_cuantas, v_aprobadas, v_monto_aprobado
  from quedan;

  if v_aprobadas > 1 then
    raise exception 'Solo se puede tildar una opción del presupuesto'
      using errcode = 'MN009',
            hint = 'Destildá la que no va y dejá tildada la que te aprobaron.';
  end if;

  -- Con opciones, el presupuesto no se elige: sale de la aprobada, y no hay ninguna mientras el
  -- cliente no eligió. Sin opciones, es el campo que manda el usuario, como siempre.
  v_presupuesto := case
    when v_cuantas > 0 then (case when v_aprobadas > 0 then v_monto_aprobado else null end)
    else v_p.presupuesto_centavos
  end;

  if v_existia then
    if v_actual.deleted_at is not null then
      raise exception 'El proyecto está borrado' using errcode = 'MN002';
    end if;

    v_sin_cambios := (
      v_actual.cliente_id, v_actual.titulo, v_actual.descripcion, v_actual.estado,
      v_actual.presupuesto_centavos, v_actual.forma_pago, v_actual.comprobante,
      v_actual.fecha_visita, v_actual.ultimo_contacto, v_actual.fecha_inicio,
      v_actual.entrega_estimada, v_actual.fecha_entrega, v_actual.direccion_entrega, v_actual.notas,
      v_actual.vencimiento_presupuesto, v_actual.visita_hecha, v_actual.sena_bp,
      v_actual.entrega_hora, v_actual.visita_hora
    ) is not distinct from (
      v_p.cliente_id, v_p.titulo, coalesce(v_p.descripcion, ''), v_p.estado,
      v_presupuesto, v_p.forma_pago, v_p.comprobante,
      v_p.fecha_visita, v_p.ultimo_contacto, v_p.fecha_inicio,
      v_p.entrega_estimada, v_p.fecha_entrega, coalesce(v_p.direccion_entrega, ''),
      coalesce(v_p.notas, ''), v_vencimiento, v_visita_hecha, v_sena_bp,
      v_entrega_hora, v_visita_hora
    );

    -- Un guardado hecho sin señal sobre una versión vieja no pisa en silencio lo que hay. La
    -- excepción es el reenvío de la cola: este mismo guardado ya se aplicó (la versión subió
    -- exactamente uno y la fila quedó igual a lo que se manda) y la respuesta se perdió. Reaplicar
    -- entonces no hace nada, porque el update de abajo y las bajas ya son no-op.
    if v_p.version is not null
      and v_actual.version <> v_p.version
      and not (v_sin_cambios and v_actual.version = v_p.version + 1)
    then
      raise exception 'El proyecto cambió desde que lo abriste'
        using errcode = 'MN006',
              detail = format('versión vista %s, versión actual %s', v_p.version, v_actual.version),
              hint = 'Abrilo de nuevo para ver lo que hay ahora y volvé a cargar lo que te falte.';
    end if;
  end if;

  -- Alta y edición se escriben por separado, no con un upsert. En un `insert ... on conflict do
  -- update`, Postgres evalúa los check de la tabla sobre la fila propuesta antes de resolver el
  -- conflicto: guardar las notas de un proyecto cobrado proponía una fila con estado cobrado y la
  -- distribución en null, y eso choca contra proyectos_liquidado_con_distribucion. El reenvío del
  -- alta cae igual en la rama de edición, porque el select de arriba ya encontró la fila.
  --
  -- La edición manda la fila entera y no solo las columnas que cambiaron, al revés que el resto de
  -- las mutaciones (ADR 0010): acá el chequeo de versión es la garantía más fuerte, porque si el
  -- servidor cambió algo el guardado se rechaza en vez de pisarlo en silencio. Los cuatro costos
  -- estimados quedan afuera a propósito: van por su propio update, como las marcas de la agenda.
  if v_existia then
    update public.proyectos set
      cliente_id = v_p.cliente_id,
      titulo = v_p.titulo,
      descripcion = coalesce(v_p.descripcion, ''),
      estado = v_p.estado,
      presupuesto_centavos = v_presupuesto,
      forma_pago = v_p.forma_pago,
      comprobante = v_p.comprobante,
      fecha_visita = v_p.fecha_visita,
      ultimo_contacto = v_p.ultimo_contacto,
      fecha_inicio = v_p.fecha_inicio,
      entrega_estimada = v_p.entrega_estimada,
      fecha_entrega = v_p.fecha_entrega,
      direccion_entrega = coalesce(v_p.direccion_entrega, ''),
      notas = coalesce(v_p.notas, ''),
      vencimiento_presupuesto = v_vencimiento,
      visita_hecha = v_visita_hecha,
      sena_bp = v_sena_bp,
      entrega_hora = v_entrega_hora,
      visita_hora = v_visita_hora
    where id = v_p.id
    returning * into v_fila;
  else
    begin
      insert into public.proyectos (
        id, cliente_id, titulo, descripcion, estado, presupuesto_centavos, forma_pago, comprobante,
        fecha_visita, ultimo_contacto, fecha_inicio, entrega_estimada, fecha_entrega,
        direccion_entrega, notas, vencimiento_presupuesto, visita_hecha, sena_bp,
        entrega_hora, visita_hora
      ) values (
        v_p.id, v_p.cliente_id, v_p.titulo, coalesce(v_p.descripcion, ''), v_p.estado,
        v_presupuesto, v_p.forma_pago, v_p.comprobante,
        v_p.fecha_visita, v_p.ultimo_contacto, v_p.fecha_inicio, v_p.entrega_estimada,
        v_p.fecha_entrega, coalesce(v_p.direccion_entrega, ''), coalesce(v_p.notas, ''),
        v_vencimiento, v_visita_hecha, v_sena_bp, v_entrega_hora, v_visita_hora
      )
      returning * into v_fila;
    exception
      -- El id existe pero el select de arriba no lo vio: es de otro household. Se responde lo mismo
      -- que si no existiera, que es lo que la RLS ya dice, en vez de filtrar que está. Un duplicate
      -- key crudo sería además un rechazo definitivo sin mensaje, y la cola drena de a una.
      when unique_violation then
        raise exception 'El proyecto no existe o no es tuyo' using errcode = '42501';
    end;
  end if;

  -- Los hijos van después del proyecto: la foreign key compuesta exige que el padre exista. La marca
  -- de la apertura de un pago usa el patrón de la clave presente: sin la clave (un bundle viejo)
  -- queda la que ya tenía el pago, y un pago nuevo nace en false.
  insert into public.pagos (id, proyecto_id, fecha, concepto, monto_centavos, ya_en_la_apertura)
  select r.id, v_fila.id, r.fecha::date, coalesce(r.concepto, ''), r.monto_centavos,
         case
           when e ? 'ya_en_la_apertura' then coalesce(r.ya_en_la_apertura, false)
           else coalesce(g.ya_en_la_apertura, false)
         end
  from jsonb_array_elements(p_pagos) as e
  cross join lateral jsonb_to_record(e) as r (
    id uuid, fecha text, concepto text, monto_centavos bigint, ya_en_la_apertura boolean,
    borrado boolean
  )
  left join public.pagos g on g.id = r.id
  where not coalesce(r.borrado, false)
  on conflict (id) do update set
    proyecto_id = excluded.proyecto_id,
    fecha = excluded.fecha,
    concepto = excluded.concepto,
    monto_centavos = excluded.monto_centavos,
    ya_en_la_apertura = excluded.ya_en_la_apertura;

  insert into public.gastos (id, proyecto_id, fecha, descripcion, monto_centavos)
  select r.id, v_fila.id, r.fecha::date, coalesce(r.descripcion, ''), r.monto_centavos
  from jsonb_to_recordset(p_gastos) as r (
    id uuid, fecha text, descripcion text, monto_centavos bigint, borrado boolean
  )
  where not coalesce(r.borrado, false)
  on conflict (id) do update set
    proyecto_id = excluded.proyecto_id,
    fecha = excluded.fecha,
    descripcion = excluded.descripcion,
    monto_centavos = excluded.monto_centavos;

  -- Las opciones solo se tocan si el pedido las trae: p_opciones en null es un bundle viejo, que no
  -- las conoce y no tiene por qué borrarlas.
  if p_opciones is not null then
    -- Apagar antes de escribir. El índice único parcial de la aprobada se evalúa fila por fila, y el
    -- orden dentro del upsert no está definido: sin este paso, mover la aprobación de una opción a
    -- otra dejaba dos prendidas a la vez y cortaba con 23505.
    update public.opciones_de_presupuesto
    set aprobada = false
    where household_id = v_fila.household_id
      and proyecto_id = v_fila.id
      and aprobada
      and deleted_at is null;

    insert into public.opciones_de_presupuesto (id, proyecto_id, descripcion, monto_centavos, aprobada)
    select r.id, v_fila.id, coalesce(r.descripcion, ''), r.monto_centavos, coalesce(r.aprobada, false)
    from jsonb_to_recordset(p_opciones) as r (
      id uuid, descripcion text, monto_centavos bigint, aprobada boolean, borrado boolean
    )
    where not coalesce(r.borrado, false)
    on conflict (id) do update set
      proyecto_id = excluded.proyecto_id,
      descripcion = excluded.descripcion,
      monto_centavos = excluded.monto_centavos,
      aprobada = excluded.aprobada;
  end if;

  -- Lo mismo con lo que hace falta: sin la clave no se toca. No hay índice único parcial acá, así que
  -- el upsert va de una y el orden entre filas no importa.
  if p_necesidades is not null then
    insert into public.necesidades (id, proyecto_id, tipo, nombre, cantidad, listo)
    select r.id, v_fila.id, r.tipo::public.tipo_de_necesidad, btrim(r.nombre), r.cantidad,
           coalesce(r.listo, false)
    from jsonb_to_recordset(p_necesidades) as r (
      id uuid, tipo text, nombre text, cantidad integer, listo boolean, borrado boolean
    )
    where not coalesce(r.borrado, false)
    on conflict (id) do update set
      proyecto_id = excluded.proyecto_id,
      tipo = excluded.tipo,
      nombre = excluded.nombre,
      cantidad = excluded.cantidad,
      listo = excluded.listo;
  end if;

  -- La baja de una fila hija es la que el cliente vio y sacó del formulario, marcada en el mismo
  -- array. Nunca es "todo lo que no vino en el pedido": la version del proyecto no se mueve cuando
  -- solo cambian sus hijos, así que un guardado viejo borraría en silencio un pago cargado desde
  -- otro lado. El filtro por deleted_at deja el reenvío en no-op y conserva la primera marca.
  update public.pagos g
  set deleted_at = now()
  from jsonb_to_recordset(p_pagos) as r (id uuid, borrado boolean)
  where g.id = r.id
    and coalesce(r.borrado, false)
    and g.proyecto_id = v_fila.id
    and g.deleted_at is null;

  update public.gastos g
  set deleted_at = now()
  from jsonb_to_recordset(p_gastos) as r (id uuid, borrado boolean)
  where g.id = r.id
    and coalesce(r.borrado, false)
    and g.proyecto_id = v_fila.id
    and g.deleted_at is null;

  update public.opciones_de_presupuesto o
  set deleted_at = now()
  from jsonb_to_recordset(coalesce(p_opciones, '[]'::jsonb)) as r (id uuid, borrado boolean)
  where o.id = r.id
    and coalesce(r.borrado, false)
    and o.proyecto_id = v_fila.id
    and o.deleted_at is null;

  update public.necesidades n
  set deleted_at = now()
  from jsonb_to_recordset(coalesce(p_necesidades, '[]'::jsonb)) as r (id uuid, borrado boolean)
  where n.id = r.id
    and coalesce(r.borrado, false)
    and n.proyecto_id = v_fila.id
    and n.deleted_at is null;

  -- Vuelve el agregado entero: las filas vivas más las que este guardado dio de baja, para que el
  -- cliente las saque de su réplica sin esperar al próximo delta.
  return jsonb_build_object(
    'proyecto', to_jsonb(v_fila),
    'pagos', (
      select coalesce(jsonb_agg(to_jsonb(g)), '[]'::jsonb)
      from public.pagos g
      where g.household_id = v_fila.household_id
        and g.proyecto_id = v_fila.id
        and (
          g.deleted_at is null
          or g.id in (select (r ->> 'id')::uuid from jsonb_array_elements(p_pagos) as r)
        )
    ),
    'gastos', (
      select coalesce(jsonb_agg(to_jsonb(g)), '[]'::jsonb)
      from public.gastos g
      where g.household_id = v_fila.household_id
        and g.proyecto_id = v_fila.id
        and (
          g.deleted_at is null
          or g.id in (select (r ->> 'id')::uuid from jsonb_array_elements(p_gastos) as r)
        )
    ),
    'opciones_de_presupuesto', (
      select coalesce(jsonb_agg(to_jsonb(o)), '[]'::jsonb)
      from public.opciones_de_presupuesto o
      where o.household_id = v_fila.household_id
        and o.proyecto_id = v_fila.id
        and (
          o.deleted_at is null
          or o.id in (
            select (r ->> 'id')::uuid from jsonb_array_elements(coalesce(p_opciones, '[]'::jsonb)) as r
          )
        )
    ),
    'necesidades', (
      select coalesce(jsonb_agg(to_jsonb(n)), '[]'::jsonb)
      from public.necesidades n
      where n.household_id = v_fila.household_id
        and n.proyecto_id = v_fila.id
        and (
          n.deleted_at is null
          or n.id in (
            select (r ->> 'id')::uuid from jsonb_array_elements(coalesce(p_necesidades, '[]'::jsonb)) as r
          )
        )
    )
  );
end;
$$;

comment on function public.guardar_proyecto(jsonb, jsonb, jsonb, jsonb, jsonb) is
  'Guarda un proyecto con sus pagos, sus gastos, sus opciones de presupuesto y lo que hace falta para el trabajo en una sola transacción, idempotente por el id del proyecto. El alta es un upsert; la edición manda la version que vio el cliente y se rechaza con MN006 si la fila cambió. Las bajas de las filas hijas vienen marcadas con borrado en su propio array. Un pago sin fecha se rechaza con MN016: la fecha la manda la app (ADR 0063); la guarda de la tabla rechaza además una fecha que todavía no llegó y una marca de la apertura que no corresponde. Con opciones vivas, el presupuesto del proyecto sale de la opción aprobada y no de lo que manda el cliente. p_opciones y p_necesidades en null quieren decir "no toques eso", para que un bundle viejo no lo borre; lo mismo la clave ya_en_la_apertura de cada pago. Los cuatro costos estimados no los escribe esta función: van por un update de sus columnas solas.';

-- El libro mayor: lo que ya estaba en la apertura queda, marcado --------------------------------------

create or replace view public.libro_mayor with (security_invoker = true) as
  select m.household_id,
    'manual'::text as origen,
    m.id as asiento_id,
    m.fecha,
    m.tesoro_destino as tesoro,
    m.tesoro_origen as contrapartida,
    m.monto_centavos,
    m.tipo::text as concepto,
    m.categoria,
    m.descripcion,
    m.proyecto_id,
    false as ya_en_la_apertura
  from public.movimientos m
  where m.deleted_at is null and m.tesoro_destino is not null
  union all
  select m.household_id,
    'manual'::text as origen,
    m.id as asiento_id,
    m.fecha,
    m.tesoro_origen as tesoro,
    m.tesoro_destino as contrapartida,
    - m.monto_centavos as monto_centavos,
    m.tipo::text as concepto,
    m.categoria,
    m.descripcion,
    m.proyecto_id,
    false as ya_en_la_apertura
  from public.movimientos m
  where m.deleted_at is null and m.tesoro_origen is not null
  union all
  select pg.household_id,
    'pago'::text as origen,
    pg.id as asiento_id,
    pg.fecha,
    'maun'::public.tesoro as tesoro,
    null::public.tesoro as contrapartida,
    pg.monto_centavos,
    'cobro'::text as concepto,
    'Cobro'::text as categoria,
    pg.concepto as descripcion,
    pg.proyecto_id,
    pg.ya_en_la_apertura
  from public.pagos pg
    join public.proyectos p on p.household_id = pg.household_id and p.id = pg.proyecto_id
  where pg.deleted_at is null and p.deleted_at is null
  union all
  select g.household_id,
    'gasto_proyecto'::text as origen,
    g.id as asiento_id,
    g.fecha,
    'maun'::public.tesoro as tesoro,
    null::public.tesoro as contrapartida,
    - g.monto_centavos as monto_centavos,
    'gasto'::text as concepto,
    'Materiales'::text as categoria,
    g.descripcion,
    g.proyecto_id,
    false as ya_en_la_apertura
  from public.gastos g
    join public.proyectos p on p.household_id = g.household_id and p.id = g.proyecto_id
  where g.deleted_at is null and p.deleted_at is null
  union all
  select p.household_id,
    'distribucion'::text as origen,
    p.id as asiento_id,
    p.fecha_cobro as fecha,
    d.tesoro,
    d.contrapartida,
    d.monto_centavos,
    d.concepto,
    'Distribución'::text as categoria,
    p.titulo as descripcion,
    p.id as proyecto_id,
    p.reparto_ya_en_la_apertura as ya_en_la_apertura
  from public.proyectos p
    cross join lateral (
      values
        ('diezmo'::public.tesoro, 'maun'::public.tesoro, p.dist_diezmo_centavos, 'diezmo'::text),
        ('maun'::public.tesoro, 'diezmo'::public.tesoro, - p.dist_diezmo_centavos, 'diezmo'::text),
        ('hogar'::public.tesoro, 'maun'::public.tesoro, p.dist_sueldo_centavos, 'sueldo'::text),
        ('maun'::public.tesoro, 'hogar'::public.tesoro, - p.dist_sueldo_centavos, 'sueldo'::text)
    ) as d (tesoro, contrapartida, monto_centavos, concepto)
  where p.estado = any (array['cobrado'::public.estado_proyecto, 'perdido'::public.estado_proyecto])
    and p.deleted_at is null
    and d.monto_centavos <> 0;

comment on view public.libro_mayor is
  'Libro mayor por tesoro: una fila por tesoro afectado, importe con signo. El saldo de un tesoro es sum(monto_centavos) where tesoro = X and not ya_en_la_apertura: una fila ya_en_la_apertura es plata de antes de la apertura que ya estaba en los saldos con los que arrancó la app, y queda en el libro con su fecha sin mover los tesoros (ADR 0063).';
