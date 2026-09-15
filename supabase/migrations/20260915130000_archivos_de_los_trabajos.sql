-- Los archivos de los trabajos (ADR 0039).
--
-- Fotos del relevamiento, planos de despiece y presupuestos en PDF, renders, capturas del software y
-- de transferencias, colgados de un contacto o de una obra: los dos son una fila de proyectos
-- (ADR 0019), así que un archivo cuelga de proyectos y sigue al trabajo cuando se aprueba.
--
-- Dos piezas:
--
-- 1. public.archivos: una fila por archivo, sincronizable. Con la réplica, la lista de archivos de un
--    trabajo se ve sin señal y borrar tiene deshacer por la cola, como una anotación. El binario no
--    viaja por la cola: la cola maneja JSON, y la subida se hace en línea.
-- 2. El bucket público archivos, con una carpeta por household y por trabajo:
--    {household}/{proyecto}/{archivo}.webp y, al lado, {archivo}.mini.webp. Tope de 10 MiB por archivo
--    y solo WebP, JPEG y PDF: la app achica y convierte las imágenes antes de subirlas, y un video no
--    entra. Es público para que se sirva por el CDN con una URL fija, que es lo que más cachea; escribir
--    y listar quedan atados al household.
--
-- Aditiva. Crea la tabla y el bucket, y reemplaza bootstrap(), delta() y la baja en cascada de un
-- proyecto para que conozcan la tabla nueva. Ninguna fila existente cambia.


-- La tabla ----------------------------------------------------------------------------------------------

create table public.archivos (
  id uuid primary key default private.uuidv7(),
  household_id uuid not null default private.household_actual()
    references public.households (id) on delete cascade,
  proyecto_id uuid not null,
  nombre text not null,
  tipo text not null,
  bytes bigint not null,
  ancho integer,
  alto integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,

  -- Compuesta, como la de anotaciones: un archivo no cuelga de un trabajo de otro household.
  constraint archivos_proyecto_fk foreign key (household_id, proyecto_id)
    references public.proyectos (household_id, id),
  constraint archivos_nombre_valido check (btrim(nombre) <> '' and char_length(nombre) <= 200),
  constraint archivos_tipo_valido check (tipo in ('image/webp', 'image/jpeg', 'application/pdf')),
  constraint archivos_bytes_validos check (bytes > 0 and bytes <= 20971520),
  constraint archivos_medidas_validas check (
    (ancho is null) = (alto is null) and (ancho is null or (ancho > 0 and alto > 0))
  )
);

comment on table public.archivos is
  'Los archivos de un trabajo (contacto u obra): fotos, capturas y PDF. El binario vive en el bucket archivos, en {household}/{proyecto}/{id}.{extensión}; esta fila es lo que la réplica trae (ADR 0039).';
comment on column public.archivos.household_id is 'Default: el household del usuario de la sesión. El cliente de la app no lo manda.';
comment on column public.archivos.nombre is 'El nombre con el que se eligió el archivo, para mostrarlo. La ruta en el bucket sale del id, no del nombre.';
comment on column public.archivos.tipo is 'Lo que quedó en el bucket: image/webp o image/jpeg (la app convierte toda imagen antes de subirla) o application/pdf. La extensión de la ruta sale de acá.';
comment on column public.archivos.bytes is 'Lo que ocupa en el bucket: el archivo y, si es una imagen, su miniatura. La suma del taller es lo que se compara contra el espacio del plan.';
comment on column public.archivos.ancho is 'Ancho en píxeles de una imagen, para reservarle el lugar antes de que cargue. Null en un PDF.';
comment on column public.archivos.alto is 'Alto en píxeles de una imagen. Null en un PDF.';
comment on column public.archivos.deleted_at is 'Borrado lógico, como en todo el household. La app quita el binario del bucket cuando vence el deshacer.';

create index archivos_household_actualizado on public.archivos (household_id, updated_at);
-- Foreign key compuesta hacia proyectos.
create index archivos_household_proyecto on public.archivos (household_id, proyecto_id);

create trigger metadatos
  before insert or update on public.archivos
  for each row execute function private.mantener_metadatos();

alter table public.archivos enable row level security;

revoke all on table public.archivos from anon, authenticated;

grant select on table public.archivos to authenticated;
grant insert (id, proyecto_id, nombre, tipo, bytes, ancho, alto, deleted_at)
  on table public.archivos to authenticated;
-- Todas las columnas del alta entran en el update porque el deshacer de una baja es un upsert, y el
-- upsert de PostgREST las incluye en el SET. Cambiar el id lo rechaza private.mantener_metadatos().
-- Sin grant de delete: la baja es lógica.
grant update (id, proyecto_id, nombre, tipo, bytes, ancho, alto, deleted_at)
  on table public.archivos to authenticated;

create policy archivos_lectura on public.archivos
  for select to authenticated
  using (household_id = any (array(select private.user_household_ids())));

create policy archivos_alta on public.archivos
  for insert to authenticated
  with check (household_id = any (array(select private.user_household_ids())));

create policy archivos_edicion on public.archivos
  for update to authenticated
  using (household_id = any (array(select private.user_household_ids())))
  with check (household_id = any (array(select private.user_household_ids())));


-- Borrar un proyecto se lleva sus archivos -----------------------------------------------------------------

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

  return null;
end;
$$;


-- La réplica trae los archivos ------------------------------------------------------------------------------

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


-- El bucket -------------------------------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('archivos', 'archivos', true, 10485760, array['image/webp', 'image/jpeg', 'application/pdf']);

-- La primera carpeta de la ruta es el household. Se compara como texto: castear a uuid una carpeta que
-- no lo es cortaría con un 22P02 en vez de rechazar por RLS.
create policy archivos_subir_al_taller on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'archivos'
    and (storage.foldername(name))[1] = any (array(select h::text from private.user_household_ids() as h))
  );

create policy archivos_reemplazar_los_del_taller on storage.objects
  for update to authenticated
  using (
    bucket_id = 'archivos'
    and (storage.foldername(name))[1] = any (array(select h::text from private.user_household_ids() as h))
  )
  with check (
    bucket_id = 'archivos'
    and (storage.foldername(name))[1] = any (array(select h::text from private.user_household_ids() as h))
  );

create policy archivos_borrar_los_del_taller on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'archivos'
    and (storage.foldername(name))[1] = any (array(select h::text from private.user_household_ids() as h))
  );

-- La lectura de los archivos no pasa por esta política: el bucket es público y se leen por URL. Existe
-- por la subida con upsert, que antes de escribir pregunta si el objeto ya existe con un select sobre
-- storage.objects que corre con la RLS del usuario. Sin una política de select ese chequeo nunca
-- encuentra el archivo anterior, intenta insertarlo de nuevo y la subida entera falla con un error de
-- RLS que no dice por qué. Es la misma trampa que resolvió la foto de perfil (ADR 0022). Acá el upsert
-- sirve para reintentar: si la red se corta después de subir y antes de la respuesta, el mismo id se
-- vuelve a subir sin chocar.
create policy archivos_ver_los_del_taller on storage.objects
  for select to authenticated
  using (
    bucket_id = 'archivos'
    and (storage.foldername(name))[1] = any (array(select h::text from private.user_household_ids() as h))
  );

comment on policy archivos_ver_los_del_taller on storage.objects is
  'No es para leer los archivos (el bucket es público y se leen por URL): es para la subida con upsert, que chequea si el objeto existe con un select bajo la RLS del usuario. Sin esta política ese chequeo nunca encuentra el archivo anterior y la subida falla con un error de RLS.';
