-- La entrega y sus fechas (ADR 0071): el listo y la comprometida como columnas que la base mantiene
-- coherentes, la historia de las fechas que escribe un trigger con la carga del taller, las propuestas
-- de entrega con su guarda, lo que contesta el cliente, y la baja con el trabajo.
--
-- Hoy en el taller es el 25 de septiembre de 2026.

select plan(69);

select set_config('maun.hoy_en_el_taller', '2026-09-25', true);

select tests.guardar('ana', tests.crear_usuario('ana@maun.test'));
select tests.guardar('household_a', private.crear_household('Taller de Ana', tests.id('ana')));
select tests.guardar('beto', tests.crear_usuario('beto@maun.test'));
select tests.guardar('household_b', private.crear_household('Taller de Beto', tests.id('beto')));

-- Un rechazo de negocio dice su motivo en el detail; uno de una constraint, cuál fue.
create function tests.rechazo(p_sql text)
returns text
language plpgsql
as $$
declare
  v_estado text;
  v_detalle text;
  v_constraint text;
begin
  execute p_sql;
  return 'ok';
exception
  when others then
    get stacked diagnostics
      v_estado = returned_sqlstate,
      v_detalle = pg_exception_detail,
      v_constraint = constraint_name;
    if v_estado like 'MN%' then
      return v_estado || ' ' || coalesce(nullif(v_detalle, ''), '-');
    end if;
    return v_estado || ' ' || coalesce(nullif(v_constraint, ''), '-');
end;
$$;

-- La historia de un trabajo, en el orden en que la anotó la base.
create function tests.historia(p_proyecto uuid, p_tipo text)
returns text[]
language sql
as $$
  select coalesce(
    array_agg(
      concat_ws(' ', coalesce(c.fecha::text, 'sin'), 'de', coalesce(c.fecha_anterior::text, 'nada'),
                c.franja::text, c.origen::text)
      order by c.created_at, c.id
    ),
    array[]::text[]
  )
  from public.cambios_de_fecha c
  where c.proyecto_id = p_proyecto and c.tipo = p_tipo::public.tipo_de_fecha
$$;

create function tests.proyecto(p_id uuid)
returns public.proyectos
language sql
as $$
  select * from public.proyectos where id = p_id
$$;

create function tests.abierta(p_proyecto uuid)
returns uuid
language sql
as $$
  select d.id from public.propuestas_de_entrega d
  where d.proyecto_id = p_proyecto and d.cerrada_at is null and d.deleted_at is null
$$;

