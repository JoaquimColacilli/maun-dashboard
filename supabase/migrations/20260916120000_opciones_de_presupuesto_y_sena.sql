-- Las opciones de presupuesto y la seña esperada (ADR 0043).
--
-- El dueño presenta más de un presupuesto para el mismo trabajo ("solo el escritorio de Alan" contra
-- "los 2 escritorios") y hoy las escribe donde puede: en las notas, o como gastos de diez centavos.
-- Acá tienen lugar propio.
--
-- Cuatro piezas:
--
-- 1. public.opciones_de_presupuesto: una fila por opción, hija del agregado como los pagos y los
--    gastos. Se escribe por guardar_proyecto, en la misma transacción y con el mismo chequeo de
--    versión, así que sigue siendo un solo ítem en la cola (ADR 0015).
-- 2. El presupuesto del trabajo pasa a derivarse cuando hay opciones: es el importe de la aprobada, o
--    null si todavía no eligieron. Un trabajo sin opciones sigue cargando el presupuesto como hasta
--    hoy, sin cambio de comportamiento.
-- 3. Un trigger de constraint diferido garantiza eso desde la base, no desde la pantalla: con
--    opciones vivas, el presupuesto solo puede ser el de la aprobada. Es diferido porque adentro de
--    una misma transacción el proyecto se escribe antes que sus hijas, y a mitad de camino el par
--    todavía no cierra.
-- 4. La seña esperada: un porcentaje del presupuesto, con el valor del taller en ajustes.sena_bp y la
--    posibilidad de pisarlo por trabajo en proyectos.sena_bp. La cuenta vive en @maun/domain y no
--    tiene gemela acá: la base no la consume.
--
-- Aditiva. Crea una tabla, agrega dos columnas nullable o con default, y reemplaza guardar_proyecto,
-- bootstrap(), delta() y la baja en cascada. Ninguna fila existente cambia de valor: los trabajos que
-- hoy tienen presupuesto no tienen opciones, así que el invariante nuevo los deja como están.


-- La tabla ------------------------------------------------------------------------------------------

create table public.opciones_de_presupuesto (
  id uuid primary key default private.uuidv7(),
  household_id uuid not null default private.household_actual()
    references public.households (id) on delete cascade,
  proyecto_id uuid not null,
  descripcion text not null default '',
  monto_centavos bigint not null,
  aprobada boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,

  -- Compuesta, como la de pagos y gastos: una opción no cuelga de un trabajo de otro household.
  constraint opciones_de_presupuesto_proyecto_fk foreign key (household_id, proyecto_id)
    references public.proyectos (household_id, id),
  constraint opciones_de_presupuesto_descripcion_larga check (char_length(descripcion) <= 500),
  -- El mismo rango que proyectos_presupuesto_no_negativo: una opción es un presupuesto.
  constraint opciones_de_presupuesto_monto_no_negativo check (monto_centavos >= 0)
);

comment on table public.opciones_de_presupuesto is
  'Las opciones de presupuesto que se le presentaron al cliente para un trabajo. Cuando el cliente elige, se tilda una y su importe pasa a ser el presupuesto del trabajo. Las que no eligió no se borran: son lo que se ofreció (ADR 0043).';
comment on column public.opciones_de_presupuesto.household_id is 'Default: el household del usuario de la sesión. El cliente de la app no lo manda.';
comment on column public.opciones_de_presupuesto.descripcion is 'Qué incluye esta opción, y el plan de pago si lo hay. Es donde va lo que antes se escribía en las notas.';
comment on column public.opciones_de_presupuesto.monto_centavos is 'El importe de esta opción, en centavos. Cuando se aprueba, es el presupuesto del trabajo.';
comment on column public.opciones_de_presupuesto.aprobada is 'La que eligió el cliente. Hay a lo sumo una viva por trabajo, y mientras no haya ninguna el trabajo no tiene presupuesto.';
comment on column public.opciones_de_presupuesto.deleted_at is 'Borrado lógico, como en todo el household.';

create index opciones_de_presupuesto_household_actualizado
  on public.opciones_de_presupuesto (household_id, updated_at);
-- Foreign key compuesta hacia proyectos.
create index opciones_de_presupuesto_household_proyecto
  on public.opciones_de_presupuesto (household_id, proyecto_id);

-- Una sola aprobada viva por trabajo. Es el invariante que hace que "el presupuesto del trabajo" sea
-- una función y no una elección: sin esto, dos aprobadas dejarían el presupuesto indefinido.
create unique index opciones_de_presupuesto_una_aprobada
  on public.opciones_de_presupuesto (household_id, proyecto_id)
  where aprobada and deleted_at is null;

create trigger metadatos
  before insert or update on public.opciones_de_presupuesto
  for each row execute function private.mantener_metadatos();

