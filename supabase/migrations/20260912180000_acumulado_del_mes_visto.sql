-- El acumulado del mes que vio la app viaja con la liquidación, y si no coincide con el de la base
-- se recalcula en vez de rechazar (la propuesta del ADR 0011, ahora que existe la pantalla de cobro).
--
-- El tope de fijos es mensual desde la migración de los topes, así que depende de las otras
-- liquidaciones del mes. Una app que no las vio manda un tope distinto y rebota con MN006, que la
-- cola no reintenta: al usuario le queda "rehacé el cobro" por algo que no podía saber. Y cobrar sin
-- señal es justo lo que el taller necesita.
--
-- El acumulado es la única entrada que la app no puede conocer sin red. Entonces:
--
--   * si la app no lo manda (null), todo sigue estricto como hasta hoy;
--   * si lo manda y coincide con el de la base, todo sigue estricto como hasta hoy;
--   * si lo manda y difiere, la base verifica que la cuenta de la app sea correcta CON LO QUE LA APP
--     VIO (los topes y la cascada, contra su propio acumulado) y recién entonces recalcula con el
--     acumulado suyo y congela eso.
--
-- Así no se pierde el MN008, que es lo que detecta una app desactualizada aplicando otra regla: se
-- sigue exigiendo que la app haya calculado bien, solo que contra las entradas que ella tenía.
--
-- La respuesta no cambia de forma. La fila congelada ya trae dist_sueldo_previo_centavos y
-- dist_fijos_previo_centavos: la app compara esos contra los que mandó y sabe si la liquidación
-- salió ajustada, y con dist_tope_* y los cuatro escalones tiene la diferencia en plata.

drop function public.cobrar_proyecto(uuid, integer, date, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint);
drop function public.cerrar_perdido(uuid, integer, date, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, integer);
drop function private.liquidar(public.estado_proyecto, uuid, integer, date, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, integer);

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
  p_fijos_previo_centavos bigint default null
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
begin
  if num_nulls(
    p_destino, p_proyecto_id, p_version, p_fecha, p_cobrado_centavos, p_gastos_centavos,
    p_tope_sueldo_centavos, p_tope_fijos_centavos, p_diezmo_centavos, p_sueldo_centavos,
    p_fijos_centavos, p_remanente_centavos
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

  -- El reenvío de una liquidación que salió ajustada. Los topes y los cuatro escalones congelados no
  -- son los que mandó la app —ese es justamente el ajuste—, así que el reenvío se reconoce por las
  -- entradas que la app sí controla. La última condición es la guarda: esta rama solo vale cuando el
  -- acumulado que vio la app no es el que quedó congelado, que es la definición de ajustada. Sin
  -- esto, un cobro ajustado cuya respuesta se perdió rebotaría con MN001 al reintentarlo.
  if p_sueldo_previo_centavos is not null
    and v_proyecto.estado = p_destino
    and v_proyecto.version = p_version + 1
    and (
      v_proyecto.fecha_cobro, v_proyecto.dist_cobrado_centavos, v_proyecto.dist_gastos_centavos
    ) = (
      p_fecha, p_cobrado_centavos, p_gastos_centavos
    )
    and (p_diezmo_bp is null or v_proyecto.dist_diezmo_bp = p_diezmo_bp)
    and (v_proyecto.dist_sueldo_previo_centavos, v_proyecto.dist_fijos_previo_centavos)
      is distinct from (p_sueldo_previo_centavos, p_fijos_previo_centavos)
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
    or v_fecha <> p_fecha
    or v_diezmo_bp <> coalesce(p_diezmo_bp, v_diezmo_bp)
    or (
      not v_ajustada
      and (
        v_topes.tope_sueldo_centavos <> p_tope_sueldo_centavos
        or v_topes.tope_fijos_centavos <> p_tope_fijos_centavos
      )
    )
  then
    raise exception 'Los pagos, los gastos, los topes, el diezmo o la fecha cambiaron desde que viste la distribución'
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
    reapertura_objetivo_sueldo_centavos = null,
    reapertura_objetivo_fijos_centavos = null,
    reapertura_sueldo_mensual = null,
    reapertura_fecha_cobro = null
  where id = v_proyecto.id
  returning * into v_proyecto;

  return v_proyecto;
end;
$$;

comment on function private.liquidar(public.estado_proyecto, uuid, integer, date, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, integer, bigint, bigint) is
  'Liquida un proyecto hacia cobrado o perdido y congela su distribución. Bloquea el proyecto y después los ajustes, suma lo liquidado en el mes, y rechaza con MN006 si la versión, los totales, el diezmo o la fecha no son los que vio el cliente, y con MN008 si la distribución no es la de la base. Si el cliente manda el acumulado del mes que vio y no es el de la base, recalcula los topes con el suyo y congela eso en vez de rechazar: el MN008 se sigue exigiendo contra lo que el cliente vio. Reconoce el reenvío, ajustado o no.';

revoke all on function private.liquidar(public.estado_proyecto, uuid, integer, date, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, integer, bigint, bigint) from public;
grant execute on function private.liquidar(public.estado_proyecto, uuid, integer, date, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, integer, bigint, bigint) to authenticated;

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
  p_fijos_previo_centavos bigint default null
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
    p_fijos_centavos, p_remanente_centavos, null,
    p_sueldo_previo_centavos, p_fijos_previo_centavos
  )
$$;

comment on function public.cobrar_proyecto(uuid, integer, date, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint) is
  'RPC de cobro de un proyecto entregado. La app manda la versión del proyecto, los totales, los topes, la fecha, la distribución que le mostró al usuario y el acumulado del mes que vio. Si ese acumulado no es el de la base, la liquidación se congela con el de la base y la app lo ve comparando dist_sueldo_previo_centavos contra lo que mandó.';

revoke all on function public.cobrar_proyecto(uuid, integer, date, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint) from public, anon, authenticated;
grant execute on function public.cobrar_proyecto(uuid, integer, date, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint) to authenticated;

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
  p_fijos_previo_centavos bigint default null
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
    p_fijos_centavos, p_remanente_centavos, p_diezmo_bp,
    p_sueldo_previo_centavos, p_fijos_previo_centavos
  )
$$;

comment on function public.cerrar_perdido(uuid, integer, date, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, integer, bigint, bigint) is
  'RPC de cierre como perdido de un lead o de una obra que se cayó. Liquida la seña retenida con la misma cascada que un cobro. Los mismos parámetros que cobrar_proyecto, más el diezmo que vio el usuario: en un perdido es un dato de los ajustes, no una regla.';

revoke all on function public.cerrar_perdido(uuid, integer, date, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, integer, bigint, bigint) from public, anon, authenticated;
grant execute on function public.cerrar_perdido(uuid, integer, date, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, integer, bigint, bigint) to authenticated;
