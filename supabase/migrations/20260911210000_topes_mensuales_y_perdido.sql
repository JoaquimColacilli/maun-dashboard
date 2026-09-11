-- Topes mensuales de costos fijos, el sueldo con tope por proyecto o por mes, y el cierre de un
-- perdido como liquidación (ADR 0011).
--
-- La cascada no cambia: cambian los topes que recibe. Los fijos se topean por lo que falta del mes;
-- el sueldo, por proyecto (hoy) o por mes (ajustes.sueldo_tope_mensual). Lo liquidado en el mes no
-- se guarda en ningún lado: se suma de las distribuciones congeladas bajo el lock de la fila de
-- ajustes, así que reabrir un proyecto lo saca de la suma sin código que reste.
--
-- Pasar a perdido deja de ser una transición: es cerrar_perdido, hermana de cobrar_proyecto, y las
-- dos envuelven private.liquidar. Salir de perdido es reactivar_perdido, hermana de
-- reabrir_proyecto, y las dos envuelven private.revertir_liquidacion.
--
-- Las gemelas de @maun/domain: private.topes_de_la_liquidacion (topesDeLaLiquidacion), el bloque
-- de objetivos de private.liquidar (planDeLiquidacion), su suma del mes (liquidadoDelMes),
-- private.liquidacion_valida (puedeLiquidar) y private.reversion_valida (puedeRevertir).


-- Ajustes ----------------------------------------------------------------------------------------

alter table public.ajustes
  add column sueldo_tope_mensual boolean not null default false,
  add column perdido_con_sueldo boolean not null default false,
  add column perdido_con_diezmo boolean not null default true;

comment on column public.ajustes.sueldo_mensual_centavos is
  'Sueldo que el taller le paga al hogar: objetivo del escalón de sueldo, por proyecto o por mes según sueldo_tope_mensual.';
comment on column public.ajustes.costos_fijos_centavos is
  'Costos fijos mensuales del taller: objetivo del escalón de fijos, que se topea por lo que falta del mes.';
comment on column public.ajustes.sueldo_tope_mensual is
  'false: cada cobro paga hasta un sueldo entero (la regla del dueño). true: el sueldo se topea por lo que falta del mes, como los fijos. El cliente no tiene grant para prenderlo: antes hay que resolver que una liquidación offline deja de ser determinista (ADR 0011).';
comment on column public.ajustes.perdido_con_sueldo is
  'Si cerrar un perdido con seña retenida paga sueldo. Por defecto no: un lead que no prosperó no es un trabajo. Se aplica como objetivo de sueldo en cero para esa liquidación, no con otra cascada.';
comment on column public.ajustes.perdido_con_diezmo is
  'Si la seña retenida de un perdido paga diezmo. Por defecto sí: es ingreso reconocido.';

grant update (perdido_con_sueldo, perdido_con_diezmo) on table public.ajustes to authenticated;


-- Lo que se congela ------------------------------------------------------------------------------

-- La reapertura guarda los objetivos del cobro original, no sus topes: el tope se recalcula contra
-- el estado actual del mes. Las dos columnas se renombran vacías (ninguna fila tenía reapertura).
alter table public.proyectos
  rename column reapertura_tope_sueldo_centavos to reapertura_objetivo_sueldo_centavos;
alter table public.proyectos
  rename column reapertura_tope_fijos_centavos to reapertura_objetivo_fijos_centavos;

alter table public.proyectos
  drop constraint proyectos_cobrado_con_distribucion,
  drop constraint proyectos_reapertura_completa,
  add column dist_objetivo_sueldo_centavos bigint,
  add column dist_objetivo_fijos_centavos bigint,
  add column dist_sueldo_mensual boolean,
  add column dist_sueldo_previo_centavos bigint,
  add column dist_fijos_previo_centavos bigint,
  add column dist_liquidado_at timestamptz,
  add column reapertura_sueldo_mensual boolean;

