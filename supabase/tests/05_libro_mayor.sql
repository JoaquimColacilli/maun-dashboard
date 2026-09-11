-- El libro mayor: cada asiento en los tesoros que toca, con signo, y sin lo borrado.

select plan(10);

select tests.guardar('a', tests.crear_usuario('a@maun.test'));
select tests.guardar('household_a', private.crear_household('Taller A', tests.id('a')));

select tests.entrar_como(tests.id('a'));

insert into public.movimientos (id, fecha, tipo, tesoro_origen, tesoro_destino, monto_centavos) values
  ('aaaaaaaa-0000-7000-8000-000000000001', '2026-09-01', 'ingreso', null, 'hogar', 1000),
  ('aaaaaaaa-0000-7000-8000-000000000002', '2026-09-02', 'aporte_cocos', 'maun', 'cocos', 300),
  ('aaaaaaaa-0000-7000-8000-000000000003', '2026-09-03', 'pago_diezmo', 'diezmo', null, 50),
  ('aaaaaaaa-0000-7000-8000-000000000004', '2026-09-04', 'gasto', 'hogar', null, 999999);
update public.movimientos set deleted_at = now() where id = 'aaaaaaaa-0000-7000-8000-000000000004';

insert into public.clientes (id, nombre) values ('aaaaaaaa-0000-7000-8000-000000000010', 'Marcela');
insert into public.proyectos (id, cliente_id, titulo, estado) values
  ('aaaaaaaa-0000-7000-8000-000000000011', 'aaaaaaaa-0000-7000-8000-000000000010', 'Placard', 'entregado'),
  ('aaaaaaaa-0000-7000-8000-000000000012', 'aaaaaaaa-0000-7000-8000-000000000010', 'Proyecto borrado', 'en_curso');
insert into public.pagos (proyecto_id, fecha, monto_centavos) values
  ('aaaaaaaa-0000-7000-8000-000000000011', '2026-08-01', 10000),
  ('aaaaaaaa-0000-7000-8000-000000000012', '2026-08-01', 777777);
insert into public.gastos (proyecto_id, fecha, monto_centavos) values
  ('aaaaaaaa-0000-7000-8000-000000000011', '2026-08-02', 3000);
update public.proyectos set deleted_at = now() where id = 'aaaaaaaa-0000-7000-8000-000000000012';

-- El cobro lo congela el dueño de la base, como lo va a hacer la función de cobro:
-- neta 7.000, diezmo 700, sueldo 6.300 (no llega al tope), fijos y remanente en cero.
select tests.salir();
update public.proyectos set
  estado = 'cobrado', fecha_cobro = '2026-08-20',
  dist_cobrado_centavos = 10000, dist_gastos_centavos = 3000, dist_diezmo_bp = 1000,
  dist_tope_sueldo_centavos = 180000000, dist_tope_fijos_centavos = 25000000,
  dist_diezmo_centavos = 700, dist_sueldo_centavos = 6300, dist_fijos_centavos = 0, dist_remanente_centavos = 0,
  dist_objetivo_sueldo_centavos = 180000000, dist_objetivo_fijos_centavos = 25000000, dist_sueldo_mensual = false,
  dist_sueldo_previo_centavos = 0, dist_fijos_previo_centavos = 0, dist_liquidado_at = now()
where id = 'aaaaaaaa-0000-7000-8000-000000000011';
select tests.entrar_como(tests.id('a'));

select results_eq(
  $$ select tesoro::text, sum(monto_centavos)::bigint from public.libro_mayor group by tesoro order by tesoro::text $$,
  $$ values ('cocos', 300::bigint), ('diezmo', 650::bigint), ('hogar', 7300::bigint), ('maun', -300::bigint) $$,
  'el saldo de cada tesoro sale de una sola consulta sobre la vista'
);

select is(
  (select count(*)::int from public.libro_mayor where asiento_id = 'aaaaaaaa-0000-7000-8000-000000000001'),
  1,
  'un ingreso es una sola fila: el otro lado es afuera'
);

select results_eq(
  $$ select tesoro::text, contrapartida::text, monto_centavos from public.libro_mayor where asiento_id = 'aaaaaaaa-0000-7000-8000-000000000002' order by monto_centavos $$,
  $$ values ('maun', 'cocos', -300::bigint), ('cocos', 'maun', 300::bigint) $$,
  'una transferencia es dos filas espejadas, cada una con su contrapartida'
);

select is_empty(
  $$
    select origen, asiento_id, concepto
    from public.libro_mayor
    where contrapartida is not null
    group by origen, asiento_id, concepto
    having sum(monto_centavos) <> 0
  $$,
  'todo asiento entre dos tesoros suma cero: la plata no aparece ni desaparece'
);

select results_eq(
  $$
    select tesoro::text, contrapartida::text, monto_centavos, concepto
    from public.libro_mayor
    where origen = 'distribucion'
    order by concepto, monto_centavos
  $$,
  $$
    values
      ('maun', 'diezmo', -700::bigint, 'diezmo'),
      ('diezmo', 'maun', 700::bigint, 'diezmo'),
      ('maun', 'hogar', -6300::bigint, 'sueldo'),
      ('hogar', 'maun', 6300::bigint, 'sueldo')
  $$,
  'la distribución congelada pasa el diezmo de MAUN a DIEZMO y el sueldo de MAUN a HOGAR, y los fijos y el remanente no mueven plata'
);

select results_eq(
  $$ select fecha from public.libro_mayor where origen = 'distribucion' group by fecha $$,
  $$ values ('2026-08-20'::date) $$,
  'los asientos de la distribución llevan la fecha del cobro'
);

select is(
  (select sum(monto_centavos)::bigint from public.libro_mayor where origen in ('pago', 'gasto_proyecto')),
  7000::bigint,
  'los pagos entran a MAUN y los gastos del proyecto salen de MAUN'
);

select is_empty(
  $$ select 1 from public.libro_mayor where asiento_id = 'aaaaaaaa-0000-7000-8000-000000000004' $$,
  'un movimiento borrado no está en el libro'
);

select is_empty(
  $$ select 1 from public.libro_mayor where proyecto_id = 'aaaaaaaa-0000-7000-8000-000000000012' $$,
  'los pagos de un proyecto borrado no están en el libro'
);

select is(
  (select count(distinct origen)::int from public.libro_mayor),
  4,
  'el campo origen distingue lo manual de lo derivado de proyectos: manual, pago, gasto_proyecto y distribucion'
);

select * from finish();
