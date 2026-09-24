-- La vista del cliente antes de aprobar (ADR 0067).
--
-- Un campo cargado no es un hecho, y menos un acuerdo. La vista del cliente mandaba la dirección, el
-- día de inicio y la entrega en cualquier etapa, y la pantalla los mostraba como pautados en un
-- trabajo que el cliente todavía no aprobó. Desde acá cada dato viaja a partir de la etapa en la que
-- es cierto, y antes no viaja: el presupuesto desde que se manda, la dirección, el inicio, la entrega
-- y el día de la aprobación desde que se aprueba, el día de la entrega desde que se entrega.
--
-- Suma hasta cuándo vale un presupuesto (una fecha por trabajo y los días por defecto en Ajustes),
-- que es lo que alimenta la proyección de la página mientras se espera la seña, y el importe de la
-- seña, que sale de una sola función de la base.
--
-- Aditiva: dos columnas nuevas (una nullable en proyectos y una con default en ajustes, ninguna de
-- las dos reescribe filas), una función nueva en private y el reemplazo de tres funciones con la
-- misma firma, que conservan sus grants. Ninguna fila existente cambia de valor.


-- Hasta cuándo vale el presupuesto ---------------------------------------------------------------------

alter table public.proyectos add column presupuesto_vale_hasta date;

comment on column public.proyectos.presupuesto_vale_hasta is
  'Hasta qué día vale el presupuesto que se le mandó al cliente, o null si no tiene fecha. La propone la app al marcar «Mandé el presupuesto» con los días de ajustes.presupuesto_vale_dias, y el dueño la corrige en la hoja del contacto. Viaja a la vista del cliente solo mientras el presupuesto está mandado y sin aprobar: es la fecha de «si dejás la seña antes del…», y la entrega que se le proyecta sale de ella con la cuenta de la entrega estimada, no de hoy. Pasada la fecha, la página dice que venció en vez de seguir prometiendo. guardar_proyecto la escribe solo si la clave viene en el pedido, así un bundle viejo no la borra (ADR 0067).';

grant insert (presupuesto_vale_hasta), update (presupuesto_vale_hasta)
  on public.proyectos to authenticated;

alter table public.ajustes
  add column presupuesto_vale_dias integer not null default 15,
  add constraint ajustes_presupuesto_vale_dias_valido
    check (presupuesto_vale_dias between 1 and 365);

comment on column public.ajustes.presupuesto_vale_dias is
  'Cuántos días vale un presupuesto desde que se manda: la app los suma al día en que el dueño marca «Mandé el presupuesto» y guarda la fecha en proyectos.presupuesto_vale_hasta, que él puede pisar en cada trabajo. Arranca en 15. Es política del taller y no viaja al cliente: lo que viaja es la fecha (ADR 0067).';

grant update (presupuesto_vale_dias) on public.ajustes to authenticated;


-- La seña, en un solo lugar de la base -------------------------------------------------------------

-- El importe de la seña: el porcentaje sobre el presupuesto, con medio centavo para redondear, la
-- misma cuenta que aplicarPorcentaje() de @maun/domain. La usan private.pagos_por_delante() y la vista
-- del cliente, así que la seña que se le muestra arriba y la que se le pide en «Cómo pagar» no pueden
-- dar distinto. Sin presupuesto devuelve null.
create function private.sena_esperada(p_precio_centavos bigint, p_sena_bp integer)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select (p_precio_centavos * p_sena_bp + 5000) / 10000
$$;

revoke all on function private.sena_esperada(bigint, integer) from public, anon, authenticated;
grant execute on function private.sena_esperada(bigint, integer) to authenticated;

comment on function private.sena_esperada(bigint, integer) is
  'El importe de la seña: el porcentaje del trabajo, o el del taller, sobre el presupuesto, redondeado al centavo mitad hacia arriba. Null sin presupuesto. Es la gemela de calcularSena().esperada de @maun/domain, y scripts/comparacion.ts las compara caso por caso. La usan private.pagos_por_delante() y public.vista_del_cliente(): la seña se calcula acá y en ningún otro lugar de la base (ADR 0067).';