alter table public.opciones_de_presupuesto enable row level security;

revoke all on table public.opciones_de_presupuesto from anon, authenticated;

grant select on table public.opciones_de_presupuesto to authenticated;
-- Las escribe guardar_proyecto, que es security invoker: corre con los grants de quien llama, así que
-- sin estos grants la función no podría escribir. Sin grant de delete: la baja es lógica.
grant insert (id, proyecto_id, descripcion, monto_centavos, aprobada, deleted_at)
  on table public.opciones_de_presupuesto to authenticated;
grant update (id, proyecto_id, descripcion, monto_centavos, aprobada, deleted_at)
  on table public.opciones_de_presupuesto to authenticated;

create policy opciones_de_presupuesto_lectura on public.opciones_de_presupuesto
  for select to authenticated
  using (household_id = any (array(select private.user_household_ids())));

create policy opciones_de_presupuesto_alta on public.opciones_de_presupuesto
  for insert to authenticated
  with check (household_id = any (array(select private.user_household_ids())));

create policy opciones_de_presupuesto_edicion on public.opciones_de_presupuesto
  for update to authenticated
  using (household_id = any (array(select private.user_household_ids())))
  with check (household_id = any (array(select private.user_household_ids())));


-- La seña esperada -----------------------------------------------------------------------------------

alter table public.ajustes
  add column sena_bp integer not null default 5000
    constraint ajustes_sena_valida check (sena_bp between 0 and 10000);

comment on column public.ajustes.sena_bp is
  'La seña que se pide para confirmar un trabajo, en puntos básicos del presupuesto (5000 = 50%, que es lo habitual). Se puede pisar por trabajo en proyectos.sena_bp.';

grant update (sena_bp) on table public.ajustes to authenticated;

alter table public.proyectos
  add column sena_bp integer
    constraint proyectos_sena_valida check (sena_bp is null or sena_bp between 0 and 10000);

comment on column public.proyectos.sena_bp is
  'La seña de este trabajo, en puntos básicos, cuando no es la del taller. Null es "la de ajustes". El dueño dijo que la seña normal es la mitad pero puede ser otra.';

grant insert (sena_bp) on table public.proyectos to authenticated;
grant update (sena_bp) on table public.proyectos to authenticated;


-- El presupuesto sale de las opciones, y lo garantiza la base --------------------------------------

-- Con opciones vivas, el presupuesto del trabajo no se elige: es el de la aprobada, o nada mientras no
-- haya ninguna. Que lo diga la base y no la pantalla es lo que impide que existan dos caminos que
-- escriban ese número (ADR 0043).
create or replace function private.validar_presupuesto_aprobado()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_household_id uuid;
  v_proyecto_id uuid;
  v_presupuesto bigint;
  v_cuantas integer;
  v_esperado bigint;
begin
  if tg_table_name = 'proyectos' then
    v_household_id := new.household_id;
    v_proyecto_id := new.id;
  else
    v_household_id := new.household_id;
    v_proyecto_id := new.proyecto_id;
  end if;

  select p.presupuesto_centavos into v_presupuesto
  from public.proyectos p
  where p.household_id = v_household_id and p.id = v_proyecto_id;

  -- El trabajo ya no está: lo borró la misma transacción y la baja en cascada se llevó sus opciones.
  if not found then
    return null;
  end if;

  select count(*)::integer, min(monto_centavos) filter (where aprobada)
  into v_cuantas, v_esperado
  from public.opciones_de_presupuesto
  where household_id = v_household_id
    and proyecto_id = v_proyecto_id
    and deleted_at is null;

  -- Sin opciones, el presupuesto es un campo más y lo carga el usuario: nada que validar.
  if v_cuantas = 0 then
    return null;
  end if;

  if v_presupuesto is distinct from v_esperado then
    raise exception 'El presupuesto de un trabajo con opciones sale de la opción aprobada'
      using errcode = 'MN009',
            detail = format(
              'presupuesto %s, opciones vivas %s, esperado %s',
              coalesce(v_presupuesto::text, 'sin presupuesto'),
              v_cuantas,
              coalesce(v_esperado::text, 'sin presupuesto')
            ),
            hint = 'Tildá la opción que te aprobaron, o sacá las opciones si querés cargar el presupuesto a mano.';
  end if;

  return null;
end;
$$;

comment on function private.validar_presupuesto_aprobado() is
  'Con opciones vivas, el presupuesto del trabajo tiene que ser el de la opción aprobada (o null si no hay ninguna). Es un trigger de constraint diferido: adentro de una transacción el proyecto se escribe antes que sus hijas, así que el par recién tiene que cerrar al final.';

revoke all on function private.validar_presupuesto_aprobado() from public;

