-- Mover la aprobación de una opción a otra, en un solo guardado (ADR 0043).
--
-- El índice único parcial opciones_de_presupuesto_una_aprobada se evalúa fila por fila, apenas se
-- escribe cada una: un índice no se puede diferir, solo un constraint. El upsert de las opciones toca
-- todas las filas en una sola sentencia y el orden entre ellas no está definido, así que si Postgres
-- escribía primero la que se aprueba, había dos aprobadas a la vez y la sentencia cortaba con 23505,
-- un rechazo definitivo, sin traducción y que además tapa la cola.
--
-- El arreglo es apagar todas las aprobaciones del trabajo antes del upsert. Así nunca hay dos
-- prendidas al mismo tiempo, sea cual sea el orden, y el índice deja de depender del azar.
--
-- No cambia la firma, así que va con create or replace y no toca grants. Ninguna fila cambia de valor.

create or replace function public.guardar_proyecto(
  p_proyecto jsonb,
  p_pagos jsonb,
  p_gastos jsonb,
  p_opciones jsonb default null
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
    sena_bp integer
  );

  if v_p.id is null or v_p.cliente_id is null or v_p.titulo is null or v_p.estado is null then
    raise exception 'El proyecto necesita id, cliente, título y estado' using errcode = '22004';
  end if;

  -- Una fila hija sin id o sin monto rebotaría contra un not null con un 23502 genérico, que no es
  -- un mensaje para el usuario y que tapa la cola igual que cualquier otro rechazo definitivo.
  if exists (
    select 1
    from jsonb_to_recordset(p_pagos) as r (id uuid, fecha text, monto_centavos bigint, borrado boolean)
    where r.id is null
       or (not coalesce(r.borrado, false) and (nullif(r.fecha, '') is null or r.monto_centavos is null))
  ) then
    raise exception 'Cada pago necesita id, fecha y monto' using errcode = '22004';
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
      v_actual.vencimiento_presupuesto, v_actual.visita_hecha, v_actual.sena_bp
    ) is not distinct from (
      v_p.cliente_id, v_p.titulo, coalesce(v_p.descripcion, ''), v_p.estado,
      v_presupuesto, v_p.forma_pago, v_p.comprobante,
      v_p.fecha_visita, v_p.ultimo_contacto, v_p.fecha_inicio,
      v_p.entrega_estimada, v_p.fecha_entrega, coalesce(v_p.direccion_entrega, ''),
      coalesce(v_p.notas, ''), v_vencimiento, v_visita_hecha, v_sena_bp
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
  -- servidor cambió algo el guardado se rechaza en vez de pisarlo en silencio.
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
      sena_bp = v_sena_bp
    where id = v_p.id
    returning * into v_fila;
  else
    begin
      insert into public.proyectos (
        id, cliente_id, titulo, descripcion, estado, presupuesto_centavos, forma_pago, comprobante,
        fecha_visita, ultimo_contacto, fecha_inicio, entrega_estimada, fecha_entrega,
        direccion_entrega, notas, vencimiento_presupuesto, visita_hecha, sena_bp
      ) values (
        v_p.id, v_p.cliente_id, v_p.titulo, coalesce(v_p.descripcion, ''), v_p.estado,
        v_presupuesto, v_p.forma_pago, v_p.comprobante,
        v_p.fecha_visita, v_p.ultimo_contacto, v_p.fecha_inicio, v_p.entrega_estimada,
        v_p.fecha_entrega, coalesce(v_p.direccion_entrega, ''), coalesce(v_p.notas, ''),
        v_vencimiento, v_visita_hecha, v_sena_bp
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

  -- Los hijos van después del proyecto: la foreign key compuesta exige que el padre exista.
  insert into public.pagos (id, proyecto_id, fecha, concepto, monto_centavos)
  select r.id, v_fila.id, r.fecha::date, coalesce(r.concepto, ''), r.monto_centavos
  from jsonb_to_recordset(p_pagos) as r (
    id uuid, fecha text, concepto text, monto_centavos bigint, borrado boolean
  )
  where not coalesce(r.borrado, false)
  on conflict (id) do update set
    proyecto_id = excluded.proyecto_id,
    fecha = excluded.fecha,
    concepto = excluded.concepto,
    monto_centavos = excluded.monto_centavos;

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
    )
  );
end;
$$;