-- Misma firma y mismo resultado, así que or replace conserva los grants. Lo único que cambia es que
-- la seña sale de private.sena_esperada() en vez de calcularse acá adentro.
create or replace function private.pagos_por_delante(
  p_precio_centavos bigint,
  p_pagado_centavos bigint,
  p_sena_bp integer
)
returns table (orden integer, instancia text, monto_centavos bigint)
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_falta bigint;
  v_sena bigint;
  v_despues bigint;
begin
  -- Sin presupuesto no hay importe que calcular, pero el camino se conoce igual: primero la seña y
  -- después el saldo. La pantalla los anticipa sin número.
  if p_precio_centavos is null then
    return query values (1, 'sena', null::bigint), (2, 'saldo', null::bigint);
    return;
  end if;

  v_falta := p_precio_centavos - p_pagado_centavos;
  if v_falta <= 0 then
    return;
  end if;

  v_sena := private.sena_esperada(p_precio_centavos, p_sena_bp);

  if p_pagado_centavos >= v_sena then
    return query values (1, 'saldo', v_falta);
    return;
  end if;

  -- Lo que queda después de cubrir la seña no es «lo que falta menos la seña que falta»: es el
  -- presupuesto menos la seña entera. Con parte de la seña ya cobrada las dos cuentas no dan lo
  -- mismo, y la que el cliente va a tener que pagar es esta.
  v_despues := p_precio_centavos - v_sena;
  if v_despues <= 0 then
    return query values (1, 'sena', v_sena - p_pagado_centavos);
    return;
  end if;

  return query values (1, 'sena', v_sena - p_pagado_centavos), (2, 'saldo', v_despues);
end;
$$;

comment on function private.pagos_por_delante(bigint, bigint, integer) is
  'Los pagos que le faltan al cliente, en el orden en que los va a hacer: la seña mientras no esté cubierta y después el saldo, o nada cuando ya pagó todo. El importe de la seña es lo que falta de ella, con todo lo cobrado hasta hoy ya descontado —la visita incluida, que entra como un pago más—; el del saldo es el presupuesto menos la seña entera, que es lo que va a quedar cuando la termine de pagar. La seña sale de private.sena_esperada(). Sin presupuesto devuelve los dos sin importe: el porcentaje de seña es política comercial del taller y no viaja. Es la gemela en SQL de pagosPorDelante() de @maun/domain y scripts/comparacion.ts las compara caso por caso (ADR 0053 y 0067).';


-- La vista del cliente: cada dato desde la etapa en la que es cierto -----------------------------------

-- Misma firma, así que or replace conserva los grants: security invoker, execute solo para
-- authenticated, y anon sigue llegando únicamente por public.vista_compartida(). Las claves son las
-- mismas de antes más dos (sena_centavos y fechas.vale_hasta), para que una versión vieja de la app la
-- siga leyendo: lo que no corresponde a la etapa viaja en null, o vacía en el caso de la dirección,
-- que el lector viejo exige como texto. El valor no sale de la base.
create or replace function public.vista_del_cliente(p_proyecto_id uuid)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_p public.proyectos;
  v_etapa public.estado_proyecto;
  v_aprobado boolean;
  v_presupuesto_mandado boolean;
  v_taller text;
  v_cliente text;
  v_ajustes public.ajustes;
  v_alias text;
  v_cbu text;
  v_link text;
  v_hay_como_transferir boolean;
  v_precio bigint;
  v_pagado bigint;
  v_sena_bp integer;
  v_instancia text;
  v_monto bigint;
  v_instancia_despues text;
  v_monto_despues bigint;
  v_formas public.forma_de_cobro[];
  v_por_transferencia boolean;
  v_siguiente jsonb;
