-- Las suscripciones a los avisos: registrar y dar de baja un dispositivo, reasignarlo cuando cambia
-- la cuenta, y que nada de esto sea parte de la réplica del household ni se lea por fuera de las
-- funciones.

select plan(24);

select tests.guardar('a', tests.crear_usuario('a@maun.test'));
select tests.guardar('b', tests.crear_usuario('b@maun.test'));
select tests.guardar('household_a', private.crear_household('Taller A', tests.id('a')));

select set_config('tests.p256dh', 'B' || repeat('x', 86), true);
select set_config('tests.auth', repeat('y', 22), true);

create function tests.registrar(p_endpoint text, p_zona text default 'America/Argentina/Buenos_Aires')
returns jsonb
language sql
as $$
  select public.registrar_suscripcion(
    p_endpoint, current_setting('tests.p256dh'), current_setting('tests.auth'), p_zona
  )
$$;

create function tests.duenio_de(p_endpoint text)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select user_id from private.suscripciones_de_avisos where endpoint = p_endpoint
$$;

grant execute on all functions in schema tests to anon, authenticated;


-- Registrar ------------------------------------------------------------------------------------------

select tests.entrar_como(tests.id('a'));

select is(
  tests.registrar('https://fcm.googleapis.com/fcm/send/telefono') - 'ultimo_envio',
  jsonb_build_object(
    'suscripto', true,
    'dispositivos', 1,
    'preferencias', jsonb_build_object(
      'zona', 'America/Argentina/Buenos_Aires',
      'hora', '07:30',
      'avisos', '{"entregas": {"activo": true, "anticipacion": 2}, "visitas": {"activo": true, "anticipacion": 1}, "presupuestos": {"activo": true, "anticipacion": 1}, "anotaciones": {"activo": false, "anticipacion": 0}}'::jsonb
    )
  ),
  'registrar el dispositivo lo deja suscripto y crea las preferencias con la zona que eligió'
);

select is(
  tests.duenio_de('https://fcm.googleapis.com/fcm/send/telefono'),
  tests.id('a'),
  'la fila es del usuario de la sesión: no lo elige el cliente'
);

select is(
  (tests.registrar('https://updates.push.services.mozilla.com/wpush/v2/pc') ->> 'dispositivos')::int,
  2,
  'dos dispositivos del mismo usuario son dos suscripciones, y los dos reciben'
);

select lives_ok(
  $$ select tests.registrar('https://fcm.googleapis.com/fcm/send/telefono') $$,
  'registrar dos veces el mismo dispositivo no rebota'
);

select is(
  (public.estado_de_mis_avisos(null) ->> 'dispositivos')::int,
  2,
  'y no lo duplica'
);

select throws_ok(
  $$ select tests.registrar('https://fcm.googleapis.com/fcm/send/otro', 'Argentina/Morón') $$,
  '22023', 'La zona horaria no existe',
  'una zona horaria que no existe se rechaza: se pregunta, no se inventa'
);

select throws_ok(
  $$ select tests.registrar('http://inseguro.example/push') $$,
  '23514', null,
  'un endpoint que no es https se rechaza'
);

select throws_ok(
  $$ select public.registrar_suscripcion('https://fcm.googleapis.com/fcm/send/x', 'corta', 'corta', 'America/Argentina/Buenos_Aires') $$,
  '23514', null,
  'unas claves que no son las del navegador se rechazan'
);


-- Otra cuenta en el mismo teléfono -------------------------------------------------------------------

select tests.entrar_como(tests.id('b'));

select is(
  (tests.registrar('https://fcm.googleapis.com/fcm/send/telefono', 'America/Montevideo') ->> 'suscripto')::boolean,
  true,
  'B registra el teléfono que era de A'
);

select is(
  tests.duenio_de('https://fcm.googleapis.com/fcm/send/telefono'),
  tests.id('b'),
  'el dispositivo pasa a ser de B: los avisos de A dejan de llegarle'
);

select is(
  public.estado_de_mis_avisos('https://fcm.googleapis.com/fcm/send/telefono') -> 'preferencias' ->> 'zona',
  'America/Montevideo',
  'las preferencias son de cada persona: B tiene las suyas'
);

select tests.entrar_como(tests.id('a'));

select is(
  public.estado_de_mis_avisos('https://fcm.googleapis.com/fcm/send/telefono') - 'preferencias' - 'ultimo_envio',
  jsonb_build_object('suscripto', false, 'dispositivos', 1),
  'a A le queda solo la PC, y el teléfono ya no figura como suyo'
);

select is(
  public.dar_de_baja_suscripcion('https://fcm.googleapis.com/fcm/send/telefono'),
  false,
  'A no da de baja el teléfono que ahora es de B'
);

select is(
  tests.duenio_de('https://fcm.googleapis.com/fcm/send/telefono'),
  tests.id('b'),
  'y la fila sigue siendo de B'
);


-- Dar de baja ------------------------------------------------------------------------------------------

select is(
  public.dar_de_baja_suscripcion('https://updates.push.services.mozilla.com/wpush/v2/pc'),
  true,
  'A da de baja su PC'
);

select is(
  tests.duenio_de('https://updates.push.services.mozilla.com/wpush/v2/pc'),
  null,
  'la fila desaparece: una baja es un borrado de verdad, no una marca'
);


-- Las preferencias -------------------------------------------------------------------------------------

select is(
  public.guardar_preferencias_de_avisos(
    'America/Argentina/Cordoba',
    '06:30',
    '{"entregas": {"activo": true, "anticipacion": 3}, "visitas": {"activo": false, "anticipacion": 1}, "presupuestos": {"activo": true, "anticipacion": 0}, "anotaciones": {"activo": true, "anticipacion": 1}}'
  ) -> 'preferencias' ->> 'hora',
  '06:30',
  'la hora, la zona y qué avisa se guardan'
);

select throws_ok(
  $$ select public.guardar_preferencias_de_avisos('America/Argentina/Cordoba', '06:30', '{"entregas": {"activo": true, "anticipacion": 9}}') $$,
  '22023', 'Las preferencias de avisos no tienen la forma esperada',
  'unas preferencias con otra forma se rechazan con un mensaje, no con un check genérico'
);


-- Lo que nadie hace por fuera de las funciones -----------------------------------------------------------

select throws_ok(
  $$ select * from private.suscripciones_de_avisos $$,
  '42501', null,
  'authenticated no lee la tabla de suscripciones: ni la suya, ni la de otro'
);

select ok(
  not has_function_privilege('authenticated', 'private.estado_de_los_avisos(uuid, text)', 'EXECUTE'),
  'authenticated no lee el estado de otro usuario pasándole su id'
);

select ok(
  not has_function_privilege('anon', 'public.registrar_suscripcion(text, text, text, text)', 'EXECUTE'),
  'anon no registra dispositivos'
);

select ok(
  not (public.bootstrap() ? 'suscripciones_de_avisos') and not (public.bootstrap() ? 'preferencias_de_avisos'),
  'las suscripciones no son parte de la réplica del household'
);

select tests.salir();
select set_config('role', 'authenticated', true);

select throws_ok(
  $$ select tests.registrar('https://fcm.googleapis.com/fcm/send/sin-sesion') $$,
  '42501', 'Hace falta una sesión para activar los avisos',
  'sin sesión no se registra nada'
);

select tests.salir();

select is(
  (select count(*)::int from private.suscripciones_de_avisos where user_id in (tests.id('a'), tests.id('b'))),
  1,
  'al final queda una sola suscripción: el teléfono, de B'
);

select * from finish();
