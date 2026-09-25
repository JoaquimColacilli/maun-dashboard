-- La encuesta desde afuera (ADR 0057): el cliente abre su enlace sin sesión, ve lo que se le pregunta
-- y guarda lo que contestó. Es la primera puerta por la que alguien de afuera escribe en la base.
--
-- Los primeros tests son los que sostienen la lista blanca: toda columna de toda tabla que leen
-- public.encuesta_compartida() y public.contestar_encuesta() está clasificada, y una columna nueva
-- en cualquiera de ellas rompe este archivo hasta que alguien decida si el cliente la ve. Después,
-- qué devuelve y qué no, los enlaces que no funcionan, y cada forma de rechazar una respuesta,
-- entera y sin guardar nada.

select plan(47);

-- El rechazo de una llamada como texto: código, motivo y mensaje. 'ok' si no rechazó.
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

create function tests.renglon(p_clave text, p_valor jsonb)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object('pregunta', tests.id(p_clave), 'valor', p_valor)
$$;

create function tests.respuesta(p_id text, variadic p_renglones jsonb[])
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object('id', p_id, 'renglones', to_jsonb(p_renglones))
$$;

grant execute on all functions in schema tests to anon, authenticated;


-- Toda columna que la encuesta puede leer está clasificada ------------------------------------------------

-- De la encuesta mandada viaja la foto de las preguntas, re-enumerada campo por campo. El token, su
-- huella, las fechas y los estados se usan para encontrarla y decidir si sirve, y no salen.
select set_eq(
  $$ select a.attname::text from pg_attribute a where a.attrelid = 'public.encuestas_enviadas'::regclass and a.attnum > 0 and not a.attisdropped $$,
  array[
    -- Viajan
    'preguntas',
    -- No viajan
    'id', 'household_id', 'proyecto_id', 'token_hash', 'token', 'enviada_at', 'recordada_at',
    'revocada_at', 'created_at', 'updated_at', 'deleted_at', 'version'
  ],
  'toda columna de encuestas_enviadas está clasificada'
);

-- De una pregunta viaja lo que hace falta para contestarla. proyecto_id sale solo como la marca de
-- si es propia, y orden solo como el orden de la lista.
select set_eq(
  $$ select a.attname::text from pg_attribute a where a.attrelid = 'public.preguntas'::regclass and a.attnum > 0 and not a.attisdropped $$,
  array[
    -- Viajan
    'id', 'texto', 'tipo', 'escala', 'obligatoria', 'opciones',
    -- No viajan
    'household_id', 'serie', 'numero', 'proyecto_id', 'titular', 'orden', 'cantidad_de_opciones',
    'archivada_at', 'created_at', 'updated_at', 'deleted_at', 'version'
  ],
  'toda columna de preguntas está clasificada'
);

-- De la respuesta viaja solo el día en que contestó. Si la leyó el dueño no sale nunca.
select set_eq(
  $$ select a.attname::text from pg_attribute a where a.attrelid = 'public.respuestas'::regclass and a.attnum > 0 and not a.attisdropped $$,
  array[
    -- Viajan
    'contestada_at',
    -- No viajan
    'id', 'household_id', 'encuesta_id', 'leida_at', 'created_at', 'updated_at', 'deleted_at', 'version'
  ],
  'toda columna de respuestas está clasificada'
);

select set_eq(
  $$ select a.attname::text from pg_attribute a where a.attrelid = 'public.renglones_de_respuesta'::regclass and a.attnum > 0 and not a.attisdropped $$,
  array[
    -- Viajan: a qué pregunta y qué contestó
    'pregunta_id', 'valor_numero', 'valor_opciones', 'valor_texto',
    -- No viajan
    'id', 'household_id', 'respuesta_id', 'tipo', 'cantidad_de_opciones', 'pregunta_texto',
    'created_at', 'updated_at', 'deleted_at', 'version'
  ],
  'toda columna de renglones_de_respuesta está clasificada'
);

