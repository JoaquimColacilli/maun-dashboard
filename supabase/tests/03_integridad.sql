-- Metadatos, idempotencia, constraints de plata y las guardas que protegen lo congelado.

select plan(53);

select tests.guardar('a', tests.crear_usuario('a@maun.test'));
select tests.guardar('household_a', private.crear_household('Taller A', tests.id('a')));
select tests.guardar('household_b', private.crear_household('Taller B', null));


-- UUIDv7 ---------------------------------------------------------------------------------------

select matches(
  private.uuidv7()::text,
  '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
  'private.uuidv7() da versión 7 y variante RFC 9562'
);

select tests.guardar('uuid_anterior', private.uuidv7());
select pg_sleep(0.005);
select ok(private.uuidv7() > tests.id('uuid_anterior'), 'private.uuidv7() crece con el tiempo');


-- Metadatos ------------------------------------------------------------------------------------

select tests.entrar_como(tests.id('a'));

insert into public.clientes (nombre) values ('Cliente sin id');
select matches(
  (select id::text from public.clientes where nombre = 'Cliente sin id'),
  '^[0-9a-f]{8}-[0-9a-f]{4}-7',
  'si el cliente no manda id, el default genera un UUIDv7'
);

insert into public.clientes (id, nombre) values ('aaaaaaaa-0000-7000-8000-000000000001', 'Marcela');

select is(
  (select version from public.clientes where id = 'aaaaaaaa-0000-7000-8000-000000000001'),
  1,
  'una fila nueva nace en version 1'
);

select set_config('tests.marca_1', (select updated_at::text from public.clientes where id = 'aaaaaaaa-0000-7000-8000-000000000001'), true);

update public.clientes set notas = 'Llamar a la tarde' where id = 'aaaaaaaa-0000-7000-8000-000000000001';

select is(
  (select version from public.clientes where id = 'aaaaaaaa-0000-7000-8000-000000000001'),
  2,
  'un cambio incrementa version'
);
select ok(
  (select updated_at from public.clientes where id = 'aaaaaaaa-0000-7000-8000-000000000001') > current_setting('tests.marca_1')::timestamptz,
  'un cambio mueve updated_at'
);

select set_config('tests.marca_2', (select updated_at::text from public.clientes where id = 'aaaaaaaa-0000-7000-8000-000000000001'), true);

update public.clientes set notas = 'Llamar a la tarde' where id = 'aaaaaaaa-0000-7000-8000-000000000001';

select is(
  (select version from public.clientes where id = 'aaaaaaaa-0000-7000-8000-000000000001'),
  2,
  'un update sin cambios no incrementa version'
);

-- El reenvío de la cola de salida: el mismo upsert, dos veces.
insert into public.clientes (id, nombre, notas)
values ('aaaaaaaa-0000-7000-8000-000000000001', 'Marcela', 'Llamar a la tarde')
on conflict (id) do update set nombre = excluded.nombre, notas = excluded.notas;

select is(
  (select version from public.clientes where id = 'aaaaaaaa-0000-7000-8000-000000000001'),
  2,
  'reenviar un upsert ya aplicado no incrementa version'
);
select is(
  (select updated_at from public.clientes where id = 'aaaaaaaa-0000-7000-8000-000000000001'),
  current_setting('tests.marca_2')::timestamptz,
  'reenviar un upsert ya aplicado no mueve updated_at: no genera un delta'
);

select throws_ok(
  $$ update public.clientes set version = 99 where id = 'aaaaaaaa-0000-7000-8000-000000000001' $$,
  '42501',
  null,
  'el cliente no escribe version'
);

select throws_ok(
  $$ update public.clientes set updated_at = now() - interval '1 year' where id = 'aaaaaaaa-0000-7000-8000-000000000001' $$,
  '42501',
  null,
  'el cliente no escribe updated_at'
);

select tests.salir();

select throws_ok(
  format('update public.clientes set household_id = %L where id = %L', tests.id('household_b'), 'aaaaaaaa-0000-7000-8000-000000000001'),
  'MN004',
  null,
  'ni el dueño de la base mueve una fila de household'
);

select throws_ok(
  $$ update public.clientes set id = private.uuidv7() where id = 'aaaaaaaa-0000-7000-8000-000000000001' $$,
  'MN004',
  null,
  'el id de una fila es inmutable'
);

