-- Cerrar como perdido: la seña retenida se liquida con la misma cascada que un cobro (ADR 0011).
-- Ajustes: sueldo 180M, fijos 25M; por defecto un perdido paga diezmo y no sueldo.
-- L1: lead con la visita cobrada (4M) y la nafta (0,8M). L2: obra con seña 100M y gastos 30M.
-- L3: contacto sin nada. E: entregado con un pago de 10M.

select plan(27);

select tests.guardar('a', tests.crear_usuario('a@maun.test'));
select tests.guardar('household_a', private.crear_household('Taller A', tests.id('a')));

update public.ajustes
set sueldo_mensual_centavos = 180000000, costos_fijos_centavos = 25000000, sueldo_tope_mensual = false
where household_id = tests.id('household_a');

select tests.entrar_como(tests.id('a'));

insert into public.clientes (id, nombre) values ('aaaaaaaa-0000-7000-8000-000000000001', 'Hernán');
insert into public.proyectos (id, cliente_id, titulo, estado) values
  ('aaaaaaaa-0000-7000-8000-000000000021', 'aaaaaaaa-0000-7000-8000-000000000001', 'Alacena del lavadero', 'relevamiento'),
  ('aaaaaaaa-0000-7000-8000-000000000022', 'aaaaaaaa-0000-7000-8000-000000000001', 'Deck', 'en_curso'),
  ('aaaaaaaa-0000-7000-8000-000000000023', 'aaaaaaaa-0000-7000-8000-000000000001', 'Cama marinera', 'contacto'),
  ('aaaaaaaa-0000-7000-8000-000000000024', 'aaaaaaaa-0000-7000-8000-000000000001', 'Vanitory', 'entregado');
insert into public.pagos (proyecto_id, fecha, concepto, monto_centavos) values
  ('aaaaaaaa-0000-7000-8000-000000000021', '2026-09-05', 'Visita de relevamiento', 4000000),
  ('aaaaaaaa-0000-7000-8000-000000000022', '2026-08-20', 'Seña', 100000000),
  ('aaaaaaaa-0000-7000-8000-000000000024', '2026-09-01', 'Saldo', 10000000);
insert into public.gastos (proyecto_id, fecha, descripcion, monto_centavos) values
  ('aaaaaaaa-0000-7000-8000-000000000021', '2026-09-05', 'Nafta de la visita', 800000),
  ('aaaaaaaa-0000-7000-8000-000000000022', '2026-08-25', 'Tablas de lapacho', 30000000);

