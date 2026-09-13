-- Las fotos de perfil (ADR 0022): un bucket público con tope de tamaño y de tipos, y una carpeta por
-- persona. Lo que se prueba acá es la RLS, que es la única barrera: anon y authenticated tienen
-- grants completos sobre storage.objects. El borrado no se prueba con SQL porque Storage lo bloquea
-- con el trigger protect_objects_delete; su política se verifica en la lista de políticas.

select plan(13);

select is(
  (select public from storage.buckets where id = 'fotos-de-perfil'),
  true,
  'el bucket es público: la foto se muestra con una URL fija'
);

select is(
  (select file_size_limit from storage.buckets where id = 'fotos-de-perfil'),
  524288::bigint,
  'el bucket tiene un tope de 512 KiB por archivo'
);

select is(
  (select allowed_mime_types from storage.buckets where id = 'fotos-de-perfil'),
  array['image/webp', 'image/jpeg'],
  'el bucket acepta solo WebP y JPEG'
);

select policies_are(
  'storage',
  'objects',
  array[
    'fotos_de_perfil_borrar_la_propia',
    'fotos_de_perfil_reemplazar_la_propia',
    'fotos_de_perfil_subir_a_la_carpeta_propia',
    'fotos_de_perfil_ver_la_propia'
  ],
  'storage.objects tiene las cuatro políticas de las fotos y ninguna otra'
);

select tests.guardar('ana', tests.crear_usuario('ana@maun.test'));
select tests.guardar('beto', tests.crear_usuario('beto@maun.test'));

select tests.entrar_como(tests.id('beto'));
insert into storage.objects (bucket_id, name) values ('fotos-de-perfil', tests.id('beto')::text || '/foto');

select tests.entrar_como(tests.id('ana'));

select lives_ok(
  format(
    $$ insert into storage.objects (bucket_id, name) values ('fotos-de-perfil', %L) $$,
    tests.id('ana')::text || '/foto'
  ),
  'ana sube su foto a su carpeta'
);

select throws_ok(
  format(
    $$ insert into storage.objects (bucket_id, name) values ('fotos-de-perfil', %L) $$,
    tests.id('beto')::text || '/otra'
  ),
  '42501',
  null,
  'ana no sube a la carpeta de beto'
);

select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('fotos-de-perfil', 'foto-suelta') $$,
  '42501',
  null,
  'ana no sube a la raíz del bucket'
);

select is(
  (
    select count(*)::int from storage.objects
    where bucket_id = 'fotos-de-perfil' and name = tests.id('ana')::text || '/foto'
  ),
  1,
  'ana ve su foto: el chequeo de existencia de la subida con upsert la encuentra'
);

select is(
  (
    select count(*)::int from storage.objects
    where bucket_id = 'fotos-de-perfil' and name like tests.id('beto')::text || '/%'
  ),
  0,
  'ana no ve los objetos de beto'
);

select lives_ok(
  format(
    $$ update storage.objects set metadata = '{"version": 2}' where bucket_id = 'fotos-de-perfil' and name = %L $$,
    tests.id('ana')::text || '/foto'
  ),
  'ana reemplaza su foto'
);

update storage.objects set metadata = '{"intruso": true}'
where bucket_id = 'fotos-de-perfil' and name like tests.id('beto')::text || '/%';

select tests.salir();

select is(
  (
    select metadata ->> 'version' from storage.objects
    where bucket_id = 'fotos-de-perfil' and name = tests.id('ana')::text || '/foto'
  ),
  '2',
  'el reemplazo de ana quedó escrito'
);

select is(
  (
    select metadata from storage.objects
    where bucket_id = 'fotos-de-perfil' and name = tests.id('beto')::text || '/foto'
  ),
  null,
  'el update de ana sobre la foto de beto no tocó nada'
);

select tests.entrar_como_anon();

select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('fotos-de-perfil', 'anon/foto') $$,
  '42501',
  null,
  'sin sesión no se sube nada'
);

select * from finish();
