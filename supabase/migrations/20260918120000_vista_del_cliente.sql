-- La vista del cliente: una pantalla pública que muestra lo que el cliente puede saber de su
-- trabajo, y nada más (ADR 0046).
--
-- El dueño va a la casa del cliente, termina de instalar y le tienen que pagar. Quiere abrir la app
-- y mostrarle cuánto valía, cuánto pagó, cuánto falta y las fotos. Y quiere poder pasarle un link
-- para que lo abra en su casa. Lo que no puede ver el cliente: costos estimados, margen, diezmo,
-- distribución, herrajes, herramientas, notas de obra, opciones de presupuesto que no aprobó, y
-- cualquier otro trabajo o cliente del taller.
--
-- La garantía no es que la pantalla esconda campos: es que los campos no viajan. Una función con
-- permisos elevados enumera uno por uno lo que devuelve, y el rol anónimo no tiene permiso sobre
-- ninguna otra cosa de la base.
--
-- Cinco piezas, todas aditivas. Ninguna fila existente cambia de valor.
--
-- 1. public.archivos.visible_para_cliente: el interruptor por archivo, apagado por defecto. El
--    dueño decide archivo por archivo, porque «los planos sí» y «el despiece no» conviven en la
--    misma carpeta, y porque el día que suba el comprobante de lo que le pagó a su proveedor tiene
--    que estar oculto porque sí y no porque se acordó de tildarlo.
-- 2. public.enlaces_publicos: el link. Token propio y aleatorio, guardado hasheado; sin caducidad
--    y revocable.
-- 3. public.cambios_de_estado: el registro de cuándo el trabajo pasó de una etapa a otra. Hoy no lo
--    muestra nada: se empieza a guardar ahora porque la historia que no se guarda hoy no se puede
--    mostrar mañana. Lo escribe un trigger, no el cliente.
-- 4. public.vista_del_cliente(uuid): la lista blanca. Enumera los campos que devuelve y nunca
--    devuelve la fila entera. Es security invoker: el dueño la llama desde la app y la RLS decide.
-- 5. public.vista_compartida(text): la misma función, entrando por el token, para el rol anónimo.
--    Es la única función de la base que anon puede ejecutar, y la única security definer de public.


-- El interruptor de cada archivo ---------------------------------------------------------------------

alter table public.archivos
  add column visible_para_cliente boolean not null default false;

comment on column public.archivos.visible_para_cliente is
  'Si este archivo se ve en la vista del cliente. Apagado por defecto, siempre: un archivo nuevo es privado hasta que el dueño decide lo contrario, nunca al revés (ADR 0046).';

-- Solo update, sin insert: un archivo nace privado y se comparte después, tildándolo. Sin grant de
-- insert, ningún camino puede subir un archivo ya compartido.
grant update (visible_para_cliente) on table public.archivos to authenticated;


-- El link --------------------------------------------------------------------------------------------

create table public.enlaces_publicos (
  id uuid primary key default private.uuidv7(),
  household_id uuid not null default private.household_actual()
    references public.households (id) on delete cascade,
  proyecto_id uuid not null,
  token_hash text not null,
  revocado_at timestamptz,
  visitas integer not null default 0,
  ultima_visita_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,

  -- Compuesta, como la de pagos, gastos y archivos: un link no cuelga de un trabajo de otro
  -- household.
  constraint enlaces_publicos_proyecto_fk foreign key (household_id, proyecto_id)
    references public.proyectos (household_id, id),
  -- 64 caracteres hexadecimales: un sha256. El largo lo controla el check para que una fila con
  -- cualquier otra cosa adentro no llegue nunca a compararse contra un token.
  constraint enlaces_publicos_hash_valido check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint enlaces_publicos_visitas_no_negativas check (visitas >= 0)
);

comment on table public.enlaces_publicos is
  'El link sin sesión de un trabajo. Lo que se guarda es el sha256 del token, nunca el token: con lo que hay acá no se puede fabricar un link. El token se muestra una sola vez, cuando se crea (ADR 0046).';
comment on column public.enlaces_publicos.household_id is 'Default: el household del usuario de la sesión. El cliente de la app no lo manda.';
comment on column public.enlaces_publicos.token_hash is
  'sha256 del token en hexadecimal. El token es aleatorio y no es el id del trabajo: el id codifica el momento en que se creó y no sirve como secreto.';