begin
  select * into v_p from public.proyectos p where p.id = p_proyecto_id and p.deleted_at is null;

  -- Lo mismo que si no existiera. Con la RLS puesta, un trabajo de otro household no se ve, y esta
  -- respuesta no distingue «no existe» de «no es tuyo».
  if not found then
    raise exception 'El trabajo no existe o no es tuyo' using errcode = '42501';
  end if;

  -- Un trabajo dado por perdido no tiene nada que contarle al cliente, y decirle que se perdió
  -- sería contarle una decisión del taller. El link se comporta como si no sirviera.
  if v_p.estado = 'perdido' then
    raise exception 'El trabajo no existe o no es tuyo' using errcode = '42501';
  end if;

  -- El «por ahora no» es una nota del taller para acordarse de volver a escribirle, no una etapa del
  -- trabajo del cliente: el cliente sigue viendo la etapa en la que estaba, la misma que va a ver si
  -- vuelve. La saca del contacto pendiente, que la guarda al entrar.
  v_etapa := v_p.estado;
  if v_p.estado = 'en_seguimiento' then
    select c.etapa_previa into v_etapa
    from public.proximos_contactos c
    where c.household_id = v_p.household_id
      and c.proyecto_id = v_p.id
      and c.hecho_el is null
      and c.deleted_at is null;
    v_etapa := coalesce(v_etapa, 'presupuesto_enviado');
  end if;

  -- Cada dato tiene una etapa a partir de la cual es cierto. Un campo cargado antes de esa etapa (el
  -- sistema viejo le copió el inicio y la entrega a todo trabajo, aprobado o no) no es un hecho ni un
  -- acuerdo, y no sale de la base.
  v_aprobado := v_etapa in ('en_curso', 'entregado', 'cobrado');
  v_presupuesto_mandado := v_aprobado or v_etapa = 'presupuesto_enviado';

  select h.nombre into v_taller from public.households h where h.id = v_p.household_id;
  select c.nombre into v_cliente from public.clientes c where c.id = v_p.cliente_id;
  select * into v_ajustes from public.ajustes a where a.household_id = v_p.household_id;

  v_alias := nullif(v_ajustes.cobro_alias, '');
  v_cbu := nullif(v_ajustes.cobro_cbu, '');
  v_link := nullif(v_ajustes.cobro_link, '');
  v_hay_como_transferir := v_alias is not null or v_cbu is not null or v_link is not null;

  -- El presupuesto existe para el cliente desde que se le manda. Antes, lo que haya en
  -- presupuesto_centavos es un borrador, o el número de un estimativo, y no viaja.
  v_precio := case when v_presupuesto_mandado then v_p.presupuesto_centavos end;
  v_sena_bp := coalesce(v_p.sena_bp, v_ajustes.sena_bp, 5000);

  select coalesce(sum(g.monto_centavos), 0) into v_pagado
  from public.pagos g
  where g.household_id = v_p.household_id
    and g.proyecto_id = v_p.id
    and g.deleted_at is null;

  select r.instancia, r.monto_centavos into v_instancia, v_monto
  from private.pagos_por_delante(v_precio, v_pagado, v_sena_bp) as r
  where r.orden = 1;

  select r.instancia, r.monto_centavos into v_instancia_despues, v_monto_despues
  from private.pagos_por_delante(v_precio, v_pagado, v_sena_bp) as r
  where r.orden = 2;

  -- Antes de aprobar lo único que se le puede pedir es la seña: el saldo existe desde que aprueba. Si
  -- lo que ya pagó la cubre, para aprobar no le falta pagar nada.
  if not v_aprobado and v_instancia = 'saldo' then
    v_instancia := null;
    v_monto := null;
    v_instancia_despues := null;
    v_monto_despues := null;
  end if;

  -- Con todo pagado no hay ninguna instancia, así que tampoco hay formas ni datos de la cuenta.
  if v_instancia is null then
    v_formas := array[]::public.forma_de_cobro[];
  elsif v_instancia = 'sena' then
    v_formas := private.formas_de_cobro(v_p.cobro_sena, v_hay_como_transferir);
  else
    v_formas := private.formas_de_cobro(v_p.cobro_saldo, v_hay_como_transferir);
  end if;

  v_por_transferencia := 'transferencia' = any (v_formas);

  if v_instancia_despues is null then
    v_siguiente := null;
  else
    v_siguiente := jsonb_build_object(
      'instancia', v_instancia_despues,
      'formas', to_jsonb(
        case
          when v_instancia_despues = 'sena'
            then private.formas_de_cobro(v_p.cobro_sena, v_hay_como_transferir)
          else private.formas_de_cobro(v_p.cobro_saldo, v_hay_como_transferir)
        end
      ),
      'monto_centavos', v_monto_despues
    );
  end if;

  -- Los campos van enumerados uno por uno, a propósito. Si esto fuera to_jsonb(v_p) con la pantalla
  -- filtrando, el día que alguien le agregue una columna a proyectos esa columna quedaría expuesta
  -- sin que nadie lo decida: lo que el cliente ve se decide acá, no en el navegador. La suite lo
  -- controla con supabase/tests/25_vista_del_cliente.sql, que falla apenas aparece una columna
  -- nueva en proyectos o en ajustes hasta que alguien la clasifica como pública o privada.
  return jsonb_build_object(
    'taller', jsonb_build_object('nombre', v_taller),
    'cliente', jsonb_build_object('nombre', v_cliente),
    'trabajo', v_p.titulo,
    -- La dirección de la casa del cliente, desde que aprueba. Antes viaja vacía y no en null: el
    -- lector de una versión vieja de la app la exige como texto.
    'direccion', case when v_aprobado then v_p.direccion_entrega else '' end,
    'estado', v_etapa,
    'precio_centavos', v_precio,
    -- La seña en pesos: la que se le pide para arrancar mientras espera, y la acordada desde que
    -- aprueba. Sale de la misma función que el importe de «pago», así que las dos no pueden dar
    -- distinto. El porcentaje sigue sin viajar.
    'sena_centavos', private.sena_esperada(v_precio, v_sena_bp),
    -- El pago que toca ahora y, si hay otro después, cuánto es y cómo se paga. Los importes salen
    -- de lo que ya está guardado; el porcentaje de seña sigue sin viajar, que es lo que dejó
    -- abierto el ADR 0048.
    'pago', jsonb_build_object(
      'instancia', v_instancia,
      'formas', to_jsonb(v_formas),
      'monto_centavos', v_monto,
      'siguiente', v_siguiente
    ),
    -- Cómo pagarle al taller, y solo si el pago que toca se puede pagar así: los cuatro datos de
    -- la cuenta para transferir y el link de Mercado Pago para pagar desde la misma página. De
    -- ajustes no viaja nada más: ni el sueldo, ni los costos fijos, ni la meta de Cocos, ni la seña.
    'cobro', jsonb_build_object(
      'alias', case when v_por_transferencia then v_alias end,
      'cbu', case when v_por_transferencia then v_cbu end,
      'titular', case when v_por_transferencia then nullif(v_ajustes.cobro_titular, '') end,
      'cuit', case when v_por_transferencia then nullif(v_ajustes.cobro_cuit, '') end,
      'link', case when v_por_transferencia then v_link end
    ),
    'fechas', jsonb_build_object(
      'estimativo', (
        select min(c.ocurrio_el)
        from public.cambios_de_estado c
        where c.household_id = v_p.household_id
          and c.proyecto_id = v_p.id
          and c.hacia = 'presupuesto_estimativo'
      ),
      'presupuesto', (
        select min(c.ocurrio_el)
        from public.cambios_de_estado c
        where c.household_id = v_p.household_id
          and c.proyecto_id = v_p.id
          and c.hacia = 'presupuesto_enviado'
      ),
      -- La aprobación sale de su registro, no de un pago, y solo mientras el trabajo está aprobado:
      -- uno que volvió a presupuesto no se muestra aprobado.
      'aprobado', case when v_aprobado then (
        select min(c.ocurrio_el)
        from public.cambios_de_estado c
        where c.household_id = v_p.household_id
          and c.proyecto_id = v_p.id
          and c.hacia = 'en_curso'
      ) end,
      'inicio', case when v_aprobado then v_p.fecha_inicio end,
      'entrega_pautada', case when v_aprobado then v_p.entrega_estimada end,
      'entregado', case when v_etapa in ('entregado', 'cobrado') then v_p.fecha_entrega end,
      'cobro', case when v_p.estado = 'cobrado' then v_p.fecha_cobro end,
      -- Hasta cuándo vale el presupuesto, solo mientras está mandado y sin aprobar.
      'vale_hasta', case when v_etapa = 'presupuesto_enviado' then v_p.presupuesto_vale_hasta end
    ),
    -- La visita para medir: el día acordado o en que se fue, y si ya se fue. La hora no viaja.
    'visita', jsonb_build_object(
      'dia', v_p.fecha_visita,
      'hecha', v_p.visita_hecha
    ),
    'pagos', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', g.id,
            'fecha', g.fecha,
            'concepto', g.concepto,
            'monto_centavos', g.monto_centavos
          )
          order by g.fecha, g.id
        ),
        '[]'::jsonb
      )
      from public.pagos g
      where g.household_id = v_p.household_id
        and g.proyecto_id = v_p.id
        and g.deleted_at is null
    ),
    'archivos', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', a.id,
            'nombre', a.nombre,
            'tipo', a.tipo,
            'ancho', a.ancho,
            'alto', a.alto,
            'fecha', a.created_at,
            -- La ruta en el bucket, que es pública y se sirve por el CDN. Sale del id, como en la
            -- app: private.ruta_del_archivo() es el único lugar donde se arma.
            'ruta', private.ruta_del_archivo(a.household_id, a.proyecto_id, a.id, a.tipo, false),
            'ruta_mini', private.ruta_del_archivo(a.household_id, a.proyecto_id, a.id, a.tipo, true)
          )
          order by a.created_at desc, a.id desc
        ),
        '[]'::jsonb
      )
      from public.archivos a
      where a.household_id = v_p.household_id
        and a.proyecto_id = v_p.id
        and a.deleted_at is null
        and a.visible_para_cliente
    )
  );
