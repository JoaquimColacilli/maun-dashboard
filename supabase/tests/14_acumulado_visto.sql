-- El acumulado del mes que vio la app: si coincide con el de la base todo sigue estricto, y si no,
-- la base recalcula los topes con el suyo y congela eso en vez de rechazar con MN006 (ADR 0011).
-- El MN008 no se afloja: se sigue exigiendo que la app haya calculado bien con lo que ella vio.
-- Ajustes: sueldo 50M por proyecto, fijos 25M mensuales. Todo en septiembre de 2026.

select plan(12);

select tests.guardar('a', tests.crear_usuario('a@maun.test'));
select tests.guardar('household_a', private.crear_household('Taller A', tests.id('a')));

update public.ajustes
set sueldo_mensual_centavos = 50000000, costos_fijos_centavos = 25000000
where household_id = tests.id('household_a');

select tests.entrar_como(tests.id('a'));

insert into public.clientes (id, nombre) values ('aaaaaaaa-0000-7000-8000-000000000001', 'Marcela');
insert into public.proyectos (id, cliente_id, titulo, estado) values
  ('aaaaaaaa-0000-7000-8000-000000000011', 'aaaaaaaa-0000-7000-8000-000000000001', 'P1', 'entregado'),
  ('aaaaaaaa-0000-7000-8000-000000000012', 'aaaaaaaa-0000-7000-8000-000000000001', 'P2', 'entregado'),
  ('aaaaaaaa-0000-7000-8000-000000000013', 'aaaaaaaa-0000-7000-8000-000000000001', 'P3', 'entregado'),
  ('aaaaaaaa-0000-7000-8000-000000000014', 'aaaaaaaa-0000-7000-8000-000000000001', 'P4', 'entregado'),
  ('aaaaaaaa-0000-7000-8000-000000000015', 'aaaaaaaa-0000-7000-8000-000000000001', 'P5', 'presupuesto_enviado');
insert into public.pagos (proyecto_id, fecha, monto_centavos) values
  ('aaaaaaaa-0000-7000-8000-000000000011', '2026-09-01', 70000000),
  ('aaaaaaaa-0000-7000-8000-000000000012', '2026-09-01', 100000000),
  ('aaaaaaaa-0000-7000-8000-000000000013', '2026-09-01', 100000000),
  ('aaaaaaaa-0000-7000-8000-000000000014', '2026-09-01', 40000000),
  ('aaaaaaaa-0000-7000-8000-000000000015', '2026-09-01', 20000000);


-- El cobro que deja el mes con algo adentro ----------------------------------------------------------

-- P1: neta 70M, diezmo 7M, sueldo 50M, fijos 13M. Septiembre queda con 50M de sueldo y 13M de fijos.
select is(
  (
    select dist_fijos_centavos
    from public.cobrar_proyecto(
      'aaaaaaaa-0000-7000-8000-000000000011', 1, '2026-09-03',
      70000000, 0, 50000000, 25000000, 7000000, 50000000, 13000000, 0,
      0, 0
    )
  ),
  13000000::bigint,
  'el primer cobro del mes manda el acumulado en cero y coincide: se congela como siempre'
);


-- El acumulado viejo se ajusta en vez de rechazarse ---------------------------------------------------

-- P2 se cobra desde un dispositivo que no vio el cobro de P1: manda el mes en cero y los topes
-- enteros. La base recalcula con lo suyo (13M de fijos ya cubiertos) y congela el tope en 12M.
select results_eq(
  $$
    select dist_tope_fijos_centavos, dist_fijos_centavos, dist_remanente_centavos
    from public.cobrar_proyecto(
      'aaaaaaaa-0000-7000-8000-000000000012', 1, '2026-09-20',
      100000000, 0, 50000000, 25000000, 10000000, 50000000, 25000000, 15000000,
      0, 0
    )
  $$,
  $$ values (12000000::bigint, 12000000::bigint, 28000000::bigint) $$,
  'con el acumulado viejo la liquidación se ajusta: el tope sale del mes real y el resto va al remanente'
);

select results_eq(
  $$
    select dist_sueldo_previo_centavos, dist_fijos_previo_centavos
    from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000012'
  $$,
  $$ values (50000000::bigint, 13000000::bigint) $$,
  'y congela el acumulado de la base, no el que mandó la app: comparándolos, la app sabe que se ajustó'
);


-- El MN008 sigue estricto contra lo que la app vio ---------------------------------------------------

-- Con el mes en (0, 5M) los topes son 50M y 20M. Mandar 25M de tope de fijos es aplicar otra regla.
select throws_ok(
  $$ select public.cobrar_proyecto('aaaaaaaa-0000-7000-8000-000000000013', 1, '2026-09-25', 100000000, 0, 50000000, 25000000, 10000000, 50000000, 25000000, 15000000, 0, 5000000) $$,
  'MN008', null, 'si los topes no salen del acumulado que la app dice haber visto, es una app desactualizada'
);