comment on column public.enlaces_publicos.revocado_at is
  'Cuándo se dio de baja. Null es activo. No hay caducidad automática: el uso es compartirlo al empezar una obra que dura meses, y un link que se vence a la mitad solo hace que el cliente llame (ADR 0046).';
comment on column public.enlaces_publicos.visitas is 'Cuántas veces se abrió. Lo cuenta public.vista_compartida().';
comment on column public.enlaces_publicos.ultima_visita_at is 'La última vez que se abrió.';
comment on column public.enlaces_publicos.deleted_at is 'Borrado lógico, como en todo el household. Borrar el trabajo se lleva su link.';

create unique index enlaces_publicos_token on public.enlaces_publicos (token_hash);
create index enlaces_publicos_household_actualizado on public.enlaces_publicos (household_id, updated_at);
-- Foreign key compuesta hacia proyectos.
create index enlaces_publicos_household_proyecto on public.enlaces_publicos (household_id, proyecto_id);

-- Un solo link vivo por trabajo. Crear uno nuevo revoca el anterior en su propia sentencia, antes
-- de insertar: un índice único parcial no se puede diferir y el orden entre filas de una misma
-- sentencia no está definido (ADR 0043).
create unique index enlaces_publicos_uno_vivo_por_trabajo
  on public.enlaces_publicos (household_id, proyecto_id)
  where revocado_at is null and deleted_at is null;

create trigger metadatos
  before insert or update on public.enlaces_publicos
  for each row execute function private.mantener_metadatos();

alter table public.enlaces_publicos enable row level security;

revoke all on table public.enlaces_publicos from anon, authenticated;

grant select on table public.enlaces_publicos to authenticated;
-- visitas y ultima_visita_at no están: las escribe la función pública, que corre elevada. El
-- dueño no las toca.
grant insert (id, proyecto_id, token_hash, revocado_at, deleted_at)
  on table public.enlaces_publicos to authenticated;
grant update (id, proyecto_id, token_hash, revocado_at, deleted_at)
  on table public.enlaces_publicos to authenticated;

create policy enlaces_publicos_lectura on public.enlaces_publicos
  for select to authenticated
  using (household_id = any (array(select private.user_household_ids())));

create policy enlaces_publicos_alta on public.enlaces_publicos
  for insert to authenticated
  with check (household_id = any (array(select private.user_household_ids())));

create policy enlaces_publicos_edicion on public.enlaces_publicos
  for update to authenticated
  using (household_id = any (array(select private.user_household_ids())))
  with check (household_id = any (array(select private.user_household_ids())));


-- La historia de las etapas ----------------------------------------------------------------------------

create table public.cambios_de_estado (
  id uuid primary key default private.uuidv7(),
  household_id uuid not null
    references public.households (id) on delete cascade,
  proyecto_id uuid not null,
  desde public.estado_proyecto,
  hacia public.estado_proyecto not null,
  ocurrio_el date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,

  constraint cambios_de_estado_proyecto_fk foreign key (household_id, proyecto_id)
    references public.proyectos (household_id, id),
  constraint cambios_de_estado_cambia check (desde is distinct from hacia)
);

comment on table public.cambios_de_estado is
  'Cuándo el trabajo pasó de una etapa a otra. Lo escribe un trigger sobre proyectos y nadie más: no hay grant de insert ni de update para la app. Hoy no lo muestra ninguna pantalla; se guarda desde ahora porque la línea de tiempo que el cliente va a ver necesita fechas que no se pueden reconstruir después (ADR 0046).';
comment on column public.cambios_de_estado.desde is 'La etapa de la que salió. Null en el alta del trabajo.';
comment on column public.cambios_de_estado.ocurrio_el is
  'El día del cambio, en la hora del taller. El taller está en Argentina y un cambio guardado a las diez de la noche no puede quedar anotado al día siguiente.';
comment on column public.cambios_de_estado.deleted_at is 'Sin uso: el registro no se borra. La columna está porque toda tabla del household la tiene.';

create index cambios_de_estado_household_actualizado on public.cambios_de_estado (household_id, updated_at);
-- Foreign key compuesta hacia proyectos, y el acceso de la vista del cliente: los cambios de un
-- trabajo, del más viejo al más nuevo.
create index cambios_de_estado_household_proyecto on public.cambios_de_estado (household_id, proyecto_id, ocurrio_el);

create trigger metadatos
  before insert or update on public.cambios_de_estado
  for each row execute function private.mantener_metadatos();

alter table public.cambios_de_estado enable row level security;

revoke all on table public.cambios_de_estado from anon, authenticated;

