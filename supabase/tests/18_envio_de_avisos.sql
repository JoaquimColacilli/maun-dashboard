-- Lo que usa la función de borde que manda los avisos: solo service_role, y un 404 o 410 del
-- servicio de push borra la suscripción.

select plan(12);

select tests.guardar('a', tests.crear_usuario('a@maun.test'));
select tests.guardar('b', tests.crear_usuario('b@maun.test'));

create function tests.registrar(p_endpoint text)
returns jsonb
language sql
as $$
  select public.registrar_suscripcion(p_endpoint, 'B' || repeat('x', 86), repeat('y', 22), 'America/Argentina/Buenos_Aires')
$$;

grant usage on schema tests to service_role;
grant execute on all functions in schema tests to anon, authenticated, service_role;

select tests.entrar_como(tests.id('a'));
select tests.registrar('https://fcm.googleapis.com/fcm/send/telefono-a');
select tests.registrar('https://fcm.googleapis.com/fcm/send/pc-a');
select tests.entrar_como(tests.id('b'));
select tests.registrar('https://fcm.googleapis.com/fcm/send/telefono-b');

select ok(
  not has_function_privilege('authenticated', 'public.borrar_suscripcion_vencida(text)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.anotar_aviso(uuid, date, boolean)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.suscripciones_para_probar(uuid, text)', 'EXECUTE'),
  'un usuario no ejecuta las funciones del que manda: ni borra suscripciones ni lee las de otro'
);

select tests.salir();
select set_config('role', 'service_role', true);

select is(
  jsonb_array_length(public.suscripciones_para_probar(tests.id('a'))),
  2,
  'la prueba va a todos los dispositivos de la persona'
);

select is(
  public.suscripciones_para_probar(tests.id('a'), 'https://fcm.googleapis.com/fcm/send/pc-a') -> 0 ->> 'endpoint',
  'https://fcm.googleapis.com/fcm/send/pc-a',
  'o solo al que la pidió'
);

select is(
  jsonb_array_length(public.suscripciones_para_probar(tests.id('a'), 'https://fcm.googleapis.com/fcm/send/telefono-b')),
  0,
  'y nunca a un dispositivo de otra persona'
);

select set_config(
  'tests.telefono_a',
  public.suscripciones_para_probar(tests.id('a'), 'https://fcm.googleapis.com/fcm/send/telefono-a') -> 0 ->> 'id',
  true
);

select is(
  public.anotar_aviso(tests.id('telefono_a'), '2026-09-14', false),
  true,
  'un día sin nada que avisar se anota igual'
);

select tests.salir();

select is(
  (select array[ultimo_dia_avisado::text, coalesce(ultimo_envio::text, 'sin envío')] from private.suscripciones_de_avisos where id = tests.id('telefono_a')),
  array['2026-09-14', 'sin envío'],
  'queda el día mirado, sin fecha de envío'
);

select set_config('role', 'service_role', true);
select public.anotar_aviso(tests.id('telefono_a'), '2026-09-14', true);
select public.anotar_aviso(tests.id('telefono_a'), '2026-09-13', true);
select tests.salir();

select ok(
  (select ultimo_envio is not null and ultimo_dia_avisado = '2026-09-14' from private.suscripciones_de_avisos where id = tests.id('telefono_a')),
  'el envío anota cuándo salió, y un día anterior no hace retroceder el último avisado'
);

select set_config('role', 'service_role', true);

select is(
  public.borrar_suscripcion_vencida('https://fcm.googleapis.com/fcm/send/telefono-a'),
  true,
  'un 410 del servicio de push borra la suscripción'
);

select is(
  public.borrar_suscripcion_vencida('https://fcm.googleapis.com/fcm/send/telefono-a'),
  false,
  'borrarla de nuevo no rompe: ya no está'
);

select throws_ok(
  $$ select * from private.suscripciones_de_avisos $$,
  '42501', null,
  'ni el que manda lee la tabla directo: pasa por las funciones'
);

select tests.salir();

select is(
  (select count(*)::int from private.suscripciones_de_avisos where user_id = tests.id('a')),
  1,
  'a A le queda la PC'
);

select is(
  (select count(*)::int from private.suscripciones_de_avisos where user_id = tests.id('b')),
  1,
  'y a B su teléfono, intacto'
);

select * from finish();