alter table public.proyectos
  add constraint proyectos_liquidado_con_distribucion check (
    (estado in ('cobrado', 'perdido')) = (fecha_cobro is not null)
    and num_nulls(
      fecha_cobro, dist_cobrado_centavos, dist_gastos_centavos, dist_diezmo_bp,
      dist_tope_sueldo_centavos, dist_tope_fijos_centavos, dist_diezmo_centavos,
      dist_sueldo_centavos, dist_fijos_centavos, dist_remanente_centavos,
      dist_objetivo_sueldo_centavos, dist_objetivo_fijos_centavos, dist_sueldo_mensual,
      dist_sueldo_previo_centavos, dist_fijos_previo_centavos, dist_liquidado_at
    ) in (0, 16)
  ),
  -- El tope congelado sale del objetivo, del modo y de lo que el mes ya llevaba liquidado. Sin
  -- esto, el previo sería un número suelto que no explica nada.
  add constraint proyectos_topes_del_mes check (
    dist_cobrado_centavos is null
    or coalesce(
      dist_objetivo_sueldo_centavos >= 0
      and dist_objetivo_fijos_centavos >= 0
      and dist_sueldo_previo_centavos >= 0
      and dist_fijos_previo_centavos >= 0
      and dist_tope_fijos_centavos = greatest(0, dist_objetivo_fijos_centavos - dist_fijos_previo_centavos)
      and dist_tope_sueldo_centavos = case
        when dist_sueldo_mensual then greatest(0, dist_objetivo_sueldo_centavos - dist_sueldo_previo_centavos)
        else dist_objetivo_sueldo_centavos
      end,
      false
    )
  ),
  add constraint proyectos_reapertura_completa check (
    num_nulls(
      reapertura_objetivo_sueldo_centavos, reapertura_objetivo_fijos_centavos,
      reapertura_sueldo_mensual, reapertura_fecha_cobro
    ) in (0, 4)
    and (estado not in ('cobrado', 'perdido') or reapertura_fecha_cobro is null)
  );

-- La suma de lo liquidado en un mes, dentro de la liquidación.
create index proyectos_liquidados_por_mes on public.proyectos (household_id, fecha_cobro)
  where fecha_cobro is not null;

comment on table public.proyectos is
  'Leads y proyectos: la misma fila avanza de seguimiento a obra y a cobrado, o se cierra como perdido. Liquidar (cobrar o cerrar como perdido) congela la distribución (ADR 0003 y 0011).';
comment on column public.proyectos.fecha_cobro is
  'Fecha de la liquidación: el cobro final o el cierre como perdido. No null si y solo si el proyecto está cobrado o perdido. Es la fecha de los asientos derivados en el libro mayor y define el mes de los topes.';
comment on column public.proyectos.dist_cobrado_centavos is
  'Congelado al liquidar: total cobrado (suma de pagos vivos). En un perdido, la seña retenida.';
comment on column public.proyectos.dist_gastos_centavos is 'Congelado al liquidar: total de gastos del proyecto.';
comment on column public.proyectos.dist_diezmo_bp is
  'Congelado al liquidar: porcentaje de diezmo aplicado, en puntos básicos (1000 = 10%). Un perdido usa 0 si ajustes.perdido_con_diezmo está apagado.';
comment on column public.proyectos.dist_tope_sueldo_centavos is
  'Congelado al liquidar: tope de sueldo que se aplicó. Sale del objetivo, del modo y de lo liquidado en el mes (proyectos_topes_del_mes).';
comment on column public.proyectos.dist_tope_fijos_centavos is
  'Congelado al liquidar: tope de costos fijos que se aplicó, lo que faltaba cubrir del mes.';
comment on column public.proyectos.dist_diezmo_centavos is 'Congelado al liquidar: lo que pasa de MAUN a DIEZMO.';
comment on column public.proyectos.dist_sueldo_centavos is 'Congelado al liquidar: lo que pasa de MAUN a HOGAR.';
comment on column public.proyectos.dist_fijos_centavos is
  'Congelado al liquidar: la parte de la ganancia que cubre costos fijos del mes. Queda en MAUN y no mueve plata entre tesoros.';
comment on column public.proyectos.dist_remanente_centavos is
  'Congelado al liquidar: lo que sobra en MAUN. Negativo solo si el proyecto dio pérdida.';
comment on column public.proyectos.dist_objetivo_sueldo_centavos is
  'Congelado al liquidar: objetivo de sueldo con el que se calculó el tope. En un perdido sin sueldo, cero.';
comment on column public.proyectos.dist_objetivo_fijos_centavos is
  'Congelado al liquidar: costos fijos del mes con los que se calculó el tope.';
comment on column public.proyectos.dist_sueldo_mensual is
  'Congelado al liquidar: si el sueldo se topeó por mes (true) o por proyecto (false).';
comment on column public.proyectos.dist_sueldo_previo_centavos is
  'Congelado al liquidar: sueldo que el mes ya llevaba liquidado por otros proyectos en ese instante. Explica el tope; una reapertura posterior en el mismo mes no lo reescribe.';
