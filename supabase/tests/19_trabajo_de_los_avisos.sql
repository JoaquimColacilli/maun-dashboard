-- A quién le toca el aviso de la mañana: la cuenta de la hora local la hace la base con la zona que
-- eligió cada persona, no el servidor que manda. Y el trabajo que lo pide existe.

select plan(14);

select tests.guardar('a', tests.crear_usuario('a@maun.test'));
select tests.guardar('household_a', private.crear_household('Taller A', tests.id('a')));
select tests.guardar('m', tests.crear_usuario('m@maun.test'));
select tests.guardar('household_m', private.crear_household('Taller M', tests.id('m')));
select tests.guardar('z', tests.crear_usuario('z@maun.test'));

create function tests.registrar(p_endpoint text, p_zona text)
returns jsonb
language sql
as $$
  select public.registrar_suscripcion(p_endpoint, 'B' || repeat('x', 86), repeat('y', 22), p_zona)
$$;

create function tests.a_quienes(p_ahora timestamptz)
returns text[]
language sql
as $$
  select coalesce(array_agg(e ->> 'endpoint' order by e ->> 'endpoint'), array[]::text[])
  from jsonb_array_elements(public.avisos_por_mandar(p_ahora)) as e
  where e ->> 'endpoint' like 'https://push.example/%'
$$;

create function tests.aviso_de(p_ahora timestamptz, p_endpoint text)
returns jsonb
language sql
as $$
  select e from jsonb_array_elements(public.avisos_por_mandar(p_ahora)) as e
  where e ->> 'endpoint' = p_endpoint
$$;

grant usage on schema tests to service_role;
grant execute on all functions in schema tests to anon, authenticated, service_role;

-- A: taller en Morón, zona de Buenos Aires, a las 07:30 (la hora por defecto).
select tests.entrar_como(tests.id('a'));
insert into public.clientes (id, nombre, zona) values ('aaaaaaaa-0000-7000-8000-000000000001', 'Villalba', 'Morón');
insert into public.proyectos (id, cliente_id, titulo, estado, entrega_estimada)
  values ('aaaaaaaa-0000-7000-8000-000000000002', 'aaaaaaaa-0000-7000-8000-000000000001', 'Cocina', 'en_curso', '2026-09-15');
insert into public.anotaciones (fecha, texto) values
  ('2026-09-14', 'Retirar el pulpo'),
  ('2026-10-20', 'Algo del mes que viene');
insert into public.anotaciones (fecha, texto, hecha) values ('2026-09-14', 'Ya estaba lista', true);
insert into public.proyectos (id, cliente_id, titulo, estado)
  values ('aaaaaaaa-0000-7000-8000-000000000003', 'aaaaaaaa-0000-7000-8000-000000000001', 'Placard', 'en_seguimiento');
insert into public.proximos_contactos (proyecto_id, fecha, etapa_previa, hecho_el, resultado)
  values ('aaaaaaaa-0000-7000-8000-000000000003', '2026-09-01', 'presupuesto_enviado', '2026-09-02', 'otra_fecha');
insert into public.proximos_contactos (proyecto_id, fecha, etapa_previa)
  values ('aaaaaaaa-0000-7000-8000-000000000003', '2026-09-14', 'presupuesto_enviado');
select tests.registrar('https://push.example/a', 'America/Argentina/Buenos_Aires');

-- M: en Madrid, a las 12:00.
select tests.entrar_como(tests.id('m'));
select tests.registrar('https://push.example/m', 'Europe/Madrid');
select public.guardar_preferencias_de_avisos(
  'Europe/Madrid', '12:00',
  '{"entregas": {"activo": true, "anticipacion": 2}, "visitas": {"activo": true, "anticipacion": 1}, "presupuestos": {"activo": true, "anticipacion": 1}, "anotaciones": {"activo": false, "anticipacion": 0}}'
);

-- Z: se registró pero no tiene taller.
select tests.entrar_como(tests.id('z'));
select tests.registrar('https://push.example/z', 'America/Argentina/Buenos_Aires');

select tests.salir();
select set_config('role', 'service_role', true);

select is(
  tests.a_quienes('2026-09-14 10:20:00+00'),
  array['https://push.example/m'],
  'a las 10:20 UTC en Buenos Aires son las 07:20 y todavía no; en Madrid son las 12:20 y sí'
);

