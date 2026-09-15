-- Los archivos de los trabajos (ADR 0039): la tabla que trae la réplica y el bucket donde viven los
-- binarios, los dos atados al household. En Storage la RLS es la única barrera, porque anon y
-- authenticated tienen grants completos sobre storage.objects. El borrado de un objeto no se prueba con
-- SQL (Storage lo bloquea con protect_objects_delete); su política está en la lista de
-- 15_fotos_de_perfil.sql.

select plan(21);

-- El bucket ------------------------------------------------------------------------------------------------

select is(
  (select public from storage.buckets where id = 'archivos'),
  true,
  'el bucket es público: los archivos se sirven por el CDN con una URL fija'
);

select is(
  (select file_size_limit from storage.buckets where id = 'archivos'),
  10485760::bigint,
  'el bucket tiene un tope de 10 MiB por archivo'
);

select is(
  (select allowed_mime_types from storage.buckets where id = 'archivos'),
  array['image/webp', 'image/jpeg', 'application/pdf'],
  'el bucket acepta WebP, JPEG y PDF, y ningún video'
);

select tests.guardar('ana', tests.crear_usuario('ana@maun.test'));
select tests.guardar('household_a', private.crear_household('Taller A', tests.id('ana')));
select tests.guardar('beto', tests.crear_usuario('beto@maun.test'));
select tests.guardar('household_b', private.crear_household('Taller B', tests.id('beto')));

select tests.entrar_como(tests.id('beto'));
insert into public.clientes (id, nombre) values ('bbbbbbbb-0000-7000-8000-000000000001', 'Cliente de Beto');
insert into public.proyectos (id, cliente_id, titulo)
  values ('bbbbbbbb-0000-7000-8000-000000000010', 'bbbbbbbb-0000-7000-8000-000000000001', 'Trabajo de Beto');
insert into storage.objects (bucket_id, name)
  values ('archivos', tests.id('household_b')::text || '/bbbbbbbb-0000-7000-8000-000000000010/foto.webp');

select tests.entrar_como(tests.id('ana'));
insert into public.clientes (id, nombre) values ('aaaaaaaa-0000-7000-8000-000000000001', 'Marcela');
insert into public.proyectos (id, cliente_id, titulo) values
  ('aaaaaaaa-0000-7000-8000-000000000010', 'aaaaaaaa-0000-7000-8000-000000000001', 'Placard'),
  ('aaaaaaaa-0000-7000-8000-000000000020', 'aaaaaaaa-0000-7000-8000-000000000001', 'Vanitory');


-- Storage ---------------------------------------------------------------------------------------------------

select lives_ok(
  format(
    $$ insert into storage.objects (bucket_id, name) values ('archivos', %L) $$,
    tests.id('household_a')::text || '/aaaaaaaa-0000-7000-8000-000000000010/relevamiento.webp'
  ),
  'ana sube un archivo a la carpeta de su taller'
);

select throws_ok(
  format(
    $$ insert into storage.objects (bucket_id, name) values ('archivos', %L) $$,
    tests.id('household_b')::text || '/bbbbbbbb-0000-7000-8000-000000000010/intruso.webp'
  ),
  '42501',
  null,
  'ana no sube a la carpeta de otro taller'
);

select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('archivos', 'suelto.webp') $$,
  '42501',
  null,
  'ana no sube a la raíz del bucket'
);

select is(
  (
    select count(*)::int from storage.objects
    where bucket_id = 'archivos' and name like tests.id('household_a')::text || '/%'
  ),
  1,
  'ana ve lo de su taller: el chequeo de existencia de la subida con upsert lo encuentra'
);

select is(
  (
    select count(*)::int from storage.objects
    where bucket_id = 'archivos' and name like tests.id('household_b')::text || '/%'
  ),
  0,
  'ana no ve los archivos de otro taller'
);

select lives_ok(
  format(
    $$ update storage.objects set metadata = '{"reintento": 1}' where bucket_id = 'archivos' and name = %L $$,
    tests.id('household_a')::text || '/aaaaaaaa-0000-7000-8000-000000000010/relevamiento.webp'
  ),
  'ana reemplaza un archivo de su taller, que es lo que hace el reintento de una subida'
);