comment on column public.proyectos.dist_fijos_previo_centavos is
  'Congelado al liquidar: costos fijos que el mes ya llevaba liquidados por otros proyectos en ese instante.';
comment on column public.proyectos.dist_liquidado_at is
  'Congelado al liquidar: el instante de la liquidación. Ordena las liquidaciones de un mismo mes.';
comment on column public.proyectos.reapertura_objetivo_sueldo_centavos is
  'Objetivo de sueldo del cobro que se reabrió. El próximo cobro lo usa en vez del de los ajustes, y lo limpia.';
comment on column public.proyectos.reapertura_objetivo_fijos_centavos is
  'Objetivo de costos fijos del cobro que se reabrió. El tope se recalcula contra lo liquidado hoy en ese mes.';
comment on column public.proyectos.reapertura_sueldo_mensual is
  'Modo del sueldo del cobro que se reabrió. El próximo cobro lo conserva aunque los ajustes hayan cambiado.';
comment on column public.proyectos.reapertura_fecha_cobro is
  'Fecha del cobro que se reabrió. El próximo cobro conserva esa fecha y ese mes: corregir no mueve la distribución en el libro mayor.';
comment on column public.proyectos.deleted_at is
  'Borrado lógico. Borrar un proyecto borra sus pagos y gastos; uno liquidado con pagos o gastos vivos no se borra, y uno borrado no revive.';


-- Los topes --------------------------------------------------------------------------------------

create function private.topes_de_la_liquidacion(
  p_objetivo_sueldo_centavos bigint,
  p_objetivo_fijos_centavos bigint,
  p_sueldo_mensual boolean,
  p_sueldo_previo_centavos bigint,
  p_fijos_previo_centavos bigint,
  out tope_sueldo_centavos bigint,
  out tope_fijos_centavos bigint
)
language plpgsql
immutable
set search_path = ''
as $$
declare
  -- Number.MAX_SAFE_INTEGER, como en private.cascada.
  c_maximo constant bigint := 9007199254740991;
begin
  if num_nulls(
    p_objetivo_sueldo_centavos, p_objetivo_fijos_centavos, p_sueldo_mensual,
    p_sueldo_previo_centavos, p_fijos_previo_centavos
  ) > 0 then
    raise exception 'Los topes necesitan todos sus parámetros' using errcode = '22004';
  end if;

  if least(
    p_objetivo_sueldo_centavos, p_objetivo_fijos_centavos, p_sueldo_previo_centavos, p_fijos_previo_centavos
  ) < 0 then
    raise exception 'Los topes no aceptan importes negativos' using errcode = '22023';
  end if;

  if greatest(
    p_objetivo_sueldo_centavos, p_objetivo_fijos_centavos, p_sueldo_previo_centavos, p_fijos_previo_centavos
  ) > c_maximo then
    raise exception 'Importe fuera del rango exacto de Money' using errcode = '22003';
  end if;

  tope_fijos_centavos := greatest(0, p_objetivo_fijos_centavos - p_fijos_previo_centavos);
  tope_sueldo_centavos := case
    when p_sueldo_mensual then greatest(0, p_objetivo_sueldo_centavos - p_sueldo_previo_centavos)
    else p_objetivo_sueldo_centavos
  end;
end;
$$;

comment on function private.topes_de_la_liquidacion(bigint, bigint, boolean, bigint, bigint) is
  'Los topes de una liquidación: fijos por lo que falta del mes; sueldo por proyecto (el objetivo entero) o por mes. Gemela de topesDeLaLiquidacion de @maun/domain.';

revoke all on function private.topes_de_la_liquidacion(bigint, bigint, boolean, bigint, bigint) from public;


-- La máquina de estados --------------------------------------------------------------------------

-- Diecinueve transiciones manuales: ninguna entra ni sale de un estado liquidado.
create or replace function private.transicion_valida(p_desde public.estado_proyecto, p_hasta public.estado_proyecto)
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
        ('contacto', 'en_curso'),
        ('relevamiento', 'contacto'), ('relevamiento', 'a_presupuestar'), ('relevamiento', 'presupuesto_enviado'),
        ('relevamiento', 'en_curso'),
        ('a_presupuestar', 'contacto'), ('a_presupuestar', 'relevamiento'), ('a_presupuestar', 'presupuesto_enviado'),
        ('a_presupuestar', 'en_curso'),
        ('presupuesto_enviado', 'contacto'), ('presupuesto_enviado', 'relevamiento'),
        ('presupuesto_enviado', 'a_presupuestar'), ('presupuesto_enviado', 'en_curso'),
        ('en_curso', 'presupuesto_enviado'), ('en_curso', 'entregado'),
        ('entregado', 'en_curso')
    ) as t (desde, hasta)
    where t.desde::public.estado_proyecto = p_desde
      and t.hasta::public.estado_proyecto = p_hasta
  )
