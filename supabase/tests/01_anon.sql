-- Sin sesión no se ve nada. anon no tiene grants: cada acceso tiene que fallar por permisos, no
-- devolver cero filas (cero filas querría decir que la RLS es la única barrera).

select plan(13);

-- Un household con datos, para que "no ve nada" no sea trivial.
select tests.guardar('usuario', tests.crear_usuario('titular@maun.test'));
select tests.guardar('household', private.crear_household('Taller visible', tests.id('usuario')));
insert into public.clientes (household_id, nombre) values (tests.id('household'), 'Cliente con datos');

select tests.entrar_como_anon();

select throws_ok(
  format('select * from public.%I', t.tabla),
  '42501',
  null,
  format('anon no lee %s', t.tabla)
)
from unnest(array[
  'households', 'household_members', 'ajustes', 'clientes', 'proyectos', 'pagos', 'gastos',
  'movimientos', 'libro_mayor'
]) as t (tabla);

select throws_ok('select public.bootstrap()', '42501', null, 'anon no llama a bootstrap()');

select throws_ok('select public.delta(now())', '42501', null, 'anon no llama a delta()');

select throws_ok(
  $$ insert into public.clientes (nombre) values ('Intruso') $$,
  '42501',
  null,
  'anon no inserta'
);

select throws_ok('select private.user_household_ids()', '42501', null, 'anon no llega a los helpers de private');

select * from finish();