update public.clientes set created_at = '2000-01-01' where id = 'aaaaaaaa-0000-7000-8000-000000000001';
select isnt(
  (select created_at from public.clientes where id = 'aaaaaaaa-0000-7000-8000-000000000001'),
  '2000-01-01'::timestamptz,
  'created_at no se reescribe en un update'
);


-- Constraints ----------------------------------------------------------------------------------

select tests.entrar_como(tests.id('a'));

insert into public.proyectos (id, cliente_id, titulo, estado)
  values ('aaaaaaaa-0000-7000-8000-000000000010', 'aaaaaaaa-0000-7000-8000-000000000001', 'Placard', 'entregado');
insert into public.pagos (id, proyecto_id, fecha, monto_centavos) values
  ('aaaaaaaa-0000-7000-8000-000000000011', 'aaaaaaaa-0000-7000-8000-000000000010', '2026-08-01', 60000000),
  ('aaaaaaaa-0000-7000-8000-000000000012', 'aaaaaaaa-0000-7000-8000-000000000010', '2026-08-20', 40000000);
insert into public.gastos (id, proyecto_id, fecha, monto_centavos)
  values ('aaaaaaaa-0000-7000-8000-000000000013', 'aaaaaaaa-0000-7000-8000-000000000010', '2026-08-02', 30000000);

select throws_ok(
  $$ update public.proyectos set estado = 'cobrado' where id = 'aaaaaaaa-0000-7000-8000-000000000010' $$,
  '23514',
  null,
  'el cliente no marca cobrado un proyecto sin congelar la distribución'
);

select throws_ok(
  $$ update public.proyectos set dist_diezmo_centavos = 1 where id = 'aaaaaaaa-0000-7000-8000-000000000010' $$,
  '42501',
  null,
  'el cliente no escribe la distribución congelada'
);

select throws_ok(
  $$ insert into public.pagos (proyecto_id, fecha, monto_centavos) values ('aaaaaaaa-0000-7000-8000-000000000010', '2026-08-21', 0) $$,
  '23514',
  null,
  'un pago no puede ser de cero'
);

select throws_ok(
  $$ insert into public.proyectos (cliente_id, titulo, presupuesto_centavos) values ('aaaaaaaa-0000-7000-8000-000000000001', 'x', -1) $$,
  '23514',
  null,
  'un presupuesto no puede ser negativo'
);

select throws_ok(
  $$ insert into public.clientes (nombre, cuit) values ('Estudio', '30712345678') $$,
  '23514',
  null,
  'el CUIT va con guiones'
);

select tests.salir();

select throws_ok(
  $$
    update public.proyectos set
      estado = 'cobrado', fecha_cobro = '2026-08-20',
      dist_cobrado_centavos = 100000000, dist_gastos_centavos = 30000000, dist_diezmo_bp = 1000,
      dist_tope_sueldo_centavos = 180000000, dist_tope_fijos_centavos = 25000000,
      dist_diezmo_centavos = 7000000, dist_sueldo_centavos = 63000000, dist_fijos_centavos = 0, dist_remanente_centavos = 1
    where id = 'aaaaaaaa-0000-7000-8000-000000000010'
  $$,
  '23514',
  null,
  'una distribución que no suma la ganancia neta no entra'
);

select throws_ok(
  $$
    update public.proyectos set
      estado = 'cobrado', fecha_cobro = '2026-08-20',
      dist_cobrado_centavos = 100000000, dist_gastos_centavos = 30000000, dist_diezmo_bp = 1000,
      dist_tope_sueldo_centavos = 50000000, dist_tope_fijos_centavos = 25000000,
      dist_diezmo_centavos = 7000000, dist_sueldo_centavos = 63000000, dist_fijos_centavos = 0, dist_remanente_centavos = 0
    where id = 'aaaaaaaa-0000-7000-8000-000000000010'
  $$,
  '23514',
  null,
  'el sueldo no pasa su tope'
);