-- Del trabajo viaja el título y nada más: ni la etapa, ni un importe, ni la dirección. El estado y la
-- baja deciden si el enlace sirve.
select set_eq(
  $$ select a.attname::text from pg_attribute a where a.attrelid = 'public.proyectos'::regclass and a.attnum > 0 and not a.attisdropped $$,
  array[
    -- Viaja
    'titulo',
    -- No viajan
    'estado', 'presupuesto_centavos', 'direccion_entrega', 'fecha_inicio', 'entrega_estimada',
    'fecha_entrega', 'fecha_cobro', 'cobro_sena', 'cobro_saldo',
    'id', 'household_id', 'cliente_id', 'descripcion', 'forma_pago', 'comprobante',
    'fecha_visita', 'ultimo_contacto', 'notas', 'vencimiento_presupuesto',
    'created_at', 'updated_at', 'deleted_at', 'version',
    'dist_cobrado_centavos', 'dist_gastos_centavos', 'dist_diezmo_bp',
    'dist_tope_sueldo_centavos', 'dist_tope_fijos_centavos', 'dist_diezmo_centavos',
    'dist_sueldo_centavos', 'dist_fijos_centavos', 'dist_remanente_centavos',
    'dist_objetivo_sueldo_centavos', 'dist_objetivo_fijos_centavos', 'dist_sueldo_mensual',
    'dist_sueldo_previo_centavos', 'dist_fijos_previo_centavos', 'dist_liquidado_at',
    'reapertura_objetivo_sueldo_centavos', 'reapertura_objetivo_fijos_centavos',
    'reapertura_sueldo_mensual', 'reapertura_fecha_cobro', 'reparto_ya_en_la_apertura',
    'presupuesto_diseno', 'presupuesto_despiece', 'presupuesto_cotizacion', 'presupuesto_pdf',
    'visita_hecha', 'visita_importante', 'entrega_importante', 'presupuesto_importante',
    'sena_bp', 'entrega_hora', 'visita_hora',
    'costo_madera_centavos', 'costo_herrajes_centavos', 'costo_flete_centavos',
    'costo_ayudante_centavos', 'presupuesto_vale_hasta',
    'listo_el', 'entrega_comprometida', 'entrega_comprometida_franja', 'tipo_de_proyecto'
  ],
  'toda columna de proyectos está clasificada para la encuesta: viaja el título y nada más'
);

-- Del cliente viaja la primera palabra del nombre, para darle las gracias. Nada más.
select set_eq(
  $$ select a.attname::text from pg_attribute a where a.attrelid = 'public.clientes'::regclass and a.attnum > 0 and not a.attisdropped $$,
  array[
    -- Viaja, recortado a la primera palabra
    'nombre',
    -- No viajan
    'id', 'household_id', 'zona', 'telefono', 'email', 'direccion', 'origen_contacto',
    'origen_detalle', 'condicion_fiscal', 'cuit', 'razon_social', 'domicilio_fiscal', 'notas',
    'created_at', 'updated_at', 'deleted_at', 'version'
  ],
  'toda columna de clientes está clasificada para la encuesta'
);

select set_eq(
  $$ select a.attname::text from pg_attribute a where a.attrelid = 'public.households'::regclass and a.attnum > 0 and not a.attisdropped $$,
  array[
    -- Viaja
    'nombre',
    -- No viajan
    'id', 'created_at', 'updated_at', 'deleted_at', 'version'
  ],
  'toda columna de households está clasificada para la encuesta'
);

-- De los ajustes viaja el enlace de reseña. Los datos para transferir viajan por la vista del
-- cliente, no por acá.
select set_eq(
  $$ select a.attname::text from pg_attribute a where a.attrelid = 'public.ajustes'::regclass and a.attnum > 0 and not a.attisdropped $$,
  array[
    -- Viaja
    'resena_link',
    -- No viajan
    'id', 'household_id', 'created_at', 'updated_at', 'deleted_at', 'version',
    'sueldo_mensual_centavos', 'costos_fijos_centavos', 'meta_cocos_centavos',
    'tasa_cocos_anual_bp', 'sueldo_tope_mensual', 'perdido_con_sueldo', 'perdido_con_diezmo',
    'sena_bp', 'cobro_alias', 'cobro_cbu', 'cobro_titular', 'cobro_cuit', 'cobro_link',
    'presupuesto_vale_dias'
  ],
  'toda columna de ajustes está clasificada para la encuesta'
);


-- Dos talleres, cada uno con sus trabajos y sus encuestas ---------------------------------------------------

select tests.guardar('ana', tests.crear_usuario('ana@maun.test'));
select tests.guardar('household_a', private.crear_household('Taller de Ana', tests.id('ana')));
select tests.guardar('beto', tests.crear_usuario('beto@maun.test'));
select tests.guardar('household_b', private.crear_household('Taller de Beto', tests.id('beto')));

select tests.guardar('q_conforme', (select id from public.preguntas where household_id = tests.id('household_a') and orden = 10));
select tests.guardar('q_tiempos', (select id from public.preguntas where household_id = tests.id('household_a') and orden = 20));
select tests.guardar('q_trato', (select id from public.preguntas where household_id = tests.id('household_a') and orden = 30));
select tests.guardar('q_recomienda', (select id from public.preguntas where household_id = tests.id('household_a') and orden = 40));
select tests.guardar('q_mejor', (select id from public.preguntas where household_id = tests.id('household_a') and orden = 50));
select tests.guardar('propia', 'aaaaaaaa-0000-7000-8000-000000000120');
select tests.guardar('propia_de_otro_trabajo', 'aaaaaaaa-0000-7000-8000-000000000121');
select tests.guardar('propia_de_beto', 'bbbbbbbb-0000-7000-8000-000000000120');
select tests.guardar('nueva_sin_mandar', 'aaaaaaaa-0000-7000-8000-000000000130');