select is(
  tests.a_quienes('2026-09-14 10:40:00+00'),
  array['https://push.example/a', 'https://push.example/m'],
  'a las 07:40 de Buenos Aires ya le toca a A; a Z no, porque no tiene taller'
);

select is(
  tests.a_quienes('2026-09-14 13:29:00+00'),
  array['https://push.example/a'],
  'la ventana dura tres horas: A sigue a las 10:29, y en Madrid ya pasaron las 15:00'
);

select is(
  tests.a_quienes('2026-09-14 13:31:00+00'),
  array[]::text[],
  'a las 10:31 de Buenos Aires ya no le toca a nadie'
);

select is(
  (select tests.aviso_de('2026-09-14 10:40:00+00', 'https://push.example/a') ->> 'dia'),
  '2026-09-14',
  'el día es el día local de la persona'
);

select is(
  (
    select array[
      jsonb_array_length(e -> 'filas' -> 'proyectos'),
      jsonb_array_length(e -> 'filas' -> 'clientes'),
      jsonb_array_length(e -> 'filas' -> 'anotaciones'),
      jsonb_array_length(e -> 'filas' -> 'proximos_contactos')
    ]
    from tests.aviso_de('2026-09-14 10:40:00+00', 'https://push.example/a') as e
  ),
  array[2, 1, 1, 1],
  'trae los datos de su taller: los trabajos (también el que está en seguimiento), su cliente, lo anotado en la ventana que no está tildado y el contacto pendiente, no el ya registrado'
);

select is(
  tests.aviso_de('2026-09-14 10:40:00+00', 'https://push.example/a') -> 'preferencias' -> 'seguimientos',
  '{"activo": true, "anticipacion": 0}'::jsonb,
  'el aviso trae el seguimiento prendido para el mismo día'
);

select is(
  tests.aviso_de('2026-09-14 10:20:00+00', 'https://push.example/m') -> 'preferencias' -> 'seguimientos',
  '{"activo": true, "anticipacion": 0}'::jsonb,
  'también a quien guardó sus preferencias con las cuatro claves de antes'
);

select is(
  jsonb_array_length(tests.aviso_de('2026-09-14 10:20:00+00', 'https://push.example/m') -> 'filas' -> 'proyectos'),
  0,
  'y nada del taller de otro'
);

select public.anotar_aviso(
  (select (e ->> 'id')::uuid from tests.aviso_de('2026-09-14 10:40:00+00', 'https://push.example/a') as e),
  '2026-09-14',
  true
);

select is(
  tests.a_quienes('2026-09-14 10:45:00+00'),
  array['https://push.example/m'],
  'el mismo día no se vuelve a mandar'
);

select is(
  tests.aviso_de('2026-09-15 10:40:00+00', 'https://push.example/a') ->> 'dia',
  '2026-09-15',
  'al día siguiente vuelve a tocar'
);

select tests.entrar_como(tests.id('a'));
select public.guardar_preferencias_de_avisos(
  'America/Argentina/Buenos_Aires', '22:30',
  '{"entregas": {"activo": true, "anticipacion": 2}, "visitas": {"activo": true, "anticipacion": 1}, "presupuestos": {"activo": true, "anticipacion": 1}, "anotaciones": {"activo": false, "anticipacion": 0}}'
);
select tests.salir();
select set_config('role', 'service_role', true);

select is(
  tests.aviso_de('2026-09-16 02:00:00+00', 'https://push.example/a') ->> 'dia',
  '2026-09-15',
  'a las 02:00 UTC del 16 en Buenos Aires son las 23:00 del 15: el día es el de la persona, no el del servidor'
);

select tests.salir();

select ok(
  not has_function_privilege('authenticated', 'public.avisos_por_mandar(timestamptz)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'private.pedir_los_avisos()', 'EXECUTE'),
  'un usuario no ve a quién le toca el aviso ni dispara el trabajo'
);

select is(
  (
    select count(*)::int from cron.job
    where jobname = 'avisos-de-la-manana'
      and schedule = '*/15 * * * *'
      and command = 'select private.pedir_los_avisos()'
  ),
  1,
  'el trabajo programado corre cada quince minutos y pide los avisos'
);

select * from finish();
