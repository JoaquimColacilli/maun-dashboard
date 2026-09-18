-- Dos talleres, cada uno con su usuario y un juego completo de datos. Un usuario ve y toca solo
-- lo suyo, por cada camino: las tablas, la vista, las funciones de sync y las foreign keys.

select plan(45);

select tests.guardar('a', tests.crear_usuario('a@maun.test'));
select tests.guardar('b', tests.crear_usuario('b@maun.test'));
select tests.guardar('sin_taller', tests.crear_usuario('sin-taller@maun.test'));
select tests.guardar('household_a', private.crear_household('Taller A', tests.id('a')));
select tests.guardar('household_b', private.crear_household('Taller B', tests.id('b')));

-- Cada usuario carga lo suyo con su propia sesión: esto ejercita los defaults, los grants y el
-- with check de las policies de alta.
select tests.entrar_como(tests.id('a'));
insert into public.clientes (id, nombre) values ('aaaaaaaa-0000-7000-8000-000000000001', 'Cliente de A');
insert into public.proyectos (id, cliente_id, titulo)
  values ('aaaaaaaa-0000-7000-8000-000000000002', 'aaaaaaaa-0000-7000-8000-000000000001', 'Proyecto de A');
insert into public.pagos (id, proyecto_id, fecha, monto_centavos)
  values ('aaaaaaaa-0000-7000-8000-000000000003', 'aaaaaaaa-0000-7000-8000-000000000002', '2026-09-01', 100000);
insert into public.gastos (id, proyecto_id, fecha, monto_centavos)
  values ('aaaaaaaa-0000-7000-8000-000000000004', 'aaaaaaaa-0000-7000-8000-000000000002', '2026-09-01', 30000);
insert into public.movimientos (id, fecha, tipo, tesoro_destino, monto_centavos)
  values ('aaaaaaaa-0000-7000-8000-000000000005', '2026-09-01', 'ingreso', 'hogar', 50000);
insert into public.anotaciones (id, fecha, texto, categoria, proyecto_id)
  values ('aaaaaaaa-0000-7000-8000-000000000006', '2026-09-10', 'Comprar melamina', 'materiales', 'aaaaaaaa-0000-7000-8000-000000000002');
insert into public.archivos (id, proyecto_id, nombre, tipo, bytes)
  values ('aaaaaaaa-0000-7000-8000-000000000007', 'aaaaaaaa-0000-7000-8000-000000000002', 'Despiece de A.pdf', 'application/pdf', 1000);
insert into public.opciones_de_presupuesto (id, proyecto_id, descripcion, monto_centavos)
  values ('aaaaaaaa-0000-7000-8000-000000000008', 'aaaaaaaa-0000-7000-8000-000000000002', 'Opción de A', 900000);
insert into public.necesidades (id, proyecto_id, tipo, nombre, cantidad)
  values ('aaaaaaaa-0000-7000-8000-000000000009', 'aaaaaaaa-0000-7000-8000-000000000002', 'herraje', 'Bisagras de A', 6);
insert into public.enlaces_publicos (id, proyecto_id, token_hash)
  values ('aaaaaaaa-0000-7000-8000-00000000000a', 'aaaaaaaa-0000-7000-8000-000000000002', repeat('a', 64));

select tests.entrar_como(tests.id('b'));
insert into public.clientes (id, nombre) values ('bbbbbbbb-0000-7000-8000-000000000001', 'Cliente de B');
insert into public.proyectos (id, cliente_id, titulo)
  values ('bbbbbbbb-0000-7000-8000-000000000002', 'bbbbbbbb-0000-7000-8000-000000000001', 'Proyecto de B');
insert into public.pagos (id, proyecto_id, fecha, monto_centavos)
  values ('bbbbbbbb-0000-7000-8000-000000000003', 'bbbbbbbb-0000-7000-8000-000000000002', '2026-09-01', 200000);
insert into public.gastos (id, proyecto_id, fecha, monto_centavos)
  values ('bbbbbbbb-0000-7000-8000-000000000004', 'bbbbbbbb-0000-7000-8000-000000000002', '2026-09-01', 60000);