select tests.entrar_como(tests.id('beto'));
insert into public.clientes (id, nombre) values ('bbbbbbbb-0000-7000-8000-000000000001', 'Cliente de Beto');
insert into public.proyectos (id, cliente_id, titulo, estado)
  values ('bbbbbbbb-0000-7000-8000-000000000010', 'bbbbbbbb-0000-7000-8000-000000000001', 'Trabajo de Beto', 'entregado');
insert into public.preguntas (id, serie, proyecto_id, orden, texto, tipo)
  values (tests.id('propia_de_beto'), tests.id('propia_de_beto'), 'bbbbbbbb-0000-7000-8000-000000000010', 10, '¿Pregunta de Beto?', 'texto');
insert into public.encuestas_enviadas (proyecto_id, token_hash, token) values (
  'bbbbbbbb-0000-7000-8000-000000000010',
  encode(sha256(convert_to('encuesta-de-beto-000000001', 'UTF8')), 'hex'), 'encuesta-de-beto-000000001'
);

select tests.entrar_como(tests.id('ana'));
update public.ajustes set resena_link = 'https://g.page/r/CaMaunTaller/review', cobro_alias = 'taller.maun.mp';
insert into public.clientes (id, nombre, telefono, direccion, notas) values
  ('aaaaaaaa-0000-7000-8000-000000000001', 'Marcela Duarte', '11-5555-0001', 'Olazábal 1240', 'Paga tarde'),
  ('aaaaaaaa-0000-7000-8000-000000000002', 'Hernán Cabrera', '11-5555-0002', '', '');
insert into public.proyectos (id, cliente_id, titulo, estado, presupuesto_centavos, direccion_entrega, notas) values
  ('aaaaaaaa-0000-7000-8000-000000000010', 'aaaaaaaa-0000-7000-8000-000000000001', 'Placard 3 puertas', 'entregado', 124000000, 'Olazábal 1240, Ituzaingó', 'Nota interna del taller'),
  ('aaaaaaaa-0000-7000-8000-000000000011', 'aaaaaaaa-0000-7000-8000-000000000002', 'Vanitory colgante', 'entregado', 68000000, '', ''),
  ('aaaaaaaa-0000-7000-8000-000000000012', 'aaaaaaaa-0000-7000-8000-000000000002', 'Mesa de comedor', 'entregado', null, '', ''),
  ('aaaaaaaa-0000-7000-8000-000000000013', 'aaaaaaaa-0000-7000-8000-000000000001', 'Escritorio en L', 'entregado', null, '', ''),
  ('aaaaaaaa-0000-7000-8000-000000000014', 'aaaaaaaa-0000-7000-8000-000000000001', 'Cómoda', 'entregado', null, '', ''),
  ('aaaaaaaa-0000-7000-8000-000000000015', 'aaaaaaaa-0000-7000-8000-000000000002', 'Deck', 'entregado', null, '', '');

insert into public.preguntas (id, serie, proyecto_id, orden, texto, tipo, escala) values
  (tests.id('propia'), tests.id('propia'), 'aaaaaaaa-0000-7000-8000-000000000010', 10, '¿La altura del barral te quedó cómoda?', 'escala5', 'conformidad'),
  (tests.id('propia_de_otro_trabajo'), tests.id('propia_de_otro_trabajo'), 'aaaaaaaa-0000-7000-8000-000000000011', 10, '¿El vanitory quedó a la altura justa?', 'escala5', 'conformidad');

insert into public.encuestas_enviadas (proyecto_id, token_hash, token) values
  ('aaaaaaaa-0000-7000-8000-000000000010', encode(sha256(convert_to('encuesta-de-marcela-000001', 'UTF8')), 'hex'), 'encuesta-de-marcela-000001'),
  ('aaaaaaaa-0000-7000-8000-000000000011', encode(sha256(convert_to('encuesta-de-hernan-0000001', 'UTF8')), 'hex'), 'encuesta-de-hernan-0000001'),
  ('aaaaaaaa-0000-7000-8000-000000000012', encode(sha256(convert_to('encuesta-de-la-mesa-000001', 'UTF8')), 'hex'), 'encuesta-de-la-mesa-000001'),
  ('aaaaaaaa-0000-7000-8000-000000000013', encode(sha256(convert_to('encuesta-del-escritorio-01', 'UTF8')), 'hex'), 'encuesta-del-escritorio-01'),
  ('aaaaaaaa-0000-7000-8000-000000000014', encode(sha256(convert_to('encuesta-de-la-comoda-0001', 'UTF8')), 'hex'), 'encuesta-de-la-comoda-0001');

