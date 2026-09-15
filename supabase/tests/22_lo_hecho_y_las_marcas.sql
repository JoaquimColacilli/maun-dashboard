-- Lo hecho y las marcas de la agenda (ADR 0042). La visita hecha la escribe guardar_proyecto solo si
-- viene la clave, y cambiar de etapa no la des-completa. Las marcas de importante se tildan de a una,
-- sin que un guardado del agregado las pise ni otro taller las toque.

select plan(20);

select tests.guardar('a', tests.crear_usuario('a@maun.test'));
select tests.guardar('household_a', private.crear_household('Taller A', tests.id('a')));
select tests.guardar('b', tests.crear_usuario('b@maun.test'));
select tests.guardar('household_b', private.crear_household('Taller B', tests.id('b')));

create function tests.contacto(p_version integer, p_estado text, p_extra jsonb default '{}'::jsonb)
returns jsonb
language sql
as $$
  select jsonb_build_object(
    'id', 'aaaaaaaa-0000-7000-8000-000000000010', 'version', p_version,
    'cliente_id', 'aaaaaaaa-0000-7000-8000-000000000001', 'titulo', 'Vestidor', 'descripcion', '',
    'estado', p_estado, 'comprobante', 'sin_comprobante', 'fecha_visita', '2026-09-10', 'notas', ''
  ) || p_extra
$$;

create function tests.version_del_contacto()
returns integer
language sql
as $$
  select version from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000010'
$$;

select tests.entrar_como(tests.id('a'));

insert into public.clientes (id, nombre) values ('aaaaaaaa-0000-7000-8000-000000000001', 'Marcela');


-- Las columnas nacen apagadas ---------------------------------------------------------------------

select col_default_is('public', 'proyectos', 'visita_hecha', 'false', 'la visita nace sin hacer');
select col_default_is('public', 'proyectos', 'visita_importante', 'false', 'la visita nace sin marcar');
select col_default_is('public', 'proyectos', 'entrega_importante', 'false', 'la entrega nace sin marcar');
select col_default_is(
  'public', 'proyectos', 'presupuesto_importante', 'false', 'el vencimiento nace sin marcar'
);


-- La visita hecha ---------------------------------------------------------------------------------

select lives_ok(
  $$ select public.guardar_proyecto(
       tests.contacto(null, 'a_presupuestar', jsonb_build_object('visita_hecha', true)),
       '[]'::jsonb, '[]'::jsonb
     ) $$,
  'anotar el relevamiento guarda que la visita pasó'
);

select is(
  (select visita_hecha from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000010'),
  true,
  'y queda guardado'
);

select lives_ok(
  format(
    $$ select public.guardar_proyecto(%L::jsonb, '[]'::jsonb, '[]'::jsonb) $$,
    tests.contacto(tests.version_del_contacto(), 'a_presupuestar', jsonb_build_object('titulo', 'Vestidor con espejo'))
  ),
  'un guardado sin la clave, como el de un bundle viejo servido por el service worker, no rebota'
);

select is(
  (select array[titulo, visita_hecha::text] from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000010'),
  array['Vestidor con espejo', 'true'],
  'guarda lo que trae y no des-completa la visita que no conoce'
);

select lives_ok(
  format(
    $$ select public.guardar_proyecto(%L::jsonb, '[]'::jsonb, '[]'::jsonb) $$,
    tests.contacto(
      tests.version_del_contacto(), 'relevamiento',
      jsonb_build_object('titulo', 'Vestidor con espejo', 'visita_hecha', true)
    )
  ),
  'volver a relevamiento es un cambio de etapa'
);

select is(
  (select array[estado::text, visita_hecha::text] from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000010'),
  array['relevamiento', 'true'],
  'y la visita sigue hecha: la etapa no la des-completa'
);

select lives_ok(
  format(
    $$ select public.guardar_proyecto(%L::jsonb, '[]'::jsonb, '[]'::jsonb) $$,
    tests.contacto(
      tests.version_del_contacto() - 1, 'relevamiento',
      jsonb_build_object('titulo', 'Vestidor con espejo', 'visita_hecha', true)
    )
  ),
  'el reenvío de ese guardado, con la versión vieja y la visita hecha, se reconoce y no rebota'
);

select lives_ok(
  format(
    $$ select public.guardar_proyecto(%L::jsonb, '[]'::jsonb, '[]'::jsonb) $$,
    tests.contacto(
      tests.version_del_contacto(), 'contacto',
      jsonb_build_object('titulo', 'Vestidor con espejo', 'visita_hecha', false)
    )
  ),
  'destildarla desde la hoja del contacto viaja en el mismo guardado'
);

select is(
  (select visita_hecha from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000010'),
  false,
  'y mandarla en false la saca'
);


-- Las marcas de importante --------------------------------------------------------------------------

select lives_ok(
  $$ update public.proyectos set visita_importante = true, presupuesto_importante = true
     where id = 'aaaaaaaa-0000-7000-8000-000000000010' $$,
  'una marca se tilda con su columna sola'
);

select lives_ok(
  format(
    $$ select public.guardar_proyecto(%L::jsonb, '[]'::jsonb, '[]'::jsonb) $$,
    tests.contacto(
      tests.version_del_contacto(), 'a_presupuestar',
      jsonb_build_object('titulo', 'Vestidor', 'visita_importante', false, 'presupuesto_importante', false)
    )
  ),
  'guardar el agregado entero, aunque el pedido traiga las claves de las marcas'
);

select is(
  (select array[visita_importante, presupuesto_importante, entrega_importante]
   from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000010'),
  array[true, true, false],
  'las marcas siguen como estaban: guardar_proyecto no las escribe'
);

select lives_ok(
  $$ update public.proyectos set entrega_importante = true
     where id = 'aaaaaaaa-0000-7000-8000-000000000010' $$,
  'la marca de la entrega también es su columna'
);

select tests.entrar_como(tests.id('b'));
update public.proyectos set visita_importante = false, entrega_importante = false, visita_hecha = true
where id = 'aaaaaaaa-0000-7000-8000-000000000010';
select tests.salir();

select is(
  (select array[visita_importante, entrega_importante, visita_hecha]
   from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000010'),
  array[true, true, false],
  'otro taller no le marca ni le desmarca nada: la RLS no le deja ver la fila'
);

select tests.entrar_como_anon();

select throws_ok(
  $$ update public.proyectos set presupuesto_importante = false
     where id = 'aaaaaaaa-0000-7000-8000-000000000010' $$,
  '42501', null, 'sin sesión no se marca nada'
);

select tests.salir();

select is(
  (select presupuesto_importante from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000010'),
  true,
  'y la marca sigue puesta'
);

select * from finish();
