-- La fecha de la plata que entra (ADR 0063): la manda la app, la base no la inventa ni acepta una que
-- todavía no llegó, volver a cobrar un reabierto usa la fecha que se elige, y lo anterior a la
-- apertura puede quedar en el libro sin mover los tesoros.
--
-- Taller A: apertura el 2026-09-14 con 500M en MAUN; sueldo 20M y fijos 25M por mes.
-- Taller B: sin apertura (no vino de una migración).

select plan(44);

select tests.guardar('a', tests.crear_usuario('a@maun.test'));
select tests.guardar('b', tests.crear_usuario('b@maun.test'));
select tests.guardar('household_a', private.crear_household('Taller A', tests.id('a')));
select tests.guardar('household_b', private.crear_household('Taller B', tests.id('b')));

update public.ajustes
set sueldo_mensual_centavos = 20000000, costos_fijos_centavos = 25000000
where household_id in (tests.id('household_a'), tests.id('household_b'));

insert into public.movimientos (household_id, fecha, tipo, tesoro_origen, tesoro_destino, monto_centavos, categoria, descripcion)
values
  (tests.id('household_a'), '2026-09-14', 'ajuste', null, 'maun', 500000000, 'Apertura', 'Apertura'),
  (tests.id('household_a'), '2026-09-01', 'ajuste', null, 'cocos', 1000, 'Ajuste', 'No es la apertura'),
  (tests.id('household_b'), '2026-09-14', 'ajuste', null, 'maun', 1000, 'Ajuste', 'No es la apertura');

insert into public.movimientos (household_id, fecha, tipo, tesoro_origen, tesoro_destino, monto_centavos, categoria, descripcion, deleted_at)
values (tests.id('household_a'), '2026-09-01', 'ajuste', null, 'hogar', 1000, 'Apertura', 'Borrada', now());

select tests.entrar_como(tests.id('a'));

insert into public.clientes (id, nombre) values ('aaaaaaaa-0000-7000-8000-000000000001', 'Marcela');
insert into public.proyectos (id, cliente_id, titulo, estado) values
  ('aaaaaaaa-0000-7000-8000-000000000010', 'aaaaaaaa-0000-7000-8000-000000000001', 'Placard viejo', 'entregado'),
  ('aaaaaaaa-0000-7000-8000-000000000020', 'aaaaaaaa-0000-7000-8000-000000000001', 'En obra', 'en_curso'),
  ('aaaaaaaa-0000-7000-8000-000000000030', 'aaaaaaaa-0000-7000-8000-000000000001', 'Vanitory de agosto', 'entregado'),
  ('aaaaaaaa-0000-7000-8000-000000000040', 'aaaaaaaa-0000-7000-8000-000000000001', 'Lead de junio', 'presupuesto_enviado'),
  ('aaaaaaaa-0000-7000-8000-000000000050', 'aaaaaaaa-0000-7000-8000-000000000001', 'Escritorio nuevo', 'entregado');

insert into public.pagos (id, proyecto_id, fecha, monto_centavos, ya_en_la_apertura) values
  ('aaaaaaaa-0000-7000-8000-000000000101', 'aaaaaaaa-0000-7000-8000-000000000010', '2026-07-01', 60000000, true),
  ('aaaaaaaa-0000-7000-8000-000000000102', 'aaaaaaaa-0000-7000-8000-000000000010', '2026-07-20', 40000000, true),
  ('aaaaaaaa-0000-7000-8000-000000000301', 'aaaaaaaa-0000-7000-8000-000000000030', '2026-08-10', 50000000, false),
  ('aaaaaaaa-0000-7000-8000-000000000401', 'aaaaaaaa-0000-7000-8000-000000000040', '2026-06-01', 10000000, true),
  ('aaaaaaaa-0000-7000-8000-000000000501', 'aaaaaaaa-0000-7000-8000-000000000050', '2026-09-20', 10000000, false);


-- El día de hoy y la apertura -----------------------------------------------------------------------

select is(private.hoy_en_el_taller(), '2099-12-31'::date, 'los tests fijan el día de hoy con su setting');

