-- Las opiniones, del lado del dueño (ADR 0057): la encuesta que nace escrita, las versiones de una
-- pregunta, lo que se manda a cada trabajo con su foto, el recordatorio y la baja, las preguntas
-- propias de un trabajo y lo que el dueño puede y no puede escribir. Lo que hace el cliente sin
-- sesión, por su enlace, está en 27_encuesta_publica.sql.

select plan(49);

select tests.guardar('ana', tests.crear_usuario('ana@maun.test'));
select tests.guardar('household_a', private.crear_household('Taller de Ana', tests.id('ana')));
select tests.guardar('beto', tests.crear_usuario('beto@maun.test'));
select tests.guardar('household_b', private.crear_household('Taller de Beto', tests.id('beto')));

select tests.guardar('q_conforme', (select id from public.preguntas where household_id = tests.id('household_a') and orden = 10));
select tests.guardar('q_tiempos', (select id from public.preguntas where household_id = tests.id('household_a') and orden = 20));
select tests.guardar('q_trato', (select id from public.preguntas where household_id = tests.id('household_a') and orden = 30));
select tests.guardar('q_recomienda', (select id from public.preguntas where household_id = tests.id('household_a') and orden = 40));
select tests.guardar('q_mejor', (select id from public.preguntas where household_id = tests.id('household_a') and orden = 50));

select tests.entrar_como(tests.id('beto'));
insert into public.clientes (id, nombre) values ('bbbbbbbb-0000-7000-8000-000000000001', 'Cliente de Beto');
insert into public.proyectos (id, cliente_id, titulo, estado)
  values ('bbbbbbbb-0000-7000-8000-000000000010', 'bbbbbbbb-0000-7000-8000-000000000001', 'Trabajo de Beto', 'entregado');

select tests.entrar_como(tests.id('ana'));
insert into public.clientes (id, nombre) values ('aaaaaaaa-0000-7000-8000-000000000001', 'Marcela Duarte');
insert into public.proyectos (id, cliente_id, titulo, estado) values
  ('aaaaaaaa-0000-7000-8000-000000000010', 'aaaaaaaa-0000-7000-8000-000000000001', 'Placard 3 puertas', 'entregado'),
  ('aaaaaaaa-0000-7000-8000-000000000011', 'aaaaaaaa-0000-7000-8000-000000000001', 'Vanitory', 'en_curso'),
  ('aaaaaaaa-0000-7000-8000-000000000012', 'aaaaaaaa-0000-7000-8000-000000000001', 'Biblioteca', 'entregado');


-- La encuesta nace escrita ---------------------------------------------------------------------------

select is(
  (select count(*)::int from public.preguntas where proyecto_id is null),
  5,
  'Ana ve las cinco preguntas de su encuesta, y ninguna de la de Beto'
);

select ok(
  (select bool_and(numero = 1 and serie = id and archivada_at is null) from public.preguntas),
  'cada una es la primera versión de su serie, y ninguna está archivada'
);


-- Lo que el dueño no escribe ---------------------------------------------------------------------------

select throws_ok(
  $$
    insert into public.preguntas (id, serie, orden, texto, tipo, titular)
    values ('aaaaaaaa-0000-7000-8000-000000000101', 'aaaaaaaa-0000-7000-8000-000000000101', 60, 'Otra del número de arriba', 'sitalvezno', true)
  $$,
  '42501',
  null,
  'el dueño no elige cuál es la pregunta del número de arriba: no tiene grant sobre esa marca'
);

select throws_ok(
  format(
    $$ insert into public.respuestas (household_id, encuesta_id) values (%L, 'aaaaaaaa-0000-7000-8000-000000000200') $$,
    tests.id('household_a')
  ),
  '42501',
  null,
  'el dueño no escribe respuestas: las escribe el cliente, por la puerta de su enlace'
);

