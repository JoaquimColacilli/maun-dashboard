-- El aviso de cambios (ADR 0065): cada transacción que escribe en una tabla del delta avisa una sola vez
-- al canal privado de su taller, sin datos, y solo los miembros del taller pueden escuchar ese canal.
--
-- Para contar los avisos sin depender de Realtime, el test cambia private.mandar_el_aviso_de_cambios
-- por un espía que los anota en una tabla; el rollback del final deja la función como estaba. Como
-- todo el archivo es una sola transacción, cada caso empieza borrando la marca maun.cambios_avisados,
-- que en la app vive lo que vive una transacción.

select plan(24);

select tests.guardar('a', tests.crear_usuario('a@maun.test'));
select tests.guardar('household_a', private.crear_household('Taller A', tests.id('a')));
select tests.guardar('b', tests.crear_usuario('b@maun.test'));
select tests.guardar('household_b', private.crear_household('Taller B', tests.id('b')));

grant execute on all functions in schema tests to anon, authenticated;


-- El aviso real ----------------------------------------------------------------------------------------

select ok(
  pg_get_functiondef('private.mandar_el_aviso_de_cambios(uuid)'::regprocedure)
    like '%realtime.send(''{}''::jsonb, ''cambios'', ''cambios:'' || p_household::text, true)%',
  'el aviso va por realtime.send al canal privado cambios:<taller>, con el payload vacío'
);

select is(
  (
    select array_agg(t order by t)
    from jsonb_object_keys(public.delta(now())) as t
    where t <> 'cursor'
      and not exists (
        select 1 from pg_trigger g
        where g.tgrelid = ('public.' || t)::regclass
          and g.tgname = 'avisar_los_cambios'
          and not g.tgisinternal
      )
  ),
  null,
  'toda tabla que viaja en el delta avisa sus cambios'
);

select ok(
  (select count(*) from jsonb_object_keys(public.delta(now())) as t where t <> 'cursor') > 0,
  'y el delta tiene tablas: la comparación de arriba no es vacía'
);

select ok(
  (select prosecdef from pg_proc where oid = 'private.avisar_los_cambios()'::regprocedure),
  'el trigger escribe el aviso como dueño: authenticated y anon no tienen insert en realtime.messages'
);


-- El espía ---------------------------------------------------------------------------------------------

create table tests.avisos (orden bigint generated always as identity, household uuid);

create or replace function private.mandar_el_aviso_de_cambios(p_household uuid)
returns void
language sql
set search_path = ''
as $$
  insert into tests.avisos (household) values (p_household)
$$;

create function tests.avisos_y_de_nuevo()
returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_avisos uuid[];
begin
  select coalesce(array_agg(household order by orden), array[]::uuid[]) into v_avisos from tests.avisos;
  delete from tests.avisos;
  perform set_config('maun.cambios_avisados', '', true);
  return v_avisos;
end;
$$;

grant execute on function tests.avisos_y_de_nuevo() to anon, authenticated;

select tests.avisos_y_de_nuevo();


-- Uno por transacción y por taller ---------------------------------------------------------------------

select tests.entrar_como(tests.id('a'));
insert into public.clientes (id, nombre) values ('aaaaaaaa-0000-7000-8000-000000000001', 'Lucía');
insert into public.clientes (id, nombre) values ('aaaaaaaa-0000-7000-8000-000000000002', 'Marcos');
update public.clientes set nombre = 'Lucía Pérez' where id = 'aaaaaaaa-0000-7000-8000-000000000001';
insert into public.anotaciones (fecha, texto) values ('2026-09-23', 'Comprar melamina');

select is(
  tests.avisos_y_de_nuevo(),
  array[tests.id('household_a')],
  'cuatro escrituras en dos tablas, en la misma transacción, mandan un solo aviso al canal de su taller'
);

update public.anotaciones set hecha = true where texto = 'Comprar melamina';

select is(
  tests.avisos_y_de_nuevo(),
  array[tests.id('household_a')],
  'la transacción siguiente vuelve a avisar'
);

select tests.entrar_como(tests.id('b'));
insert into public.clientes (id, nombre) values ('bbbbbbbb-0000-7000-8000-000000000001', 'Rocío');

select is(
  tests.avisos_y_de_nuevo(),
  array[tests.id('household_b')],
  'lo que escribe otro taller avisa en el canal de ese taller'
);

select tests.salir();
update public.clientes set notas = 'mismo lote'
where id in ('aaaaaaaa-0000-7000-8000-000000000002', 'bbbbbbbb-0000-7000-8000-000000000001');

select is(
  (select array_agg(h order by h) from unnest(tests.avisos_y_de_nuevo()) as h),
  (select array_agg(h order by h) from unnest(array[tests.id('household_a'), tests.id('household_b')]) as h),
  'una transacción que toca dos talleres avisa a cada uno una vez'
);