$$;

comment on function private.transicion_valida(public.estado_proyecto, public.estado_proyecto) is
  'Transiciones manuales de estado. Liquidar y revertir no están: son operaciones. Gemela de TRANSICIONES de @maun/domain.';

-- A cobrado se llega desde entregado; a perdido, desde el seguimiento o desde la obra.
create function private.liquidacion_valida(p_desde public.estado_proyecto, p_hacia public.estado_proyecto)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    case p_hacia
      when 'cobrado' then p_desde = 'entregado'
      when 'perdido' then p_desde in ('contacto', 'relevamiento', 'a_presupuestar', 'presupuesto_enviado', 'en_curso')
      else false
    end,
    false
  )
$$;

comment on function private.liquidacion_valida(public.estado_proyecto, public.estado_proyecto) is
  'Desde qué estado se liquida hacia cobrado o perdido. Gemela de puedeLiquidar de @maun/domain.';

revoke all on function private.liquidacion_valida(public.estado_proyecto, public.estado_proyecto) from public;
-- La llama private.validar_proyecto(), que corre con el rol de quien edita.
grant execute on function private.liquidacion_valida(public.estado_proyecto, public.estado_proyecto) to authenticated;

-- Un cobrado se reabre a entregado; un perdido se reactiva a un estado de seguimiento.
create function private.reversion_valida(p_desde public.estado_proyecto, p_hacia public.estado_proyecto)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    case p_desde
      when 'cobrado' then p_hacia = 'entregado'
      when 'perdido' then p_hacia in ('contacto', 'relevamiento', 'a_presupuestar', 'presupuesto_enviado')
      else false
    end,
    false
  )
$$;

comment on function private.reversion_valida(public.estado_proyecto, public.estado_proyecto) is
  'A qué estado vuelve una liquidación revertida. Gemela de puedeRevertir de @maun/domain.';

revoke all on function private.reversion_valida(public.estado_proyecto, public.estado_proyecto) from public;
grant execute on function private.reversion_valida(public.estado_proyecto, public.estado_proyecto) to authenticated;


-- La guarda de proyectos ------------------------------------------------------------------------

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

    -- Un proyecto no nace liquidado: cobrar y cerrar como perdido son operaciones, no datos.
    if new.estado in ('cobrado', 'perdido') and new.fecha_cobro is null then
      raise exception 'Un proyecto no se crea %: se cobra con cobrar_proyecto y se pierde con cerrar_perdido', new.estado
        using errcode = 'MN007';
    end if;
  elsif private.es_reenvio(to_jsonb(old), to_jsonb(new)) then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    -- Lo congelado solo se mueve revirtiendo, y la reversión limpia fecha_cobro. Sin esta guarda,
    -- una edición encolada con el estado viejo rebotaría contra un check con un 23514 genérico.
    if old.estado in ('cobrado', 'perdido') and new.fecha_cobro is not null and new.estado <> old.estado then
      raise exception 'El proyecto está % y su distribución congelada: su estado no cambia editándolo', old.estado
        using errcode = 'MN001',
              hint = case old.estado
                when 'cobrado' then 'Para corregirlo hay que reabrir el proyecto o registrar un ajuste.'
                else 'Un perdido vuelve al seguimiento con reactivar_perdido.'
              end;
    end if;

    -- Borrar un proyecto borra sus pagos y gastos: si está liquidado y movió plata, eso la sacaría
    -- del libro mayor. Un liquidado sin pagos ni gastos (el lead perdido sin seña) sí se borra.
    if old.fecha_cobro is not null and old.deleted_at is null and new.deleted_at is not null and (
      exists (
        select 1 from public.pagos g
        where g.household_id = old.household_id and g.proyecto_id = old.id and g.deleted_at is null
      )
      or exists (
        select 1 from public.gastos g
        where g.household_id = old.household_id and g.proyecto_id = old.id and g.deleted_at is null
      )
    ) then
      raise exception 'Un proyecto % con pagos o gastos no se borra: tiene la distribución congelada', old.estado
        using errcode = 'MN001';
    end if;

    -- La baja se lleva los pagos y gastos, y des-borrar no los trae de vuelta: un proyecto
    -- borrado se queda borrado. Evita que una edición vieja encolada lo resucite vacío.
    if old.deleted_at is not null and new.deleted_at is null then
      raise exception 'El proyecto está borrado'
        using errcode = 'MN002';
    end if;

    if new.estado is distinct from old.estado then
      if new.estado in ('cobrado', 'perdido') then
        -- Solo private.liquidar llega acá con la distribución congelada: el cliente no tiene grant
        -- sobre fecha_cobro.
        if new.fecha_cobro is null or not private.liquidacion_valida(old.estado, new.estado) then
          raise exception 'Un proyecto no pasa de % a % editando el estado: se cobra con cobrar_proyecto y se pierde con cerrar_perdido', old.estado, new.estado
            using errcode = 'MN007';
        end if;
      elsif old.estado in ('cobrado', 'perdido') then
        -- Solo private.revertir_liquidacion llega acá, porque es la única que limpia fecha_cobro.
        if not private.reversion_valida(old.estado, new.estado) then
          raise exception 'Un proyecto % no vuelve a %', old.estado, new.estado
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
  'Guarda de proyectos: un liquidado (cobrado o perdido) no cambia de estado editándolo, y con pagos o gastos no se borra (MN001); un borrado no revive (MN002); un proyecto vivo no cuelga de un cliente borrado (MN005); el estado solo sigue transiciones válidas (MN007). Deja pasar el reenvío idéntico de la cola.';