select throws_ok(
  format(
    $$
      insert into public.renglones_de_respuesta (household_id, respuesta_id, pregunta_id, tipo, cantidad_de_opciones, pregunta_texto, valor_numero)
      values (%L, 'aaaaaaaa-0000-7000-8000-000000000300', %L, 'escala5', 0, 'Inventada', 5)
    $$,
    tests.id('household_a'), tests.id('q_conforme')
  ),
  '42501',
  null,
  'ni sus renglones'
);

select throws_ok(
  $$
    insert into public.encuestas_enviadas (proyecto_id, token_hash, token, preguntas)
    values ('aaaaaaaa-0000-7000-8000-000000000010', encode(sha256(convert_to('token-de-prueba-000000001', 'UTF8')), 'hex'), 'token-de-prueba-000000001', '[]')
  $$,
  '42501',
  null,
  'la foto de las preguntas no la manda el dueño: la saca la base'
);


-- Mandarla -------------------------------------------------------------------------------------------

select throws_ok(
  $$
    insert into public.encuestas_enviadas (proyecto_id, token_hash, token)
    values ('aaaaaaaa-0000-7000-8000-000000000011', encode(sha256(convert_to('token-de-la-obra-00000001', 'UTF8')), 'hex'), 'token-de-la-obra-00000001')
  $$,
  'MN015',
  'La opinión se le pide al cliente cuando el trabajo está entregado',
  'a un trabajo que sigue en el taller no se le pide la opinión'
);

select throws_ok(
  $$
    insert into public.encuestas_enviadas (proyecto_id, token_hash, token)
    values ('bbbbbbbb-0000-7000-8000-000000000010', encode(sha256(convert_to('token-de-otro-taller-0001', 'UTF8')), 'hex'), 'token-de-otro-taller-0001')
  $$,
  '23503',
  null,
  'ni a un trabajo de otro taller: la foreign key compuesta lo rechaza'
);

insert into public.encuestas_enviadas (id, proyecto_id, token_hash, token) values (
  'aaaaaaaa-0000-7000-8000-000000000100', 'aaaaaaaa-0000-7000-8000-000000000010',
  encode(sha256(convert_to('encuesta-del-placard-0001', 'UTF8')), 'hex'), 'encuesta-del-placard-0001'
);

select is(
  (
    select array_agg(x.p ->> 'texto' order by x.o)
    from public.encuestas_enviadas e, jsonb_array_elements(e.preguntas) with ordinality as x (p, o)
    where e.id = 'aaaaaaaa-0000-7000-8000-000000000100'
  ),
  array[
    '¿Qué tan conforme quedaste con el mueble?', '¿Y con los tiempos de entrega?',
    '¿Cómo fue hablar con el taller mientras duró el trabajo?', '¿Se lo recomendarías a alguien?',
    '¿Qué podríamos hacer mejor?'
  ],
  'al mandarla, la base le saca la foto a la encuesta: las cinco preguntas, en su orden'
);

select is(
  (
    select array_agg(distinct k order by k)
    from public.encuestas_enviadas e, jsonb_array_elements(e.preguntas) as p, jsonb_object_keys(p) as k
    where e.id = 'aaaaaaaa-0000-7000-8000-000000000100'
  ),
  array['escala', 'id', 'obligatoria', 'opciones', 'propia', 'texto', 'tipo'],
  'de cada pregunta la foto guarda lo que hace falta para contestarla, y nada más'
);

select ok(
  (
    select enviada_at is not null and recordada_at is null and revocada_at is null
    from public.encuestas_enviadas where id = 'aaaaaaaa-0000-7000-8000-000000000100'
  ),
  'queda mandada, sin recordar y viva'
);

select throws_ok(
  $$
    insert into public.encuestas_enviadas (proyecto_id, token_hash, token)
    values ('aaaaaaaa-0000-7000-8000-000000000010', encode(sha256(convert_to('encuesta-del-placard-0002', 'UTF8')), 'hex'), 'encuesta-del-placard-0002')
  $$,
  '23505',
  null,
  'un trabajo tiene un solo enlace vivo: para mandar otro, primero se da de baja el que está'
);


-- Un solo recordatorio ---------------------------------------------------------------------------------

