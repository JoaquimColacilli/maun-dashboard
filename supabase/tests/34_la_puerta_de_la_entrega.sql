-- La puerta de la entrega (ADR 0071): lo que el dueño le propone al cliente y lo que el cliente
-- contesta desde su página, sin sesión. responder_la_entrega es la quinta función que ejecuta anon, y
-- sigue las reglas de la encuesta (ADR 0057): el enlace con su huella, un MN010 igual para todo lo que
-- no sirve, la validación entera en la base con el motivo en el detail, el reenvío que no duplica y
-- solo {estado} de vuelta.
--
-- Hoy en el taller es el viernes 25 de septiembre de 2026: se pueden elegir días del lunes 28 (el
-- domingo 27 no) al sábado 24 de octubre.

select plan(56);

select set_config('maun.hoy_en_el_taller', '2026-09-25', true);

select tests.guardar('ana', tests.crear_usuario('ana@maun.test'));
select tests.guardar('household_a', private.crear_household('Taller de Ana', tests.id('ana')));
select tests.guardar('beto', tests.crear_usuario('beto@maun.test'));
select tests.guardar('household_b', private.crear_household('Taller de Beto', tests.id('beto')));

create function tests.rechazo(p_sql text)
returns text
language plpgsql
as $$
declare
  v_estado text;
  v_detalle text;
  v_mensaje text;
begin
  execute p_sql;
  return 'ok';
exception
  when others then
    get stacked diagnostics
      v_estado = returned_sqlstate,
      v_detalle = pg_exception_detail,
      v_mensaje = message_text;
    return v_estado || ' ' || coalesce(nullif(v_detalle, ''), '-') || ': ' || v_mensaje;
end;
$$;

create function tests.mis_dias(p_id text, p_propuesta text, p_dias jsonb, p_nota text default '')
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'id', p_id, 'propuesta_id', p_propuesta, 'respuesta', 'mis_dias', 'dias', p_dias, 'nota', p_nota
  )
$$;

create function tests.me_queda_bien(p_id text, p_propuesta text)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'id', p_id, 'propuesta_id', p_propuesta, 'respuesta', 'me_queda_bien', 'dias', '[]'::jsonb, 'nota', ''
  )
$$;

create function tests.respuestas_de(p_proyecto uuid)
returns integer
language sql
security definer
set search_path = ''
as $$
  select count(*)::integer from public.respuestas_de_entrega where proyecto_id = p_proyecto
$$;

