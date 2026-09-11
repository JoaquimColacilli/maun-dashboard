-- Los planes, bajo RLS: el delta y el bootstrap entran por índice filtrando por household. Que el
-- índice exista no alcanza (00_estructura); una policy mal escrita lo deja sin usar y cada sync
-- lee las filas de todos los households.
--
-- enable_seqscan off: en el ensayo las tablas están vacías y sin estadísticas, y el planner
-- preferiría un scan secuencial aunque el índice sirva. Con esto, si el índice se puede usar, se usa.

select plan(8);

select tests.guardar('a', tests.crear_usuario('a@maun.test'));
select tests.guardar('household_a', private.crear_household('Taller A', tests.id('a')));

select tests.entrar_como(tests.id('a'));
select set_config('enable_seqscan', 'off', true);

select matches(
  tests.plan_de(format('select * from public.%I where updated_at >= now() - interval ''5 minutes''', t.tabla)),
  'Index Cond: \(+household_id = ANY',
  format('el delta de %s entra por (household_id, updated_at) con el household como condición de índice', t.tabla)
)
from unnest(array['household_members', 'clientes', 'proyectos', 'pagos', 'gastos', 'movimientos']) as t (tabla);

select matches(
  tests.plan_de('select * from public.households'),
  'Index Cond: \(+id = ANY',
  'households entra por su clave primaria'
);

select matches(
  tests.plan_de('select * from public.ajustes'),
  'Index Cond: \(+household_id = ANY',
  'ajustes entra por su clave única de household'
);

select * from finish();