update public.encuestas_enviadas set recordada_at = '2026-09-20 10:00-03' where id = 'aaaaaaaa-0000-7000-8000-000000000100';
update public.encuestas_enviadas set recordada_at = '2026-09-21 10:00-03' where id = 'aaaaaaaa-0000-7000-8000-000000000100';
update public.encuestas_enviadas set recordada_at = null where id = 'aaaaaaaa-0000-7000-8000-000000000100';

select is(
  (select recordada_at from public.encuestas_enviadas where id = 'aaaaaaaa-0000-7000-8000-000000000100'),
  '2026-09-20 10:00-03'::timestamptz,
  'el recordatorio es uno: una segunda marca y el intento de borrarla dejan la primera'
);


-- Las versiones de una pregunta --------------------------------------------------------------------------

-- Solo la redactó mejor: la misma fila, con otro texto. El enlace que ya salió no cambia.
update public.preguntas
set texto = '¿Cómo fue hablar con el taller mientras duró la obra?'
where id = tests.id('q_trato');

select is(
  (select numero from public.preguntas where id = tests.id('q_trato')),
  1,
  '«solo la redacté mejor» no parte la serie: es la misma pregunta con el texto nuevo'
);

select is(
  (
    select p ->> 'texto'
    from public.encuestas_enviadas e, jsonb_array_elements(e.preguntas) as p
    where e.id = 'aaaaaaaa-0000-7000-8000-000000000100' and p ->> 'id' = tests.id('q_trato')::text
  ),
  '¿Cómo fue hablar con el taller mientras duró el trabajo?',
  'y el enlace que ya salió sigue preguntando lo que decía cuando se mandó'
);

select throws_ok(
  format($$ update public.preguntas set tipo = 'sitalvezno', escala = null where id = %L $$, tests.id('q_trato')),
  'MN013',
  'Esa pregunta ya salió en una encuesta: cómo se contesta no cambia',
  'cómo se contesta una pregunta que ya salió no se cambia en el lugar'
);

-- Le cambia el sentido: versión 2 de la misma serie, y puede cambiar también cómo se contesta.
select lives_ok(
  format(
    $$
      insert into public.preguntas (id, serie, numero, orden, texto, tipo, obligatoria)
      values ('aaaaaaaa-0000-7000-8000-000000000102', %L, 2, 30, '¿Te costó ubicarnos mientras duró el trabajo?', 'sitalvezno', false)
    $$,
    tests.id('q_trato')
  ),
  'cambiarle el sentido es una versión nueva de la misma serie'
);

select is(
  (select array_agg(numero order by numero) from public.preguntas where serie = tests.id('q_trato')),
  array[1, 2],
  'la versión vieja queda con lo que le contestaron, y la nueva cuenta de cero'
);

select throws_ok(
  format($$ update public.preguntas set texto = 'Otra cosa' where id = %L $$, tests.id('q_trato')),
  'MN014',
  'La pregunta cambió desde otro lado',
  'la versión vieja ya no se edita: un cambio que llega tarde no toca lo que ya no se pregunta'
);

select throws_ok(
  format(
    $$
      insert into public.preguntas (id, serie, numero, orden, texto, tipo)
      values ('aaaaaaaa-0000-7000-8000-000000000103', %L, 2, 30, 'Otra versión 2', 'texto')
    $$,
    tests.id('q_trato')
  ),
  'MN014',
  'La pregunta cambió desde otro lado',
  'dos aparatos que versionan la misma pregunta sin señal no dejan dos versiones 2'
);

-- Así manda la cola un alta: un upsert de la fila entera. Reenviarlo no cambia nada.
insert into public.preguntas (id, serie, numero, orden, texto, tipo, escala, obligatoria, opciones, archivada_at, deleted_at)
values (
  'aaaaaaaa-0000-7000-8000-000000000102', tests.id('q_trato'), 2, 30,
  '¿Te costó ubicarnos mientras duró el trabajo?', 'sitalvezno', null, false, null, null, null
)
on conflict (id) do update set
  serie = excluded.serie, numero = excluded.numero, orden = excluded.orden, texto = excluded.texto,
  tipo = excluded.tipo, escala = excluded.escala, obligatoria = excluded.obligatoria,
  opciones = excluded.opciones, archivada_at = excluded.archivada_at, deleted_at = excluded.deleted_at;