end;
$$;

comment on function public.vista_del_cliente(uuid) is
  'Lo único que un cliente puede ver de su trabajo, y cada dato recién desde la etapa en la que es cierto (ADR 0067): el presupuesto desde que se le manda; la dirección de entrega, el día de inicio, la entrega pautada y el día de la aprobación desde que aprueba; el día de la entrega desde que se entrega. Antes de esas etapas no viajan, aunque estén cargados: un campo cargado no es un hecho. Devuelve cuánto vale, cuánto pagó, en qué anda, la seña en pesos, qué pago le toca ahora, cuánto es, cómo puede pagarlo y cuál viene después (antes de aprobar solo se le pide la seña), hasta cuándo vale el presupuesto mientras espera la seña, los archivos que el dueño marcó, el día que se le mandó el estimativo y el día de la visita para medir con si ya se fue. Enumera los campos uno por uno y nunca devuelve la fila entera: convertirla en un select * expondría cada columna nueva de proyectos sin que nadie lo decida, costos estimados y margen incluidos. Un trabajo en seguimiento se muestra en la etapa en la que estaba: el «por ahora no» y su próximo contacto son del taller y no viajan (ADR 0064). Del estimativo viaja el día, nunca un importe. De la visita viajan el día y la marca, no la hora. De ajustes viajan exactamente los cinco campos de cobro —los cuatro de la cuenta y el link de Mercado Pago—, y solo cuando el pago que toca AHORA se ofrece por transferencia: lo que no se muestra, no se manda. El porcentaje de seña y los días que vale un presupuesto no viajan nunca; lo que viaja son el importe y la fecha que salen de ellos. Es security invoker: desde la app la llama el dueño y la RLS decide; desde el link la llama public.vista_compartida(), que ya resolvió el token (ADR 0046, 0048, 0053, 0054, 0058 y 0067).';


