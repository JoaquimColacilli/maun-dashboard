-- Las anotaciones de la agenda: una tabla sincronizable más. Metadatos, reenvío, borrado lógico,
-- lo que la base rechaza y lo que el cliente no puede escribir. El aislamiento entre talleres está
-- en 02_aislamiento.sql, con el resto de las tablas.

select plan(17);

select tests.guardar('a', tests.crear_usuario('a@maun.test'));
select tests.guardar('household_a', private.crear_household('Taller A', tests.id('a')));

select tests.entrar_como(tests.id('a'));

insert into public.clientes (id, nombre) values ('aaaaaaaa-0000-7000-8000-000000000001', 'Villalba');
insert into public.proyectos (id, cliente_id, titulo, estado)
  values ('aaaaaaaa-0000-7000-8000-000000000002', 'aaaaaaaa-0000-7000-8000-000000000001', 'Cocina', 'en_curso');

insert into public.anotaciones (id, fecha, hora, texto, categoria, proyecto_id, importante) values
  ('aaaaaaaa-0000-7000-8000-000000000010', '2026-09-15', '10:00', 'Coordinar el corte de la mesada', 'taller', 'aaaaaaaa-0000-7000-8000-000000000002', true),
  ('aaaaaaaa-0000-7000-8000-000000000011', '2026-09-22', null, 'Comprar tapacantos', 'materiales', null, false);

select is(
  (select array[household_id::text, version::text, hecha::text, importante::text] from public.anotaciones where id = 'aaaaaaaa-0000-7000-8000-000000000010'),
  array[tests.id('household_a')::text, '1', 'false', 'true'],
  'el household y la versión los pone la base, y la anotación nace sin tildar'
);

select is(
  (select hora from public.anotaciones where id = 'aaaaaaaa-0000-7000-8000-000000000011'),
  null::time,
  'la hora es opcional: el día es la unidad'
);

select is(
  (select categoria::text from public.anotaciones where id = 'aaaaaaaa-0000-7000-8000-000000000011'),
  'materiales',
  'la categoría queda guardada'
);

update public.anotaciones set hecha = true where id = 'aaaaaaaa-0000-7000-8000-000000000010';

select is(
  (select version from public.anotaciones where id = 'aaaaaaaa-0000-7000-8000-000000000010'),
  2,
  'tildarla sube la versión'
);

update public.anotaciones set hecha = true where id = 'aaaaaaaa-0000-7000-8000-000000000010';

select is(
  (select version from public.anotaciones where id = 'aaaaaaaa-0000-7000-8000-000000000010'),
  2,
  'reenviar la misma edición desde la cola no cambia nada ni genera delta'
);

select lives_ok(
  $$
    insert into public.anotaciones (id, fecha, texto, categoria)
    values ('aaaaaaaa-0000-7000-8000-000000000011', '2026-09-22', 'Comprar tapacantos', 'materiales')
    on conflict (id) do update set fecha = excluded.fecha, texto = excluded.texto, categoria = excluded.categoria
  $$,
  'reenviar el alta como upsert por id no rebota'
);

select is(
  (select count(*)::int from public.anotaciones),
  2,
  'y no la duplica'
);


-- Lo que la base rechaza ----------------------------------------------------------------------------

select throws_ok(
  $$ insert into public.anotaciones (fecha, texto) values ('2026-09-10', '   ') $$,
  '23514', null,
  'una anotación sin texto se rechaza'
);

select throws_ok(
  format('insert into public.anotaciones (fecha, texto) values (%L, %L)', '2026-09-10', repeat('a', 501)),
  '23514', null,
  'una anotación de más de 500 caracteres se rechaza'
);

select throws_ok(
  $$ insert into public.anotaciones (fecha, texto, categoria) values ('2026-09-10', 'Entregar', 'entrega') $$,
  '22P02', null,
  'entrega no es una categoría de anotación: lo que sale del proyecto no se anota a mano'
);

select throws_ok(
  $$ insert into public.anotaciones (texto) values ('Sin día') $$,
  '23502', null,
  'una anotación sin fecha se rechaza'
);


-- Lo que el cliente no escribe ----------------------------------------------------------------------

select throws_ok(
  $$ update public.anotaciones set version = 99 where id = 'aaaaaaaa-0000-7000-8000-000000000011' $$,
  '42501', null,
  'la versión no tiene grant: la mantiene la base'
);

select throws_ok(
  $$ delete from public.anotaciones where id = 'aaaaaaaa-0000-7000-8000-000000000011' $$,
  '42501', null,
  'no hay borrado físico: la baja es lógica'
);

select throws_ok(
  $$ update public.anotaciones set id = 'aaaaaaaa-0000-7000-8000-000000000099' where id = 'aaaaaaaa-0000-7000-8000-000000000011' $$,
  'MN004', null,
  'el id de una anotación no se cambia'
);


-- La baja lógica y la réplica -------------------------------------------------------------------------

update public.anotaciones set deleted_at = now() where id = 'aaaaaaaa-0000-7000-8000-000000000011';

select is(
  (select array_agg(e ->> 'id') from jsonb_array_elements(public.bootstrap() -> 'anotaciones') as e),
  array['aaaaaaaa-0000-7000-8000-000000000010'],
  'bootstrap() trae las anotaciones vivas'
);

select is(
  (
    select jsonb_object_agg(e ->> 'id', e ->> 'deleted_at' is not null)
    from jsonb_array_elements(public.delta(now() - interval '1 hour') -> 'anotaciones') as e
  ),
  '{"aaaaaaaa-0000-7000-8000-000000000010": false, "aaaaaaaa-0000-7000-8000-000000000011": true}'::jsonb,
  'delta() trae también la borrada, para que el cliente la saque de su copia'
);

update public.proyectos set deleted_at = now() where id = 'aaaaaaaa-0000-7000-8000-000000000002';

select is(
  (select proyecto_id from public.anotaciones where id = 'aaaaaaaa-0000-7000-8000-000000000010'),
  'aaaaaaaa-0000-7000-8000-000000000002'::uuid,
  'borrar el proyecto no se lleva la anotación: lo que anotó sigue siendo suyo'
);

select * from finish();