select is(
  (select version from public.preguntas where id = 'aaaaaaaa-0000-7000-8000-000000000102'),
  1,
  'el reenvío idéntico de una versión nueva, como lo manda la cola, pasa sin cambiar nada'
);

select lives_ok(
  format(
    $$
      insert into public.preguntas (id, serie, numero, orden, texto, tipo, escala, obligatoria)
      values ('aaaaaaaa-0000-7000-8000-000000000104', %L, 2, 10, '¿Qué tan conforme quedaste con lo que te hicimos?', 'escala5', 'conformidad', true)
    $$,
    tests.id('q_conforme')
  ),
  'la del número de arriba también se versiona'
);

select is(
  (select array_agg(titular order by numero) from public.preguntas where serie = tests.id('q_conforme')),
  array[true, true],
  'y su versión nueva hereda la marca: el número de arriba sigue saliendo de esa serie'
);

-- Dejar de preguntarla: la próxima encuesta ya no la trae.
update public.preguntas set archivada_at = now() where id = tests.id('q_mejor');

insert into public.encuestas_enviadas (id, proyecto_id, token_hash, token) values (
  'aaaaaaaa-0000-7000-8000-000000000110', 'aaaaaaaa-0000-7000-8000-000000000012',
  encode(sha256(convert_to('encuesta-de-la-biblioteca-01', 'UTF8')), 'hex'), 'encuesta-de-la-biblioteca-01'
);

select is(
  (
    select array_agg(x.p ->> 'id' order by x.o)
    from public.encuestas_enviadas e, jsonb_array_elements(e.preguntas) with ordinality as x (p, o)
    where e.id = 'aaaaaaaa-0000-7000-8000-000000000110'
  ),
  array[
    'aaaaaaaa-0000-7000-8000-000000000104', tests.id('q_tiempos')::text,
    'aaaaaaaa-0000-7000-8000-000000000102', tests.id('q_recomienda')::text
  ],
  'la encuesta que sale después pregunta las versiones nuevas y deja afuera la archivada'
);


-- Borrar o archivar ------------------------------------------------------------------------------------

select throws_ok(
  format($$ update public.preguntas set deleted_at = now() where id = %L $$, tests.id('q_recomienda')),
  'MN004',
  'Esa pregunta no se borra: se deja de preguntar',
  'una pregunta que ya salió en una encuesta no se borra: se archiva'
);

insert into public.preguntas (id, serie, orden, texto, tipo, opciones) values (
  'aaaaaaaa-0000-7000-8000-000000000105', 'aaaaaaaa-0000-7000-8000-000000000105', 60,
  '¿Cómo nos conociste?', 'una', array['Me lo recomendaron', 'Por Instagram', 'Vi el cartel del taller']
);

select lives_ok(
  $$ update public.preguntas set deleted_at = now() where id = 'aaaaaaaa-0000-7000-8000-000000000105' $$,
  'la que nadie llegó a ver sí se borra: no hay nada que guardar'
);

select lives_ok(
  $$ update public.preguntas set deleted_at = null where id = 'aaaaaaaa-0000-7000-8000-000000000105' $$,
  'y el deshacer la trae de vuelta'
);

select throws_ok(
  $$
    insert into public.preguntas (id, serie, orden, texto, tipo, opciones)
    values ('aaaaaaaa-0000-7000-8000-000000000106', 'aaaaaaaa-0000-7000-8000-000000000106', 70, 'Una sola opción', 'una', array['Sola'])
  $$,
  '23514',
  null,
  'una pregunta de opciones tiene al menos dos'
);


-- Preguntas propias de un trabajo ------------------------------------------------------------------------

insert into public.preguntas (id, serie, proyecto_id, orden, texto, tipo, escala) values (
  'aaaaaaaa-0000-7000-8000-000000000120', 'aaaaaaaa-0000-7000-8000-000000000120',
  'aaaaaaaa-0000-7000-8000-000000000010', 10, '¿La altura del barral te quedó cómoda?', 'escala5', 'conformidad'
);