select lives_ok(
  $$
    update public.proyectos set
      estado = 'cobrado', fecha_cobro = '2026-08-20',
      dist_cobrado_centavos = 100000000, dist_gastos_centavos = 30000000, dist_diezmo_bp = 1000,
      dist_tope_sueldo_centavos = 180000000, dist_tope_fijos_centavos = 25000000,
      dist_diezmo_centavos = 7000000, dist_sueldo_centavos = 63000000, dist_fijos_centavos = 0, dist_remanente_centavos = 0
    where id = 'aaaaaaaa-0000-7000-8000-000000000010'
  $$,
  'una distribución que cuadra congela el proyecto'
);

select lives_ok(
  $$
    insert into public.proyectos (
      household_id, cliente_id, titulo, estado, fecha_cobro,
      dist_cobrado_centavos, dist_gastos_centavos, dist_diezmo_bp, dist_tope_sueldo_centavos, dist_tope_fijos_centavos,
      dist_diezmo_centavos, dist_sueldo_centavos, dist_fijos_centavos, dist_remanente_centavos
    )
    select household_id, id, 'Proyecto a pérdida', 'cobrado', '2026-08-20',
      10000000, 15000000, 1000, 180000000, 25000000,
      0, 0, 0, -5000000
    from public.clientes where id = 'aaaaaaaa-0000-7000-8000-000000000001'
  $$,
  'un proyecto con pérdida congela todo en cero y la pérdida en el remanente'
);


-- Lo congelado no se toca ----------------------------------------------------------------------

select tests.entrar_como(tests.id('a'));

select throws_ok(
  $$ insert into public.pagos (proyecto_id, fecha, monto_centavos) values ('aaaaaaaa-0000-7000-8000-000000000010', '2026-08-25', 1000) $$,
  'MN001',
  null,
  'no entra un pago nuevo en un proyecto cobrado'
);

select throws_ok(
  $$ update public.pagos set monto_centavos = 1 where id = 'aaaaaaaa-0000-7000-8000-000000000011' $$,
  'MN001',
  null,
  'no se edita un pago de un proyecto cobrado'
);

select throws_ok(
  $$ update public.pagos set deleted_at = now() where id = 'aaaaaaaa-0000-7000-8000-000000000011' $$,
  'MN001',
  null,
  'no se borra un pago de un proyecto cobrado'
);

select throws_ok(
  $$ insert into public.gastos (proyecto_id, fecha, monto_centavos) values ('aaaaaaaa-0000-7000-8000-000000000010', '2026-08-25', 1000) $$,
  'MN001',
  null,
  'no entra un gasto nuevo en un proyecto cobrado'
);

select lives_ok(
  $$
    insert into public.pagos (id, proyecto_id, fecha, monto_centavos)
    values ('aaaaaaaa-0000-7000-8000-000000000011', 'aaaaaaaa-0000-7000-8000-000000000010', '2026-08-01', 60000000)
    on conflict (id) do update set
      proyecto_id = excluded.proyecto_id, fecha = excluded.fecha, monto_centavos = excluded.monto_centavos
  $$,
  'el reenvío idéntico de un pago ya aplicado pasa aunque el proyecto se haya cobrado después'
);

select is(
  (select version from public.pagos where id = 'aaaaaaaa-0000-7000-8000-000000000011'),
  1,
  'y no toca la fila'
);

insert into public.proyectos (id, cliente_id, titulo)
  values ('aaaaaaaa-0000-7000-8000-000000000020', 'aaaaaaaa-0000-7000-8000-000000000001', 'Escritorio');

select throws_ok(
  $$ update public.pagos set proyecto_id = 'aaaaaaaa-0000-7000-8000-000000000020' where id = 'aaaaaaaa-0000-7000-8000-000000000011' $$,
  'MN001',
  null,
  'no se saca un pago de un proyecto cobrado moviéndolo a otro'
);

select throws_ok(
  $$ update public.proyectos set deleted_at = now() where id = 'aaaaaaaa-0000-7000-8000-000000000010' $$,
  'MN001',
  null,
  'un proyecto cobrado no se borra'
);

-- Una edición encolada antes del cobro trae el estado viejo: tiene que rebotar con un código de
-- negocio que la cola sepa mostrar, no con el 23514 del check.
select throws_ok(
  $$
    insert into public.proyectos (id, cliente_id, titulo, estado)
    values ('aaaaaaaa-0000-7000-8000-000000000010', 'aaaaaaaa-0000-7000-8000-000000000001', 'Placard', 'entregado')
    on conflict (id) do update set titulo = excluded.titulo, estado = excluded.estado
  $$,
  'MN001',
  null,
  'el estado de un proyecto cobrado no vuelve atrás por una edición encolada'
);