-- guardar_proyecto escribe hasta cuándo vale el presupuesto -------------------------------------------

-- Misma firma, así que or replace conserva los grants. Suma una clave con el patrón de la clave
-- presente, como el vencimiento: sin la clave (un bundle viejo) queda la fecha que había.

create or replace function public.guardar_proyecto(
  p_proyecto jsonb,
  p_pagos jsonb,
  p_gastos jsonb,
  p_opciones jsonb default null,
  p_necesidades jsonb default null,
  p_proximos jsonb default null
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
  v_vale_hasta date;
  v_household_id uuid;
  v_cuantas integer;
  v_aprobadas integer;
  v_monto_aprobado bigint;
  v_presupuesto bigint;
  v_entra_en_seguimiento boolean;
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

  if p_proximos is not null and jsonb_typeof(p_proximos) <> 'array' then
    raise exception 'Los próximos contactos van en un array jsonb' using errcode = '22023';
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
    visita_hora text,
    presupuesto_vale_hasta text
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

  -- El próximo contacto: el día en que hay que escribirle, la etapa a la que vuelve y, si ya se hizo,
  -- el día y el resultado. Todo se lee como texto y se revisa la forma antes de castear, por lo mismo
  -- que las fechas de los pagos.
  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_proximos, '[]'::jsonb))
      as r (id uuid, fecha text, etapa_previa text, hecho_el text, resultado text, borrado boolean)
    where r.id is null
       or (
         not coalesce(r.borrado, false)
         and (
           coalesce(r.fecha, '') !~ '^\d{4}-\d{2}-\d{2}$'
           or coalesce(r.etapa_previa, '') not in (
             'contacto', 'presupuesto_estimativo', 'relevamiento', 'a_presupuestar', 'presupuesto_enviado'
           )
           or (nullif(r.hecho_el, '') is not null and r.hecho_el !~ '^\d{4}-\d{2}-\d{2}$')
           or (nullif(r.hecho_el, '') is null) <> (nullif(r.resultado, '') is null)
           or coalesce(nullif(r.resultado, ''), 'otra_fecha') not in ('reactivado', 'perdido', 'otra_fecha')
         )
       )
  ) then
    raise exception 'Cada próximo contacto necesita id, día y la etapa a la que vuelve; si ya se hizo, el día y el resultado'
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

  -- Hasta cuándo vale el presupuesto, con el mismo patrón: un bundle viejo no la manda y no la borra.
  v_vale_hasta := case
    when p_proyecto ? 'presupuesto_vale_hasta' then nullif(v_p.presupuesto_vale_hasta, '')::date
    else v_actual.presupuesto_vale_hasta
  end;

  v_household_id := coalesce(v_actual.household_id, private.household_actual());

  -- Entra en seguimiento en este guardado: la etapa a la que vuelve es la que tenía el trabajo, y la
  -- decide la base, que la tiene en la mano, no lo que diga la app.
  v_entra_en_seguimiento := v_existia
    and v_p.estado = 'en_seguimiento'
    and v_actual.estado is distinct from 'en_seguimiento'
    and v_actual.estado in ('contacto', 'presupuesto_estimativo', 'relevamiento', 'a_presupuestar', 'presupuesto_enviado');

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
      v_actual.entrega_hora, v_actual.visita_hora, v_actual.presupuesto_vale_hasta
    ) is not distinct from (
      v_p.cliente_id, v_p.titulo, coalesce(v_p.descripcion, ''), v_p.estado,
      v_presupuesto, v_p.forma_pago, v_p.comprobante,
      v_p.fecha_visita, v_p.ultimo_contacto, v_p.fecha_inicio,
      v_p.entrega_estimada, v_p.fecha_entrega, coalesce(v_p.direccion_entrega, ''),
      coalesce(v_p.notas, ''), v_vencimiento, v_visita_hecha, v_sena_bp,
      v_entrega_hora, v_visita_hora, v_vale_hasta
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
      visita_hora = v_visita_hora,
      presupuesto_vale_hasta = v_vale_hasta
    where id = v_p.id
    returning * into v_fila;
  else
    begin
      insert into public.proyectos (
        id, cliente_id, titulo, descripcion, estado, presupuesto_centavos, forma_pago, comprobante,
        fecha_visita, ultimo_contacto, fecha_inicio, entrega_estimada, fecha_entrega,
        direccion_entrega, notas, vencimiento_presupuesto, visita_hecha, sena_bp,
        entrega_hora, visita_hora, presupuesto_vale_hasta
      ) values (
        v_p.id, v_p.cliente_id, v_p.titulo, coalesce(v_p.descripcion, ''), v_p.estado,
        v_presupuesto, v_p.forma_pago, v_p.comprobante,
        v_p.fecha_visita, v_p.ultimo_contacto, v_p.fecha_inicio, v_p.entrega_estimada,
        v_p.fecha_entrega, coalesce(v_p.direccion_entrega, ''), coalesce(v_p.notas, ''),
        v_vencimiento, v_visita_hecha, v_sena_bp, v_entrega_hora, v_visita_hora, v_vale_hasta
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

  -- El próximo contacto, también solo si viene la clave. Primero los registrados y después los
  -- pendientes: el índice único del pendiente se evalúa fila por fila, y cerrar uno y abrir el
  -- siguiente en el mismo guardado tiene que pasar por un momento sin ninguno. La marca de importante
  -- no viaja por acá: se tilda con su propio update.
  if p_proximos is not null then
    insert into public.proximos_contactos (
      id, proyecto_id, fecha, nota, etapa_previa, hecho_el, resultado, respuesta
    )
    select r.id, v_fila.id, r.fecha::date, coalesce(r.nota, ''),
           r.etapa_previa::public.estado_proyecto, r.hecho_el::date, r.resultado,
           coalesce(r.respuesta, '')
    from jsonb_to_recordset(p_proximos) as r (
      id uuid, fecha text, nota text, etapa_previa text, hecho_el text, resultado text,
      respuesta text, borrado boolean
    )
    where not coalesce(r.borrado, false)
      and nullif(r.hecho_el, '') is not null
    on conflict (id) do update set
      proyecto_id = excluded.proyecto_id,
      fecha = excluded.fecha,
      nota = excluded.nota,
      etapa_previa = excluded.etapa_previa,
      hecho_el = excluded.hecho_el,
      resultado = excluded.resultado,
      respuesta = excluded.respuesta;

    begin
      insert into public.proximos_contactos (id, proyecto_id, fecha, nota, etapa_previa, respuesta)
      select r.id, v_fila.id, r.fecha::date, coalesce(r.nota, ''),
             case
               when v_entra_en_seguimiento then v_actual.estado
               else r.etapa_previa::public.estado_proyecto
             end,
             coalesce(r.respuesta, '')
      from jsonb_to_recordset(p_proximos) as r (
        id uuid, fecha text, nota text, etapa_previa text, hecho_el text, respuesta text,
        borrado boolean
      )
      where not coalesce(r.borrado, false)
        and nullif(r.hecho_el, '') is null
      on conflict (id) do update set
        proyecto_id = excluded.proyecto_id,
        fecha = excluded.fecha,
        nota = excluded.nota,
        etapa_previa = excluded.etapa_previa,
        respuesta = excluded.respuesta;
    exception
      -- Otro dispositivo ya dejó un contacto pendiente para este trabajo: este guardado viene de
      -- una versión vieja del seguimiento. Se contesta como cualquier otro choque de versiones.
      when unique_violation then
        raise exception 'El seguimiento cambió desde que lo abriste'
          using errcode = 'MN006',
                hint = 'Abrilo de nuevo para ver cuándo le toca, y volvé a cargar lo que te falte.';
    end;
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

  update public.proximos_contactos c
  set deleted_at = now()
  from jsonb_to_recordset(coalesce(p_proximos, '[]'::jsonb)) as r (id uuid, borrado boolean)
  where c.id = r.id
    and coalesce(r.borrado, false)
    and c.proyecto_id = v_fila.id
    and c.deleted_at is null;

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
    ),
    'proximos_contactos', (
      select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb)
      from public.proximos_contactos c
      where c.household_id = v_fila.household_id
        and c.proyecto_id = v_fila.id
        and (
          c.deleted_at is null
          or c.id in (
            select (r ->> 'id')::uuid from jsonb_array_elements(coalesce(p_proximos, '[]'::jsonb)) as r
          )
        )
    )
  );
