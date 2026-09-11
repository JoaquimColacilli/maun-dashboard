-- Cobrar y reabrir: lo que se congela, cuándo se rechaza, el reenvío de la cola y quién puede.
-- Proyecto 010: pagos 60M + 40M, gasto 30M, topes 180M y 25M. Neta 70M: diezmo 7M, sueldo 63M.
-- Los topes mensuales se prueban en 10_topes_mensuales.sql y el perdido en 11_perdido.sql.

select plan(41);

select tests.guardar('a', tests.crear_usuario('a@maun.test'));
select tests.guardar('b', tests.crear_usuario('b@maun.test'));
select tests.guardar('household_a', private.crear_household('Taller A', tests.id('a')));
select tests.guardar('household_b', private.crear_household('Taller B', tests.id('b')));

update public.ajustes
set sueldo_mensual_centavos = 180000000, costos_fijos_centavos = 25000000
where household_id in (tests.id('household_a'), tests.id('household_b'));

select tests.entrar_como(tests.id('a'));

insert into public.clientes (id, nombre) values ('aaaaaaaa-0000-7000-8000-000000000001', 'Marcela');
insert into public.proyectos (id, cliente_id, titulo, estado) values
  ('aaaaaaaa-0000-7000-8000-000000000010', 'aaaaaaaa-0000-7000-8000-000000000001', 'Placard', 'entregado'),
  ('aaaaaaaa-0000-7000-8000-000000000020', 'aaaaaaaa-0000-7000-8000-000000000001', 'En obra', 'en_curso'),
  ('aaaaaaaa-0000-7000-8000-000000000030', 'aaaaaaaa-0000-7000-8000-000000000001', 'A pérdida', 'entregado'),
  ('aaaaaaaa-0000-7000-8000-000000000040', 'aaaaaaaa-0000-7000-8000-000000000001', 'Borrado', 'entregado');
insert into public.pagos (proyecto_id, fecha, monto_centavos) values
  ('aaaaaaaa-0000-7000-8000-000000000010', '2026-08-01', 60000000),
  ('aaaaaaaa-0000-7000-8000-000000000010', '2026-08-20', 40000000),
  ('aaaaaaaa-0000-7000-8000-000000000030', '2026-08-01', 10000000);
insert into public.gastos (proyecto_id, fecha, monto_centavos) values
  ('aaaaaaaa-0000-7000-8000-000000000010', '2026-08-02', 30000000),
  ('aaaaaaaa-0000-7000-8000-000000000030', '2026-08-02', 15000000);
update public.proyectos set deleted_at = now() where id = 'aaaaaaaa-0000-7000-8000-000000000040';

select tests.entrar_como(tests.id('b'));
insert into public.clientes (id, nombre) values ('bbbbbbbb-0000-7000-8000-000000000001', 'Cliente de B');
insert into public.proyectos (id, cliente_id, titulo, estado)
  values ('bbbbbbbb-0000-7000-8000-000000000010', 'bbbbbbbb-0000-7000-8000-000000000001', 'De B', 'entregado');

select tests.entrar_como(tests.id('a'));