create constraint trigger presupuesto_aprobado
  after insert or update on public.proyectos
  deferrable initially deferred
  for each row execute function private.validar_presupuesto_aprobado();

create constraint trigger presupuesto_aprobado
  after insert or update on public.opciones_de_presupuesto
  deferrable initially deferred
  for each row execute function private.validar_presupuesto_aprobado();


-- Borrar un trabajo se lleva sus opciones -----------------------------------------------------------

create or replace function private.borrar_hijos_de_proyecto()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.pagos
  set deleted_at = new.deleted_at
  where household_id = new.household_id
    and proyecto_id = new.id
    and deleted_at is null;

  update public.gastos
  set deleted_at = new.deleted_at
  where household_id = new.household_id
    and proyecto_id = new.id
    and deleted_at is null;

  update public.archivos
  set deleted_at = new.deleted_at
  where household_id = new.household_id
    and proyecto_id = new.id
    and deleted_at is null;

  update public.opciones_de_presupuesto
  set deleted_at = new.deleted_at
  where household_id = new.household_id
    and proyecto_id = new.id
    and deleted_at is null;

  return null;
end;
$$;


-- La réplica trae las opciones -----------------------------------------------------------------------

-- Una clave más en el mismo JSON. Un bundle viejo lee solo las tablas que conoce y la ignora.
create or replace function public.bootstrap()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'cursor', now(),
    'households', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.households t where t.deleted_at is null
    ),
    'household_members', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.household_members t where t.deleted_at is null
    ),
    'ajustes', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.ajustes t where t.deleted_at is null
    ),
    'clientes', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.clientes t where t.deleted_at is null
    ),
    'proyectos', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.proyectos t where t.deleted_at is null
    ),
    'pagos', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.pagos t where t.deleted_at is null
    ),
    'gastos', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.gastos t where t.deleted_at is null
    ),
    'opciones_de_presupuesto', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.opciones_de_presupuesto t where t.deleted_at is null
    ),
    'movimientos', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.movimientos t where t.deleted_at is null
    ),
    'anotaciones', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.anotaciones t where t.deleted_at is null
    ),
    'archivos', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.archivos t where t.deleted_at is null
    )
  )
$$;

create or replace function public.delta(p_desde timestamptz)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_desde timestamptz;
begin
  if p_desde is null then
    raise exception 'delta() necesita un cursor: sin cursor corresponde bootstrap()'
      using errcode = '22004';
  end if;

  v_desde := p_desde - interval '5 minutes';

  return jsonb_build_object(
    'cursor', now(),
    'households', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.households t where t.updated_at >= v_desde
    ),
    'household_members', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.household_members t where t.updated_at >= v_desde
    ),
    'ajustes', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.ajustes t where t.updated_at >= v_desde
    ),
    'clientes', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.clientes t where t.updated_at >= v_desde
    ),
    'proyectos', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.proyectos t where t.updated_at >= v_desde
    ),
    'pagos', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.pagos t where t.updated_at >= v_desde
    ),
    'gastos', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.gastos t where t.updated_at >= v_desde
    ),
    'opciones_de_presupuesto', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.opciones_de_presupuesto t where t.updated_at >= v_desde
    ),
    'movimientos', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.movimientos t where t.updated_at >= v_desde
    ),
    'anotaciones', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.anotaciones t where t.updated_at >= v_desde
    ),
    'archivos', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.archivos t where t.updated_at >= v_desde
    )
  );
end;
$$;


-- guardar_proyecto guarda también las opciones -------------------------------------------------------

-- La firma cambia, así que es drop y create y no create or replace: con otra lista de argumentos,
-- or replace deja las dos funciones y la llamada queda ambigua. El parámetro nuevo lleva default, que
-- es lo que hace el cambio retrocompatible: un bundle viejo servido por el service worker sigue
-- llamando con tres argumentos, y p_opciones en null quiere decir "no toques las opciones".
drop function public.guardar_proyecto(jsonb, jsonb, jsonb);

create function public.guardar_proyecto(
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

revoke all on function public.guardar_proyecto(jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.guardar_proyecto(jsonb, jsonb, jsonb, jsonb) to authenticated;

comment on function public.guardar_proyecto(jsonb, jsonb, jsonb, jsonb) is
  'Guarda un proyecto con sus pagos, sus gastos y sus opciones de presupuesto en una sola transacción, idempotente por el id del proyecto. El alta es un upsert; la edición manda la version que vio el cliente y se rechaza con MN006 si la fila cambió. Las bajas de las filas hijas vienen marcadas con borrado en su propio array. Con opciones vivas, el presupuesto del proyecto sale de la opción aprobada y no de lo que manda el cliente. p_opciones en null quiere decir "no toques las opciones", para que un bundle viejo no las borre.';