select set_config('maun.hoy_en_el_taller', '', true);
select is(
  private.hoy_en_el_taller(),
  (now() at time zone 'America/Argentina/Buenos_Aires')::date,
  'sin el setting, hoy es el día de Argentina, no el de UTC'
);
select set_config('maun.hoy_en_el_taller', '2026-09-23', true);

select is(
  private.fecha_de_apertura(tests.id('household_a')), '2026-09-14'::date,
  'la apertura es el ajuste con la categoría Apertura, sin contar los borrados ni los otros ajustes'
);
select is(private.fecha_de_apertura(tests.id('household_b')), null::date, 'un taller sin migración no tiene apertura');


-- Un pago sin fecha, o con una que todavía no llegó ----------------------------------------------------

select throws_ok(
  $$ select public.guardar_proyecto(
       '{"id": "aaaaaaaa-0000-7000-8000-000000000020", "cliente_id": "aaaaaaaa-0000-7000-8000-000000000001", "titulo": "En obra", "estado": "en_curso", "comprobante": "sin_comprobante"}',
       '[{"id": "aaaaaaaa-0000-7000-8000-000000000201", "monto_centavos": 100}]', '[]') $$,
  'MN016', null, 'un pago sin fecha no se guarda: la base no la inventa'
);

select throws_ok(
  $$ select public.guardar_proyecto(
       '{"id": "aaaaaaaa-0000-7000-8000-000000000020", "cliente_id": "aaaaaaaa-0000-7000-8000-000000000001", "titulo": "En obra", "estado": "en_curso", "comprobante": "sin_comprobante"}',
       '[{"id": "aaaaaaaa-0000-7000-8000-000000000201", "fecha": "", "monto_centavos": 100}]', '[]') $$,
  'MN016', null, 'ni con la fecha vacía de un campo sin completar'
);

select throws_ok(
  $$ select public.guardar_proyecto(
       '{"id": "aaaaaaaa-0000-7000-8000-000000000020", "cliente_id": "aaaaaaaa-0000-7000-8000-000000000001", "titulo": "En obra", "estado": "en_curso", "comprobante": "sin_comprobante"}',
       '[{"id": "aaaaaaaa-0000-7000-8000-000000000201", "fecha": "ayer", "monto_centavos": 100}]', '[]') $$,
  'MN016', null, 'ni con algo que no es un día'
);

select throws_ok(
  $$ select public.guardar_proyecto(
       '{"id": "aaaaaaaa-0000-7000-8000-000000000020", "cliente_id": "aaaaaaaa-0000-7000-8000-000000000001", "titulo": "En obra", "estado": "en_curso", "comprobante": "sin_comprobante"}',
       '[{"id": "aaaaaaaa-0000-7000-8000-000000000201", "fecha": "2026-09-24", "monto_centavos": 100}]', '[]') $$,
  'MN017', null, 'un pago de mañana no se guarda'
);

select throws_ok(
  $$ insert into public.pagos (proyecto_id, fecha, monto_centavos) values ('aaaaaaaa-0000-7000-8000-000000000020', '2026-09-24', 100) $$,
  'MN017', null, 'tampoco por fuera de guardar_proyecto: la guarda es de la tabla'
);

select lives_ok(
  $$ select public.guardar_proyecto(
       '{"id": "aaaaaaaa-0000-7000-8000-000000000020", "cliente_id": "aaaaaaaa-0000-7000-8000-000000000001", "titulo": "En obra", "estado": "en_curso", "comprobante": "sin_comprobante"}',
       '[{"id": "aaaaaaaa-0000-7000-8000-000000000201", "fecha": "2026-09-23", "monto_centavos": 100}]', '[]') $$,
  'un pago de hoy sí'
);

select lives_ok(
  $$ select public.guardar_proyecto(
       '{"id": "aaaaaaaa-0000-7000-8000-000000000020", "cliente_id": "aaaaaaaa-0000-7000-8000-000000000001", "titulo": "En obra", "estado": "en_curso", "comprobante": "sin_comprobante"}',
       '[{"id": "aaaaaaaa-0000-7000-8000-000000000201", "borrado": true}]', '[]') $$,
  'y una baja no lleva fecha'
);