select set_config(
  'tests.v010',
  (select version::text from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000010'),
  true
);


-- Rechazos antes de cobrar --------------------------------------------------------------------------

select throws_ok(
  $$ select public.cobrar_proyecto('aaaaaaaa-0000-7000-8000-000000000010', 99, '2026-09-10', 100000000, 30000000, 180000000, 25000000, 7000000, 63000000, 0, 0) $$,
  'MN006', null, 'con una versión vieja del proyecto, el cobro se rechaza'
);

select throws_ok(
  format($$ select public.cobrar_proyecto('aaaaaaaa-0000-7000-8000-000000000010', %s, '2026-09-10', 60000000, 30000000, 180000000, 25000000, 3000000, 27000000, 0, 0) $$, current_setting('tests.v010')),
  'MN006', null, 'si la app no vio todos los pagos, el cobro se rechaza'
);

select throws_ok(
  format($$ select public.cobrar_proyecto('aaaaaaaa-0000-7000-8000-000000000010', %s, '2026-09-10', 100000000, 20000000, 180000000, 25000000, 8000000, 72000000, 0, 0) $$, current_setting('tests.v010')),
  'MN006', null, 'si la app no vio todos los gastos, el cobro se rechaza'
);

select throws_ok(
  format($$ select public.cobrar_proyecto('aaaaaaaa-0000-7000-8000-000000000010', %s, '2026-09-10', 100000000, 30000000, 150000000, 25000000, 7000000, 63000000, 0, 0) $$, current_setting('tests.v010')),
  'MN006', null, 'si el tope de sueldo cambió desde que la app calculó, el cobro se rechaza'
);

select throws_ok(
  format($$ select public.cobrar_proyecto('aaaaaaaa-0000-7000-8000-000000000010', %s, '2026-09-10', 100000000, 30000000, 180000000, 20000000, 7000000, 63000000, 0, 0) $$, current_setting('tests.v010')),
  'MN006', null, 'si el tope de fijos cambió desde que la app calculó, el cobro se rechaza'
);

select throws_ok(
  format($$ select public.cobrar_proyecto('aaaaaaaa-0000-7000-8000-000000000010', %s, '2026-09-10', 100000000, 30000000, 180000000, 25000000, 7000001, 62999999, 0, 0) $$, current_setting('tests.v010')),
  'MN008', null, 'si la distribución que vio el usuario no es la de la base, por un centavo, el cobro se rechaza'
);

select throws_ok(
  $$ select public.cobrar_proyecto('aaaaaaaa-0000-7000-8000-000000000020', 1, '2026-09-10', 0, 0, 180000000, 25000000, 0, 0, 0, 0) $$,
  'MN007', null, 'solo se cobra un proyecto entregado'
);

select throws_ok(
  $$ select public.cobrar_proyecto('aaaaaaaa-0000-7000-8000-000000000040', 2, '2026-09-10', 0, 0, 180000000, 25000000, 0, 0, 0, 0) $$,
  'MN002', null, 'un proyecto borrado no se cobra'
);

select throws_ok(
  $$ select public.cobrar_proyecto('bbbbbbbb-0000-7000-8000-000000000010', 1, '2026-09-10', 0, 0, 180000000, 25000000, 0, 0, 0, 0) $$,
  '42501', null, 'A no cobra un proyecto de B: para A no existe'
);

select throws_ok(
  $$ select public.cobrar_proyecto('aaaaaaaa-0000-7000-8000-000000000010', 1, null, 0, 0, 0, 0, 0, 0, 0, 0) $$,
  '22004', null, 'el cobro necesita todos sus parámetros'
);


-- Cobrar ------------------------------------------------------------------------------------------

select is(
  (
    select estado::text
    from public.cobrar_proyecto(
      'aaaaaaaa-0000-7000-8000-000000000010', current_setting('tests.v010')::int, '2026-09-10',
      100000000, 30000000, 180000000, 25000000, 7000000, 63000000, 0, 0
    )
  ),
  'cobrado',
  'con lo que vio el usuario, el proyecto queda cobrado'
);

select results_eq(
  $$
    select fecha_cobro, dist_cobrado_centavos, dist_gastos_centavos, dist_diezmo_bp,
           dist_tope_sueldo_centavos, dist_tope_fijos_centavos,
           dist_diezmo_centavos, dist_sueldo_centavos, dist_fijos_centavos, dist_remanente_centavos
    from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000010'
  $$,
  $$
    values ('2026-09-10'::date, 100000000::bigint, 30000000::bigint, 1000,
            180000000::bigint, 25000000::bigint,
            7000000::bigint, 63000000::bigint, 0::bigint, 0::bigint)
  $$,
  'congela la cascada sobre lo cobrado y los topes del momento'
);

select results_eq(
  $$
    select dist_objetivo_sueldo_centavos, dist_objetivo_fijos_centavos, dist_sueldo_mensual,
           dist_sueldo_previo_centavos, dist_fijos_previo_centavos, dist_liquidado_at is not null
    from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000010'
  $$,
  $$ values (180000000::bigint, 25000000::bigint, false, 0::bigint, 0::bigint, true) $$,
  'y congela los objetivos, el modo del sueldo, lo que el mes ya llevaba liquidado y el instante'
);

select is(
  (select version from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000010'),
  current_setting('tests.v010')::int + 1,
  'el cobro sube la versión del proyecto en uno'
);

select results_eq(
  $$
    select tesoro::text, sum(monto_centavos)::bigint from public.libro_mayor
    where proyecto_id = 'aaaaaaaa-0000-7000-8000-000000000010' and origen = 'distribucion'
    group by tesoro order by tesoro::text
  $$,
  $$ values ('diezmo', 7000000::bigint), ('hogar', 63000000::bigint), ('maun', -70000000::bigint) $$,
  'el libro mayor refleja la distribución congelada'
);

select is(
  (
    select version
    from public.cobrar_proyecto(
      'aaaaaaaa-0000-7000-8000-000000000010', current_setting('tests.v010')::int, '2026-09-10',
      100000000, 30000000, 180000000, 25000000, 7000000, 63000000, 0, 0
    )
  ),
  current_setting('tests.v010')::int + 1,
  'el reenvío idéntico de la cola devuelve el proyecto cobrado sin rechazar ni tocar nada'
);

select throws_ok(
  format($$ select public.cobrar_proyecto('aaaaaaaa-0000-7000-8000-000000000010', %s, '2026-09-10', 100000000, 30000000, 180000000, 25000000, 7000000, 63000000, 0, 0) $$,
         (select version from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000010')),
  'MN001', null, 'no se cobra dos veces'
);

select throws_ok(
  $$ update public.proyectos set estado = 'entregado' where id = 'aaaaaaaa-0000-7000-8000-000000000010' $$,
  'MN001', null, 'un cobrado no vuelve a entregado editando el estado'
);

select is(
  (
    select dist_remanente_centavos
    from public.cobrar_proyecto(
      'aaaaaaaa-0000-7000-8000-000000000030',
      (select version from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000030'),
      '2026-09-10', 10000000, 15000000, 180000000, 25000000, 0, 0, 0, -5000000
    )
  ),
  -5000000::bigint,
  'un proyecto a pérdida se cobra igual: la pérdida queda en el remanente'
);


-- Reabrir -----------------------------------------------------------------------------------------

select set_config(
  'tests.v010_cobrado',
  (select version::text from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000010'),
  true
);

select throws_ok(
  $$ select public.reabrir_proyecto('aaaaaaaa-0000-7000-8000-000000000010', 1) $$,
  'MN006', null, 'con una versión vieja, la reapertura se rechaza'
);

select throws_ok(
  format($$ select public.reabrir_proyecto('aaaaaaaa-0000-7000-8000-000000000020', %s) $$,
         (select version from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000020')),
  'MN007', null, 'solo se reabre un proyecto cobrado'
);

select is(
  (
    select estado::text
    from public.reabrir_proyecto('aaaaaaaa-0000-7000-8000-000000000010', current_setting('tests.v010_cobrado')::int)
  ),
  'entregado',
  'reabrir vuelve el proyecto a entregado'
);

select ok(
  (
    select fecha_cobro is null and num_nonnulls(
      dist_cobrado_centavos, dist_gastos_centavos, dist_diezmo_bp, dist_tope_sueldo_centavos,
      dist_tope_fijos_centavos, dist_diezmo_centavos, dist_sueldo_centavos, dist_fijos_centavos,
      dist_remanente_centavos, dist_objetivo_sueldo_centavos, dist_objetivo_fijos_centavos,
      dist_sueldo_mensual, dist_sueldo_previo_centavos, dist_fijos_previo_centavos, dist_liquidado_at
    ) = 0
    from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000010'
  ),
  'y descongela la distribución'
);

select results_eq(
  $$
    select reapertura_objetivo_sueldo_centavos, reapertura_objetivo_fijos_centavos,
           reapertura_sueldo_mensual, reapertura_fecha_cobro
    from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000010'
  $$,
  $$ values (180000000::bigint, 25000000::bigint, false, '2026-09-10'::date) $$,
  'pero guarda la fecha, los objetivos y el modo del sueldo del cobro original'
);

select is(
  (
    select version
    from public.reabrir_proyecto('aaaaaaaa-0000-7000-8000-000000000010', current_setting('tests.v010_cobrado')::int)
  ),
  current_setting('tests.v010_cobrado')::int + 1,
  'el reenvío idéntico de la reapertura devuelve el proyecto sin rechazar ni tocar nada'
);

select is_empty(
  $$ select 1 from public.libro_mayor where proyecto_id = 'aaaaaaaa-0000-7000-8000-000000000010' and origen = 'distribucion' $$,
  'la distribución sale del libro mayor'
);

select lives_ok(
  $$ insert into public.pagos (proyecto_id, fecha, monto_centavos) values ('aaaaaaaa-0000-7000-8000-000000000010', '2026-09-11', 5000000) $$,
  'reabierto, el proyecto vuelve a aceptar pagos'
);

-- Mientras estuvo reabierto, el sueldo subió.
select tests.salir();
update public.ajustes set sueldo_mensual_centavos = 250000000 where household_id = tests.id('household_a');
select tests.entrar_como(tests.id('a'));

select throws_ok(
  format($$ select public.cobrar_proyecto('aaaaaaaa-0000-7000-8000-000000000010', %s, '2026-09-10', 105000000, 30000000, 250000000, 25000000, 7500000, 67500000, 0, 0) $$,
         (select version from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000010')),
  'MN006', null, 'volver a cobrar con los ajustes de hoy se rechaza: la historia no se reescribe'
);

select throws_ok(
  format($$ select public.cobrar_proyecto('aaaaaaaa-0000-7000-8000-000000000010', %s, '2026-09-11', 105000000, 30000000, 180000000, 25000000, 7500000, 67500000, 0, 0) $$,
         (select version from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000010')),
  'MN006', null, 'y con otra fecha también: corregir no mueve la distribución en el libro mayor'
);

select results_eq(
  format(
    $$
      select dist_diezmo_centavos, dist_sueldo_centavos, dist_tope_sueldo_centavos, fecha_cobro,
             reapertura_fecha_cobro is null
      from public.cobrar_proyecto('aaaaaaaa-0000-7000-8000-000000000010', %s, '2026-09-10', 105000000, 30000000, 180000000, 25000000, 7500000, 67500000, 0, 0)
    $$,
    (select version from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000010')
  ),
  $$ values (7500000::bigint, 67500000::bigint, 180000000::bigint, '2026-09-10'::date, true) $$,
  'con los objetivos y la fecha originales, se vuelve a cobrar con el pago nuevo y se limpia lo guardado'
);


-- La cascada de SQL --------------------------------------------------------------------------------

select tests.salir();

select is((select diezmo_centavos from private.cascada(5, 0, 1000, 0, 0)), 1::bigint,
  'el diezmo de 5 centavos es 1: mitad hacia arriba, no al par ni truncado');
select is((select diezmo_centavos from private.cascada(25, 0, 1000, 0, 0)), 3::bigint,
  'el de 25 es 3: al par daría 2');
select is((select diezmo_centavos from private.cascada(1000005, 0, 1000, 0, 0)), 100001::bigint,
  'el de 1.000.005 es 100.001: truncado o al par daría 100.000');

select lives_ok(
  $$ select * from private.cascada(9007199254735, 0, 1000, 0, 0) $$,
  'acepta el importe más grande que TypeScript puede calcular exacto'
);

select throws_ok(
  $$ select * from private.cascada(9007199254736, 0, 1000, 0, 0) $$,
  '22003', null, 'y rechaza el siguiente, igual que TypeScript'
);

select throws_ok(
  $$ select * from private.cascada(-1, 0, 1000, 0, 0) $$,
  '22023', null, 'rechaza importes negativos'
);

select throws_ok(
  $$ select * from private.cascada(1, 0, 10001, 0, 0) $$,
  '22023', null, 'y un diezmo de más de 100%'
);


-- Quién puede --------------------------------------------------------------------------------------

select tests.entrar_como_anon();

select throws_ok(
  $$ select public.cobrar_proyecto('aaaaaaaa-0000-7000-8000-000000000010', 1, '2026-09-10', 0, 0, 0, 0, 0, 0, 0, 0) $$,
  '42501', null, 'anon no cobra'
);

select throws_ok(
  $$ select public.reabrir_proyecto('aaaaaaaa-0000-7000-8000-000000000010', 1) $$,
  '42501', null, 'anon no reabre'
);

select throws_ok(
  $$ select public.cerrar_perdido('aaaaaaaa-0000-7000-8000-000000000010', 1, '2026-09-10', 0, 0, 0, 0, 0, 0, 0, 0, 1000) $$,
  '42501', null, 'anon no cierra un perdido'
);

select throws_ok(
  $$ select public.reactivar_perdido('aaaaaaaa-0000-7000-8000-000000000010', 1, 'contacto') $$,
  '42501', null, 'anon no reactiva un perdido'
);

select * from finish();