-- Solo lectura: las filas las pone el trigger, que corre elevado. Sin insert ni update, nadie puede
-- inventarse una historia ni corregirla.
grant select on table public.cambios_de_estado to authenticated;

create policy cambios_de_estado_lectura on public.cambios_de_estado
  for select to authenticated
  using (household_id = any (array(select private.user_household_ids())));

create function private.anotar_el_cambio_de_estado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.estado is not distinct from old.estado then
    return null;
  end if;

  insert into public.cambios_de_estado (household_id, proyecto_id, desde, hacia, ocurrio_el)
  values (
    new.household_id,
    new.id,
    case when tg_op = 'UPDATE' then old.estado end,
    new.estado,
    (now() at time zone 'America/Argentina/Buenos_Aires')::date
  );

  return null;
end;
$$;

comment on function private.anotar_el_cambio_de_estado() is
  'Anota en public.cambios_de_estado cada vez que un trabajo cambia de etapa, venga de donde venga (el agregado, el cobro, la reapertura). Es security definer porque la app no tiene grant de insert sobre esa tabla: la historia no la escribe el cliente.';

revoke all on function private.anotar_el_cambio_de_estado() from public, anon, authenticated;

create trigger anotar_el_cambio_de_estado
  after insert or update of estado on public.proyectos
  for each row execute function private.anotar_el_cambio_de_estado();


-- Borrar un trabajo se lleva su link --------------------------------------------------------------------

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

  update public.necesidades
  set deleted_at = new.deleted_at
  where household_id = new.household_id
    and proyecto_id = new.id
    and deleted_at is null;

  -- Lo que agrega esta migración: un trabajo borrado no puede seguir abriéndose desde afuera.
  update public.enlaces_publicos
  set deleted_at = new.deleted_at
  where household_id = new.household_id
    and proyecto_id = new.id
    and deleted_at is null;

  return null;
end;
$$;


-- La lista blanca -----------------------------------------------------------------------------------------

create function private.ruta_del_archivo(
  p_household_id uuid,
  p_proyecto_id uuid,
  p_archivo_id uuid,
  p_tipo text,
  p_miniatura boolean
)
returns text
language sql
immutable
set search_path = ''
as $$
  select p_household_id::text || '/' || p_proyecto_id::text || '/' || p_archivo_id::text
    || case
         when p_miniatura and p_tipo in ('image/webp', 'image/jpeg') then '.mini'
         else ''
       end
    || case p_tipo
         when 'image/webp' then '.webp'
         when 'image/jpeg' then '.jpg'
         when 'application/pdf' then '.pdf'
         else '.bin'
       end
$$;

comment on function private.ruta_del_archivo(uuid, uuid, uuid, text, boolean) is
  'La ruta del binario en el bucket archivos, la misma que arma la app (ADR 0039). La vista del cliente la manda ya armada para que el navegador del cliente no tenga que conocer la convención.';

-- La llama public.vista_del_cliente(), que es security invoker: sin este grant, el dueño no puede
-- abrir la vista desde su propia app. No toca ninguna tabla, arma un texto con lo que recibe.
revoke all on function private.ruta_del_archivo(uuid, uuid, uuid, text, boolean)
  from public, anon, authenticated;
grant execute on function private.ruta_del_archivo(uuid, uuid, uuid, text, boolean) to authenticated;