-- Después de mandarla: una pregunta base nueva y otra redactada mejor. El enlace que ya salió no las ve.
insert into public.preguntas (id, serie, orden, texto, tipo, opciones) values (
  tests.id('nueva_sin_mandar'), tests.id('nueva_sin_mandar'), 60, '¿Cómo nos conociste?', 'una',
  array['Me lo recomendaron', 'Por Instagram', 'Vi el cartel del taller']
);
update public.preguntas set texto = '¿Cómo fue hablar con el taller mientras duró la obra?' where id = tests.id('q_trato');

-- Un enlace dado de baja, un trabajo borrado y uno que se dio por perdido: los tres dejan de funcionar.
update public.encuestas_enviadas set revocada_at = now() where proyecto_id = 'aaaaaaaa-0000-7000-8000-000000000011';
update public.proyectos set deleted_at = now() where id = 'aaaaaaaa-0000-7000-8000-000000000013';
update public.proyectos set estado = 'en_curso' where id = 'aaaaaaaa-0000-7000-8000-000000000012';

select tests.salir();

update public.proyectos set
  estado = 'perdido', fecha_cobro = '2026-09-10', dist_liquidado_at = '2026-09-10 18:00-03',
  dist_cobrado_centavos = 0, dist_gastos_centavos = 0, dist_diezmo_bp = 1000,
  dist_objetivo_sueldo_centavos = 0, dist_objetivo_fijos_centavos = 0, dist_sueldo_mensual = false,
  dist_sueldo_previo_centavos = 0, dist_fijos_previo_centavos = 0,
  dist_tope_sueldo_centavos = 0, dist_tope_fijos_centavos = 0,
  dist_diezmo_centavos = 0, dist_sueldo_centavos = 0, dist_fijos_centavos = 0, dist_remanente_centavos = 0
where id = 'aaaaaaaa-0000-7000-8000-000000000012';

-- Uno cobrado, que también se puede pedir.
update public.proyectos set
  estado = 'cobrado', fecha_cobro = '2026-09-12', dist_liquidado_at = '2026-09-12 18:00-03',
  dist_cobrado_centavos = 0, dist_gastos_centavos = 0, dist_diezmo_bp = 1000,
  dist_objetivo_sueldo_centavos = 0, dist_objetivo_fijos_centavos = 0, dist_sueldo_mensual = false,
  dist_sueldo_previo_centavos = 0, dist_fijos_previo_centavos = 0,
  dist_tope_sueldo_centavos = 0, dist_tope_fijos_centavos = 0,
  dist_diezmo_centavos = 0, dist_sueldo_centavos = 0, dist_fijos_centavos = 0, dist_remanente_centavos = 0
where id = 'aaaaaaaa-0000-7000-8000-000000000015';

select tests.entrar_como(tests.id('ana'));

select lives_ok(
  $$
    insert into public.encuestas_enviadas (proyecto_id, token_hash, token)
    values ('aaaaaaaa-0000-7000-8000-000000000015', encode(sha256(convert_to('encuesta-del-deck-00000001', 'UTF8')), 'hex'), 'encuesta-del-deck-00000001')
  $$,
  'a un trabajo cobrado también se le pide la opinión'
);


-- Qué devuelve -------------------------------------------------------------------------------------------

select tests.entrar_como_anon();

select is(
  (select array_agg(k order by k) from jsonb_object_keys(public.encuesta_compartida('encuesta-de-marcela-000001')) as k),
  array['cliente', 'contestada', 'preguntas', 'resena', 'taller', 'trabajo'],
  'la encuesta devuelve exactamente seis campos'
);

select is(
  (
    select array_agg(distinct k order by k)
    from jsonb_array_elements(public.encuesta_compartida('encuesta-de-marcela-000001') -> 'preguntas') as p,
         jsonb_object_keys(p) as k
  ),
  array['escala', 'id', 'obligatoria', 'opciones', 'propia', 'texto', 'tipo'],
  'y de cada pregunta, exactamente siete'
);

select is(
  public.encuesta_compartida('encuesta-de-marcela-000001') - 'preguntas',
  jsonb_build_object(
    'taller', 'Taller de Ana',
    'cliente', 'Marcela',
    'trabajo', 'Placard 3 puertas',
    'resena', 'https://g.page/r/CaMaunTaller/review',
    'contestada', null
  ),
  'el taller, el nombre de pila del cliente, el trabajo, el enlace de reseña y que todavía no contestó'
);