end;
$$;

comment on function public.guardar_proyecto(jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) is
  'Guarda un proyecto con sus pagos, sus gastos, sus opciones de presupuesto, lo que hace falta para el trabajo y su próximo contacto en una sola transacción, idempotente por el id del proyecto. El alta es un upsert; la edición manda la version que vio el cliente y se rechaza con MN006 si la fila cambió. Las bajas de las filas hijas vienen marcadas con borrado en su propio array. Un pago sin fecha se rechaza con MN016: la fecha la manda la app (ADR 0063); la guarda de la tabla rechaza además una fecha que todavía no llegó y una marca de la apertura que no corresponde. Con opciones vivas, el presupuesto del proyecto sale de la opción aprobada y no de lo que manda el cliente. Entrar en seguimiento, cambiar la fecha y registrar el contacto viajan en p_proximos junto con el estado, y la guarda diferida exige que el trabajo en seguimiento tenga su contacto pendiente (MN019, ADR 0064); al entrar, la etapa a la que vuelve la pone la base. Hasta cuándo vale el presupuesto (presupuesto_vale_hasta) se escribe solo si la clave viene en el pedido, como el vencimiento (ADR 0067). p_opciones, p_necesidades y p_proximos en null quieren decir "no toques eso", para que un bundle viejo no lo borre; lo mismo la clave ya_en_la_apertura de cada pago. Los cuatro costos estimados no los escribe esta función: van por un update de sus columnas solas.';