-- La guarda de pagos y gastos -------------------------------------------------------------------

create or replace function private.validar_proyecto_abierto()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_proyectos uuid[];
  v_liquidado public.estado_proyecto;
begin
  if tg_op = 'INSERT' then
    -- En un upsert que choca contra una fila existente, este trigger corre antes de detectar el
    -- conflicto. Se deja pasar y decide el trigger de UPDATE, que ve la fila vieja.
    if tg_table_name = 'pagos' then
      perform 1 from public.pagos where id = new.id;
    else
      perform 1 from public.gastos where id = new.id;
    end if;
    if found then
      return new;
    end if;
    v_proyectos := array[new.proyecto_id];
  else
    if private.es_reenvio(to_jsonb(old), to_jsonb(new)) then
      return new;
    end if;
    v_proyectos := array[old.proyecto_id, new.proyecto_id];
  end if;

  -- Bloquea el proyecto antes de mirarlo. Sin esto, un pago que entra mientras otra sesión liquida
  -- el proyecto pasa la guarda con el estado viejo y queda fuera de la distribución congelada: la
  -- foreign key solo toma un lock que no choca con el update de la liquidación. Con for share, este
  -- trigger espera a la liquidación y la consulta de abajo, que es nueva, ya la ve commiteada. El
  -- contrato del otro lado: private.liquidar bloquea el proyecto con for update antes de sumar.
  perform 1
  from public.proyectos p
  where p.household_id = new.household_id
    and p.id = any (v_proyectos)
  order by p.id
  for share;

  select p.estado into v_liquidado
  from public.proyectos p
  where p.household_id = new.household_id
    and p.id = any (v_proyectos)
    and p.estado in ('cobrado', 'perdido')
  limit 1;

  if found then
    raise exception 'El proyecto está % y su distribución congelada: sus pagos y gastos no se modifican', v_liquidado
      using errcode = 'MN001',
            hint = case v_liquidado
              when 'cobrado' then 'Para corregirlo hay que reabrir el proyecto o registrar un ajuste.'
              else 'Para cargarlo hay que reactivar el perdido y volver a cerrarlo.'
            end;
  end if;

  -- Un hijo de un proyecto borrado solo puede quedar borrado (es lo que hace la baja en cascada).
  if new.deleted_at is null and exists (
    select 1
    from public.proyectos p
    where p.household_id = new.household_id
      and p.id = new.proyecto_id
      and p.deleted_at is not null
  ) then
    raise exception 'El proyecto está borrado'
      using errcode = 'MN002';
  end if;

  return new;
end;
$$;

comment on function private.validar_proyecto_abierto() is
  'Guarda de pagos y gastos: rechaza altas y cambios sobre un proyecto liquidado, cobrado o perdido (MN001), o borrado (MN002). Deja pasar el reenvío idéntico de la cola.';


-- Liquidar: cobrar o cerrar como perdido ----------------------------------------------------------

