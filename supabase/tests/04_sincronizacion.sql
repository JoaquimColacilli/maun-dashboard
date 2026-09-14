-- Contrato de bootstrap() y delta(): qué traen, qué no, y la ventana de solape del cursor.

select plan(12);

select tests.guardar('a', tests.crear_usuario('a@maun.test'));
select tests.guardar('household_a', private.crear_household('Taller A', tests.id('a')));

select tests.entrar_como(tests.id('a'));

insert into public.clientes (id, nombre) values ('aaaaaaaa-0000-7000-8000-000000000001', 'Marcela');
insert into public.movimientos (id, fecha, tipo, tesoro_destino, monto_centavos) values
  ('aaaaaaaa-0000-7000-8000-000000000002', '2026-09-01', 'ingreso', 'hogar', 100),
  ('aaaaaaaa-0000-7000-8000-000000000003', '2026-09-02', 'ingreso', 'hogar', 200);
update public.movimientos set deleted_at = now() where id = 'aaaaaaaa-0000-7000-8000-000000000003';

select is(
  (select array_agg(k order by k) from jsonb_object_keys(public.bootstrap()) as k),
  array['ajustes', 'anotaciones', 'clientes', 'cursor', 'gastos', 'household_members', 'households', 'movimientos', 'pagos', 'proyectos'],
  'bootstrap() trae el cursor y todas las tablas sincronizables'
);

select is(
  (select array_agg(k order by k) from jsonb_object_keys(public.delta(now())) as k),
  array['ajustes', 'anotaciones', 'clientes', 'cursor', 'gastos', 'household_members', 'households', 'movimientos', 'pagos', 'proyectos'],
  'delta() trae las mismas claves que bootstrap()'
);

select is(
  (public.bootstrap() ->> 'cursor')::timestamptz,
  now(),
  'el cursor es la hora del servidor, no la del cliente'
);

select is(
  (select array_agg(e ->> 'id') from jsonb_array_elements(public.bootstrap() -> 'movimientos') as e),
  array['aaaaaaaa-0000-7000-8000-000000000002'],
  'bootstrap() no trae filas borradas'
);

select is(
  (
    select jsonb_object_agg(e ->> 'id', e ->> 'deleted_at' is not null)
    from jsonb_array_elements(public.delta(now() - interval '1 hour') -> 'movimientos') as e
  ),
  '{"aaaaaaaa-0000-7000-8000-000000000002": false, "aaaaaaaa-0000-7000-8000-000000000003": true}'::jsonb,
  'delta() sí trae las borradas, con su deleted_at, para que el cliente las saque de su copia'
);

select ok(
  (select bool_and(e ? 'version' and e ? 'updated_at') from jsonb_array_elements(public.bootstrap() -> 'clientes') as e),
  'cada fila viaja con version y updated_at, que el cliente usa para quedarse con la más nueva'
);

select is(
  (
    select jsonb_typeof(e -> 'monto_centavos')
    from jsonb_array_elements(public.bootstrap() -> 'movimientos') as e
  ),
  'number',
  'los importes viajan como número entero de centavos'
);

-- La ventana de solape: con un cursor hasta cinco minutos posterior a la escritura, la fila vuelve.
select set_config(
  'tests.marca',
  (select updated_at::text from public.clientes where id = 'aaaaaaaa-0000-7000-8000-000000000001'),
  true
);

select is(
  jsonb_array_length(public.delta(current_setting('tests.marca')::timestamptz + interval '4 minutes 59 seconds') -> 'clientes'),
  1,
  'una fila escrita hasta cinco minutos antes del cursor vuelve en el delta: es el solape'
);

-- Un cursor que deja la escritura original apenas afuera de la ventana.
select set_config(
  'tests.cursor',
  (current_setting('tests.marca')::timestamptz + interval '5 minutes 1 microsecond')::text,
  true
);

select is(
  jsonb_array_length(public.delta(current_setting('tests.cursor')::timestamptz) -> 'clientes'),
  0,
  'una fila escrita más de cinco minutos antes del cursor no vuelve'
);

select pg_sleep(0.005);
update public.clientes set notas = 'Cambió el teléfono' where id = 'aaaaaaaa-0000-7000-8000-000000000001';

select is(
  (
    select array_agg((e ->> 'version')::int)
    from jsonb_array_elements(public.delta(current_setting('tests.cursor')::timestamptz) -> 'clientes') as e
  ),
  array[2],
  'con ese mismo cursor, el cambio posterior la vuelve a traer, con su nueva version'
);

select is(
  (
    select count(*)::int
    from jsonb_each(public.delta(now() + interval '1 hour') - 'cursor') as t (clave, valor)
    cross join lateral jsonb_array_elements(t.valor)
  ),
  0,
  'sin cambios desde el cursor, el delta viene vacío'
);

select throws_ok('select public.delta(null)', '22004', null, 'delta() sin cursor es un error: corresponde bootstrap()');

select * from finish();