insert into public.movimientos (id, fecha, tipo, tesoro_origen, monto_centavos)
  values ('bbbbbbbb-0000-7000-8000-000000000005', '2026-09-01', 'gasto', 'maun', 70000);
insert into public.anotaciones (id, fecha, texto)
  values ('bbbbbbbb-0000-7000-8000-000000000006', '2026-09-10', 'Retirar el pulpo');
insert into public.archivos (id, proyecto_id, nombre, tipo, bytes)
  values ('bbbbbbbb-0000-7000-8000-000000000007', 'bbbbbbbb-0000-7000-8000-000000000002', 'Despiece de B.pdf', 'application/pdf', 1000);
insert into public.opciones_de_presupuesto (id, proyecto_id, descripcion, monto_centavos)
  values ('bbbbbbbb-0000-7000-8000-000000000008', 'bbbbbbbb-0000-7000-8000-000000000002', 'Opción de B', 1800000);
insert into public.necesidades (id, proyecto_id, tipo, nombre)
  values ('bbbbbbbb-0000-7000-8000-000000000009', 'bbbbbbbb-0000-7000-8000-000000000002', 'herramienta', 'Multitool de B');
insert into public.enlaces_publicos (id, proyecto_id, token_hash)
  values ('bbbbbbbb-0000-7000-8000-00000000000a', 'bbbbbbbb-0000-7000-8000-000000000002', repeat('b', 64));


-- Lectura --------------------------------------------------------------------------------------

select tests.entrar_como(tests.id('a'));

select ok(
  (select household_id from public.clientes where id = 'aaaaaaaa-0000-7000-8000-000000000001') = tests.id('household_a'),
  'el household_id lo pone la base, no el cliente'
);

select results_eq('select id from public.households', array[tests.id('household_a')], 'A ve solo su household');
select results_eq('select user_id from public.household_members', array[tests.id('a')], 'A ve solo su membresía');
select results_eq('select household_id from public.ajustes', array[tests.id('household_a')], 'A ve solo sus ajustes');
select results_eq('select id from public.clientes', array['aaaaaaaa-0000-7000-8000-000000000001'::uuid], 'A ve solo sus clientes');
select results_eq('select id from public.proyectos', array['aaaaaaaa-0000-7000-8000-000000000002'::uuid], 'A ve solo sus proyectos');
select results_eq('select id from public.pagos', array['aaaaaaaa-0000-7000-8000-000000000003'::uuid], 'A ve solo sus pagos');
select results_eq('select id from public.gastos', array['aaaaaaaa-0000-7000-8000-000000000004'::uuid], 'A ve solo sus gastos');
select results_eq('select id from public.movimientos', array['aaaaaaaa-0000-7000-8000-000000000005'::uuid], 'A ve solo sus movimientos');
select results_eq('select id from public.anotaciones', array['aaaaaaaa-0000-7000-8000-000000000006'::uuid], 'A ve solo sus anotaciones');
select results_eq('select id from public.archivos', array['aaaaaaaa-0000-7000-8000-000000000007'::uuid], 'A ve solo sus archivos');
select results_eq('select id from public.opciones_de_presupuesto', array['aaaaaaaa-0000-7000-8000-000000000008'::uuid], 'A ve solo sus opciones de presupuesto');
select results_eq('select id from public.necesidades', array['aaaaaaaa-0000-7000-8000-000000000009'::uuid], 'A ve solo lo que hace falta en sus trabajos');
select results_eq('select id from public.enlaces_publicos', array['aaaaaaaa-0000-7000-8000-00000000000a'::uuid], 'A ve solo los links de sus trabajos');

select is_empty(
  format('select 1 from public.libro_mayor where household_id <> %L', tests.id('household_a')),
  'el libro mayor de A no tiene filas de B'
);
select isnt_empty('select 1 from public.libro_mayor', 'el libro mayor de A tiene sus propias filas');

