-- El sueldo se topea por mes (ADR 0072): un taller nuevo nace así, cada cobro paga a lo sumo lo que le
-- falta al sueldo de su mes y lo que sobra queda en el remanente del taller.
-- Ajustes: sueldo 180M, fijos 0, como el taller de MAUN. Los números de P1 a P3 son los de sus tres
-- cobros de septiembre de 2026; por proyecto, el tercero se había llevado 139.126.458 al hogar.

select plan(8);

select col_default_is(
  'public', 'ajustes', 'sueldo_tope_mensual', 'true',
  'el sueldo por mes es el default: lo toma todo taller nuevo'
);

select tests.guardar('a', tests.crear_usuario('a@maun.test'));
select tests.guardar('household_a', private.crear_household('Taller A', tests.id('a')));

select is(
  (select sueldo_tope_mensual from public.ajustes where household_id = tests.id('household_a')),
  true,
  'crear_household deja el taller con el sueldo por mes'
);

update public.ajustes
set sueldo_mensual_centavos = 180000000, costos_fijos_centavos = 0
where household_id = tests.id('household_a');

select tests.entrar_como(tests.id('a'));

insert into public.clientes (id, nombre) values ('aaaaaaaa-0000-7000-8000-000000000001', 'Marcela');
insert into public.proyectos (id, cliente_id, titulo, estado) values
  ('aaaaaaaa-0000-7000-8000-000000000011', 'aaaaaaaa-0000-7000-8000-000000000001', 'P1', 'entregado'),
  ('aaaaaaaa-0000-7000-8000-000000000012', 'aaaaaaaa-0000-7000-8000-000000000001', 'P2', 'entregado'),
  ('aaaaaaaa-0000-7000-8000-000000000013', 'aaaaaaaa-0000-7000-8000-000000000001', 'P3', 'entregado'),
  ('aaaaaaaa-0000-7000-8000-000000000014', 'aaaaaaaa-0000-7000-8000-000000000001', 'P4', 'entregado');
insert into public.pagos (proyecto_id, fecha, monto_centavos) values
  ('aaaaaaaa-0000-7000-8000-000000000011', '2026-09-01', 15800000),
  ('aaaaaaaa-0000-7000-8000-000000000012', '2026-09-01', 105733800),
  ('aaaaaaaa-0000-7000-8000-000000000013', '2026-09-01', 154584953),
  ('aaaaaaaa-0000-7000-8000-000000000014', '2026-09-01', 50000000);


-- Los cobros van cubriendo el sueldo del mes ---------------------------------------------------------

-- P1: neta 15,8M, diezmo 1,58M; el tope es el sueldo entero porque el mes está vacío.
select is(
  (
    select dist_sueldo_centavos
    from public.cobrar_proyecto(
      'aaaaaaaa-0000-7000-8000-000000000011', 1, '2026-09-08',
      15800000, 0, 180000000, 0, 1580000, 14220000, 0, 0,
      0, 0
    )
  ),
  14220000::bigint,
  'el primer cobro del mes tiene el sueldo entero de tope y paga lo que le alcanza'
);

-- P2: el mes ya lleva 14,22M, así que el tope es 165,78M.
select is(
  (
    select dist_tope_sueldo_centavos
    from public.cobrar_proyecto(
      'aaaaaaaa-0000-7000-8000-000000000012', 1, '2026-09-09',
      105733800, 0, 165780000, 0, 10573380, 95160420, 0, 0,
      14220000, 0
    )
  ),
  165780000::bigint,
  'el segundo cobro topea el sueldo por lo que le falta al mes'
);

-- Una app que todavía reparte por proyecto manda el sueldo entero de tope con el mismo acumulado que la
-- base: son los ajustes los que cambiaron, y eso es un MN006.
select throws_ok(
  $$ select public.cobrar_proyecto('aaaaaaaa-0000-7000-8000-000000000013', 1, '2026-09-20', 154584953, 0, 180000000, 0, 15458495, 139126458, 0, 0, 109380420, 0) $$,
  'MN006', null, 'la cuenta por proyecto rebota: el tope del sueldo ya no es el sueldo entero'
);

-- P3: el mes lleva 109.380.420, el tope es 70.619.580 y lo que sobra del diezmo queda en el taller.
select results_eq(
  $$
    select dist_tope_sueldo_centavos, dist_sueldo_centavos, dist_remanente_centavos, dist_sueldo_mensual
    from public.cobrar_proyecto(
      'aaaaaaaa-0000-7000-8000-000000000013', 1, '2026-09-20',
      154584953, 0, 70619580, 0, 15458495, 70619580, 0, 68506878,
      109380420, 0
    )
  $$,
  $$ values (70619580::bigint, 70619580::bigint, 68506878::bigint, true) $$,
  'el tercer cobro completa el sueldo del mes y deja 68.506.878 en el remanente del taller'
);


-- Con el mes cubierto, un cobro que no lo vio se ajusta ----------------------------------------------

-- P4 se cobra desde un dispositivo que no vio P3: su cuenta cierra con lo que vio (tope 70.619.580,
-- sueldo 45M), pero el mes real ya tiene el sueldo cubierto. La base congela sueldo 0.
select results_eq(
  $$
    select dist_tope_sueldo_centavos, dist_sueldo_centavos, dist_remanente_centavos, dist_sueldo_previo_centavos
    from public.cobrar_proyecto(
      'aaaaaaaa-0000-7000-8000-000000000014', 1, '2026-09-22',
      50000000, 0, 70619580, 0, 5000000, 45000000, 0, 0,
      109380420, 0
    )
  $$,
  $$ values (0::bigint, 0::bigint, 45000000::bigint, 180000000::bigint) $$,
  'con el sueldo del mes cubierto, el cobro no le paga nada al hogar aunque la app no lo supiera'
);

select is(
  (
    select sum(dist_sueldo_centavos)
    from public.proyectos
    where household_id = tests.id('household_a') and fecha_cobro between '2026-09-01' and '2026-09-30'
  ),
  180000000::numeric,
  'septiembre le paga al hogar un sueldo, no uno por cobro'
);

select * from finish();