select is(
  (
    select array_agg((p ->> 'texto') || case when (p -> 'propia')::boolean then ' (propia)' else '' end order by o)
    from jsonb_array_elements(public.encuesta_compartida('encuesta-de-marcela-000001') -> 'preguntas') with ordinality as x (p, o)
  ),
  array[
    '¿Qué tan conforme quedaste con el mueble?', '¿Y con los tiempos de entrega?',
    '¿Cómo fue hablar con el taller mientras duró el trabajo?', '¿Se lo recomendarías a alguien?',
    '¿Qué podríamos hacer mejor?', '¿La altura del barral te quedó cómoda? (propia)'
  ],
  'las preguntas son las que se mandaron, con el texto de ese día, más las propias de ese trabajo'
);

select is(
  (
    select array_agg(aguja order by aguja)
    from unnest(array[
      '124000000', '1240000', '11-5555-0001', 'Paga tarde', 'Duarte', 'Nota interna', 'Olazábal',
      'entregado', 'taller.maun.mp', 'Vanitory', 'Hernán', '¿El vanitory', 'Taller de Beto',
      'Trabajo de Beto', '¿Cómo nos conociste?', 'mientras duró la obra',
      'encuesta-de-marcela', encode(sha256(convert_to('encuesta-de-marcela-000001', 'UTF8')), 'hex'),
      tests.id('household_a')::text, 'aaaaaaaa-0000-7000-8000-000000000010',
      'aaaaaaaa-0000-7000-8000-000000000001'
    ]) as aguja
    where strpos(public.encuesta_compartida('encuesta-de-marcela-000001')::text, aguja) > 0
  ),
  null,
  'ni plata, ni la etapa, ni datos del cliente o del trabajo, ni nada de otro trabajo u otro taller, ni lo que se agregó después'
);

select is(
  public.encuesta_compartida('encuesta-de-beto-000000001') -> 'resena',
  'null'::jsonb,
  'sin enlace de reseña cargado, la encuesta no ofrece ninguno'
);


-- Un enlace que no funciona contesta siempre lo mismo ---------------------------------------------------------

select is(
  array[
    tests.rechazo($$ select public.encuesta_compartida('no sirve') $$),
    tests.rechazo($$ select public.encuesta_compartida('no-existe-00000000000000') $$),
    tests.rechazo($$ select public.encuesta_compartida('encuesta-de-hernan-0000001') $$),
    tests.rechazo($$ select public.encuesta_compartida('encuesta-del-escritorio-01') $$),
    tests.rechazo($$ select public.encuesta_compartida('encuesta-de-la-mesa-000001') $$)
  ],
  array_fill('MN010 -: Este link no funciona'::text, array[5]),
  'un token mal formado, uno que no existe, uno dado de baja, uno de un trabajo borrado y uno de un perdido: la misma frase'
);

select is(
  array[
    tests.rechazo($$ select public.contestar_encuesta('no sirve', '{}') $$),
    tests.rechazo($$ select public.contestar_encuesta('no-existe-00000000000000', '{}') $$),
    tests.rechazo($$ select public.contestar_encuesta('encuesta-de-hernan-0000001', '{}') $$),
    tests.rechazo($$ select public.contestar_encuesta('encuesta-del-escritorio-01', '{}') $$),
    tests.rechazo($$ select public.contestar_encuesta('encuesta-de-la-mesa-000001', '{}') $$)
  ],
  array_fill('MN010 -: Este link no funciona'::text, array[5]),
  'y guardar por esos enlaces tampoco: la misma frase, antes de mirar la respuesta'
);


-- Lo que se rechaza, entero -----------------------------------------------------------------------------------

select is(
  tests.rechazo($$ select public.contestar_encuesta('encuesta-de-marcela-000001', '[]') $$),
  'MN011 forma: La respuesta no tiene la forma que espera la encuesta',
  'algo que no es una respuesta'
);

select is(
  tests.rechazo(format(
    $$ select public.contestar_encuesta('encuesta-de-marcela-000001', %L) $$,
    tests.respuesta('aaaaaaaa-0000-7000-8000-000000000900', tests.renglon('q_conforme', '5'), tests.renglon('q_tiempos', '4'), tests.renglon('q_recomienda', '3'))
      || '{"cliente": "Marcela"}'
  )),
  'MN011 forma: La respuesta no tiene la forma que espera la encuesta',
  'una respuesta con un campo de más'
);