select is(
  (select jsonb_object_agg(t.clave, jsonb_array_length(t.valor)) from jsonb_each(public.bootstrap() - 'cursor') as t (clave, valor)),
  '{"households": 1, "household_members": 1, "ajustes": 1, "clientes": 1, "proyectos": 1, "pagos": 1, "gastos": 1, "opciones_de_presupuesto": 1, "necesidades": 1, "movimientos": 1, "anotaciones": 1, "archivos": 1, "enlaces_publicos": 1}'::jsonb,
  'bootstrap() de A trae su household completo'
);

select is(
  (
    select array_agg(distinct coalesce(e ->> 'household_id', e ->> 'id'))
    from jsonb_each(public.bootstrap() - 'cursor') as t (clave, valor)
    cross join lateral jsonb_array_elements(t.valor) as e
  ),
  array[tests.id('household_a')::text],
  'bootstrap() de A no trae ninguna fila de B'
);

select is(
  (
    select array_agg(distinct coalesce(e ->> 'household_id', e ->> 'id'))
    from jsonb_each(public.delta(now() - interval '1 day') - 'cursor') as t (clave, valor)
    cross join lateral jsonb_array_elements(t.valor) as e
  ),
  array[tests.id('household_a')::text],
  'delta() de A no trae ninguna fila de B'
);


-- Escritura --------------------------------------------------------------------------------------

with u as (update public.clientes set notas = 'intrusión' where id = 'bbbbbbbb-0000-7000-8000-000000000001' returning 1)
select is(count(*), 0::bigint, 'A no edita un cliente de B: la RLS lo vuelve invisible') from u;

with u as (update public.proyectos set titulo = 'intrusión' where id = 'bbbbbbbb-0000-7000-8000-000000000002' returning 1)
select is(count(*), 0::bigint, 'A no edita un proyecto de B') from u;

with u as (update public.pagos set monto_centavos = 1 where id = 'bbbbbbbb-0000-7000-8000-000000000003' returning 1)
select is(count(*), 0::bigint, 'A no edita un pago de B') from u;

with u as (update public.movimientos set deleted_at = now() where id = 'bbbbbbbb-0000-7000-8000-000000000005' returning 1)
select is(count(*), 0::bigint, 'A no borra un movimiento de B') from u;

with u as (update public.ajustes set sueldo_mensual_centavos = 1 where household_id = tests.id('household_b') returning 1)
select is(count(*), 0::bigint, 'A no edita los ajustes de B') from u;

with u as (update public.anotaciones set hecha = true where id = 'bbbbbbbb-0000-7000-8000-000000000006' returning 1)
select is(count(*), 0::bigint, 'A no tilda una anotación de B') from u;

select throws_ok(
  format('insert into public.clientes (household_id, nombre) values (%L, %L)', tests.id('household_b'), 'Intruso'),
  '42501',
  null,
  'A no elige el household de una fila nueva: la columna no tiene grant'
);

select throws_ok(
  format('update public.clientes set household_id = %L where id = %L', tests.id('household_b'), 'aaaaaaaa-0000-7000-8000-000000000001'),
  '42501',
  null,
  'A no mueve una fila suya al household de B'
);

select throws_ok(
  $$ insert into public.pagos (proyecto_id, fecha, monto_centavos) values ('bbbbbbbb-0000-7000-8000-000000000002', '2026-09-01', 1) $$,
  '23503',
  null,
  'A no cuelga un pago de un proyecto de B: la foreign key compuesta lo rechaza'
);

select throws_ok(
  $$ insert into public.proyectos (cliente_id, titulo) values ('bbbbbbbb-0000-7000-8000-000000000001', 'Proyecto cruzado') $$,
  '23503',
  null,
  'A no crea un proyecto para un cliente de B'
);

select throws_ok(
  $$ insert into public.movimientos (fecha, tipo, tesoro_destino, monto_centavos, proyecto_id) values ('2026-09-01', 'ajuste', 'maun', 1, 'bbbbbbbb-0000-7000-8000-000000000002') $$,
  '23503',
  null,
  'A no imputa un movimiento a un proyecto de B'
);