create function public.vista_del_cliente(p_proyecto_id uuid)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_p public.proyectos;
  v_taller text;
  v_cliente text;
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

  select h.nombre into v_taller from public.households h where h.id = v_p.household_id;
  select c.nombre into v_cliente from public.clientes c where c.id = v_p.cliente_id;

  -- Los campos van enumerados uno por uno, a propósito. Si esto fuera to_jsonb(v_p) con la pantalla
  -- filtrando, el día que alguien le agregue una columna a proyectos esa columna quedaría expuesta
  -- sin que nadie lo decida: lo que el cliente ve se decide acá, no en el navegador. La suite lo
  -- controla con supabase/tests/25_vista_del_cliente.sql, que falla apenas aparece una columna
  -- nueva en proyectos hasta que alguien la clasifica como pública o privada.
  return jsonb_build_object(
    'taller', jsonb_build_object('nombre', v_taller),
    'cliente', jsonb_build_object('nombre', v_cliente),
    'trabajo', v_p.titulo,
    'direccion', v_p.direccion_entrega,
    'estado', v_p.estado,
    'precio_centavos', v_p.presupuesto_centavos,
    'fechas', jsonb_build_object(
      'presupuesto', (
        select min(c.ocurrio_el)
        from public.cambios_de_estado c
        where c.household_id = v_p.household_id
          and c.proyecto_id = v_p.id
          and c.hacia = 'presupuesto_enviado'
      ),
      'aprobado', (
        select min(c.ocurrio_el)
        from public.cambios_de_estado c
        where c.household_id = v_p.household_id
          and c.proyecto_id = v_p.id
          and c.hacia = 'en_curso'
      ),
      'inicio', v_p.fecha_inicio,
      'entrega_pautada', v_p.entrega_estimada,
      'entregado', v_p.fecha_entrega,
      'cobro', case when v_p.estado = 'cobrado' then v_p.fecha_cobro end
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
  'Lo único que un cliente puede ver de su trabajo: cuánto vale, cuánto pagó, en qué anda, la dirección de entrega y los archivos que el dueño marcó. Enumera los campos uno por uno y nunca devuelve la fila entera: convertirla en un select * expondría cada columna nueva de proyectos sin que nadie lo decida, costos estimados y margen incluidos. Es security invoker: desde la app la llama el dueño y la RLS decide; desde el link la llama public.vista_compartida(), que ya resolvió el token (ADR 0046).';

revoke all on function public.vista_del_cliente(uuid) from public, anon, authenticated;
grant execute on function public.vista_del_cliente(uuid) to authenticated;


-- La puerta del link ----------------------------------------------------------------------------------------

create function public.vista_compartida(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enlace public.enlaces_publicos;
begin
  -- Un token que no tiene la forma de un token no llega ni a consultarse.
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{16,128}$' then
    raise exception 'Este link no funciona' using errcode = 'MN010';
  end if;

  select * into v_enlace
  from public.enlaces_publicos e
  where e.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
    and e.revocado_at is null
    and e.deleted_at is null;

  -- Inexistente, revocado y de un trabajo borrado contestan exactamente lo mismo: el que tiene el
  -- link no se entera de si alguna vez existió, ni de quién es, ni de nada.
  if not found then
    raise exception 'Este link no funciona' using errcode = 'MN010';
  end if;

  update public.enlaces_publicos
  set visitas = visitas + 1, ultima_visita_at = now()
  where id = v_enlace.id;

  return public.vista_del_cliente(v_enlace.proyecto_id);
exception
  -- La vista rechaza con 42501 lo que no existe, lo que no es del household y lo que se dio por
  -- perdido. Desde afuera todo eso es la misma frase: el link no funciona.
  when insufficient_privilege then
    raise exception 'Este link no funciona' using errcode = 'MN010';
end;
$$;

comment on function public.vista_compartida(text) is
  'La vista del cliente entrando por el link, sin sesión. Es la única función de la base que el rol anónimo puede ejecutar y la única security definer de public: anon no tiene permiso sobre ninguna tabla, así que sin elevar no llega a nada. Resuelve el token contra el hash guardado —el token en claro no está en la base— y delega en public.vista_del_cliente(), que es la lista blanca. Un token inválido, revocado o inexistente contestan lo mismo (ADR 0046).';

revoke all on function public.vista_compartida(text) from public, anon, authenticated;
grant execute on function public.vista_compartida(text) to anon, authenticated;


-- La réplica trae los links ----------------------------------------------------------------------------------

-- Una clave más en el mismo JSON. Un bundle viejo lee solo las tablas que conoce y la ignora.
-- public.cambios_de_estado queda afuera a propósito: todavía no la muestra ninguna pantalla, y una
-- tabla que nadie lee no tiene por qué viajar en cada sincronización.
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
    'necesidades', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.necesidades t where t.deleted_at is null
    ),
    'movimientos', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.movimientos t where t.deleted_at is null
    ),
    'anotaciones', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.anotaciones t where t.deleted_at is null
    ),
    'archivos', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.archivos t where t.deleted_at is null
    ),
    'enlaces_publicos', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.enlaces_publicos t where t.deleted_at is null
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
    'necesidades', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.necesidades t where t.updated_at >= v_desde
    ),
    'movimientos', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.movimientos t where t.updated_at >= v_desde
    ),
    'anotaciones', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.anotaciones t where t.updated_at >= v_desde
    ),
    'archivos', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.archivos t where t.updated_at >= v_desde
    ),
    'enlaces_publicos', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.enlaces_publicos t where t.updated_at >= v_desde
    )
  );
end;
$$;