select is(
  tests.rechazo(format(
    $$ select public.contestar_encuesta('encuesta-de-marcela-000001', %L) $$,
    tests.respuesta('no-es-un-id', tests.renglon('q_conforme', '5'), tests.renglon('q_tiempos', '4'), tests.renglon('q_recomienda', '3'))
  )),
  'MN011 forma: La respuesta no tiene la forma que espera la encuesta',
  'una respuesta sin un id que sirva'
);

select is(
  tests.rechazo(format(
    $$ select public.contestar_encuesta('encuesta-de-marcela-000001', %L) $$,
    tests.respuesta('aaaaaaaa-0000-7000-8000-000000000900', tests.renglon('q_conforme', '5'), tests.renglon('q_tiempos', '4'), tests.renglon('q_recomienda', '3'), tests.renglon('propia_de_beto', '"Hola"'))
  )),
  'MN011 ajena: Vino una respuesta a una pregunta que no es de esta encuesta',
  'una pregunta de otro taller'
);

select is(
  tests.rechazo(format(
    $$ select public.contestar_encuesta('encuesta-de-marcela-000001', %L) $$,
    tests.respuesta('aaaaaaaa-0000-7000-8000-000000000900', tests.renglon('q_conforme', '5'), tests.renglon('q_tiempos', '4'), tests.renglon('q_recomienda', '3'), tests.renglon('propia_de_otro_trabajo', '5'))
  )),
  'MN011 ajena: Vino una respuesta a una pregunta que no es de esta encuesta',
  'una pregunta propia de otro trabajo del mismo taller'
);

select is(
  tests.rechazo(format(
    $$ select public.contestar_encuesta('encuesta-de-marcela-000001', %L) $$,
    tests.respuesta('aaaaaaaa-0000-7000-8000-000000000900', tests.renglon('q_conforme', '5'), tests.renglon('q_tiempos', '4'), tests.renglon('q_recomienda', '3'), tests.renglon('nueva_sin_mandar', '0'))
  )),
  'MN011 ajena: Vino una respuesta a una pregunta que no es de esta encuesta',
  'una pregunta que el taller agregó después de mandar este enlace'
);

select is(
  tests.rechazo(format(
    $$ select public.contestar_encuesta('encuesta-de-marcela-000001', %L) $$,
    tests.respuesta('aaaaaaaa-0000-7000-8000-000000000900', tests.renglon('q_conforme', '5'), tests.renglon('q_conforme', '1'), tests.renglon('q_tiempos', '4'), tests.renglon('q_recomienda', '3'))
  )),
  'MN011 repetida: Vino dos veces la respuesta a la misma pregunta',
  'la misma pregunta dos veces'
);

select is(
  tests.rechazo(format(
    $$ select public.contestar_encuesta('encuesta-de-marcela-000001', %L) $$,
    tests.respuesta('aaaaaaaa-0000-7000-8000-000000000900', tests.renglon('q_conforme', '"5"'), tests.renglon('q_tiempos', '4'), tests.renglon('q_recomienda', '3'))
  )),
  'MN011 tipo: Una respuesta no es del tipo que pide su pregunta',
  'una carita que llega como texto'
);

select is(
  tests.rechazo(format(
    $$ select public.contestar_encuesta('encuesta-de-marcela-000001', %L) $$,
    tests.respuesta('aaaaaaaa-0000-7000-8000-000000000900', tests.renglon('q_conforme', '4.5'), tests.renglon('q_tiempos', '4'), tests.renglon('q_recomienda', '3'))
  )),
  'MN011 tipo: Una respuesta no es del tipo que pide su pregunta',
  'una carita con decimales'
);

select is(
  tests.rechazo(format(
    $$ select public.contestar_encuesta('encuesta-de-marcela-000001', %L) $$,
    tests.respuesta('aaaaaaaa-0000-7000-8000-000000000900', tests.renglon('q_conforme', '5'), tests.renglon('q_tiempos', '4'), tests.renglon('q_recomienda', '3'), tests.renglon('q_mejor', '5'))
  )),
  'MN011 tipo: Una respuesta no es del tipo que pide su pregunta',
  'un número donde se pedía texto'
);

select is(
  tests.rechazo(format(
    $$ select public.contestar_encuesta('encuesta-de-marcela-000001', %L) $$,
    tests.respuesta('aaaaaaaa-0000-7000-8000-000000000900', tests.renglon('q_conforme', '6'), tests.renglon('q_tiempos', '4'), tests.renglon('q_recomienda', '3'))
  )),
  'MN011 rango: Una respuesta está fuera de las opciones de su pregunta',
  'una sexta carita'
);