-- Un placard en curso, como lo manda la app al guardarlo.
create function tests.el_trabajo(p_extra jsonb default '{}'::jsonb)
returns jsonb
language sql
as $$
  select jsonb_build_object(
    'id', 'aaaaaaaa-0000-7000-8000-000000000120',
    'version', (select version from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000120'),
    'cliente_id', 'aaaaaaaa-0000-7000-8000-000000000001', 'titulo', 'Placard', 'descripcion', '',
    'estado', 'en_curso', 'comprobante', 'sin_comprobante', 'notas', ''
  ) || p_extra
$$;

grant execute on all functions in schema tests to anon, authenticated;


-- Los tipos --------------------------------------------------------------------------------------------------

select enum_has_labels('public', 'franja_de_entrega', array['manana', 'tarde'], 'las franjas son la mañana y la tarde');
select enum_has_labels('public', 'forma_de_coordinar', array['un_dia', 'sus_dias'], 'se propone un día o se le piden los suyos');
select enum_has_labels('public', 'respuesta_de_entrega', array['me_queda_bien', 'mis_dias'], 'el cliente acepta el día o manda los suyos');
select enum_has_labels('public', 'tipo_de_fecha', array['estimada', 'comprometida'], 'la historia es de la estimada y de la comprometida');
select enum_has_labels('public', 'origen_de_la_fecha', array['taller', 'cliente', 'importada'], 'una fecha la fija el taller, el cliente, o ya estaba');


-- Los trabajos del taller de Ana ------------------------------------------------------------------------------

select tests.entrar_como(tests.id('ana'));

insert into public.clientes (id, nombre) values ('aaaaaaaa-0000-7000-8000-000000000001', 'Cintia Rodríguez');

-- Dos obras en curso, una ya lista, y una entregada que no cuenta como carga del taller.
insert into public.proyectos (id, cliente_id, titulo, estado, listo_el) values
  ('aaaaaaaa-0000-7000-8000-000000000101', 'aaaaaaaa-0000-7000-8000-000000000001', 'Rack', 'en_curso', '2026-09-20'),
  ('aaaaaaaa-0000-7000-8000-000000000102', 'aaaaaaaa-0000-7000-8000-000000000001', 'Biblioteca', 'en_curso', null);
insert into public.proyectos (id, cliente_id, titulo, estado, fecha_entrega) values
  ('aaaaaaaa-0000-7000-8000-000000000103', 'aaaaaaaa-0000-7000-8000-000000000001', 'Escritorio', 'entregado', '2026-09-10');

-- El trabajo de la historia: con el presupuesto mandado y la estimada ya cargada.
insert into public.proyectos (id, cliente_id, titulo, estado, entrega_estimada) values
  ('aaaaaaaa-0000-7000-8000-000000000110', 'aaaaaaaa-0000-7000-8000-000000000001', 'Cocina en L',
   'presupuesto_enviado', '2026-10-20');


-- La historia de las fechas ------------------------------------------------------------------------------------

update public.proyectos set entrega_estimada = '2026-10-22'
  where id = 'aaaaaaaa-0000-7000-8000-000000000110';

select is(
  tests.historia('aaaaaaaa-0000-7000-8000-000000000110', 'estimada'),
  array[]::text[],
  'antes de aprobar, mover la estimada no anota nada: es un número del taller'
);

update public.proyectos set estado = 'en_curso'
  where id = 'aaaaaaaa-0000-7000-8000-000000000110';

select is(
  tests.historia('aaaaaaaa-0000-7000-8000-000000000110', 'estimada'),
  array['2026-10-22 de nada taller'],
  'al aprobar con estimada queda la primera, que es la línea de base'
);

select is(
  (
    select array[c.trabajos_en_curso, c.trabajos_sin_terminar]
    from public.cambios_de_fecha c
    where c.proyecto_id = 'aaaaaaaa-0000-7000-8000-000000000110'
  ),
  array[2, 1],
  'con la carga del taller en ese momento: las otras dos obras en curso, y de esas una sin terminar'
);

select is(
  (select c.decidido_el from public.cambios_de_fecha c where c.proyecto_id = 'aaaaaaaa-0000-7000-8000-000000000110'),
  '2026-09-25'::date,
  'y con el día en el taller'
);

update public.proyectos set entrega_estimada = '2026-10-27'
  where id = 'aaaaaaaa-0000-7000-8000-000000000110';

update public.proyectos set notas = 'Llevar el zócalo aparte'
  where id = 'aaaaaaaa-0000-7000-8000-000000000110';

select is(
  tests.historia('aaaaaaaa-0000-7000-8000-000000000110', 'estimada'),
  array['2026-10-22 de nada taller', '2026-10-27 de 2026-10-22 taller'],
  'mover la estimada en curso anota la nueva con la anterior, y editar otra cosa no anota nada'
);

update public.proyectos set entrega_comprometida = '2026-10-29', entrega_comprometida_franja = 'manana'
  where id = 'aaaaaaaa-0000-7000-8000-000000000110';

update public.proyectos set entrega_comprometida_franja = 'tarde'
  where id = 'aaaaaaaa-0000-7000-8000-000000000110';

-- La puerta del cliente marca el origen en la transacción y lo vuelve a vacío después.
select set_config('maun.origen_de_la_fecha', 'cliente', true);
update public.proyectos set entrega_comprometida = '2026-10-30', entrega_comprometida_franja = null
  where id = 'aaaaaaaa-0000-7000-8000-000000000110';
select set_config('maun.origen_de_la_fecha', '', true);

update public.proyectos set entrega_comprometida = null
  where id = 'aaaaaaaa-0000-7000-8000-000000000110';

select is(
  tests.historia('aaaaaaaa-0000-7000-8000-000000000110', 'comprometida'),
  array[
    '2026-10-29 de nada manana taller',
    '2026-10-29 de 2026-10-29 tarde taller',
    '2026-10-30 de 2026-10-29 cliente',
    'sin de 2026-10-30 taller'
  ],
  'la comprometida se anota cada vez: el taller, su franja, la que aceptó el cliente y la que se sacó'
);

-- Un solo update que mueve las dos: una fila de cada una, ni más ni menos.
update public.proyectos set entrega_estimada = '2026-10-28', entrega_comprometida = '2026-11-02'
  where id = 'aaaaaaaa-0000-7000-8000-000000000110';

select is(
  array[
    cardinality(tests.historia('aaaaaaaa-0000-7000-8000-000000000110', 'estimada')),
    cardinality(tests.historia('aaaaaaaa-0000-7000-8000-000000000110', 'comprometida'))
  ],
  array[3, 5],
  'un mismo update deja una sola fila por tipo'
);

-- Un trabajo aprobado sin estimada no anota nada al aprobarse; la primera que se le pone es la base.
insert into public.proyectos (id, cliente_id, titulo, estado) values
  ('aaaaaaaa-0000-7000-8000-000000000111', 'aaaaaaaa-0000-7000-8000-000000000001', 'Vestidor', 'presupuesto_enviado');
update public.proyectos set estado = 'en_curso' where id = 'aaaaaaaa-0000-7000-8000-000000000111';

select is(
  tests.historia('aaaaaaaa-0000-7000-8000-000000000111', 'estimada'),
  array[]::text[],
  'aprobado sin estimada, no hay nada que anotar'
);

update public.proyectos set entrega_estimada = '2026-10-15' where id = 'aaaaaaaa-0000-7000-8000-000000000111';

select is(
  tests.historia('aaaaaaaa-0000-7000-8000-000000000111', 'estimada'),
  array['2026-10-15 de nada taller'],
  'la primera que se le pone en curso es su línea de base'
);

select is(
  tests.rechazo($$
    insert into public.cambios_de_fecha (household_id, proyecto_id, tipo, fecha, origen, decidido_el)
    values ('00000000-0000-7000-8000-000000000001', 'aaaaaaaa-0000-7000-8000-000000000110', 'estimada', '2026-01-01', 'taller', '2026-01-01')
  $$),
  '42501 -',
  'la app no escribe la historia: no tiene grant de insert'
);

select is(
  tests.rechazo($$ update public.cambios_de_fecha set fecha = '2026-01-01' $$),
  '42501 -',
  'ni la corrige'
);


-- La siembra -------------------------------------------------------------------------------------------------

-- Las importadas las dejó la migración con los trabajos aprobados que tenían estimada. Se miran las que
-- haya en la base: nacieron sin conteos, de una estimada, una por trabajo, y con el día de la aprobación
-- cuando quedó registrado.
select tests.salir();

select is_empty(
  $$
    select c.id from public.cambios_de_fecha c
    where c.origen = 'importada'
      and (c.tipo <> 'estimada' or c.fecha is null or c.trabajos_en_curso is not null or c.fecha_anterior is not null)
  $$,
  'cada importada es una estimada con su fecha, sin conteos y sin anterior'
);

select is_empty(
  $$
    select c.proyecto_id from public.cambios_de_fecha c
    where c.origen = 'importada' and c.deleted_at is null
    group by c.proyecto_id
    having count(*) > 1
  $$,
  'una sola importada por trabajo'
);

select is_empty(
  $$
    select c.id
    from public.cambios_de_fecha c
    where c.origen = 'importada'
      and c.decidido_el is distinct from coalesce(
        (
          select min(e.ocurrio_el) from public.cambios_de_estado e
          where e.household_id = c.household_id and e.proyecto_id = c.proyecto_id and e.hacia = 'en_curso'
        ),
        c.decidido_el
      )
  $$,
  'y con el día de la aprobación cuando quedó en cambios_de_estado'
);

select tests.entrar_como(tests.id('ana'));


-- La coherencia: la guarda de proyectos -----------------------------------------------------------------------

-- En curso no hay entrega real: una fecha cargada se va sola.
update public.proyectos set fecha_entrega = '2026-09-20'
  where id = 'aaaaaaaa-0000-7000-8000-000000000102';

select is(
  (tests.proyecto('aaaaaaaa-0000-7000-8000-000000000102')).fecha_entrega,
  null::date,
  'con el trabajo en curso, una entrega cargada no se guarda'
);

-- Volver al taller se lleva la entrega y deja el listo.
update public.proyectos set estado = 'entregado', fecha_entrega = '2026-09-24'
  where id = 'aaaaaaaa-0000-7000-8000-000000000101';
update public.proyectos set estado = 'en_curso'
  where id = 'aaaaaaaa-0000-7000-8000-000000000101';

select is(
  array[
    (tests.proyecto('aaaaaaaa-0000-7000-8000-000000000101')).fecha_entrega::text,
    (tests.proyecto('aaaaaaaa-0000-7000-8000-000000000101')).listo_el::text
  ],
  array[null, '2026-09-20'],
  'volver al taller borra la entrega y deja el listo como estaba'
);

-- Una franja sin su día no queda.
update public.proyectos set entrega_comprometida_franja = 'manana'
  where id = 'aaaaaaaa-0000-7000-8000-000000000101';

select is(
  (tests.proyecto('aaaaaaaa-0000-7000-8000-000000000101')).entrega_comprometida_franja,
  null::public.franja_de_entrega,
  'una franja sin su día no se guarda'
);

-- Volver a presupuesto se lleva el listo y la comprometida.
update public.proyectos set entrega_comprometida = '2026-10-05'
  where id = 'aaaaaaaa-0000-7000-8000-000000000101';
update public.proyectos set estado = 'presupuesto_enviado'
  where id = 'aaaaaaaa-0000-7000-8000-000000000101';

select is(
  array[
    (tests.proyecto('aaaaaaaa-0000-7000-8000-000000000101')).listo_el::text,
    (tests.proyecto('aaaaaaaa-0000-7000-8000-000000000101')).entrega_comprometida::text
  ],
  array[null, null],
  'volver a presupuesto se lleva el listo y la comprometida'
);

select is(
  tests.historia('aaaaaaaa-0000-7000-8000-000000000101', 'comprometida'),
  array['2026-10-05 de nada taller', 'sin de 2026-10-05 taller'],
  'y la historia dice que se sacó'
);

-- Reactivar un perdido también vuelve a una consulta.
update public.proyectos set estado = 'en_curso', listo_el = '2026-09-22'
  where id = 'aaaaaaaa-0000-7000-8000-000000000101';
select public.cerrar_perdido(
  'aaaaaaaa-0000-7000-8000-000000000101',
  (select version from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000101'),
  '2026-09-24', 0, 0, 0, 0, 0, 0, 0, 0, 1000
);

select is(
  (tests.proyecto('aaaaaaaa-0000-7000-8000-000000000101')).listo_el,
  '2026-09-22'::date,
  'perder un trabajo terminado no borra el día en que quedó listo'
);

select public.reactivar_perdido(
  'aaaaaaaa-0000-7000-8000-000000000101',
  (select version from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000101'),
  'presupuesto_enviado'
);

select is(
  (tests.proyecto('aaaaaaaa-0000-7000-8000-000000000101')).listo_el,
  null::date,
  'reactivarlo lo devuelve a una consulta, sin listo'
);

-- Los checks son la red de la guarda.
select is(
  tests.rechazo($$
    update public.proyectos set listo_el = '2026-09-11'
    where id = 'aaaaaaaa-0000-7000-8000-000000000103'
  $$),
  '23514 proyectos_listo_antes_de_entregar',
  'un mueble no queda listo después del día en que se entregó'
);

select is(
  tests.rechazo($$
    update public.proyectos set tipo_de_proyecto = '  Cocina'
    where id = 'aaaaaaaa-0000-7000-8000-000000000103'
  $$),
  '23514 proyectos_tipo_de_proyecto_valido',
  'el tipo de proyecto no lleva espacios en los bordes'
);

select is(
  tests.rechazo(format(
    $$ update public.proyectos set tipo_de_proyecto = %L where id = 'aaaaaaaa-0000-7000-8000-000000000103' $$,
    repeat('a', 61)
  )),
  '23514 proyectos_tipo_de_proyecto_valido',
  'ni pasa de sesenta caracteres'
);

select is(
  tests.rechazo($$
    update public.proyectos set tipo_de_proyecto = ''
    where id = 'aaaaaaaa-0000-7000-8000-000000000103'
  $$),
  '23514 proyectos_tipo_de_proyecto_valido',
  'ni queda vacío: sin tipo es null'
);


-- guardar_proyecto: el patrón de la clave presente ----------------------------------------------------------

select public.guardar_proyecto(
  tests.el_trabajo(jsonb_build_object(
    'listo_el', '2026-09-24', 'entrega_comprometida', '2026-10-01',
    'entrega_comprometida_franja', 'manana', 'tipo_de_proyecto', '  Placard  ',
    'fecha_entrega', '2026-09-01'
  )),
  '[]', '[]'
);

select is(
  (
    select array[listo_el::text, entrega_comprometida::text, entrega_comprometida_franja::text,
                 tipo_de_proyecto, coalesce(fecha_entrega::text, 'sin entrega')]
    from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000120'
  ),
  array['2026-09-24', '2026-10-01', 'manana', 'Placard', 'sin entrega'],
  'con las claves los guarda: el tipo sin los espacios de los bordes, y en curso sin entrega real'
);

select lives_ok(
  format(
    $$ select public.guardar_proyecto(%L::jsonb, '[]', '[]') $$,
    tests.el_trabajo(jsonb_build_object('titulo', 'Placard del pasillo'))
  ),
  'un guardado sin las claves, como el de un bundle viejo, no rebota'
);

select is(
  (
    select array[listo_el::text, entrega_comprometida::text, entrega_comprometida_franja::text, tipo_de_proyecto]
    from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000120'
  ),
  array['2026-09-24', '2026-10-01', 'manana', 'Placard'],
  'y no borra lo que no conoce'
);

-- El reenvío de la cola con la versión vieja y la entrega que la guarda ya limpió sigue siendo un reenvío.
select set_config(
  'tests.reenvio',
  tests.el_trabajo(jsonb_build_object('titulo', 'Placard chico', 'fecha_entrega', '2026-09-01'))::text,
  true
);
select public.guardar_proyecto(current_setting('tests.reenvio')::jsonb, '[]', '[]');

select lives_ok(
  $$ select public.guardar_proyecto(current_setting('tests.reenvio')::jsonb, '[]', '[]') $$,
  'reenviar un guardado ya aplicado no rebota, aunque la base haya limpiado la entrega que mandaba'
);

select lives_ok(
  format(
    $$ select public.guardar_proyecto(%L::jsonb, '[]', '[]') $$,
    tests.el_trabajo(jsonb_build_object(
      'listo_el', '', 'entrega_comprometida', '', 'entrega_comprometida_franja', '', 'tipo_de_proyecto', '   '
    ))
  ),
  'vacías, como las manda un campo borrado, no rebotan'
);

select is(
  (
    select array[listo_el::text, entrega_comprometida::text, entrega_comprometida_franja::text, tipo_de_proyecto]
    from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000120'
  ),
  array[null, null, null, null]::text[],
  'y las borran: el tipo en blanco queda sin tipo'
);


-- Las propuestas de entrega y su guarda ------------------------------------------------------------------------

select is(
  tests.rechazo($$
    insert into public.propuestas_de_entrega (proyecto_id, forma, fecha)
    values ('aaaaaaaa-0000-7000-8000-000000000102', 'un_dia', '2026-10-01')
  $$),
  'MN021 sin_listo',
  'no se propone la entrega de un mueble que todavía no está listo'
);

select is(
  tests.rechazo($$
    insert into public.propuestas_de_entrega (proyecto_id, forma)
    values ('aaaaaaaa-0000-7000-8000-000000000103', 'sus_dias')
  $$),
  'MN021 sin_listo',
  'ni de uno que ya se entregó'
);

select is(
  tests.hint_de($$
    insert into public.propuestas_de_entrega (proyecto_id, forma)
    values ('aaaaaaaa-0000-7000-8000-000000000102', 'sus_dias')
  $$),
  'Marcá en la ficha que ya está listo y proponele el día.',
  'y el rechazo dice cómo seguir'
);

update public.proyectos set listo_el = '2026-09-24'
  where id = 'aaaaaaaa-0000-7000-8000-000000000102';

select is(
  tests.rechazo($$
    insert into public.propuestas_de_entrega (proyecto_id, forma, fecha)
    values ('aaaaaaaa-0000-7000-8000-000000000102', 'un_dia', '2026-09-25')
  $$),
  'MN021 fecha',
  'el día propuesto no puede ser hoy: tiene que ser desde mañana'
);

select is(
  tests.rechazo($$
    insert into public.propuestas_de_entrega (proyecto_id, forma)
    values ('aaaaaaaa-0000-7000-8000-000000000102', 'un_dia')
  $$),
  '23514 propuestas_de_entrega_dia_segun_la_forma',
  'un día propuesto lleva su día'
);

select is(
  tests.rechazo($$
    insert into public.propuestas_de_entrega (proyecto_id, forma, fecha)
    values ('aaaaaaaa-0000-7000-8000-000000000102', 'sus_dias', '2026-10-01')
  $$),
  '23514 propuestas_de_entrega_dia_segun_la_forma',
  'y pedirle sus días no lleva ninguno'
);

select is(
  tests.rechazo($$
    insert into public.propuestas_de_entrega (id, proyecto_id, forma, fecha, franja)
    values ('aaaaaaaa-0000-7000-8000-000000000501', 'aaaaaaaa-0000-7000-8000-000000000102', 'un_dia', '2026-09-26', 'manana')
  $$),
  'ok',
  'con el mueble listo y un día desde mañana, se propone'
);

select is(
  tests.rechazo($$
    insert into public.propuestas_de_entrega (proyecto_id, forma)
    values ('aaaaaaaa-0000-7000-8000-000000000102', 'sus_dias')
  $$),
  '23505 propuestas_de_entrega_una_abierta',
  'no hay dos propuestas abiertas del mismo trabajo'
);

update public.propuestas_de_entrega set cerrada_at = now()
  where proyecto_id = 'aaaaaaaa-0000-7000-8000-000000000102' and cerrada_at is null;

select is(
  tests.rechazo($$
    insert into public.propuestas_de_entrega (id, proyecto_id, forma)
    values ('aaaaaaaa-0000-7000-8000-000000000502', 'aaaaaaaa-0000-7000-8000-000000000102', 'sus_dias')
  $$),
  'ok',
  'cerrada la anterior en su propia sentencia, entra la nueva'
);

select is(
  tests.rechazo($$
    update public.propuestas_de_entrega set fecha = '2026-10-10'
    where id = 'aaaaaaaa-0000-7000-8000-000000000502'
  $$),
  '42501 -',
  'lo que se propuso no se edita: se propone otra cosa'
);


-- Lo que contesta el cliente ------------------------------------------------------------------------------------

select is(
  tests.rechazo($$
    insert into public.respuestas_de_entrega (household_id, proyecto_id, propuesta_id, respuesta)
    values ('00000000-0000-7000-8000-000000000001', 'aaaaaaaa-0000-7000-8000-000000000102',
            'aaaaaaaa-0000-7000-8000-000000000502', 'mis_dias')
  $$),
  '42501 -',
  'el dueño no escribe respuestas: las escribe el cliente, por la puerta de su enlace'
);

select tests.salir();
insert into public.respuestas_de_entrega (id, household_id, proyecto_id, propuesta_id, respuesta, dias, nota)
  values ('aaaaaaaa-0000-7000-8000-000000000601', tests.id('household_a'),
          'aaaaaaaa-0000-7000-8000-000000000102', 'aaaaaaaa-0000-7000-8000-000000000502', 'mis_dias',
          '[{"fecha": "2026-09-29", "franjas": ["manana", "tarde"]}]', 'Hay ascensor');
select tests.entrar_como(tests.id('ana'));

select is(
  tests.rechazo($$
    update public.respuestas_de_entrega set leida_at = now()
    where id = 'aaaaaaaa-0000-7000-8000-000000000601'
  $$),
  'ok',
  'leerla es del dueño: marca leida_at'
);

select is(
  tests.rechazo($$
    update public.respuestas_de_entrega set nota = 'Otra cosa'
    where id = 'aaaaaaaa-0000-7000-8000-000000000601'
  $$),
  '42501 -',
  'y es lo único que toca de una respuesta'
);

select is(
  tests.rechazo($$
    insert into public.respuestas_de_entrega (household_id, proyecto_id, propuesta_id, respuesta, dias)
    select household_id, proyecto_id, propuesta_id, 'me_queda_bien', '[{"fecha": "2026-09-29", "franjas": ["tarde"]}]'
    from public.respuestas_de_entrega where id = 'aaaaaaaa-0000-7000-8000-000000000601'
  $$),
  '42501 -',
  'ni con los datos de otra'
);

select tests.salir();

select is(
  tests.rechazo($$
    insert into public.respuestas_de_entrega (household_id, proyecto_id, propuesta_id, respuesta, dias)
    values ((select household_id from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000102'),
            'aaaaaaaa-0000-7000-8000-000000000102', 'aaaaaaaa-0000-7000-8000-000000000502',
            'me_queda_bien', '[{"fecha": "2026-09-29", "franjas": ["tarde"]}]')
  $$),
  '23514 respuestas_de_entrega_me_queda_bien_sola',
  'aceptar el día propuesto no lleva días: el día es el de la propuesta'
);

select is(
  tests.rechazo($$
    insert into public.respuestas_de_entrega (household_id, proyecto_id, propuesta_id, respuesta)
    values ((select household_id from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000101'),
            'aaaaaaaa-0000-7000-8000-000000000101', 'aaaaaaaa-0000-7000-8000-000000000502', 'mis_dias')
  $$),
  '23503 respuestas_de_entrega_propuesta_fk',
  'una respuesta es de una propuesta de su mismo trabajo'
);

select tests.entrar_como(tests.id('ana'));


-- La base cierra la propuesta cuando ya no hay nada que coordinar -------------------------------------------------

update public.proyectos set entrega_comprometida = '2026-09-29'
  where id = 'aaaaaaaa-0000-7000-8000-000000000102';

select is(
  tests.abierta('aaaaaaaa-0000-7000-8000-000000000102'),
  null::uuid,
  'fijar la comprometida cierra la propuesta abierta'
);

select is(
  tests.rechazo($$
    insert into public.propuestas_de_entrega (proyecto_id, forma)
    values ('aaaaaaaa-0000-7000-8000-000000000102', 'sus_dias')
  $$),
  'MN021 comprometida',
  'y con la entrega comprometida no se propone otra: se cambia la fecha'
);

update public.proyectos set entrega_comprometida = null
  where id = 'aaaaaaaa-0000-7000-8000-000000000102';
insert into public.propuestas_de_entrega (proyecto_id, forma)
  values ('aaaaaaaa-0000-7000-8000-000000000102', 'sus_dias');
update public.proyectos set listo_el = null
  where id = 'aaaaaaaa-0000-7000-8000-000000000102';

select is(
  tests.abierta('aaaaaaaa-0000-7000-8000-000000000102'),
  null::uuid,
  '«Todavía no está listo» la cierra'
);

update public.proyectos set listo_el = '2026-09-24'
  where id = 'aaaaaaaa-0000-7000-8000-000000000102';
insert into public.propuestas_de_entrega (proyecto_id, forma)
  values ('aaaaaaaa-0000-7000-8000-000000000102', 'sus_dias');
update public.proyectos set estado = 'entregado', fecha_entrega = '2026-09-25'
  where id = 'aaaaaaaa-0000-7000-8000-000000000102';

select is(
  tests.abierta('aaaaaaaa-0000-7000-8000-000000000102'),
  null::uuid,
  'y entregarlo también'
);

select is(
  (
    select count(*)::int from public.propuestas_de_entrega
    where proyecto_id = 'aaaaaaaa-0000-7000-8000-000000000102' and cerrada_at is not null
  ),
  4,
  'las cerradas quedan: son lo que se le pidió'
);


-- Lo que ve cada taller ---------------------------------------------------------------------------------------

select tests.entrar_como(tests.id('beto'));

select is_empty($$ select 1 from public.propuestas_de_entrega $$, 'Beto no ve las propuestas de Ana');
select is_empty($$ select 1 from public.respuestas_de_entrega $$, 'ni lo que le contestaron sus clientes');
select is_empty($$ select 1 from public.cambios_de_fecha $$, 'ni la historia de sus fechas');

select is(
  tests.rechazo($$
    insert into public.propuestas_de_entrega (proyecto_id, forma)
    values ('aaaaaaaa-0000-7000-8000-000000000110', 'sus_dias')
  $$),
  '23503 propuestas_de_entrega_proyecto_fk',
  'ni le propone una entrega a un trabajo de Ana: la foreign key compuesta lo rechaza'
);

insert into public.clientes (id, nombre) values ('bbbbbbbb-0000-7000-8000-000000000001', 'Lucía');
insert into public.proyectos (id, cliente_id, titulo, estado, entrega_estimada) values
  ('bbbbbbbb-0000-7000-8000-000000000010', 'bbbbbbbb-0000-7000-8000-000000000001', 'Mesa', 'en_curso', '2026-10-09');

select is(
  (select array[c.trabajos_en_curso, c.trabajos_sin_terminar] from public.cambios_de_fecha c),
  array[0, 0],
  'la carga del taller es la de su taller: las obras de Ana no cuentan para Beto'
);


-- La baja con el trabajo --------------------------------------------------------------------------------------

select tests.entrar_como(tests.id('ana'));

update public.proyectos set deleted_at = now() where id = 'aaaaaaaa-0000-7000-8000-000000000102';

select is(
  array[
    (select count(*)::int from public.propuestas_de_entrega where proyecto_id = 'aaaaaaaa-0000-7000-8000-000000000102' and deleted_at is null),
    (select count(*)::int from public.respuestas_de_entrega where proyecto_id = 'aaaaaaaa-0000-7000-8000-000000000102' and deleted_at is null)
  ],
  array[0, 0],
  'borrar el trabajo se lleva lo que se le propuso y lo que contestó el cliente'
);

select is(
  tests.rechazo($$
    insert into public.propuestas_de_entrega (proyecto_id, forma)
    values ('aaaaaaaa-0000-7000-8000-000000000102', 'sus_dias')
  $$),
  'MN002 -',
  'y a un trabajo borrado no se le propone nada'
);

update public.proyectos set deleted_at = now() where id = 'aaaaaaaa-0000-7000-8000-000000000110';

select is(
  (select count(*)::int from public.cambios_de_fecha where proyecto_id = 'aaaaaaaa-0000-7000-8000-000000000110' and deleted_at is null),
  0,
  'y la historia de sus fechas'
);

select private.borrar_la_entrega_del_trabajo(
  tests.id('household_a'), 'aaaaaaaa-0000-7000-8000-000000000111', now()
);

select is(
  cardinality(tests.historia('aaaaaaaa-0000-7000-8000-000000000111', 'estimada')),
  1,
  'la baja de la entrega no hace nada con un trabajo vivo'
);

select tests.entrar_como_anon();

select throws_ok(
  $$ select private.borrar_la_entrega_del_trabajo('00000000-0000-7000-8000-000000000001', '00000000-0000-7000-8000-000000000002', now()) $$,
  '42501',
  null,
  'y el rol anónimo no la ejecuta'
);


-- Las tres viajan en la réplica y avisan sus cambios -------------------------------------------------------------

select tests.entrar_como(tests.id('ana'));

select is(
  (
    select array[
      jsonb_array_length(public.bootstrap() -> 'propuestas_de_entrega'),
      jsonb_array_length(public.bootstrap() -> 'respuestas_de_entrega'),
      jsonb_array_length(public.bootstrap() -> 'cambios_de_fecha')
    ]
  ),
  array[
    (select count(*)::int from public.propuestas_de_entrega where deleted_at is null),
    (select count(*)::int from public.respuestas_de_entrega where deleted_at is null),
    (select count(*)::int from public.cambios_de_fecha where deleted_at is null)
  ],
  'bootstrap() trae las propuestas, las respuestas y la historia vivas del taller'
);

select ok(
  (
    select bool_and(e ->> 'deleted_at' is not null)
    from jsonb_array_elements(public.delta(now() - interval '1 minute') -> 'cambios_de_fecha') as e
    where e ->> 'proyecto_id' = 'aaaaaaaa-0000-7000-8000-000000000110'
  ),
  'y delta() trae las bajas, para que el aparato las saque'
);

select * from finish();