-- La tabla --------------------------------------------------------------------------------------------------

select lives_ok(
  $$ insert into public.archivos (id, proyecto_id, nombre, tipo, bytes, ancho, alto) values
       ('aaaaaaaa-0000-7000-8000-000000000101', 'aaaaaaaa-0000-7000-8000-000000000010', 'relevamiento.jpg', 'image/webp', 240000, 2000, 1500),
       ('aaaaaaaa-0000-7000-8000-000000000102', 'aaaaaaaa-0000-7000-8000-000000000020', 'despiece.pdf', 'application/pdf', 850000, null, null) $$,
  'ana anota una foto y un PDF de sus trabajos'
);

select is(
  (select household_id from public.archivos where id = 'aaaaaaaa-0000-7000-8000-000000000101'),
  tests.id('household_a'),
  'el household lo pone la base, no la app'
);

select throws_ok(
  $$ insert into public.archivos (proyecto_id, nombre, tipo, bytes) values
       ('aaaaaaaa-0000-7000-8000-000000000010', 'relevamiento.mp4', 'video/mp4', 90000000) $$,
  '23514',
  null,
  'un video no se anota'
);

select throws_ok(
  $$ insert into public.archivos (proyecto_id, nombre, tipo, bytes) values
       ('aaaaaaaa-0000-7000-8000-000000000010', 'vacio.pdf', 'application/pdf', 0) $$,
  '23514',
  null,
  'un archivo vacío no se anota'
);

select throws_ok(
  $$ insert into public.archivos (proyecto_id, nombre, tipo, bytes, ancho) values
       ('aaaaaaaa-0000-7000-8000-000000000010', 'medio.webp', 'image/webp', 1000, 800) $$,
  '23514',
  null,
  'una imagen lleva ancho y alto juntos, o ninguno'
);

select throws_ok(
  $$ insert into public.archivos (proyecto_id, nombre, tipo, bytes) values
       ('bbbbbbbb-0000-7000-8000-000000000010', 'ajeno.pdf', 'application/pdf', 1000) $$,
  '23503',
  null,
  'ana no cuelga un archivo de un trabajo de otro taller'
);

select tests.entrar_como(tests.id('beto'));

select is(
  (select count(*)::int from public.archivos),
  0,
  'beto no ve los archivos de ana'
);

select tests.entrar_como(tests.id('ana'));

select is(
  (select array_agg(e ->> 'id' order by e ->> 'id') from jsonb_array_elements(public.bootstrap() -> 'archivos') as e),
  array['aaaaaaaa-0000-7000-8000-000000000101', 'aaaaaaaa-0000-7000-8000-000000000102'],
  'bootstrap() trae los archivos del taller'
);

select lives_ok(
  $$ update public.archivos set deleted_at = now() where id = 'aaaaaaaa-0000-7000-8000-000000000101' $$,
  'borrar un archivo es una baja lógica'
);

select is(
  (select array_agg(e ->> 'id') from jsonb_array_elements(public.bootstrap() -> 'archivos') as e),
  array['aaaaaaaa-0000-7000-8000-000000000102'],
  'y bootstrap() deja de traerlo'
);

select lives_ok(
  $$ update public.proyectos set deleted_at = now() where id = 'aaaaaaaa-0000-7000-8000-000000000020' $$,
  'se borra el trabajo del PDF'
);

select isnt(
  (select deleted_at from public.archivos where id = 'aaaaaaaa-0000-7000-8000-000000000102'),
  null,
  'borrar un trabajo se lleva sus archivos, como sus pagos y sus gastos'
);

select tests.entrar_como_anon();

select throws_ok(
  $$ insert into public.archivos (proyecto_id, nombre, tipo, bytes) values
       ('aaaaaaaa-0000-7000-8000-000000000010', 'anon.pdf', 'application/pdf', 1000) $$,
  '42501',
  null,
  'sin sesión no se anota nada'
);

select * from finish();