-- security definer: escribe las columnas de la distribución, sobre las que el cliente no tiene
-- grant. Como corre con el dueño de las tablas y saltea la RLS, verifica la pertenencia a mano.
-- La llaman public.cobrar_proyecto y public.cerrar_perdido: una sola implementación, dos destinos.
--
-- La app manda lo que le mostró al usuario: la versión del proyecto, los totales, los topes, la
-- fecha y la distribución que calculó calcularLiquidacion de @maun/domain. Se congela solo si todo
-- coincide con lo que calcula la base; si no, se rechaza y la app vuelve a mostrar la distribución.
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
  p_diezmo_bp integer
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
  v_cobrado bigint;
  v_gastos bigint;
  v_dist record;
begin
  if num_nulls(
    p_destino, p_proyecto_id, p_version, p_fecha, p_cobrado_centavos, p_gastos_centavos,
    p_tope_sueldo_centavos, p_tope_fijos_centavos, p_diezmo_centavos, p_sueldo_centavos,
    p_fijos_centavos, p_remanente_centavos
  ) > 0 then
    raise exception 'La liquidación necesita todos sus parámetros' using errcode = '22004';
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
  -- la respuesta se perdió. Se devuelve la fila tal cual, sin rechazar algo que salió bien.
  if v_proyecto.estado = p_destino
    and v_proyecto.version = p_version + 1
    and (
      v_proyecto.fecha_cobro, v_proyecto.dist_cobrado_centavos, v_proyecto.dist_gastos_centavos,
      v_proyecto.dist_tope_sueldo_centavos, v_proyecto.dist_tope_fijos_centavos,
      v_proyecto.dist_diezmo_centavos, v_proyecto.dist_sueldo_centavos,
      v_proyecto.dist_fijos_centavos, v_proyecto.dist_remanente_centavos
    ) = (
      p_fecha, p_cobrado_centavos, p_gastos_centavos, p_tope_sueldo_centavos,
      p_tope_fijos_centavos, p_diezmo_centavos, p_sueldo_centavos, p_fijos_centavos,
      p_remanente_centavos
    )
    and (p_diezmo_bp is null or v_proyecto.dist_diezmo_bp = p_diezmo_bp)
  then
    return v_proyecto;
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

  -- Con qué fecha, diezmo y objetivos se liquida. Gemela de planDeLiquidacion.
  if p_destino = 'perdido' then
    -- Un cierre como perdido es un evento nuevo: no usa la foto de una reapertura. El sueldo del
    -- perdido es un objetivo en cero cuando perdido_con_sueldo está apagado, no otra cascada.
    v_fecha := p_fecha;
    v_diezmo_bp := case when v_ajustes.perdido_con_diezmo then c_diezmo_bp else 0 end;
    v_objetivo_sueldo := case when v_ajustes.perdido_con_sueldo then v_ajustes.sueldo_mensual_centavos else 0 end;
    v_objetivo_fijos := v_ajustes.costos_fijos_centavos;
    v_sueldo_mensual := v_ajustes.sueldo_tope_mensual;
  elsif v_proyecto.reapertura_fecha_cobro is not null then
    -- Un cobro reabierto se vuelve a cobrar con la fecha y los objetivos del original.
    v_fecha := v_proyecto.reapertura_fecha_cobro;
    v_diezmo_bp := c_diezmo_bp;
    v_objetivo_sueldo := v_proyecto.reapertura_objetivo_sueldo_centavos;
    v_objetivo_fijos := v_proyecto.reapertura_objetivo_fijos_centavos;
    v_sueldo_mensual := v_proyecto.reapertura_sueldo_mensual;
  else
    v_fecha := p_fecha;
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
  -- la app no veía otra liquidación del mes (o una reapertura), o que cambiaron los ajustes.
  if v_cobrado <> p_cobrado_centavos
    or v_gastos <> p_gastos_centavos
    or v_topes.tope_sueldo_centavos <> p_tope_sueldo_centavos
    or v_topes.tope_fijos_centavos <> p_tope_fijos_centavos
    or v_fecha <> p_fecha
    or v_diezmo_bp <> coalesce(p_diezmo_bp, v_diezmo_bp)
  then
    raise exception 'Los pagos, los gastos, los topes, el diezmo o la fecha cambiaron desde que viste la distribución'
      using errcode = 'MN006',
            detail = format(
              'cobrado %s, gastos %s, tope de sueldo %s, tope de fijos %s, diezmo %s bp, fecha %s; el mes ya llevaba %s de sueldo y %s de fijos',
              v_cobrado, v_gastos, v_topes.tope_sueldo_centavos, v_topes.tope_fijos_centavos, v_diezmo_bp,
              v_fecha, v_sueldo_previo, v_fijos_previo
            );
  end if;

  select * into v_dist
  from private.cascada(v_cobrado, v_gastos, v_diezmo_bp, v_topes.tope_sueldo_centavos, v_topes.tope_fijos_centavos);

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
    reapertura_objetivo_sueldo_centavos = null,
    reapertura_objetivo_fijos_centavos = null,
    reapertura_sueldo_mensual = null,
    reapertura_fecha_cobro = null
  where id = v_proyecto.id
  returning * into v_proyecto;

  return v_proyecto;