-- Bajas -----------------------------------------------------------------------------------------

insert into public.pagos (id, proyecto_id, fecha, monto_centavos)
  values ('aaaaaaaa-0000-7000-8000-000000000021', 'aaaaaaaa-0000-7000-8000-000000000020', '2026-09-01', 10000);
insert into public.gastos (id, proyecto_id, fecha, monto_centavos)
  values ('aaaaaaaa-0000-7000-8000-000000000022', 'aaaaaaaa-0000-7000-8000-000000000020', '2026-09-01', 5000);

select throws_ok(
  $$ update public.pagos set proyecto_id = 'aaaaaaaa-0000-7000-8000-000000000010' where id = 'aaaaaaaa-0000-7000-8000-000000000021' $$,
  'MN001',
  null,
  'no se mete un pago en un proyecto cobrado moviéndolo desde otro'
);

-- La marca la manda el cliente con su hora, que no es la del servidor: un literal distinto de
-- now() prueba que la cascada copia la del proyecto y no pone la suya.
update public.proyectos set deleted_at = '2026-09-01 10:00-03' where id = 'aaaaaaaa-0000-7000-8000-000000000020';

select ok(
  (select deleted_at is not null from public.pagos where id = 'aaaaaaaa-0000-7000-8000-000000000021')
  and (select deleted_at is not null from public.gastos where id = 'aaaaaaaa-0000-7000-8000-000000000022'),
  'borrar un proyecto borra sus pagos y gastos'
);

select ok(
  (select deleted_at from public.pagos where id = 'aaaaaaaa-0000-7000-8000-000000000021') = '2026-09-01 10:00-03'::timestamptz
  and (select deleted_at from public.gastos where id = 'aaaaaaaa-0000-7000-8000-000000000022') = '2026-09-01 10:00-03'::timestamptz,
  'con la misma marca que el proyecto, no con la hora del servidor'
);

update public.pagos set deleted_at = '2030-01-01 00:00-03' where id = 'aaaaaaaa-0000-7000-8000-000000000021';

select ok(
  (select version = 2 and deleted_at = '2026-09-01 10:00-03'::timestamptz
   from public.pagos where id = 'aaaaaaaa-0000-7000-8000-000000000021'),
  'borrar otra vez lo ya borrado, con otra marca, es un no-op: conserva la primera y no sube version'
);

select throws_ok(
  $$ update public.proyectos set deleted_at = null where id = 'aaaaaaaa-0000-7000-8000-000000000020' $$,
  'MN002',
  null,
  'un proyecto borrado no revive: una edición vieja encolada no lo resucita sin sus pagos'
);

select throws_ok(
  $$ insert into public.pagos (proyecto_id, fecha, monto_centavos) values ('aaaaaaaa-0000-7000-8000-000000000020', '2026-09-02', 1000) $$,
  'MN002',
  null,
  'no entra un pago en un proyecto borrado'
);

insert into public.clientes (id, nombre) values ('aaaaaaaa-0000-7000-8000-000000000030', 'Cliente con obra');
insert into public.proyectos (id, cliente_id, titulo)
  values ('aaaaaaaa-0000-7000-8000-000000000031', 'aaaaaaaa-0000-7000-8000-000000000030', 'Vanitory');

select throws_ok(
  $$ update public.clientes set deleted_at = now() where id = 'aaaaaaaa-0000-7000-8000-000000000030' $$,
  'MN003',
  null,
  'no se borra un cliente con proyectos vivos'
);

update public.proyectos set deleted_at = now() where id = 'aaaaaaaa-0000-7000-8000-000000000031';

select lives_ok(
  $$ update public.clientes set deleted_at = now() where id = 'aaaaaaaa-0000-7000-8000-000000000030' $$,
  'sin proyectos vivos, el cliente se borra'
);

select throws_ok(
  $$ insert into public.proyectos (cliente_id, titulo) values ('aaaaaaaa-0000-7000-8000-000000000030', 'Encolado offline') $$,
  'MN005',
  null,
  'no entra un proyecto para un cliente borrado, aunque venga de una cola offline'
);