select is(
  tests.rechazo(format(
    $$ select public.contestar_encuesta('encuesta-de-marcela-000001', %L) $$,
    tests.respuesta('aaaaaaaa-0000-7000-8000-000000000900', tests.renglon('q_conforme', '0'), tests.renglon('q_tiempos', '4'), tests.renglon('q_recomienda', '3'))
  )),
  'MN011 rango: Una respuesta está fuera de las opciones de su pregunta',
  'una carita cero'
);

select is(
  tests.rechazo(format(
    $$ select public.contestar_encuesta('encuesta-de-marcela-000001', %L) $$,
    tests.respuesta('aaaaaaaa-0000-7000-8000-000000000900', tests.renglon('q_conforme', '5'), tests.renglon('q_tiempos', '4'), tests.renglon('q_recomienda', '4'))
  )),
  'MN011 rango: Una respuesta está fuera de las opciones de su pregunta',
  'un cuarto botón en sí / tal vez / no'
);

select is(
  tests.rechazo(format(
    $$ select public.contestar_encuesta('encuesta-de-marcela-000001', %L) $$,
    tests.respuesta('aaaaaaaa-0000-7000-8000-000000000900', tests.renglon('q_tiempos', '4'), tests.renglon('q_recomienda', '3'))
  )),
  'MN011 obligatoria: Falta contestar una pregunta obligatoria',
  'sin una obligatoria'
);

select is(
  tests.rechazo(format(
    $$ select public.contestar_encuesta('encuesta-de-marcela-000001', %L) $$,
    tests.respuesta('aaaaaaaa-0000-7000-8000-000000000900', tests.renglon('q_conforme', '5'), tests.renglon('q_tiempos', '4'), tests.renglon('q_recomienda', '3'), tests.renglon('q_mejor', to_jsonb(E' \n\t '::text)))
  )),
  'MN011 vacio: Vino una respuesta vacía',
  'un comentario que es solo espacios'
);

select is(
  tests.rechazo(format(
    $$ select public.contestar_encuesta('encuesta-de-marcela-000001', %L) $$,
    tests.respuesta('aaaaaaaa-0000-7000-8000-000000000900', tests.renglon('q_conforme', '5'), tests.renglon('q_tiempos', '4'), tests.renglon('q_recomienda', '3'), tests.renglon('q_mejor', to_jsonb(repeat('a', 2001))))
  )),
  'MN011 largo: Un texto pasa de los 2000 caracteres que acepta la encuesta',
  'un comentario de 2001 caracteres'
);

select tests.salir();

select is(
  (select count(*)::int from public.respuestas where household_id = tests.id('household_a')),
  0,
  'después de cada rechazo no quedó nada guardado: ni una respuesta, ni media'
);


-- La que se guarda --------------------------------------------------------------------------------------------

select tests.entrar_como_anon();

select is(
  public.contestar_encuesta(
    'encuesta-de-marcela-000001',
    tests.respuesta(
      'aaaaaaaa-0000-7000-8000-000000000900',
      tests.renglon('q_conforme', '5'), tests.renglon('q_tiempos', '4'), tests.renglon('q_trato', '5'),
      tests.renglon('q_recomienda', '3'), tests.renglon('q_mejor', to_jsonb(E'  Quedó impecable.\n'::text)),
      tests.renglon('propia', '4')
    )
  ),
  '{"estado": "guardada"}'::jsonb,
  'una respuesta que cumple se guarda'
);

select is(
  public.contestar_encuesta(
    'encuesta-de-marcela-000001',
    tests.respuesta('aaaaaaaa-0000-7000-8000-000000000901', tests.renglon('q_conforme', '1'), tests.renglon('q_tiempos', '1'), tests.renglon('q_recomienda', '1'))
  ),
  '{"estado": "ya_contestada"}'::jsonb,
  'una segunda respuesta por el mismo enlace no se guarda: ya contestó'
);

select is(
  public.contestar_encuesta(
    'encuesta-de-marcela-000001',
    tests.respuesta('aaaaaaaa-0000-7000-8000-000000000900', tests.renglon('q_conforme', '5'), tests.renglon('q_tiempos', '4'), tests.renglon('q_recomienda', '3'))
  ),
  '{"estado": "guardada"}'::jsonb,
  'el mismo envío que vuelve, porque se perdió la respuesta en la red, contesta que quedó guardado'
);

select tests.salir();

select is(
  (select count(*)::int from public.respuestas where household_id = tests.id('household_a')),
  1,
  'y en la base hay una sola respuesta'
);

