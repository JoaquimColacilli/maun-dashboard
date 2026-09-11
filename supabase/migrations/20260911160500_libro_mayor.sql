-- El libro mayor: una fila por cada tesoro que toca un asiento, con el importe con signo. Une los
-- movimientos manuales con los derivados de proyectos, que no se guardan en ningún lado: salen de
-- pagos, gastos y de la distribución congelada. Hay una sola fuente de verdad (ADR 0003).
--
-- security_invoker: la vista corre con los permisos de quien consulta, así que la RLS de cada
-- tabla de abajo sigue filtrando por household.

create view public.libro_mayor
with (security_invoker = true)
as
-- Movimiento manual, lado que recibe.
select
  m.household_id,
  'manual'::text as origen,
  m.id as asiento_id,
  m.fecha,
  m.tesoro_destino as tesoro,
  m.tesoro_origen as contrapartida,
  m.monto_centavos,
  m.tipo::text as concepto,
  m.categoria,
  m.descripcion,
  m.proyecto_id
from public.movimientos m
where m.deleted_at is null
  and m.tesoro_destino is not null

union all

-- Movimiento manual, lado que entrega.
select
  m.household_id,
  'manual',
  m.id,
  m.fecha,
  m.tesoro_origen,
  m.tesoro_destino,
  -m.monto_centavos,
  m.tipo::text,
  m.categoria,
  m.descripcion,
  m.proyecto_id
from public.movimientos m
where m.deleted_at is null
  and m.tesoro_origen is not null

union all

-- Pago de un proyecto: entra a MAUN desde afuera.
select
  pg.household_id,
  'pago',
  pg.id,
  pg.fecha,
  'maun'::public.tesoro,
  null::public.tesoro,
  pg.monto_centavos,
  'cobro',
  'Cobro',
  pg.concepto,
  pg.proyecto_id
from public.pagos pg
join public.proyectos p on p.household_id = pg.household_id and p.id = pg.proyecto_id
where pg.deleted_at is null
  and p.deleted_at is null

union all

-- Gasto de un proyecto: sale de MAUN hacia afuera.
select
  g.household_id,
  'gasto_proyecto',
  g.id,
  g.fecha,
  'maun'::public.tesoro,
  null::public.tesoro,
  -g.monto_centavos,
  'gasto',
  'Materiales',
  g.descripcion,
  g.proyecto_id
from public.gastos g
join public.proyectos p on p.household_id = g.household_id and p.id = g.proyecto_id
where g.deleted_at is null
  and p.deleted_at is null

union all

-- Distribución congelada: el diezmo pasa de MAUN a DIEZMO y el sueldo de MAUN a HOGAR. Los fijos y
-- el remanente se quedan en MAUN: no mueven plata, así que no generan filas.
select
  p.household_id,
  'distribucion',
  p.id,
  p.fecha_cobro,
  d.tesoro,
  d.contrapartida,
  d.monto_centavos,
  d.concepto,
  'Distribución',
  p.titulo,
  p.id
from public.proyectos p
cross join lateral (
  values
    ('diezmo'::public.tesoro, 'maun'::public.tesoro, p.dist_diezmo_centavos, 'diezmo'),
    ('maun'::public.tesoro, 'diezmo'::public.tesoro, -p.dist_diezmo_centavos, 'diezmo'),
    ('hogar'::public.tesoro, 'maun'::public.tesoro, p.dist_sueldo_centavos, 'sueldo'),
    ('maun'::public.tesoro, 'hogar'::public.tesoro, -p.dist_sueldo_centavos, 'sueldo')
) as d (tesoro, contrapartida, monto_centavos, concepto)
where p.estado = 'cobrado'
  and p.deleted_at is null
  and d.monto_centavos <> 0;

comment on view public.libro_mayor is
  'Libro mayor por tesoro: una fila por tesoro afectado, importe con signo. El saldo de un tesoro es sum(monto_centavos) where tesoro = X.';
comment on column public.libro_mayor.origen is
  'De dónde sale el asiento: manual (tabla movimientos), pago, gasto_proyecto o distribucion. Distingue lo cargado a mano de lo derivado de un proyecto.';
comment on column public.libro_mayor.asiento_id is
  'Id de la fila de origen: el movimiento, el pago, el gasto o el proyecto (para la distribución). Un asiento puede dar varias filas, una por tesoro.';
comment on column public.libro_mayor.contrapartida is 'El otro lado del asiento. Null: afuera.';
comment on column public.libro_mayor.monto_centavos is 'Con signo: positivo si entra al tesoro, negativo si sale.';
comment on column public.libro_mayor.concepto is 'Tipo del asiento: el tipo del movimiento manual, o cobro, gasto, diezmo, sueldo.';

revoke all on table public.libro_mayor from anon, authenticated;
grant select on table public.libro_mayor to authenticated;