-- Lo que ya estaba en los saldos de la apertura --------------------------------------------------------

select lives_ok(
  $$ select public.guardar_proyecto(
       '{"id": "aaaaaaaa-0000-7000-8000-000000000020", "cliente_id": "aaaaaaaa-0000-7000-8000-000000000001", "titulo": "En obra", "estado": "en_curso", "comprobante": "sin_comprobante"}',
       '[{"id": "aaaaaaaa-0000-7000-8000-000000000202", "fecha": "2026-07-15", "monto_centavos": 7000000, "ya_en_la_apertura": true}]', '[]') $$,
  'un pago de julio se puede marcar como ya incluido en la apertura'
);

select is(
  (select ya_en_la_apertura from public.libro_mayor where asiento_id = 'aaaaaaaa-0000-7000-8000-000000000202'),
  true,
  'queda en el libro mayor con su fecha, marcado'
);

select lives_ok(
  $$ select public.guardar_proyecto(
       '{"id": "aaaaaaaa-0000-7000-8000-000000000020", "cliente_id": "aaaaaaaa-0000-7000-8000-000000000001", "titulo": "En obra", "estado": "en_curso", "comprobante": "sin_comprobante"}',
       '[{"id": "aaaaaaaa-0000-7000-8000-000000000202", "fecha": "2026-07-15", "concepto": "Seña", "monto_centavos": 7000000}]', '[]') $$,
  'un bundle viejo que no manda la clave edita el pago'
);

select is(
  (select ya_en_la_apertura from public.pagos where id = 'aaaaaaaa-0000-7000-8000-000000000202'),
  true,
  'y no le borra la marca'
);

select throws_ok(
  $$ select public.guardar_proyecto(
       '{"id": "aaaaaaaa-0000-7000-8000-000000000020", "cliente_id": "aaaaaaaa-0000-7000-8000-000000000001", "titulo": "En obra", "estado": "en_curso", "comprobante": "sin_comprobante"}',
       '[{"id": "aaaaaaaa-0000-7000-8000-000000000203", "fecha": "2026-09-14", "monto_centavos": 100, "ya_en_la_apertura": true}]', '[]') $$,
  'MN018', null, 'un pago del mismo día de la apertura no estaba en los saldos de arranque'
);

select throws_ok(
  $$ update public.pagos set fecha = '2026-09-20' where id = 'aaaaaaaa-0000-7000-8000-000000000202' $$,
  'MN018', null, 'mover un pago marcado a después de la apertura se rechaza'
);

select lives_ok(
  $$ update public.pagos set fecha = '2026-09-20', ya_en_la_apertura = false where id = 'aaaaaaaa-0000-7000-8000-000000000202' $$,
  'moverlo y destildarlo a la vez, sí'
);

select results_eq(
  $$ select tesoro::text, sum(monto_centavos)::bigint from public.libro_mayor
     where not ya_en_la_apertura group by tesoro order by tesoro::text $$,
  $$ values ('cocos', 1000::bigint), ('maun', 567000000::bigint) $$,
  'los saldos: la apertura, lo de después, y nada de lo que ya estaba en ella (los pagos de julio y de junio no suman)'
);


-- Un cobro de antes de la apertura: tildado no mueve los tesoros, destildado sí ------------------

