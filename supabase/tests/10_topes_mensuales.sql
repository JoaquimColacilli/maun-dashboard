-- Topes mensuales: los fijos se topean por lo que falta del mes y el sueldo, por proyecto o por mes.
-- Lo liquidado en el mes se suma de las distribuciones congeladas: reabrir saca un proyecto de la
-- suma y los demás cobros del mes no se recalculan (ADR 0011).
-- Ajustes: sueldo 50M, fijos 25M. P1 (pagos 70M) y P2 (100M) en septiembre, P3 (100M) en octubre,
-- P4 (40M) y P5 (100M) en noviembre, con el sueldo mensual.

select plan(20);

select tests.guardar('a', tests.crear_usuario('a@maun.test'));
select tests.guardar('household_a', private.crear_household('Taller A', tests.id('a')));

update public.ajustes
set sueldo_mensual_centavos = 50000000, costos_fijos_centavos = 25000000, sueldo_tope_mensual = false
where household_id = tests.id('household_a');

select tests.entrar_como(tests.id('a'));

insert into public.clientes (id, nombre) values ('aaaaaaaa-0000-7000-8000-000000000001', 'Marcela');
insert into public.proyectos (id, cliente_id, titulo, estado) values
  ('aaaaaaaa-0000-7000-8000-000000000011', 'aaaaaaaa-0000-7000-8000-000000000001', 'P1', 'entregado'),
  ('aaaaaaaa-0000-7000-8000-000000000012', 'aaaaaaaa-0000-7000-8000-000000000001', 'P2', 'entregado'),
  ('aaaaaaaa-0000-7000-8000-000000000013', 'aaaaaaaa-0000-7000-8000-000000000001', 'P3', 'entregado'),
  ('aaaaaaaa-0000-7000-8000-000000000014', 'aaaaaaaa-0000-7000-8000-000000000001', 'P4', 'entregado'),
  ('aaaaaaaa-0000-7000-8000-000000000015', 'aaaaaaaa-0000-7000-8000-000000000001', 'P5', 'entregado');
insert into public.pagos (proyecto_id, fecha, monto_centavos) values
  ('aaaaaaaa-0000-7000-8000-000000000011', '2026-09-01', 70000000),
  ('aaaaaaaa-0000-7000-8000-000000000012', '2026-09-01', 100000000),
  ('aaaaaaaa-0000-7000-8000-000000000013', '2026-10-01', 100000000),
  ('aaaaaaaa-0000-7000-8000-000000000014', '2026-11-01', 40000000),
  ('aaaaaaaa-0000-7000-8000-000000000015', '2026-11-01', 100000000);


-- Dos cobros en septiembre -------------------------------------------------------------------------

-- P1: neta 70M, diezmo 7M, sueldo 50M, y los 13M que quedan van a fijos.
select is(
  (
    select dist_fijos_centavos
    from public.cobrar_proyecto(
      'aaaaaaaa-0000-7000-8000-000000000011', 1, '2026-09-03',
      70000000, 0, 50000000, 25000000, 7000000, 50000000, 13000000, 0
    )
  ),
  13000000::bigint,
  'el primer cobro del mes toma los fijos que le alcanzan'
);

select throws_ok(
  $$ select public.cobrar_proyecto('aaaaaaaa-0000-7000-8000-000000000012', 1, '2026-09-20', 100000000, 0, 50000000, 25000000, 10000000, 50000000, 25000000, 15000000) $$,
  'MN006', null, 'si la app no vio el otro cobro del mes, el tope de fijos no coincide y se rechaza'
);

select results_eq(
  $$
    select dist_tope_fijos_centavos, dist_fijos_centavos, dist_remanente_centavos
    from public.cobrar_proyecto('aaaaaaaa-0000-7000-8000-000000000012', 1, '2026-09-20', 100000000, 0, 50000000, 12000000, 10000000, 50000000, 12000000, 28000000)
  $$,
  $$ values (12000000::bigint, 12000000::bigint, 28000000::bigint) $$,
  'el segundo cobro del mes toma solo lo que falta de los fijos, y el resto queda de remanente'
);

select results_eq(
  $$
    select dist_objetivo_sueldo_centavos, dist_objetivo_fijos_centavos, dist_sueldo_mensual,
           dist_sueldo_previo_centavos, dist_fijos_previo_centavos, dist_tope_sueldo_centavos
    from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000012'
  $$,
  $$ values (50000000::bigint, 25000000::bigint, false, 50000000::bigint, 13000000::bigint, 50000000::bigint) $$,
  'congela el objetivo y lo que el mes ya llevaba: el tope se explica solo, y el sueldo por proyecto no mira el mes'
);

select is(
  (
    select dist_fijos_centavos
    from public.cobrar_proyecto(
      'aaaaaaaa-0000-7000-8000-000000000013', 1, '2026-10-01',
      100000000, 0, 50000000, 25000000, 10000000, 50000000, 25000000, 15000000
    )
  ),
  25000000::bigint,
  'un cobro de otro mes no mira septiembre: tiene los fijos enteros'
);


-- Reabrir un cobro de un mes con otros cobros --------------------------------------------------------