select set_config(
  'tests.v_l1',
  (select version::text from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000021'),
  true
);


-- Rechazos antes de cerrar -------------------------------------------------------------------------

select throws_ok(
  $$ update public.proyectos set estado = 'perdido' where id = 'aaaaaaaa-0000-7000-8000-000000000023' $$,
  'MN007', null, 'a perdido no se llega editando el estado: se cierra con cerrar_perdido'
);

select throws_ok(
  $$ select public.cerrar_perdido('aaaaaaaa-0000-7000-8000-000000000024', 1, '2026-09-10', 10000000, 0, 0, 25000000, 1000000, 0, 9000000, 0, 1000) $$,
  'MN007', null, 'lo entregado no se da por perdido: se cobra'
);

select throws_ok(
  $$ select public.cerrar_perdido('aaaaaaaa-0000-7000-8000-000000000021', 99, '2026-09-10', 4000000, 800000, 0, 25000000, 320000, 0, 2880000, 0, 1000) $$,
  'MN006', null, 'con una versión vieja, el cierre se rechaza'
);

select throws_ok(
  format($$ select public.cerrar_perdido('aaaaaaaa-0000-7000-8000-000000000021', %s, '2026-09-10', 4000000, 800000, 180000000, 25000000, 320000, 2880000, 0, 0, 1000) $$, current_setting('tests.v_l1')),
  'MN006', null, 'si la app le puso sueldo al perdido, el tope no coincide y se rechaza'
);


-- Cerrar con la seña retenida --------------------------------------------------------------------

-- Neta 3,2M: diezmo 320.000; sueldo 0 porque el objetivo del perdido es cero; 2,88M a fijos.
select is(
  (
    select estado::text
    from public.cerrar_perdido(
      'aaaaaaaa-0000-7000-8000-000000000021', current_setting('tests.v_l1')::int, '2026-09-10',
      4000000, 800000, 0, 25000000, 320000, 0, 2880000, 0, 1000
    )
  ),
  'perdido',
  'la seña retenida se liquida al cerrar el lead como perdido'
);

select results_eq(
  $$
    select dist_diezmo_bp, dist_objetivo_sueldo_centavos, dist_tope_sueldo_centavos,
           dist_diezmo_centavos, dist_sueldo_centavos, dist_fijos_centavos, dist_remanente_centavos
    from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000021'
  $$,
  $$ values (1000, 0::bigint, 0::bigint, 320000::bigint, 0::bigint, 2880000::bigint, 0::bigint) $$,
  'por defecto paga diezmo y no sueldo: lo que no es diezmo queda en el taller'
);

select results_eq(
  $$
    select tesoro::text, sum(monto_centavos)::bigint from public.libro_mayor
    where proyecto_id = 'aaaaaaaa-0000-7000-8000-000000000021' and origen = 'distribucion'
    group by tesoro order by tesoro::text
  $$,
  $$ values ('diezmo', 320000::bigint), ('maun', -320000::bigint) $$,
  'el libro mayor refleja el diezmo de la seña retenida, sin sueldo'
);

select is(
  (
    select version
    from public.cerrar_perdido(
      'aaaaaaaa-0000-7000-8000-000000000021', current_setting('tests.v_l1')::int, '2026-09-10',
      4000000, 800000, 0, 25000000, 320000, 0, 2880000, 0, 1000
    )
  ),
  current_setting('tests.v_l1')::int + 1,
  'el reenvío idéntico del cierre devuelve el perdido sin rechazar ni tocar nada'
);


-- Lo cerrado no se toca ---------------------------------------------------------------------------

select throws_ok(
  $$ insert into public.gastos (proyecto_id, fecha, descripcion, monto_centavos) values ('aaaaaaaa-0000-7000-8000-000000000021', '2026-09-11', 'Nafta que faltaba', 500000) $$,
  'MN001', null, 'la nafta cargada tarde no entra en un perdido cerrado'
);

select is(
  tests.hint_de($$ insert into public.gastos (proyecto_id, fecha, descripcion, monto_centavos) values ('aaaaaaaa-0000-7000-8000-000000000021', '2026-09-11', 'Nafta que faltaba', 500000) $$),
  'Para cargarlo hay que reactivar el perdido y volver a cerrarlo.',
  'y el rechazo dice cómo seguir: reactivar y volver a cerrar'
);

select throws_ok(
  $$ update public.proyectos set estado = 'relevamiento' where id = 'aaaaaaaa-0000-7000-8000-000000000021' $$,
  'MN001', null, 'un perdido no vuelve al seguimiento editando el estado'
);


-- Reactivar ---------------------------------------------------------------------------------------

select throws_ok(
  format($$ select public.reabrir_proyecto('aaaaaaaa-0000-7000-8000-000000000021', %s) $$, current_setting('tests.v_l1')::int + 1),
  'MN007', null, 'un perdido no se reabre: se reactiva'
);

select throws_ok(
  format($$ select public.reactivar_perdido('aaaaaaaa-0000-7000-8000-000000000021', %s, 'en_curso') $$, current_setting('tests.v_l1')::int + 1),
  'MN007', null, 'un perdido se reactiva a un estado de seguimiento, no a la obra'
);

select results_eq(
  format(
    $$
      select estado::text, fecha_cobro is null, reapertura_fecha_cobro is null, dist_liquidado_at is null
      from public.reactivar_perdido('aaaaaaaa-0000-7000-8000-000000000021', %s, 'relevamiento')
    $$,
    current_setting('tests.v_l1')::int + 1
  ),
  $$ values ('relevamiento', true, true, true) $$,
  'reactivar lo vuelve al seguimiento sin guardar nada: la seña vuelve a ser un anticipo'
);

select is(
  (
    select version
    from public.reactivar_perdido(
      'aaaaaaaa-0000-7000-8000-000000000021', current_setting('tests.v_l1')::int + 1, 'relevamiento'
    )
  ),
  current_setting('tests.v_l1')::int + 2,
  'el reenvío idéntico de la reactivación devuelve el proyecto sin rechazar'
);

select is_empty(
  $$ select 1 from public.libro_mayor where proyecto_id = 'aaaaaaaa-0000-7000-8000-000000000021' and origen = 'distribucion' $$,
  'la distribución del perdido sale del libro mayor'
);

select lives_ok(
  $$ insert into public.gastos (proyecto_id, fecha, descripcion, monto_centavos) values ('aaaaaaaa-0000-7000-8000-000000000021', '2026-09-11', 'Nafta que faltaba', 500000) $$,
  'reactivado, el lead acepta la nafta que faltaba'
);

-- Neta 2,7M: diezmo 270.000 y 2,43M a fijos.
select results_eq(
  format(
    $$
      select fecha_cobro, dist_gastos_centavos, dist_diezmo_centavos, dist_fijos_centavos
      from public.cerrar_perdido('aaaaaaaa-0000-7000-8000-000000000021', %s, '2026-09-15', 4000000, 1300000, 0, 25000000, 270000, 0, 2430000, 0, 1000)
    $$,
    (select version from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000021')
  ),
  $$ values ('2026-09-15'::date, 1300000::bigint, 270000::bigint, 2430000::bigint) $$,
  'volver a cerrarlo es un evento nuevo: con su fecha y con la nafta adentro'
);


-- Los parámetros del perdido ---------------------------------------------------------------------

select lives_ok(
  format('update public.ajustes set perdido_con_sueldo = true, perdido_con_diezmo = false where household_id = %L', tests.id('household_a')),
  'el dueño decide si la seña retenida paga sueldo y diezmo'
);

-- Neta 70M: sin diezmo, y el sueldo se lleva todo.
select results_eq(
  $$
    select dist_diezmo_bp, dist_objetivo_sueldo_centavos, dist_diezmo_centavos, dist_sueldo_centavos
    from public.cerrar_perdido('aaaaaaaa-0000-7000-8000-000000000022', 1, '2026-10-05', 100000000, 30000000, 180000000, 25000000, 0, 70000000, 0, 0, 0)
  $$,
  $$ values (0, 180000000::bigint, 0::bigint, 70000000::bigint) $$,
  'con los parámetros cambiados, el mismo cierre paga sueldo y no diezmo: cambia el objetivo, no la cascada'
);


-- Un lead sin seña -------------------------------------------------------------------------------

select throws_ok(
  $$ select public.cerrar_perdido('aaaaaaaa-0000-7000-8000-000000000023', 1, '2026-10-06', 0, 0, 180000000, 25000000, 0, 0, 0, 0, 1000) $$,
  'MN006', null, 'si el diezmo del perdido cambió en los ajustes desde que la app calculó, es MN006: un dato cambiado, no una app vieja'
);

select results_eq(
  $$
    select estado::text, dist_diezmo_centavos, dist_sueldo_centavos, dist_fijos_centavos, dist_remanente_centavos
    from public.cerrar_perdido('aaaaaaaa-0000-7000-8000-000000000023', 1, '2026-10-06', 0, 0, 180000000, 25000000, 0, 0, 0, 0, 0)
  $$,
  $$ values ('perdido', 0::bigint, 0::bigint, 0::bigint, 0::bigint) $$,
  'un lead sin seña se cierra igual: todo en cero'
);

select is_empty(
  $$ select 1 from public.libro_mayor where proyecto_id = 'aaaaaaaa-0000-7000-8000-000000000023' $$,
  'y no deja nada en el libro mayor'
);

select lives_ok(
  $$ update public.proyectos set deleted_at = now() where id = 'aaaaaaaa-0000-7000-8000-000000000023' $$,
  'un perdido sin pagos ni gastos se borra'
);

select throws_ok(
  $$ update public.proyectos set deleted_at = now() where id = 'aaaaaaaa-0000-7000-8000-000000000021' $$,
  'MN001', null, 'un perdido con seña no se borra: sacaría plata del libro mayor'
);


-- Un cobrado no es un perdido --------------------------------------------------------------------

select lives_ok(
  $$ select public.cobrar_proyecto('aaaaaaaa-0000-7000-8000-000000000024', 1, '2026-11-02', 10000000, 0, 180000000, 25000000, 1000000, 9000000, 0, 0) $$,
  'el entregado se cobra'
);

select throws_ok(
  $$ select public.reactivar_perdido('aaaaaaaa-0000-7000-8000-000000000024', 2, 'contacto') $$,
  'MN007', null, 'y un cobrado no se reactiva como si fuera un perdido'
);

select * from finish();