delete from public.anotaciones
where household_id = tests.id('household_a') and texto = 'Comprar melamina';

select is(
  tests.avisos_y_de_nuevo(),
  array[tests.id('household_a')],
  'un borrado de verdad también avisa, con el taller de la fila que se fue'
);

update public.households set nombre = 'Taller A renombrado' where id = tests.id('household_a');

select is(
  tests.avisos_y_de_nuevo(),
  array[tests.id('household_a')],
  'en households el taller es la fila misma'
);

select tests.entrar_como(tests.id('a'));
select public.guardar_proyecto(
  jsonb_build_object(
    'id', 'aaaaaaaa-0000-7000-8000-000000000010', 'version', null,
    'cliente_id', 'aaaaaaaa-0000-7000-8000-000000000001', 'titulo', 'Placard',
    'estado', 'en_curso', 'comprobante', 'sin_comprobante', 'presupuesto_centavos', 90000000
  ),
  jsonb_build_array(jsonb_build_object(
    'id', 'aaaaaaaa-0000-7000-8000-000000000011', 'fecha', '2026-09-01', 'concepto', 'Seña',
    'monto_centavos', 30000000, 'borrado', false
  )),
  '[]'::jsonb
);

select is(
  tests.avisos_y_de_nuevo(),
  array[tests.id('household_a')],
  'guardar un trabajo con sus pagos, que escribe en varias tablas, avisa una vez'
);

select tests.salir();


-- Quién escucha el canal ------------------------------------------------------------------------------

select tests.entrar_como(tests.id('a'));

select ok(
  private.es_el_canal_de_mi_taller('cambios:' || tests.id('household_a')),
  'el dueño escucha el canal de su taller'
);

select ok(
  not private.es_el_canal_de_mi_taller('cambios:' || tests.id('household_b')),
  'y no el de otro taller'
);

select ok(
  not private.es_el_canal_de_mi_taller(tests.id('household_a')::text),
  'ni un canal con otro nombre'
);

select ok(
  not private.es_el_canal_de_mi_taller(null),
  'ni un pedido sin canal'
);

select tests.entrar_como(tests.id('b'));

select ok(
  private.es_el_canal_de_mi_taller('cambios:' || tests.id('household_b')),
  'el otro taller escucha el suyo'
);

select ok(
  not private.es_el_canal_de_mi_taller('cambios:' || tests.id('household_a')),
  'y no el del primero'
);

select tests.entrar_como_anon();

select throws_ok(
  $$ select private.es_el_canal_de_mi_taller('cambios:00000000-0000-0000-0000-000000000000') $$,
  '42501',
  null,
  'anon no puede ni preguntar por un canal'
);

select tests.salir();

select is(
  (
    select format('%s %s %s', cmd, array_to_string(roles, ','), permissive)
    from pg_policies
    where schemaname = 'realtime' and tablename = 'messages' and policyname = 'cambios_del_taller_escucha'
  ),
  'SELECT authenticated PERMISSIVE',
  'la lectura de los mensajes es solo para authenticated'
);

select ok(
  (
    select qual like '%es_el_canal_de_mi_taller%' and qual like '%realtime.topic()%' and qual like '%broadcast%'
    from pg_policies
    where schemaname = 'realtime' and tablename = 'messages' and policyname = 'cambios_del_taller_escucha'
  ),
  'y pasa por el canal que se pide y el taller del usuario, solo para broadcast'
);

select is(
  (
    select count(*) from pg_policies
    where schemaname = 'realtime' and tablename = 'messages' and roles && array['anon', 'public']::name[]
  ),
  0::bigint,
  'anon no tiene ninguna política sobre los mensajes'
);


-- anon no gana nada -----------------------------------------------------------------------------------

select ok(
  not has_function_privilege('anon', 'private.avisar_los_cambios()', 'execute')
    and not has_function_privilege('authenticated', 'private.avisar_los_cambios()', 'execute'),
  'nadie de la API ejecuta el trigger por su cuenta'
);

select ok(
  not has_function_privilege('anon', 'private.mandar_el_aviso_de_cambios(uuid)', 'execute')
    and not has_function_privilege('authenticated', 'private.mandar_el_aviso_de_cambios(uuid)', 'execute'),
  'ni manda avisos a mano'
);

select ok(
  not has_function_privilege('anon', 'private.es_el_canal_de_mi_taller(text)', 'execute')
    and has_function_privilege('authenticated', 'private.es_el_canal_de_mi_taller(text)', 'execute'),
  'la pregunta por el canal es de authenticated, que la necesita para la política, y no de anon'
);

select * from finish();