select throws_ok(
  $$ insert into public.anotaciones (fecha, texto, proyecto_id) values ('2026-09-10', 'Cruzada', 'bbbbbbbb-0000-7000-8000-000000000002') $$,
  '23503',
  null,
  'A no cuelga una anotación de un proyecto de B'
);

select throws_ok(
  $$ insert into public.ajustes (sueldo_mensual_centavos) values (1) $$,
  '42501',
  null,
  'A no crea ajustes: nacen con el household'
);

select throws_ok(
  $$ select private.crear_household('Taller propio', null) $$,
  '42501',
  null,
  'A no crea households'
);


-- A no se suma al taller de B por ningún camino --------------------------------------------------
-- Que cada uno se cree el suyo al registrarse (ADR 0012) no puede significar que pueda meterse en
-- el de otro. Las membresías las crea únicamente el trigger de auth.users.

select throws_ok(
  format(
    'insert into public.household_members (household_id, user_id) values (%L, %L)',
    tests.id('household_b'), tests.id('a')
  ),
  '42501',
  null,
  'A no se agrega al taller de B: authenticated no tiene insert sobre household_members'
);

select throws_ok(
  format(
    'update public.household_members set household_id = %L where user_id = %L',
    tests.id('household_b'), tests.id('a')
  ),
  '42501',
  null,
  'A no muda su membresía al taller de B: tampoco tiene update'
);

select throws_ok(
  format('update public.household_members set deleted_at = null where user_id = %L', tests.id('a')),
  '42501',
  null,
  'A no revive una membresía revocada'
);

select ok(
  not has_function_privilege('authenticated', 'private.crear_taller_del_usuario()', 'EXECUTE'),
  'A no llama a mano a la función que crea talleres'
);

with u as (
  update public.households set nombre = 'Robado' where id = tests.id('household_b') returning 1
)
select is(count(*), 0::bigint, 'A no renombra el taller de B: la policy no se lo muestra') from u;

with u as (
  update public.households set nombre = 'Mi taller nuevo' where id = tests.id('household_a') returning 1
)
select is(count(*), 1::bigint, 'el suyo sí: el nombre es el único campo que el usuario escribe') from u;

select throws_ok(
  format('update public.households set deleted_at = now() where id = %L', tests.id('household_a')),
  '42501',
  null,
  'y es el único: no puede borrar su taller ni tocarle los metadatos'
);


-- Sin household y sin sesión -----------------------------------------------------------------

select tests.entrar_como(tests.id('sin_taller'));

select is(
  (select jsonb_object_agg(t.clave, jsonb_array_length(t.valor)) from jsonb_each(public.bootstrap() - 'cursor') as t (clave, valor)),
  '{"households": 0, "household_members": 0, "ajustes": 0, "clientes": 0, "proyectos": 0, "pagos": 0, "gastos": 0, "opciones_de_presupuesto": 0, "necesidades": 0, "movimientos": 0, "anotaciones": 0, "archivos": 0, "enlaces_publicos": 0}'::jsonb,
  'un usuario sin household no ve nada'
);

select throws_ok(
  $$ insert into public.clientes (nombre) values ('Cliente huérfano') $$,
  '42501',
  'El usuario no pertenece a ningún household',
  'un usuario sin household no puede cargar nada'
);

select tests.salir();
select set_config('role', 'authenticated', true);

select is_empty('select 1 from public.clientes', 'con rol authenticated pero sin sub en el JWT no se ve nada');


-- Una membresía borrada deja de dar acceso ------------------------------------------------------

select tests.salir();
update public.household_members set deleted_at = now() where user_id = tests.id('a');
select tests.entrar_como(tests.id('a'));

select is_empty('select 1 from public.clientes', 'con la membresía borrada, A deja de ver sus clientes');
select is_empty('select 1 from public.households', 'con la membresía borrada, A deja de ver su household');

select * from finish();