select is(
  (
    select reparto_ya_en_la_apertura
    from public.cobrar_proyecto(
      'aaaaaaaa-0000-7000-8000-000000000010',
      (select version from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000010'),
      '2026-07-20', 100000000, 0, 20000000, 25000000, 10000000, 20000000, 25000000, 45000000, 0, 0, true
    )
  ),
  true,
  'un cobro de julio se congela marcado como ya incluido en la apertura'
);

select results_eq(
  $$ select tesoro::text, sum(monto_centavos)::bigint from public.libro_mayor
     where proyecto_id = 'aaaaaaaa-0000-7000-8000-000000000010' and origen = 'distribucion' and ya_en_la_apertura
     group by tesoro order by tesoro::text $$,
  $$ values ('diezmo', 10000000::bigint), ('hogar', 20000000::bigint), ('maun', -30000000::bigint) $$,
  'su reparto queda en el libro, con la fecha del cobro, marcado'
);

select is(
  (select min(fecha) from public.libro_mayor where proyecto_id = 'aaaaaaaa-0000-7000-8000-000000000010' and origen = 'distribucion'),
  '2026-07-20'::date,
  'y fechado el día del cobro, no el de hoy'
);

select results_eq(
  $$ select tesoro::text, sum(monto_centavos)::bigint from public.libro_mayor
     where not ya_en_la_apertura group by tesoro order by tesoro::text $$,
  $$ values ('cocos', 1000::bigint), ('maun', 567000000::bigint) $$,
  'y los cuatro saldos no cambian'
);

select is(
  (
    select reparto_ya_en_la_apertura
    from public.cobrar_proyecto(
      'aaaaaaaa-0000-7000-8000-000000000030',
      (select version from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000030'),
      '2026-08-10', 50000000, 0, 20000000, 25000000, 5000000, 20000000, 25000000, 0, 0, 0, false
    )
  ),
  false,
  'el de agosto, destildado, se cobra como cualquier otro'
);

select results_eq(
  $$ select tesoro::text, sum(monto_centavos)::bigint from public.libro_mayor
     where not ya_en_la_apertura group by tesoro order by tesoro::text $$,
  $$ values ('cocos', 1000::bigint), ('diezmo', 5000000::bigint), ('hogar', 20000000::bigint), ('maun', 542000000::bigint) $$,
  'y su reparto mueve los tesoros: diezmo +5M, hogar +20M y maun −25M'
);

select is(
  (
    select version
    from public.cobrar_proyecto(
      'aaaaaaaa-0000-7000-8000-000000000010',
      (select version - 1 from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000010'),
      '2026-07-20', 100000000, 0, 20000000, 25000000, 10000000, 20000000, 25000000, 45000000, 0, 0, true
    )
  ),
  (select version from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000010'),
  'el reenvío de un cobro marcado lo reconoce, marca incluida'
);

select throws_ok(
  format(
    $$ select public.cobrar_proyecto('aaaaaaaa-0000-7000-8000-000000000050', %s, '2026-09-20', 10000000, 0, 20000000, 25000000, 1000000, 9000000, 0, 0, 0, 0, true) $$,
    (select version from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000050')
  ),
  'MN018', null, 'un cobro de después de la apertura no puede marcarse como ya incluido en ella'
);

select throws_ok(
  format(
    $$ select public.cobrar_proyecto('aaaaaaaa-0000-7000-8000-000000000050', %s, '2026-09-24', 10000000, 0, 20000000, 25000000, 1000000, 9000000, 0, 0, 0, 0) $$,
    (select version from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000050')
  ),
  'MN017', null, 'un cobro con fecha de mañana se rechaza'
);


-- Reabrir y volver a cobrar con otra fecha --------------------------------------------------------------

select is(
  (
    select reparto_ya_en_la_apertura
    from public.reabrir_proyecto(
      'aaaaaaaa-0000-7000-8000-000000000010',
      (select version from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000010')
    )
  ),
  true,
  'reabrir conserva la marca, para que volver a cobrar proponga lo mismo'
);

select is(
  (select reapertura_fecha_cobro from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000010'),
  '2026-07-20'::date,
  'y la fecha del cobro original, que es la que la app propone'
);

select tests.salir();
update public.ajustes set sueldo_mensual_centavos = 99000000 where household_id = tests.id('household_a');
select tests.entrar_como(tests.id('a'));

select results_eq(
  format(
    $$
      select fecha_cobro, dist_sueldo_centavos, dist_fijos_centavos, dist_fijos_previo_centavos,
             dist_objetivo_sueldo_centavos, reparto_ya_en_la_apertura
      from public.cobrar_proyecto('aaaaaaaa-0000-7000-8000-000000000010', %s, '2026-08-05',
        100000000, 0, 20000000, 0, 10000000, 20000000, 0, 70000000, 20000000, 25000000, true)
    $$,
    (select version from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000010')
  ),
  $$ values ('2026-08-05'::date, 20000000::bigint, 0::bigint, 25000000::bigint, 20000000::bigint, true) $$,
  'volver a cobrar con otra fecha lo pasa a ese mes: agosto ya tenía los fijos cubiertos, y el sueldo es el objetivo del cobro original'
);

select is(
  (select count(*)::integer from public.proyectos where household_id = tests.id('household_a') and fecha_cobro >= '2026-07-01' and fecha_cobro < '2026-08-01'),
  0,
  'y julio ya no lo cuenta'
);


-- Un perdido de antes de la apertura, y reactivarlo -----------------------------------------------------

select is(
  (
    select reparto_ya_en_la_apertura
    from public.cerrar_perdido(
      'aaaaaaaa-0000-7000-8000-000000000040',
      (select version from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000040'),
      '2026-06-15', 10000000, 0, 0, 25000000, 1000000, 0, 9000000, 0, 1000, 0, 0, true
    )
  ),
  true,
  'un perdido de junio con la seña de junio también se puede marcar'
);

select is(
  (
    select reparto_ya_en_la_apertura
    from public.reactivar_perdido(
      'aaaaaaaa-0000-7000-8000-000000000040',
      (select version from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000040'),
      'presupuesto_enviado'
    )
  ),
  false,
  'reactivarlo apaga la marca: un cierre posterior es un evento nuevo'
);

select throws_ok(
  format(
    $$ select public.cerrar_perdido('aaaaaaaa-0000-7000-8000-000000000040', %s, null, 10000000, 0, 0, 25000000, 1000000, 0, 9000000, 0, 1000) $$,
    (select version from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000040')
  ),
  'MN016', null, 'el cierre de un perdido también necesita su fecha'
);


-- En un taller sin apertura no hay nada que marcar ---------------------------------------------------

select tests.entrar_como(tests.id('b'));
insert into public.clientes (id, nombre) values ('bbbbbbbb-0000-7000-8000-000000000001', 'Cliente de B');
insert into public.proyectos (id, cliente_id, titulo, estado)
  values ('bbbbbbbb-0000-7000-8000-000000000010', 'bbbbbbbb-0000-7000-8000-000000000001', 'De B', 'en_curso');

select throws_ok(
  $$ insert into public.pagos (proyecto_id, fecha, monto_centavos, ya_en_la_apertura) values ('bbbbbbbb-0000-7000-8000-000000000010', '2020-01-01', 100, true) $$,
  'MN018', null, 'sin apertura, ningún pago estaba en los saldos de arranque'
);

select lives_ok(
  $$ insert into public.pagos (proyecto_id, fecha, monto_centavos) values ('bbbbbbbb-0000-7000-8000-000000000010', '2020-01-01', 100) $$,
  'un pago viejo sin marcar se guarda y mueve los tesoros como siempre'
);

select is(
  (select count(*)::integer from public.libro_mayor where household_id = tests.id('household_a')),
  0,
  'B no ve el libro de A'
);


-- La gemela del dominio ----------------------------------------------------------------------------------

select tests.salir();

select has_function('private', 'fecha_de_apertura', array['uuid'], 'la apertura tiene su función, gemela de fechaDeApertura');
select function_privs_are('private', 'fecha_de_apertura', array['uuid'], 'anon', array[]::text[], 'anon no la ejecuta');
select function_privs_are('private', 'hoy_en_el_taller', array[]::text[], 'anon', array[]::text[], 'ni la de hoy');
select col_default_is('public', 'pagos', 'ya_en_la_apertura', 'false', 'un pago nuevo nace moviendo los tesoros');
select col_default_is('public', 'proyectos', 'reparto_ya_en_la_apertura', 'false', 'y un reparto también');
select col_not_null('public', 'pagos', 'ya_en_la_apertura', 'la marca de un pago no tiene null: o estaba en la apertura o no');

select * from finish();