end;
$$;

comment on function private.liquidar(public.estado_proyecto, uuid, integer, date, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, integer) is
  'Liquida un proyecto hacia cobrado o perdido y congela su distribución. Bloquea el proyecto y después los ajustes, suma lo liquidado en el mes, y rechaza con MN006 si la versión, los totales, los topes o la fecha no son los que vio el cliente, y con MN008 si la distribución no es la de la base. Reconoce el reenvío idéntico.';

revoke all on function private.liquidar(public.estado_proyecto, uuid, integer, date, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, integer) from public;
grant execute on function private.liquidar(public.estado_proyecto, uuid, integer, date, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, integer) to authenticated;


create or replace function public.cobrar_proyecto(
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
  from private.liquidar(
    'cobrado', p_proyecto_id, p_version, p_fecha_cobro, p_cobrado_centavos, p_gastos_centavos,
    p_tope_sueldo_centavos, p_tope_fijos_centavos, p_diezmo_centavos, p_sueldo_centavos,
    p_fijos_centavos, p_remanente_centavos, null
  )
$$;

comment on function public.cobrar_proyecto(uuid, integer, date, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint) is
  'RPC de cobro de un proyecto entregado. La app manda la versión del proyecto, los totales, los topes, la fecha y la distribución que le mostró al usuario.';


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
  p_diezmo_bp integer
)
returns public.proyectos
language sql
security invoker
set search_path = ''
as $$
  select *
  from private.liquidar(
    'perdido', p_proyecto_id, p_version, p_fecha, p_cobrado_centavos, p_gastos_centavos,
    p_tope_sueldo_centavos, p_tope_fijos_centavos, p_diezmo_centavos, p_sueldo_centavos,
    p_fijos_centavos, p_remanente_centavos, p_diezmo_bp
  )
$$;

comment on function public.cerrar_perdido(uuid, integer, date, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, integer) is
  'RPC de cierre como perdido de un lead o de una obra que se cayó. Liquida la seña retenida con la misma cascada que un cobro. Los mismos parámetros que cobrar_proyecto, más el diezmo que vio el usuario: en un perdido es un dato de los ajustes, no una regla.';

revoke all on function public.cerrar_perdido(uuid, integer, date, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, integer) from public, anon, authenticated;
grant execute on function public.cerrar_perdido(uuid, integer, date, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, integer) to authenticated;


-- Revertir: reabrir un cobro o reactivar un perdido -----------------------------------------------