select is(
  (
    select estado::text
    from public.reabrir_proyecto(
      'aaaaaaaa-0000-7000-8000-000000000011',
      (select version from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000011')
    )
  ),
  'entregado',
  'P1 se reabre'
);

select is(
  (
    select sum(dist_fijos_centavos)::bigint from public.proyectos
    where fecha_cobro >= '2026-09-01' and fecha_cobro < '2026-10-01'
  ),
  12000000::bigint,
  'y sale de la suma del mes: septiembre queda con 13.000.000 de fijos sin cubrir, a la vista'
);

select results_eq(
  $$ select dist_tope_fijos_centavos, dist_fijos_centavos, version from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000012' $$,
  $$ values (12000000::bigint, 12000000::bigint, 2) $$,
  'P2 no se recalcula: sigue congelado con lo que tomó'
);

-- P1 recibe un pago más, y mientras estuvo reabierto los fijos subieron a 99M.
insert into public.pagos (proyecto_id, fecha, monto_centavos)
  values ('aaaaaaaa-0000-7000-8000-000000000011', '2026-09-25', 30000000);
update public.ajustes set costos_fijos_centavos = 99000000 where household_id = tests.id('household_a');

select throws_ok(
  format($$ select public.cobrar_proyecto('aaaaaaaa-0000-7000-8000-000000000011', %s, '2026-09-03', 100000000, 0, 50000000, 87000000, 10000000, 50000000, 40000000, 0) $$,
         (select version from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000011')),
  'MN006', null, 'volver a cobrar con los fijos de hoy se rechaza: el objetivo es el del cobro original'
);

select results_eq(
  format(
    $$
      select fecha_cobro, dist_tope_fijos_centavos, dist_fijos_centavos, dist_remanente_centavos,
             dist_fijos_previo_centavos, dist_objetivo_fijos_centavos
      from public.cobrar_proyecto('aaaaaaaa-0000-7000-8000-000000000011', %s, '2026-09-03', 100000000, 0, 50000000, 13000000, 10000000, 50000000, 13000000, 27000000)
    $$,
    (select version from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000011')
  ),
  $$ values ('2026-09-03'::date, 13000000::bigint, 13000000::bigint, 27000000::bigint, 12000000::bigint, 25000000::bigint) $$,
  'se vuelve a cobrar en su mes, con su objetivo, contra lo que el mes lleva hoy'
);


-- Los parámetros de ajustes ------------------------------------------------------------------------

select throws_ok(
  format('update public.ajustes set sueldo_tope_mensual = true where household_id = %L', tests.id('household_a')),
  '42501', null, 'el cliente no prende el sueldo mensual: antes hay que resolver el cobro sin conexión (ADR 0011)'
);

select lives_ok(
  format('update public.ajustes set perdido_con_sueldo = true, perdido_con_diezmo = false where household_id = %L', tests.id('household_a')),
  'los parámetros del perdido sí los edita el cliente'
);


-- Sueldo mensual -----------------------------------------------------------------------------------

select tests.salir();
update public.ajustes set sueldo_tope_mensual = true where household_id = tests.id('household_a');
select tests.entrar_como(tests.id('a'));

-- P4: neta 40M, diezmo 4M, y los 36M van al sueldo.
select is(
  (
    select dist_sueldo_centavos
    from public.cobrar_proyecto(
      'aaaaaaaa-0000-7000-8000-000000000014', 1, '2026-11-02',
      40000000, 0, 50000000, 99000000, 4000000, 36000000, 0, 0
    )
  ),
  36000000::bigint,
  'con el sueldo mensual, el primer cobro del mes toma el sueldo que le alcanza'
);

-- P5: neta 100M, diezmo 10M, sueldo 14M (lo que falta de los 50M), fijos 76M.
select results_eq(
  $$
    select dist_tope_sueldo_centavos, dist_sueldo_centavos, dist_sueldo_previo_centavos,
           dist_sueldo_mensual, dist_fijos_centavos
    from public.cobrar_proyecto('aaaaaaaa-0000-7000-8000-000000000015', 1, '2026-11-20', 100000000, 0, 14000000, 99000000, 10000000, 14000000, 76000000, 0)
  $$,
  $$ values (14000000::bigint, 14000000::bigint, 36000000::bigint, true, 76000000::bigint) $$,
  'y el segundo toma solo lo que falta del sueldo del mes'
);


-- Los topes en SQL ---------------------------------------------------------------------------------

select tests.salir();

select results_eq(
  $$ select tope_sueldo_centavos, tope_fijos_centavos from private.topes_de_la_liquidacion(100, 30, true, 40, 50) $$,
  $$ values (60::bigint, 0::bigint) $$,
  'sueldo mensual: lo que falta; fijos: saturan en cero, nunca negativos'
);

select is(
  (select tope_sueldo_centavos from private.topes_de_la_liquidacion(100, 30, false, 400, 0)),
  100::bigint,
  'el sueldo por proyecto no mira lo liquidado en el mes'
);

select throws_ok(
  $$ select * from private.topes_de_la_liquidacion(-1, 0, false, 0, 0) $$,
  '22023', null, 'los topes rechazan importes negativos'
);

select throws_ok(
  $$ select * from private.topes_de_la_liquidacion(0, 0, null, 0, 0) $$,
  '22004', null, 'y parámetros nulos'
);

select throws_ok(
  $$ select * from private.topes_de_la_liquidacion(9007199254740992, 0, false, 0, 0) $$,
  '22003', null, 'y lo que Money no representa exacto'
);

select is(
  (select count(*)::int from public.proyectos where household_id = tests.id('household_a') and estado = 'cobrado'),
  5,
  'los cinco cobros quedaron congelados'
);

select * from finish();