insert into public.proyectos (id, cliente_id, titulo)
  values ('aaaaaaaa-0000-7000-8000-000000000040', 'aaaaaaaa-0000-7000-8000-000000000001', 'Rack de TV');

select throws_ok(
  $$ update public.proyectos set cliente_id = 'aaaaaaaa-0000-7000-8000-000000000030' where id = 'aaaaaaaa-0000-7000-8000-000000000040' $$,
  'MN005',
  null,
  'un proyecto vivo no se reasigna a un cliente borrado'
);


-- Forma de los movimientos ---------------------------------------------------------------------

select throws_ok(
  $$ insert into public.movimientos (fecha, tipo, tesoro_origen, tesoro_destino, monto_centavos) values ('2026-09-01', 'ingreso', 'maun', 'hogar', 100) $$,
  '23514', null, 'un ingreso viene de afuera: no tiene origen'
);
select throws_ok(
  $$ insert into public.movimientos (fecha, tipo, tesoro_destino, monto_centavos) values ('2026-09-01', 'gasto', 'hogar', 100) $$,
  '23514', null, 'un gasto sale de un tesoro: tiene origen y no destino'
);
select throws_ok(
  $$ insert into public.movimientos (fecha, tipo, tesoro_origen, tesoro_destino, monto_centavos) values ('2026-09-01', 'transferencia', 'maun', 'maun', 100) $$,
  '23514', null, 'una transferencia no va de un tesoro a sí mismo'
);
select throws_ok(
  $$ insert into public.movimientos (fecha, tipo, tesoro_origen, monto_centavos) values ('2026-09-01', 'pago_diezmo', 'maun', 100) $$,
  '23514', null, 'el diezmo se paga desde el tesoro diezmo'
);
select throws_ok(
  $$ insert into public.movimientos (fecha, tipo, tesoro_origen, monto_centavos) values ('2026-09-01', 'aporte_cocos', 'maun', 100) $$,
  '23514', null, 'un aporte a Cocos tiene destino cocos'
);
select throws_ok(
  $$ insert into public.movimientos (fecha, tipo, tesoro_origen, tesoro_destino, monto_centavos) values ('2026-09-01', 'ajuste', 'maun', 'hogar', 100) $$,
  '23514', null, 'un ajuste toca un solo tesoro'
);
select throws_ok(
  $$ insert into public.movimientos (fecha, tipo, tesoro_destino, monto_centavos) values ('2026-09-01', 'ingreso', 'hogar', -100) $$,
  '23514', null, 'el monto de un movimiento es positivo: el sentido lo dan origen y destino'
);

select lives_ok(
  $$
    insert into public.movimientos (fecha, tipo, tesoro_origen, tesoro_destino, monto_centavos) values
      ('2026-09-01', 'ingreso', null, 'hogar', 100),
      ('2026-09-01', 'gasto', 'hogar', null, 100),
      ('2026-09-01', 'transferencia', 'maun', 'hogar', 100),
      ('2026-09-01', 'pago_diezmo', 'diezmo', null, 100),
      ('2026-09-01', 'aporte_cocos', 'maun', 'cocos', 100),
      ('2026-09-01', 'ajuste', null, 'cocos', 100),
      ('2026-09-01', 'ajuste', 'cocos', null, 100)
  $$,
  'las siete formas válidas de movimiento entran'
);


-- Ajustes --------------------------------------------------------------------------------------

select lives_ok(
  format('update public.ajustes set sueldo_mensual_centavos = 190000000 where household_id = %L', tests.id('household_a')),
  'el usuario edita sus ajustes'
);

select throws_ok(
  format('update public.ajustes set tasa_cocos_anual_bp = -1 where household_id = %L', tests.id('household_a')),
  '23514', null, 'la tasa no es negativa'
);

-- Contrato de la cola (ADR 0010): las altas son upsert, las ediciones son update por id. ajustes
-- solo se edita, así que el upsert no tiene grant.
select throws_ok(
  format(
    'insert into public.ajustes (id, sueldo_mensual_centavos) values (%L, 1) on conflict (id) do update set sueldo_mensual_centavos = excluded.sueldo_mensual_centavos',
    (select id from public.ajustes where household_id = tests.id('household_a'))
  ),
  '42501', null, 'ajustes se edita con update, no con upsert'
);

select * from finish();