create function private.revertir_liquidacion(
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
  -- siguiente (ADR 0003). Reactivar un perdido no guarda nada: un lead que revive es un lead vivo
  -- otra vez, y un cierre posterior es un evento nuevo con su fecha.
  update public.proyectos set
    estado = p_hacia,
    reapertura_objetivo_sueldo_centavos = case when p_desde = 'cobrado' then dist_objetivo_sueldo_centavos end,
    reapertura_objetivo_fijos_centavos = case when p_desde = 'cobrado' then dist_objetivo_fijos_centavos end,
    reapertura_sueldo_mensual = case when p_desde = 'cobrado' then dist_sueldo_mensual end,
    reapertura_fecha_cobro = case when p_desde = 'cobrado' then fecha_cobro end,
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

comment on function private.revertir_liquidacion(uuid, integer, public.estado_proyecto, public.estado_proyecto) is
  'Descongela la distribución de un proyecto liquidado: reabre un cobrado a entregado guardando la foto del cobro, o reactiva un perdido a un estado de seguimiento sin foto. Los demás proyectos del mes no se recalculan. Rechaza con MN006 si el proyecto cambió. Reconoce el reenvío idéntico.';

revoke all on function private.revertir_liquidacion(uuid, integer, public.estado_proyecto, public.estado_proyecto) from public;
grant execute on function private.revertir_liquidacion(uuid, integer, public.estado_proyecto, public.estado_proyecto) to authenticated;


create or replace function public.reabrir_proyecto(p_proyecto_id uuid, p_version integer)
returns public.proyectos
language sql
security invoker
set search_path = ''
as $$
  select * from private.revertir_liquidacion(p_proyecto_id, p_version, 'cobrado', 'entregado')
$$;

comment on function public.reabrir_proyecto(uuid, integer) is
  'RPC de reapertura de un proyecto cobrado: vuelve a entregado y guarda la fecha y los objetivos del cobro.';


create function public.reactivar_perdido(p_proyecto_id uuid, p_version integer, p_estado public.estado_proyecto)
returns public.proyectos
language sql
security invoker
set search_path = ''
as $$
  select * from private.revertir_liquidacion(p_proyecto_id, p_version, 'perdido', p_estado)
$$;

comment on function public.reactivar_perdido(uuid, integer, public.estado_proyecto) is
  'RPC de reactivación de un perdido: descongela su liquidación y lo vuelve al estado de seguimiento elegido.';

revoke all on function public.reactivar_perdido(uuid, integer, public.estado_proyecto) from public, anon, authenticated;
grant execute on function public.reactivar_perdido(uuid, integer, public.estado_proyecto) to authenticated;


-- Las funciones que reemplaza private.liquidar y private.revertir_liquidacion -------------------

drop function private.cobrar_proyecto(uuid, integer, date, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint);
drop function private.reabrir_proyecto(uuid, integer);


-- El libro mayor ---------------------------------------------------------------------------------

create or replace view public.libro_mayor
with (security_invoker = true)
as
-- Movimiento manual, lado que recibe.
select
  m.household_id,
  'manual'::text as origen,
  m.id as asiento_id,
  m.fecha,
  m.tesoro_destino as tesoro,
  m.tesoro_origen as contrapartida,
  m.monto_centavos,
  m.tipo::text as concepto,
  m.categoria,
  m.descripcion,
  m.proyecto_id
from public.movimientos m
where m.deleted_at is null
  and m.tesoro_destino is not null

union all

-- Movimiento manual, lado que entrega.
select
  m.household_id,
  'manual',
  m.id,
  m.fecha,
  m.tesoro_origen,
  m.tesoro_destino,
  -m.monto_centavos,
  m.tipo::text,
  m.categoria,
  m.descripcion,
  m.proyecto_id
from public.movimientos m
where m.deleted_at is null
  and m.tesoro_origen is not null

union all

-- Pago de un proyecto: entra a MAUN desde afuera.
select
  pg.household_id,
  'pago',
  pg.id,
  pg.fecha,
  'maun'::public.tesoro,
  null::public.tesoro,
  pg.monto_centavos,
  'cobro',
  'Cobro',
  pg.concepto,
  pg.proyecto_id
from public.pagos pg
join public.proyectos p on p.household_id = pg.household_id and p.id = pg.proyecto_id
where pg.deleted_at is null
  and p.deleted_at is null

union all

-- Gasto de un proyecto: sale de MAUN hacia afuera.
select
  g.household_id,
  'gasto_proyecto',
  g.id,
  g.fecha,
  'maun'::public.tesoro,
  null::public.tesoro,
  -g.monto_centavos,
  'gasto',
  'Materiales',
  g.descripcion,
  g.proyecto_id
from public.gastos g
join public.proyectos p on p.household_id = g.household_id and p.id = g.proyecto_id
where g.deleted_at is null
  and p.deleted_at is null

union all

-- Distribución congelada de un cobro o de un perdido con seña retenida: el diezmo pasa de MAUN a
-- DIEZMO y el sueldo de MAUN a HOGAR. Los fijos y el remanente se quedan en MAUN: no mueven plata,
-- así que no generan filas.
select
  p.household_id,
  'distribucion',
  p.id,
  p.fecha_cobro,
  d.tesoro,
  d.contrapartida,
  d.monto_centavos,
  d.concepto,
  'Distribución',
  p.titulo,
  p.id
from public.proyectos p
cross join lateral (
  values
    ('diezmo'::public.tesoro, 'maun'::public.tesoro, p.dist_diezmo_centavos, 'diezmo'),
    ('maun'::public.tesoro, 'diezmo'::public.tesoro, -p.dist_diezmo_centavos, 'diezmo'),
    ('hogar'::public.tesoro, 'maun'::public.tesoro, p.dist_sueldo_centavos, 'sueldo'),
    ('maun'::public.tesoro, 'hogar'::public.tesoro, -p.dist_sueldo_centavos, 'sueldo')
) as d (tesoro, contrapartida, monto_centavos, concepto)
where p.estado in ('cobrado', 'perdido')
  and p.deleted_at is null
  and d.monto_centavos <> 0;