select throws_ok(
  $$
    insert into public.preguntas (id, serie, proyecto_id, orden, texto, tipo, obligatoria)
    values ('aaaaaaaa-0000-7000-8000-000000000121', 'aaaaaaaa-0000-7000-8000-000000000121', 'aaaaaaaa-0000-7000-8000-000000000010', 20, 'Una propia obligatoria', 'texto', true)
  $$,
  '23514',
  null,
  'una pregunta propia no es obligatoria: se puede sumar con el enlace ya mandado'
);

select throws_ok(
  $$ update public.preguntas set tipo = 'texto', escala = null where id = 'aaaaaaaa-0000-7000-8000-000000000120' $$,
  'MN013',
  'Esa pregunta ya salió en una encuesta: cómo se contesta no cambia',
  'con el enlace del trabajo vivo, una propia tampoco cambia cómo se contesta'
);

select lives_ok(
  $$ update public.preguntas set texto = '¿La altura del barral te quedó cómoda para colgar?' where id = 'aaaaaaaa-0000-7000-8000-000000000120' $$,
  'su texto sí se corrige'
);


-- El cliente contesta, y desde ahí su trabajo queda como está ------------------------------------------------

select tests.entrar_como_anon();

select is(
  public.contestar_encuesta(
    'encuesta-del-placard-0001',
    jsonb_build_object(
      'id', 'aaaaaaaa-0000-7000-8000-000000000900',
      'renglones', jsonb_build_array(
        jsonb_build_object('pregunta', tests.id('q_conforme'), 'valor', 5),
        jsonb_build_object('pregunta', tests.id('q_tiempos'), 'valor', 4),
        jsonb_build_object('pregunta', tests.id('q_recomienda'), 'valor', 3),
        jsonb_build_object('pregunta', 'aaaaaaaa-0000-7000-8000-000000000120', 'valor', 4)
      )
    )
  ),
  '{"estado": "guardada"}'::jsonb,
  'el cliente contesta desde su enlace'
);

select tests.entrar_como(tests.id('ana'));

select is(
  (select pregunta_texto from public.renglones_de_respuesta where pregunta_id = tests.id('q_conforme')),
  '¿Qué tan conforme quedaste con el mueble?',
  'la respuesta cuelga de la versión que se contestó, con el texto que leyó, aunque ya haya una más nueva'
);

select throws_ok(
  $$
    insert into public.preguntas (id, serie, proyecto_id, orden, texto, tipo)
    values ('aaaaaaaa-0000-7000-8000-000000000122', 'aaaaaaaa-0000-7000-8000-000000000122', 'aaaaaaaa-0000-7000-8000-000000000010', 30, '¿Algo más?', 'texto')
  $$,
  'MN012',
  'Ese cliente ya contestó: sus preguntas quedan como están',
  'con la respuesta guardada, al trabajo no se le suman preguntas'
);

select throws_ok(
  $$ update public.preguntas set texto = 'Otro texto' where id = 'aaaaaaaa-0000-7000-8000-000000000120' $$,
  'MN012',
  'Ese cliente ya contestó: sus preguntas quedan como están',
  'ni se cambian las que tenía'
);

update public.encuestas_enviadas set revocada_at = now() where id = 'aaaaaaaa-0000-7000-8000-000000000100';

select throws_ok(
  $$
    insert into public.encuestas_enviadas (proyecto_id, token_hash, token)
    values ('aaaaaaaa-0000-7000-8000-000000000010', encode(sha256(convert_to('encuesta-del-placard-0003', 'UTF8')), 'hex'), 'encuesta-del-placard-0003')
  $$,
  'MN012',
  'Ese cliente ya contestó',
  'ni se le manda otra encuesta, aunque se dé de baja el enlace: una respuesta por trabajo'
);

update public.encuestas_enviadas set revocada_at = null where id = 'aaaaaaaa-0000-7000-8000-000000000100';