-- Lo que haría la puerta si no corriera las guardas diferidas antes de volver: fijar la comprometida
-- como dueño de la función y devolverle la transacción a anon con el chequeo pendiente.
create function tests.comprometer_sin_correr_las_guardas(p_proyecto uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.proyectos set entrega_comprometida = '2026-10-02' where id = p_proyecto
$$;

grant execute on all functions in schema tests to anon, authenticated;


-- Los trabajos de Ana ---------------------------------------------------------------------------------------

select tests.entrar_como(tests.id('ana'));

insert into public.clientes (id, nombre) values ('aaaaaaaa-0000-7000-8000-000000000001', 'Cintia Rodríguez');

insert into public.proyectos (id, cliente_id, titulo, estado, listo_el) values
  ('aaaaaaaa-0000-7000-8000-000000000010', 'aaaaaaaa-0000-7000-8000-000000000001', 'Cocina en L', 'en_curso', '2026-09-24'),
  ('aaaaaaaa-0000-7000-8000-000000000011', 'aaaaaaaa-0000-7000-8000-000000000001', 'Rack', 'en_curso', '2026-09-24'),
  ('aaaaaaaa-0000-7000-8000-000000000012', 'aaaaaaaa-0000-7000-8000-000000000001', 'Mesa', 'en_curso', '2026-09-24'),
  ('aaaaaaaa-0000-7000-8000-000000000013', 'aaaaaaaa-0000-7000-8000-000000000001', 'Banco', 'en_curso', '2026-09-24'),
  ('aaaaaaaa-0000-7000-8000-000000000020', 'aaaaaaaa-0000-7000-8000-000000000001', 'Vestidor', 'en_curso', '2026-09-24'),
  ('aaaaaaaa-0000-7000-8000-000000000030', 'aaaaaaaa-0000-7000-8000-000000000001', 'Biblioteca', 'en_curso', '2026-09-24'),
  ('aaaaaaaa-0000-7000-8000-000000000040', 'aaaaaaaa-0000-7000-8000-000000000001', 'Escritorio', 'en_curso', null),
  ('aaaaaaaa-0000-7000-8000-000000000050', 'aaaaaaaa-0000-7000-8000-000000000001', 'Alacena', 'en_curso', null);

insert into public.enlaces_publicos (proyecto_id, token_hash, token)
select e.proyecto_id::uuid, encode(sha256(convert_to(e.token, 'UTF8')), 'hex'), e.token
from (values
  ('aaaaaaaa-0000-7000-8000-000000000010', 'el-token-de-la-cocina-de-cintia'),
  ('aaaaaaaa-0000-7000-8000-000000000011', 'el-token-dado-de-baja-00000'),
  ('aaaaaaaa-0000-7000-8000-000000000012', 'el-token-de-un-borrado-0000'),
  ('aaaaaaaa-0000-7000-8000-000000000013', 'el-token-de-un-perdido-0000'),
  ('aaaaaaaa-0000-7000-8000-000000000020', 'el-token-del-vestidor-00000')
) as e (proyecto_id, token);

insert into public.propuestas_de_entrega (id, proyecto_id, forma, fecha, franja) values
  ('aaaaaaaa-0000-7000-8000-000000000100', 'aaaaaaaa-0000-7000-8000-000000000010', 'un_dia', '2026-10-01', 'manana'),
  ('aaaaaaaa-0000-7000-8000-000000000200', 'aaaaaaaa-0000-7000-8000-000000000020', 'sus_dias', null, null);

update public.enlaces_publicos set revocado_at = now() where proyecto_id = 'aaaaaaaa-0000-7000-8000-000000000011';
update public.proyectos set deleted_at = now() where id = 'aaaaaaaa-0000-7000-8000-000000000012';
select public.cerrar_perdido(
  'aaaaaaaa-0000-7000-8000-000000000013',
  (select version from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000013'),
  '2026-09-24', 0, 0, 0, 0, 0, 0, 0, 0, 1000
);

select set_config(
  'tests.version_de_la_cocina',
  (select version::text from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000010'),
  true
);


-- El enlace que no sirve ----------------------------------------------------------------------------------

select tests.entrar_como_anon();

select is(
  array[
    tests.rechazo($$ select public.responder_la_entrega('no sirve', '{}') $$),
    tests.rechazo($$ select public.responder_la_entrega('un-token-que-no-existe-0000', '{}') $$),
    tests.rechazo($$ select public.responder_la_entrega('el-token-dado-de-baja-00000', '{}') $$),
    tests.rechazo($$ select public.responder_la_entrega('el-token-de-un-borrado-0000', '{}') $$),
    tests.rechazo($$ select public.responder_la_entrega('el-token-de-un-perdido-0000', '{}') $$)
  ],
  array_fill('MN010 -: Este link no funciona'::text, array[5]),
  'un token mal formado, uno que no existe, uno dado de baja, uno de un trabajo borrado y uno de un perdido: la misma frase, antes de mirar la respuesta'
);


-- Lo que no cumple se rechaza entero --------------------------------------------------------------------------

select is(
  tests.rechazo($$ select public.responder_la_entrega('el-token-de-la-cocina-de-cintia', '[]') $$),
  'MN020 forma: La respuesta no tiene la forma que espera la página',
  'una respuesta que no es un objeto'
);

select is(
  tests.rechazo($$
    select public.responder_la_entrega('el-token-de-la-cocina-de-cintia',
      tests.mis_dias('no-es-un-id', 'aaaaaaaa-0000-7000-8000-000000000100', '[]'))
  $$),
  'MN020 forma: La respuesta no tiene la forma que espera la página',
  'ni una sin un id que sirva'
);

select is(
  tests.rechazo(format(
    $$ select public.responder_la_entrega('el-token-de-la-cocina-de-cintia', %L) $$,
    tests.mis_dias('aaaaaaaa-0000-7000-8000-000000000901', 'aaaaaaaa-0000-7000-8000-000000000100',
                   '[]', repeat('a', 20000))
  )),
  'MN020 forma: La respuesta no tiene la forma que espera la página',
  'ni una más grande de lo que puede ser'
);

select is(
  tests.rechazo($$
    select public.responder_la_entrega('el-token-de-la-cocina-de-cintia',
      tests.mis_dias('aaaaaaaa-0000-7000-8000-000000000901', 'aaaaaaaa-0000-7000-8000-000000000100', '[]', '  '))
  $$),
  'MN020 vacia: Falta al menos un día, o una nota con cuándo te queda bien',
  'sus días sin un día ni una nota'
);

select is(
  tests.rechazo(format(
    $$ select public.responder_la_entrega('el-token-de-la-cocina-de-cintia', %L) $$,
    tests.mis_dias('aaaaaaaa-0000-7000-8000-000000000901', 'aaaaaaaa-0000-7000-8000-000000000100',
      (select jsonb_agg(jsonb_build_object('fecha', d::date::text, 'franjas', jsonb_build_array('manana')))
       from generate_series('2026-10-05'::date, '2026-10-16'::date, interval '1 day') as d
       where extract(isodow from d) <> 7))
  )),
  'MN020 demasiados: Son más de diez días',
  'más de diez días'
);

select is(
  tests.rechazo($$
    select public.responder_la_entrega('el-token-de-la-cocina-de-cintia',
      tests.mis_dias('aaaaaaaa-0000-7000-8000-000000000901', 'aaaaaaaa-0000-7000-8000-000000000100',
        '[{"fecha": "2026-09-29", "franjas": ["manana"]}, {"fecha": "2026-09-29", "franjas": ["tarde"]}]'))
  $$),
  'MN020 repetido: Vino dos veces el mismo día',
  'el mismo día dos veces'
);

select is(
  tests.rechazo($$
    select public.responder_la_entrega('el-token-de-la-cocina-de-cintia',
      tests.mis_dias('aaaaaaaa-0000-7000-8000-000000000901', 'aaaaaaaa-0000-7000-8000-000000000100',
        '[{"fecha": "2026-09-26", "franjas": ["manana"]}]'))
  $$),
  'MN020 fuera: Un día está fuera de los que se pueden elegir',
  'mañana es demasiado pronto: desde pasado mañana'
);

select is(
  tests.rechazo($$
    select public.responder_la_entrega('el-token-de-la-cocina-de-cintia',
      tests.mis_dias('aaaaaaaa-0000-7000-8000-000000000901', 'aaaaaaaa-0000-7000-8000-000000000100',
        '[{"fecha": "2026-10-26", "franjas": ["manana"]}]'))
  $$),
  'MN020 fuera: Un día está fuera de los que se pueden elegir',
  'y dentro de 31 días, demasiado tarde'
);

select is(
  tests.rechazo($$
    select public.responder_la_entrega('el-token-de-la-cocina-de-cintia',
      tests.mis_dias('aaaaaaaa-0000-7000-8000-000000000901', 'aaaaaaaa-0000-7000-8000-000000000100',
        '[{"fecha": "2026-09-27", "franjas": ["manana"]}]'))
  $$),
  'MN020 domingo: Los domingos no se entrega',
  'un domingo'
);

select is(
  tests.rechazo($$
    select public.responder_la_entrega('el-token-de-la-cocina-de-cintia',
      tests.mis_dias('aaaaaaaa-0000-7000-8000-000000000901', 'aaaaaaaa-0000-7000-8000-000000000100',
        '[{"fecha": "2026-09-29", "franjas": ["noche"]}]'))
  $$),
  'MN020 franja: Un día no tiene bien marcada la mañana o la tarde',
  'una franja que no es la mañana ni la tarde'
);

select is(
  tests.rechazo(format(
    $$ select public.responder_la_entrega('el-token-de-la-cocina-de-cintia', %L) $$,
    tests.mis_dias('aaaaaaaa-0000-7000-8000-000000000901', 'aaaaaaaa-0000-7000-8000-000000000100',
                   '[{"fecha": "2026-09-29", "franjas": ["manana"]}]', repeat('a', 501))
  )),
  'MN020 largo: La nota pasa de los 500 caracteres',
  'una nota de más de 500 caracteres'
);

select is(
  tests.rechazo($$
    select public.responder_la_entrega('el-token-del-vestidor-00000',
      tests.me_queda_bien('aaaaaaaa-0000-7000-8000-000000000901', 'aaaaaaaa-0000-7000-8000-000000000200'))
  $$),
  'MN020 propuesta: Ese día no se puede aceptar: el taller te pidió tus días',
  '«me queda bien» cuando el taller le pidió sus días'
);

select is(
  tests.respuestas_de('aaaaaaaa-0000-7000-8000-000000000010') + tests.respuestas_de('aaaaaaaa-0000-7000-8000-000000000020'),
  0,
  'después de cada rechazo no quedó nada guardado'
);


-- Lo que sirve se guarda ------------------------------------------------------------------------------------

select is(
  public.responder_la_entrega(
    'el-token-de-la-cocina-de-cintia',
    tests.mis_dias(
      'aaaaaaaa-0000-7000-8000-000000000901', 'aaaaaaaa-0000-7000-8000-000000000100',
      '[{"fecha": "2026-10-02", "franjas": ["tarde", "manana"]}, {"fecha": "2026-09-29", "franjas": ["tarde"]}]',
      E'  Tercer piso, sin ascensor.\n'
    )
  ),
  '{"estado": "guardada"}'::jsonb,
  'no puede ese día y pasa los suyos: se guarda, y lo único que vuelve es el estado'
);

select tests.salir();

select is(
  (
    select jsonb_build_object('respuesta', r.respuesta, 'dias', r.dias, 'nota', r.nota)
    from public.respuestas_de_entrega r where r.id = 'aaaaaaaa-0000-7000-8000-000000000901'
  ),
  '{"respuesta": "mis_dias", "dias": [{"fecha": "2026-09-29", "franjas": ["tarde"]}, {"fecha": "2026-10-02", "franjas": ["manana", "tarde"]}], "nota": "Tercer piso, sin ascensor."}'::jsonb,
  'los días quedan en orden, la mañana antes que la tarde, y la nota sin los blancos de las puntas'
);

select is(
  (select household_id from public.respuestas_de_entrega where id = 'aaaaaaaa-0000-7000-8000-000000000901'),
  tests.id('household_a'),
  'con el taller del enlace'
);

select tests.entrar_como_anon();

select is(
  public.responder_la_entrega(
    'el-token-de-la-cocina-de-cintia',
    tests.mis_dias(
      'aaaaaaaa-0000-7000-8000-000000000901', 'aaaaaaaa-0000-7000-8000-000000000100',
      '[{"fecha": "2026-10-02", "franjas": ["tarde", "manana"]}, {"fecha": "2026-09-29", "franjas": ["tarde"]}]',
      E'  Tercer piso, sin ascensor.\n'
    )
  ),
  '{"estado": "guardada"}'::jsonb,
  'el mismo envío que vuelve porque se perdió la respuesta contesta lo mismo'
);

select is(tests.respuestas_de('aaaaaaaa-0000-7000-8000-000000000010'), 1, 'y no duplica');

select is(
  public.responder_la_entrega(
    'el-token-de-la-cocina-de-cintia',
    tests.mis_dias('aaaaaaaa-0000-7000-8000-000000000902', 'aaaaaaaa-0000-7000-8000-000000000100',
                   '[{"fecha": "2026-10-05", "franjas": ["manana"]}]')
  ),
  '{"estado": "guardada"}'::jsonb,
  'puede cambiar sus días: otro envío también se guarda'
);

select is(
  public.vista_compartida('el-token-de-la-cocina-de-cintia') #> '{entrega,respuesta}',
  '{"respuesta": "mis_dias", "dias": [{"fecha": "2026-10-05", "franjas": ["manana"]}], "nota": ""}'::jsonb,
  'y su página le muestra lo último que mandó'
);


-- Cuando el taller cambió lo que le pedía ------------------------------------------------------------------

select is(
  public.responder_la_entrega(
    'el-token-de-la-cocina-de-cintia',
    tests.mis_dias('aaaaaaaa-0000-7000-8000-000000000903', 'aaaaaaaa-0000-7000-8000-000000000999',
                   '[{"fecha": "2026-10-05", "franjas": ["manana"]}]')
  ),
  '{"estado": "cambio"}'::jsonb,
  'le contesta a una propuesta que no es la abierta: cambió lo que se le pedía'
);

select set_config('maun.hoy_en_el_taller', '2026-10-02', true);

select is(
  public.responder_la_entrega(
    'el-token-de-la-cocina-de-cintia',
    tests.me_queda_bien('aaaaaaaa-0000-7000-8000-000000000903', 'aaaaaaaa-0000-7000-8000-000000000100')
  ),
  '{"estado": "cambio"}'::jsonb,
  'o acepta un día que ya pasó'
);

select set_config('maun.hoy_en_el_taller', '2026-09-25', true);

select is(tests.respuestas_de('aaaaaaaa-0000-7000-8000-000000000010'), 2, 'y ninguna de las dos se guardó');


-- «Me queda bien» compromete la entrega ------------------------------------------------------------------------

select is(
  public.responder_la_entrega(
    'el-token-de-la-cocina-de-cintia',
    tests.me_queda_bien('aaaaaaaa-0000-7000-8000-000000000904', 'aaaaaaaa-0000-7000-8000-000000000100')
  ),
  '{"estado": "guardada"}'::jsonb,
  'acepta el día propuesto'
);

select lives_ok(
  $$ set constraints all immediate; set constraints all deferred $$,
  'y todavía como anon, las guardas diferidas no tienen nada pendiente: la puerta ya las corrió como dueña'
);

select tests.salir();

select is(
  (
    select array[p.entrega_comprometida::text, p.entrega_comprometida_franja::text]
    from public.proyectos p where p.id = 'aaaaaaaa-0000-7000-8000-000000000010'
  ),
  array['2026-10-01', 'manana'],
  'la entrega queda comprometida con el día y la franja de la propuesta'
);

select is(
  (
    select array[c.origen::text, c.fecha::text, c.franja::text]
    from public.cambios_de_fecha c
    where c.proyecto_id = 'aaaaaaaa-0000-7000-8000-000000000010' and c.tipo = 'comprometida'
  ),
  array['cliente', '2026-10-01', 'manana'],
  'y la historia dice que la fijó el cliente'
);

select is(
  current_setting('maun.origen_de_la_fecha', true),
  '',
  'la marca del origen vuelve a vacío: lo que escriba después la misma transacción es del taller'
);

select is(
  (select version from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000010'),
  current_setting('tests.version_de_la_cocina')::integer + 1,
  'aceptar el día le sube la versión al trabajo, una sola vez'
);

select tests.entrar_como(tests.id('ana'));

select throws_ok(
  format(
    $$ select public.guardar_proyecto(%L::jsonb, '[]', '[]') $$,
    jsonb_build_object(
      'id', 'aaaaaaaa-0000-7000-8000-000000000010',
      'version', current_setting('tests.version_de_la_cocina')::integer,
      'cliente_id', 'aaaaaaaa-0000-7000-8000-000000000001', 'titulo', 'Cocina en L con isla',
      'estado', 'en_curso', 'comprobante', 'sin_comprobante'
    )
  ),
  'MN006',
  null,
  'así que un guardado del dueño que esperaba en la cola con la versión de antes rebota'
);

select tests.salir();

select is(
  (
    select cerrada_at is not null from public.propuestas_de_entrega
    where id = 'aaaaaaaa-0000-7000-8000-000000000100'
  ),
  true,
  'la propuesta queda cerrada: ya no hay nada que contestar'
);

select tests.entrar_como_anon();

select is(
  public.vista_compartida('el-token-de-la-cocina-de-cintia') -> 'entrega',
  '{"comprometida": {"fecha": "2026-10-01", "franja": "manana"}, "propuesta": null, "respuesta": null}'::jsonb,
  'su página ya dice la comprometida'
);

select is(
  public.responder_la_entrega(
    'el-token-de-la-cocina-de-cintia',
    tests.mis_dias('aaaaaaaa-0000-7000-8000-000000000905', 'aaaaaaaa-0000-7000-8000-000000000100',
                   '[{"fecha": "2026-10-05", "franjas": ["manana"]}]')
  ),
  '{"estado": "ya_confirmada"}'::jsonb,
  'con la entrega comprometida, cualquier otra respuesta contesta que ya está confirmada'
);

select is(
  public.responder_la_entrega(
    'el-token-de-la-cocina-de-cintia',
    tests.me_queda_bien('aaaaaaaa-0000-7000-8000-000000000904', 'aaaaaaaa-0000-7000-8000-000000000100')
  ),
  '{"estado": "guardada"}'::jsonb,
  'salvo el mismo «me queda bien» que vuelve: ese ya está guardado'
);


-- El tope --------------------------------------------------------------------------------------------------

select is(
  tests.rechazo($$
    select public.responder_la_entrega('el-token-del-vestidor-00000',
      tests.mis_dias('aaaaaaaa-0000-7000-8000-000000000904', 'aaaaaaaa-0000-7000-8000-000000000200',
        '[{"fecha": "2026-09-30", "franjas": ["tarde"]}]'))
  $$),
  'MN020 forma: La respuesta no tiene la forma que espera la página',
  'un id que ya es de otra respuesta no se pisa'
);

select tests.salir();

insert into public.respuestas_de_entrega (household_id, proyecto_id, propuesta_id, respuesta, dias)
select tests.id('household_a'), 'aaaaaaaa-0000-7000-8000-000000000020', 'aaaaaaaa-0000-7000-8000-000000000200',
       'mis_dias', '[{"fecha": "2026-09-29", "franjas": ["manana"]}]'
from generate_series(1, 19);

select tests.entrar_como_anon();

select is(
  public.responder_la_entrega(
    'el-token-del-vestidor-00000',
    tests.mis_dias('aaaaaaaa-0000-7000-8000-000000000920', 'aaaaaaaa-0000-7000-8000-000000000200',
                   '[{"fecha": "2026-09-30", "franjas": ["tarde"]}]')
  ),
  '{"estado": "guardada"}'::jsonb,
  'la vigésima respuesta a una misma propuesta todavía entra'
);

select is(
  tests.rechazo($$
    select public.responder_la_entrega('el-token-del-vestidor-00000',
      tests.mis_dias('aaaaaaaa-0000-7000-8000-000000000921', 'aaaaaaaa-0000-7000-8000-000000000200',
        '[{"fecha": "2026-09-30", "franjas": ["tarde"]}]'))
  $$),
  'MN020 tope: Ya contestaste demasiadas veces a este pedido',
  'la vigesimoprimera no'
);


-- Solo el rol anónimo contesta -------------------------------------------------------------------------------

select tests.entrar_como(tests.id('ana'));

select is(
  tests.rechazo($$ select public.responder_la_entrega('el-token-del-vestidor-00000', '{}') $$),
  '42501 -: permission denied for function responder_la_entrega',
  'el dueño con su sesión no contesta por esta puerta: la página pública pregunta siempre como anónima'
);

select ok(
  (
    select p.prosecdef and not has_function_privilege('authenticated', p.oid, 'EXECUTE')
      and has_function_privilege('anon', p.oid, 'EXECUTE')
    from pg_proc p where p.oid = 'public.responder_la_entrega(text, jsonb)'::regprocedure
  ),
  'corre elevada, la ejecuta anon y no la ejecuta authenticated'
);

select is_empty(
  $$
    select c.conname
    from pg_constraint c
    where c.connamespace = 'public'::regnamespace and c.condeferrable and not c.condeferred
  $$,
  'toda constraint diferible de public nace diferida: devolverlas a diferidas al salir de la puerta deja la transacción como estaba'
);


-- Lo que propone el dueño ---------------------------------------------------------------------------------------

select is(
  public.proponer_la_entrega(
    'aaaaaaaa-0000-7000-8000-000000000030',
    '{"id": "aaaaaaaa-0000-7000-8000-000000000300", "forma": "un_dia", "fecha": "2026-10-05", "franja": "tarde"}'
  ) #>> '{propuestas,0,id}',
  'aaaaaaaa-0000-7000-8000-000000000300',
  'propone un día y le vuelve la fila, para aplicarla a su réplica'
);

select is(
  (
    select array_agg(e ->> 'id' order by e ->> 'id')
    from jsonb_array_elements(
      public.proponer_la_entrega(
        'aaaaaaaa-0000-7000-8000-000000000030',
        '{"id": "aaaaaaaa-0000-7000-8000-000000000301", "forma": "sus_dias", "fecha": "", "franja": ""}'
      ) -> 'propuestas'
    ) as e
  ),
  array['aaaaaaaa-0000-7000-8000-000000000300', 'aaaaaaaa-0000-7000-8000-000000000301'],
  'pedirle sus días cierra el día propuesto y abre lo nuevo, y le vuelven las dos'
);

select is(
  (select id from public.propuestas_de_entrega where proyecto_id = 'aaaaaaaa-0000-7000-8000-000000000030' and cerrada_at is null),
  'aaaaaaaa-0000-7000-8000-000000000301'::uuid,
  'queda abierta la última'
);

select is(
  jsonb_array_length(
    public.proponer_la_entrega(
      'aaaaaaaa-0000-7000-8000-000000000030',
      '{"id": "aaaaaaaa-0000-7000-8000-000000000301", "forma": "sus_dias"}'
    ) -> 'propuestas'
  ),
  1,
  'el mismo pedido otra vez contesta el que ya está'
);

select is(
  (select count(*)::int from public.propuestas_de_entrega where proyecto_id = 'aaaaaaaa-0000-7000-8000-000000000030'),
  2,
  'sin abrir otra ni cerrar nada'
);

select is(
  jsonb_array_length(public.proponer_la_entrega('aaaaaaaa-0000-7000-8000-000000000030', null) -> 'propuestas'),
  1,
  'sin propuesta, solo cierra la abierta'
);

select is(
  (select count(*)::int from public.propuestas_de_entrega where proyecto_id = 'aaaaaaaa-0000-7000-8000-000000000030' and cerrada_at is null),
  0,
  'y no queda ninguna abierta'
);

select is(
  tests.rechazo($$
    select public.proponer_la_entrega('aaaaaaaa-0000-7000-8000-000000000040',
      '{"id": "aaaaaaaa-0000-7000-8000-000000000400", "forma": "sus_dias"}')
  $$),
  'MN021 sin_listo: La entrega se coordina con el mueble listo',
  'a un mueble que no está listo no se le propone la entrega'
);

select is(
  tests.rechazo($$
    select public.proponer_la_entrega('aaaaaaaa-0000-7000-8000-000000000030',
      '{"id": "aaaaaaaa-0000-7000-8000-000000000302", "forma": "un_dia", "fecha": "2026-09-25"}')
  $$),
  'MN021 fecha: El día que le proponés tiene que ser desde mañana',
  'ni un día que no es desde mañana'
);

select is(
  tests.rechazo($$ select public.proponer_la_entrega('aaaaaaaa-0000-7000-8000-000000000030', '[]') $$),
  '22023 -: La propuesta va en un objeto jsonb',
  'la propuesta va en un objeto'
);

select tests.entrar_como(tests.id('beto'));

select is(
  tests.rechazo($$ select public.proponer_la_entrega('aaaaaaaa-0000-7000-8000-000000000030', null) $$),
  '42501 -: El proyecto no existe o no es tuyo',
  'Beto no le toca la entrega a un trabajo de Ana: para él no existe'
);

select tests.entrar_como(tests.id('ana'));

select is(
  (select count(*)::int from public.propuestas_de_entrega where proyecto_id = 'aaaaaaaa-0000-7000-8000-000000000030' and cerrada_at is null),
  0,
  'y lo de Ana queda como estaba'
);


-- Lo que el dueño no toca de lo que contestó el cliente --------------------------------------------------------

select is(
  tests.rechazo($$
    update public.respuestas_de_entrega set dias = '[]' where id = 'aaaaaaaa-0000-7000-8000-000000000901'
  $$),
  '42501 -: permission denied for table respuestas_de_entrega',
  'el dueño no cambia los días que mandó el cliente'
);

select is(
  tests.rechazo($$
    update public.respuestas_de_entrega set leida_at = now() where id = 'aaaaaaaa-0000-7000-8000-000000000901'
  $$),
  'ok',
  'solo marca que la leyó'
);


-- Sin correr las guardas adentro, la puerta cortaría ----------------------------------------------------------------

-- Lo que pasaría si responder_la_entrega no corriera las guardas diferidas antes de volver: el
-- chequeo del presupuesto (presupuesto_aprobado) queda pendiente, y al commit correría como anon, que
-- no puede leer proyectos. El commit se adelanta con set constraints all immediate.
select tests.entrar_como_anon();
select tests.comprometer_sin_correr_las_guardas('aaaaaaaa-0000-7000-8000-000000000050');

select throws_ok(
  $$ set constraints all immediate $$,
  '42501',
  null,
  'sin el set constraints de la puerta, la guarda diferida corre como anon y corta con 42501'
);

select * from finish();