select is(
  (
    select jsonb_object_agg(g.pregunta_texto, coalesce(to_jsonb(g.valor_numero), to_jsonb(g.valor_texto)))
    from public.renglones_de_respuesta g
    where g.respuesta_id = 'aaaaaaaa-0000-7000-8000-000000000900'
  ),
  jsonb_build_object(
    '¿Qué tan conforme quedaste con el mueble?', 5,
    '¿Y con los tiempos de entrega?', 4,
    '¿Cómo fue hablar con el taller mientras duró el trabajo?', 5,
    '¿Se lo recomendarías a alguien?', 3,
    '¿Qué podríamos hacer mejor?', 'Quedó impecable.',
    '¿La altura del barral te quedó cómoda?', 4
  ),
  'la primera, entera: cada renglón con el texto que leyó el cliente, y el comentario sin blancos de más'
);

select tests.entrar_como_anon();

select is(
  public.encuesta_compartida('encuesta-de-marcela-000001') -> 'contestada' ->> 'fecha',
  (now() at time zone 'America/Argentina/Buenos_Aires')::date::text,
  'la encuesta contestada dice el día en que contestó'
);

select is(
  (
    select jsonb_object_agg(r ->> 'pregunta', r -> 'valor')
    from jsonb_array_elements(public.encuesta_compartida('encuesta-de-marcela-000001') -> 'contestada' -> 'renglones') as r
  ),
  jsonb_build_object(
    tests.id('q_conforme'), 5, tests.id('q_tiempos'), 4, tests.id('q_trato'), 5,
    tests.id('q_recomienda'), 3, tests.id('q_mejor'), 'Quedó impecable.', tests.id('propia'), 4
  ),
  'y qué puso, para mostrárselo sin dejarlo editar'
);


-- Una pregunta propia que se borra con la encuesta abierta ------------------------------------------------

select tests.entrar_como(tests.id('ana'));
insert into public.preguntas (id, serie, proyecto_id, orden, texto, tipo)
  values ('aaaaaaaa-0000-7000-8000-000000000140', 'aaaaaaaa-0000-7000-8000-000000000140', 'aaaaaaaa-0000-7000-8000-000000000014', 10, '¿Te sirvieron los cajones?', 'sitalvezno');

select tests.entrar_como_anon();

select is(
  (
    select count(*)::int
    from jsonb_array_elements(public.encuesta_compartida('encuesta-de-la-comoda-0001') -> 'preguntas') as p
    where p ->> 'id' = 'aaaaaaaa-0000-7000-8000-000000000140'
  ),
  1,
  'una pregunta propia que se suma con el enlace ya mandado aparece en la encuesta'
);

select tests.entrar_como(tests.id('ana'));
update public.preguntas set deleted_at = now() where id = 'aaaaaaaa-0000-7000-8000-000000000140';

select tests.entrar_como_anon();

select is(
  tests.rechazo(format(
    $$ select public.contestar_encuesta('encuesta-de-la-comoda-0001', %L) $$,
    tests.respuesta(
      'aaaaaaaa-0000-7000-8000-000000000910',
      tests.renglon('q_conforme', '5'), tests.renglon('q_tiempos', '4'), tests.renglon('q_recomienda', '3'),
      jsonb_build_object('pregunta', 'aaaaaaaa-0000-7000-8000-000000000140', 'valor', 3)
    )
  )),
  'MN011 ajena: Vino una respuesta a una pregunta que no es de esta encuesta',
  'si el dueño la saca mientras el cliente contesta, esa respuesta ya no entra: la página vuelve a cargar la encuesta'
);


-- Las dos puertas son del rol anónimo y de nadie más --------------------------------------------------------

select tests.entrar_como(tests.id('ana'));

select is(
  tests.rechazo($$ select public.encuesta_compartida('encuesta-de-marcela-000001') $$),
  '42501 -: permission denied for function encuesta_compartida',
  'el dueño con su sesión no abre la encuesta por esta puerta: la página pública pregunta siempre como anónima'
);

select is(
  tests.rechazo($$ select public.contestar_encuesta('encuesta-de-la-comoda-0001', '{}') $$),
  '42501 -: permission denied for function contestar_encuesta',
  'ni la contesta'
);

select tests.salir();

select is(
  (select provolatile::text from pg_proc where oid = 'public.encuesta_compartida(text)'::regprocedure),
  's',
  'la que muestra la encuesta es stable: no escribe nada, ni siquiera una visita'
);

select ok(
  (
    select bool_and(p.prosecdef and not has_function_privilege('authenticated', p.oid, 'EXECUTE'))
    from pg_proc p
    where p.oid in ('public.encuesta_compartida(text)'::regprocedure, 'public.contestar_encuesta(text, jsonb)'::regprocedure)
  ),
  'las dos corren elevadas y ninguna la ejecuta authenticated'
);

select * from finish();
