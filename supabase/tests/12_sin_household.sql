-- Una cuenta de Auth sin household: el caso que abre el registro público (ADR 0012). La app tiene
-- que poder distinguir "tu cuenta todavía no tiene acceso" de "tu taller está vacío", y esa
-- diferencia sale de acá: bootstrap() responde, vacío, en vez de fallar.

select plan(8);

select tests.guardar('con_taller', tests.crear_usuario('titular@maun.test'));
select tests.guardar('household', private.crear_household('Taller con datos', tests.id('con_taller')));
insert into public.clientes (household_id, nombre) values (tests.id('household'), 'Cliente ajeno');

select tests.guardar('sin_taller', tests.crear_usuario('recien-creada@maun.test'));
select tests.entrar_como(tests.id('sin_taller'));

select lives_ok(
  'select public.bootstrap()',
  'una cuenta sin household llama a bootstrap() sin error: la respuesta vacía es la respuesta'
);

select is(
  jsonb_array_length(public.bootstrap() -> 'households'),
  0,
  'no ve ningún household: es lo que la app lee para mandarla a la pantalla de sin acceso'
);

select is(
  (
    select count(*)::int
    from jsonb_each(public.bootstrap() - 'cursor') as t (clave, valor)
    cross join lateral jsonb_array_elements(t.valor)
  ),
  0,
  'ni una fila de ninguna tabla, ni siquiera del taller que sí tiene datos'
);

select isnt(
  public.bootstrap() ->> 'cursor',
  null,
  'el cursor viene igual, así que el primer delta arranca desde ahí cuando le den acceso'
);

select lives_ok('select public.delta(now())', 'delta() también responde, vacío');

select throws_ok(
  'select private.household_actual()',
  '42501',
  null,
  'sin household no hay household de la sesión'
);

select throws_ok(
  $$ insert into public.clientes (nombre) values ('Mi primer cliente') $$,
  '42501',
  null,
  'y por eso tampoco carga datos: el household_id sale de private.household_actual()'
);

select throws_ok(
  $$ insert into public.households (nombre) values ('Mi taller') $$,
  '42501',
  null,
  'nadie se crea un household solo: authenticated no tiene insert sobre households'
);

select * from finish();