select isnt(
  (select revocada_at from public.encuestas_enviadas where id = 'aaaaaaaa-0000-7000-8000-000000000100'),
  null::timestamptz,
  'un enlace dado de baja no revive'
);


-- Archivar no borra lo que contestaron ----------------------------------------------------------------------

update public.preguntas set archivada_at = now() where id = tests.id('q_recomienda');

select is(
  (select count(*)::int from public.renglones_de_respuesta where pregunta_id = tests.id('q_recomienda') and deleted_at is null),
  1,
  'archivar una pregunta con respuestas no borra lo que contestaron'
);

select is(
  (select deleted_at from public.preguntas where id = tests.id('q_recomienda')),
  null::timestamptz,
  'ni la pregunta: sale de la encuesta y queda'
);


-- Leerla ------------------------------------------------------------------------------------------------

select lives_ok(
  $$ update public.respuestas set leida_at = now() where encuesta_id = 'aaaaaaaa-0000-7000-8000-000000000100' $$,
  'leerla es del dueño: marca leida_at'
);

select throws_ok(
  $$ update public.respuestas set contestada_at = now() where encuesta_id = 'aaaaaaaa-0000-7000-8000-000000000100' $$,
  '42501',
  null,
  'y es lo único que toca de una respuesta'
);

select throws_ok(
  format($$ update public.renglones_de_respuesta set valor_numero = 1 where pregunta_id = %L $$, tests.id('q_conforme')),
  '42501',
  null,
  'lo que contestó el cliente no lo cambia nadie de adentro'
);


-- Cada taller ve lo suyo ---------------------------------------------------------------------------------

select tests.entrar_como(tests.id('beto'));

select is_empty('select 1 from public.encuestas_enviadas', 'Beto no ve las encuestas de Ana');
select is_empty('select 1 from public.respuestas', 'ni lo que le contestaron');
select is_empty('select 1 from public.renglones_de_respuesta', 'ni un renglón');


-- Borrar el trabajo se lleva sus opiniones -------------------------------------------------------------------

select tests.entrar_como(tests.id('ana'));

update public.proyectos set deleted_at = now() where id = 'aaaaaaaa-0000-7000-8000-000000000010';

select is(
  array[
    (select count(*) from public.encuestas_enviadas where proyecto_id = 'aaaaaaaa-0000-7000-8000-000000000010' and deleted_at is null),
    (select count(*) from public.respuestas where encuesta_id = 'aaaaaaaa-0000-7000-8000-000000000100' and deleted_at is null),
    (
      select count(*) from public.renglones_de_respuesta g
      join public.respuestas r on r.id = g.respuesta_id
      where r.encuesta_id = 'aaaaaaaa-0000-7000-8000-000000000100' and g.deleted_at is null
    ),
    (select count(*) from public.preguntas where proyecto_id = 'aaaaaaaa-0000-7000-8000-000000000010' and deleted_at is null)
  ],
  array[0, 0, 0, 0]::bigint[],
  'borrar el trabajo se lleva su encuesta, lo que contestó el cliente y sus preguntas propias'
);

select throws_ok(
  $$
    insert into public.preguntas (id, serie, proyecto_id, orden, texto, tipo)
    values ('aaaaaaaa-0000-7000-8000-000000000123', 'aaaaaaaa-0000-7000-8000-000000000123', 'aaaaaaaa-0000-7000-8000-000000000010', 40, 'Tarde', 'texto')
  $$,
  'MN002',
  'El proyecto está borrado',
  'y a un trabajo borrado no se le suman preguntas'
);


-- El enlace de reseña -----------------------------------------------------------------------------------

select lives_ok(
  $$ update public.ajustes set resena_link = 'https://g.page/r/CaMaunTaller/review' $$,
  'el enlace para dejar una reseña en Google se guarda en los ajustes'
);

select throws_ok(
  $$ update public.ajustes set resena_link = 'https://resenas-truchas.com/maun' $$,
  '23514',
  null,
  'uno de otro sitio no: ese texto se vuelve un enlace en una página pública'
);

select * from finish();