-- Los topes cierran con su acumulado, pero la cascada no: 20M de fijos dejan 20M de remanente, no 21M.
select throws_ok(
  $$ select public.cobrar_proyecto('aaaaaaaa-0000-7000-8000-000000000013', 1, '2026-09-25', 100000000, 0, 50000000, 20000000, 10000000, 50000000, 20000000, 21000000, 0, 5000000) $$,
  'MN008', null, 'y la distribución se sigue verificando contra los topes que la app vio'
);

-- Ahora sí: la cuenta de la app cierra con su acumulado (0, 5M), pero el mes real lleva 25M de fijos,
-- así que el tope de fijos de la base es 0 y todo lo que sobra queda de remanente.
select results_eq(
  $$
    select dist_tope_fijos_centavos, dist_fijos_centavos, dist_remanente_centavos, dist_fijos_previo_centavos
    from public.cobrar_proyecto(
      'aaaaaaaa-0000-7000-8000-000000000013', 1, '2026-09-25',
      100000000, 0, 50000000, 20000000, 10000000, 50000000, 20000000, 20000000,
      0, 5000000
    )
  $$,
  $$ values (0::bigint, 0::bigint, 40000000::bigint, 25000000::bigint) $$,
  'con la cuenta bien hecha sobre su propio acumulado, la base ajusta y congela lo suyo'
);


-- El reenvío de una liquidación ajustada --------------------------------------------------------------

-- La respuesta se perdió y la cola reintenta. Los topes y los escalones congelados no son los que
-- mandó la app —ese es el ajuste—, así que el reenvío se reconoce por lo que la app sí controla.
select results_eq(
  $$
    select estado::text, version, dist_remanente_centavos
    from public.cobrar_proyecto(
      'aaaaaaaa-0000-7000-8000-000000000013', 1, '2026-09-25',
      100000000, 0, 50000000, 20000000, 10000000, 50000000, 20000000, 20000000,
      0, 5000000
    )
  $$,
  $$ values ('cobrado', 2, 40000000::bigint) $$,
  'reenviar una liquidación ajustada devuelve la fila, no un MN001 por estar ya cobrado'
);


-- Sin acumulado, todo sigue como antes ---------------------------------------------------------------

-- Septiembre lleva 25M de fijos, así que el tope es 0 y el 25M que manda la app no coincide.
select throws_ok(
  $$ select public.cobrar_proyecto('aaaaaaaa-0000-7000-8000-000000000014', 1, '2026-09-28', 40000000, 0, 50000000, 25000000, 4000000, 36000000, 0, 0) $$,
  'MN006', null, 'una app que no manda el acumulado sigue rebotando con MN006, como hasta ahora'
);

select throws_ok(
  $$ select public.cobrar_proyecto('aaaaaaaa-0000-7000-8000-000000000014', 1, '2026-09-28', 40000000, 0, 50000000, 25000000, 4000000, 36000000, 0, 0, 150000000) $$,
  '22004', null, 'el acumulado del mes va entero o no va: con la mitad se rechaza'
);

-- Con el acumulado correcto no hay ajuste, y lo que cambió de verdad se rechaza igual.
select throws_ok(
  $$ select public.cobrar_proyecto('aaaaaaaa-0000-7000-8000-000000000014', 1, '2026-09-28', 30000000, 0, 50000000, 0, 3000000, 27000000, 0, 0, 150000000, 25000000) $$,
  'MN006', null, 'si el acumulado coincide, un pago que la app no vio sigue siendo MN006'
);


-- El perdido también ajusta --------------------------------------------------------------------------

-- La seña de 20M paga diezmo y no paga sueldo (los parámetros por defecto), pero el tope de fijos es
-- mensual igual que en un cobro: es el caso que hoy dispara el ajuste sin prender el sueldo mensual.
-- La app vio el mes en cero: para ella los fijos se llevaban 18M. Septiembre ya los tiene cubiertos.
select results_eq(
  $$
    select dist_tope_fijos_centavos, dist_diezmo_centavos, dist_fijos_centavos, dist_remanente_centavos
    from public.cerrar_perdido(
      'aaaaaaaa-0000-7000-8000-000000000015', 1, '2026-09-29',
      20000000, 0, 0, 25000000, 2000000, 0, 18000000, 0, 1000,
      0, 0
    )
  $$,
  $$ values (0::bigint, 2000000::bigint, 0::bigint, 18000000::bigint) $$,
  'cerrar un perdido con el acumulado viejo ajusta igual: la seña deja el diezmo y el resto en el taller'
);

select is(
  (
    select count(*)::int from public.proyectos
    where household_id = tests.id('household_a') and estado in ('cobrado', 'perdido')
  ),
  4,
  'quedaron los tres cobros y el perdido, todos con su distribución congelada'
);

select * from finish();
