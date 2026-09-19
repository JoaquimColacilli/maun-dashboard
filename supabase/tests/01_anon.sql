-- Sin sesión no se ve nada, salvo la vista del cliente entrando por su link. anon no tiene grants
-- sobre ninguna tabla: cada acceso tiene que fallar por permisos, no devolver cero filas (cero
-- filas querría decir que la RLS es la única barrera).

select plan(19);

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
  'movimientos', 'libro_mayor', 'archivos', 'enlaces_publicos', 'cambios_de_estado'
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

-- La vista del cliente tiene dos puertas y anon solo puede empujar una: la del token. La otra
-- recibe el id del trabajo y es de quien tiene sesión.
select throws_ok(
  $$ select public.vista_del_cliente('00000000-0000-7000-8000-000000000001'::uuid) $$,
  '42501',
  null,
  'anon no llama a la vista por el id del trabajo: esa es la de adentro de la app'
);

-- La del token sí la puede llamar: rebota con MN010 y no con 42501, que es la diferencia entre
-- «este link no funciona» y «ni siquiera podés preguntar».
select throws_ok(
  $$ select public.vista_compartida('token-que-no-existe-0000000000') $$,
  'MN010',
  'Este link no funciona',
  'anon sí llama a la vista del link, y un token que no existe no revela nada'
);

select throws_ok(
  $$ select public.vista_compartida('no sirve') $$,
  'MN010',
  'Este link no funciona',
  'un token con cualquier forma contesta exactamente lo mismo'
);

select * from finish();
