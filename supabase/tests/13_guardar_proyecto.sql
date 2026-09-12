-- guardar_proyecto: el agregado entero (proyecto + pagos + gastos) en una sola transacción, el
-- reenvío de la cola, el conflicto de versión y la guarda del proyecto liquidado.
-- Los helpers viven en el schema tests, que el rollback del runner se lleva con todo lo demás.

select plan(36);

select tests.guardar('a', tests.crear_usuario('a@maun.test'));
select tests.guardar('b', tests.crear_usuario('b@maun.test'));
select tests.guardar('household_a', private.crear_household('Taller A', tests.id('a')));
select tests.guardar('household_b', private.crear_household('Taller B', tests.id('b')));

update public.ajustes
set sueldo_mensual_centavos = 180000000, costos_fijos_centavos = 25000000
where household_id in (tests.id('household_a'), tests.id('household_b'));

create function tests.proyecto(
  p_id uuid,
  p_version integer,
  p_titulo text default 'Placard',
  p_estado text default 'en_curso',
  p_notas text default '',
  p_cliente uuid default 'aaaaaaaa-0000-7000-8000-000000000001'
)
returns jsonb
language sql
as $$
  select jsonb_build_object(
    'id', p_id, 'version', p_version, 'cliente_id', p_cliente,
    'titulo', p_titulo, 'descripcion', '', 'estado', p_estado,
    'presupuesto_centavos', 120000000, 'forma_pago', 'transferencia', 'comprobante', 'remito',
    'fecha_inicio', '2026-09-01', 'entrega_estimada', '2026-09-30',
    'direccion_entrega', 'Olazábal 1240', 'notas', p_notas
  )
$$;

create function tests.pago(p_id uuid, p_monto bigint, p_borrado boolean default false)
returns jsonb
language sql
as $$
  select jsonb_build_object(
    'id', p_id, 'fecha', '2026-09-01', 'concepto', 'Seña',
    'monto_centavos', p_monto, 'borrado', p_borrado
  )
$$;

create function tests.gasto(p_id uuid, p_monto bigint, p_borrado boolean default false)
returns jsonb
language sql
as $$
  select jsonb_build_object(
    'id', p_id, 'fecha', '2026-09-02', 'descripcion', 'Melamina',
    'monto_centavos', p_monto, 'borrado', p_borrado
  )
$$;

create function tests.vivos(p_tabla text, p_proyecto uuid)
returns bigint
language plpgsql
as $$
declare
  v_cuantos bigint;
begin
  execute format(
    'select count(*) from public.%I where proyecto_id = $1 and deleted_at is null', p_tabla
  ) into v_cuantos using p_proyecto;
  return v_cuantos;
end;
$$;

grant execute on all functions in schema tests to anon, authenticated;

select tests.entrar_como(tests.id('a'));

insert into public.clientes (id, nombre) values
  ('aaaaaaaa-0000-7000-8000-000000000001', 'Marcela'),
  ('aaaaaaaa-0000-7000-8000-000000000002', 'El que se borró');
update public.clientes set deleted_at = now() where id = 'aaaaaaaa-0000-7000-8000-000000000002';

select tests.entrar_como(tests.id('b'));
insert into public.clientes (id, nombre) values ('bbbbbbbb-0000-7000-8000-000000000001', 'Cliente de B');
insert into public.proyectos (id, cliente_id, titulo, estado)
  values ('bbbbbbbb-0000-7000-8000-000000000010', 'bbbbbbbb-0000-7000-8000-000000000001', 'De B', 'en_curso');

select tests.entrar_como(tests.id('a'));


-- El alta: un proyecto, dos pagos y un gasto en una sola llamada ----------------------------------

select lives_ok(
  $$
    select public.guardar_proyecto(
      tests.proyecto('aaaaaaaa-0000-7000-8000-000000000010', null),
      jsonb_build_array(
        tests.pago('aaaaaaaa-0000-7000-8000-000000000101', 40000000),
        tests.pago('aaaaaaaa-0000-7000-8000-000000000102', 20000000)
      ),
      jsonb_build_array(tests.gasto('aaaaaaaa-0000-7000-8000-000000000201', 30000000))
    )
  $$,
  'el alta guarda el proyecto, sus dos pagos y su gasto en una sola llamada'
);

select is(
  tests.vivos('pagos', 'aaaaaaaa-0000-7000-8000-000000000010'), 2::bigint,
  'los dos pagos quedaron guardados'
);

select is(
  tests.vivos('gastos', 'aaaaaaaa-0000-7000-8000-000000000010'), 1::bigint,
  'el gasto quedó guardado'
);

select is(
  (select titulo from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000010'),
  'Placard',
  'el proyecto quedó con lo que mandó el formulario'
);

select is(
  (select version from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000010'), 1,
  'el alta deja el proyecto en la versión 1'
);

select is(
  (select household_id from public.pagos where id = 'aaaaaaaa-0000-7000-8000-000000000101'),
  tests.id('household_a'),
  'el household de las filas hijas lo pone la base, no el cliente'
);


-- Reenviar el alta no duplica nada -----------------------------------------------------------------

select lives_ok(
  $$
    select public.guardar_proyecto(
      tests.proyecto('aaaaaaaa-0000-7000-8000-000000000010', null),
      jsonb_build_array(
        tests.pago('aaaaaaaa-0000-7000-8000-000000000101', 40000000),
        tests.pago('aaaaaaaa-0000-7000-8000-000000000102', 20000000)
      ),
      jsonb_build_array(tests.gasto('aaaaaaaa-0000-7000-8000-000000000201', 30000000))
    )
  $$,
  'reenviar el alta desde la cola no rechaza'
);

select is(
  tests.vivos('pagos', 'aaaaaaaa-0000-7000-8000-000000000010'), 2::bigint,
  'el reenvío del alta no duplica los pagos'
);

select is(
  (select version from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000010'), 1,
  'el reenvío del alta no mueve la versión, así que no genera delta'
);


-- La edición: saca un pago, agrega un gasto y cambia el título -------------------------------------

select lives_ok(
  $$
    select public.guardar_proyecto(
      tests.proyecto('aaaaaaaa-0000-7000-8000-000000000010', 1, 'Placard de tres puertas'),
      jsonb_build_array(
        tests.pago('aaaaaaaa-0000-7000-8000-000000000101', 40000000),
        tests.pago('aaaaaaaa-0000-7000-8000-000000000102', 20000000, true)
      ),
      jsonb_build_array(
        tests.gasto('aaaaaaaa-0000-7000-8000-000000000201', 30000000),
        tests.gasto('aaaaaaaa-0000-7000-8000-000000000202', 5000000)
      )
    )
  $$,
  'la edición guarda el proyecto, la baja de un pago y el gasto nuevo de una sola vez'
);

select is(
  tests.vivos('pagos', 'aaaaaaaa-0000-7000-8000-000000000010'), 1::bigint,
  'el pago que el usuario sacó del formulario quedó dado de baja'
);

select is(
  tests.vivos('gastos', 'aaaaaaaa-0000-7000-8000-000000000010'), 2::bigint,
  'el gasto nuevo entró en la misma operación'
);

select isnt(
  (select deleted_at from public.pagos where id = 'aaaaaaaa-0000-7000-8000-000000000102'), null,
  'la baja del pago es lógica: la fila sigue ahí con su deleted_at'
);

-- Una baja viaja con la fecha vacía, que es lo que devuelve un <input type="date"> sin cargar.
-- jsonb_to_recordset castea todas las columnas de todas las filas antes de que el where filtre
-- nada, así que leer la fecha como date cortaba la llamada entera con un 22007 sin mensaje.
select lives_ok(
  $$
    select public.guardar_proyecto(
      tests.proyecto('aaaaaaaa-0000-7000-8000-000000000010', 2, 'Placard de tres puertas'),
      jsonb_build_array(
        tests.pago('aaaaaaaa-0000-7000-8000-000000000101', 40000000),
        jsonb_build_object(
          'id', 'aaaaaaaa-0000-7000-8000-000000000102',
          'fecha', '', 'concepto', '', 'monto_centavos', 0, 'borrado', true
        )
      ),
      jsonb_build_array(
        tests.gasto('aaaaaaaa-0000-7000-8000-000000000201', 30000000),
        tests.gasto('aaaaaaaa-0000-7000-8000-000000000202', 5000000)
      )
    )
  $$,
  'una baja con la fecha vacía no rompe el guardado: esa fila solo necesita su id'
);

select is(
  (select titulo from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000010'),
  'Placard de tres puertas',
  'el proyecto quedó con el título nuevo'
);


-- Conflicto de versión ------------------------------------------------------------------------------

select throws_ok(
  $$
    select public.guardar_proyecto(
      tests.proyecto('aaaaaaaa-0000-7000-8000-000000000010', 1, 'Escrito sobre una versión vieja'),
      '[]'::jsonb, '[]'::jsonb
    )
  $$,
  'MN006', null,
  'un guardado hecho sobre una versión vieja se rechaza en vez de pisar lo que hay'
);

select is(
  (select titulo from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000010'),
  'Placard de tres puertas',
  'el rechazo por versión no dejó nada a medio escribir'
);

select is(
  tests.hint_de(
    $$
      select public.guardar_proyecto(
        tests.proyecto('aaaaaaaa-0000-7000-8000-000000000010', 1, 'Otra cosa'),
        '[]'::jsonb, '[]'::jsonb
      )
    $$
  ),
  'Abrilo de nuevo para ver lo que hay ahora y volvé a cargar lo que te falte.',
  'el rechazo por versión dice qué hacer para destrabarlo'
);

select lives_ok(
  $$
    select public.guardar_proyecto(
      tests.proyecto('aaaaaaaa-0000-7000-8000-000000000010', 1, 'Placard de tres puertas'),
      jsonb_build_array(
        tests.pago('aaaaaaaa-0000-7000-8000-000000000101', 40000000),
        tests.pago('aaaaaaaa-0000-7000-8000-000000000102', 20000000, true)
      ),
      jsonb_build_array(
        tests.gasto('aaaaaaaa-0000-7000-8000-000000000201', 30000000),
        tests.gasto('aaaaaaaa-0000-7000-8000-000000000202', 5000000)
      )
    )
  $$,
  'el reenvío de la edición, con la versión vieja y la fila ya igual, no rebota'
);

select is(
  tests.vivos('pagos', 'aaaaaaaa-0000-7000-8000-000000000010')
    + tests.vivos('gastos', 'aaaaaaaa-0000-7000-8000-000000000010'),
  3::bigint,
  'el reenvío de la edición no revive el pago dado de baja ni duplica el gasto'
);


-- Lo que la base rechaza ----------------------------------------------------------------------------

select throws_ok(
  $$
    select public.guardar_proyecto(
      tests.proyecto('aaaaaaaa-0000-7000-8000-000000000011', null, 'Para un cliente borrado',
                     'en_curso', '', 'aaaaaaaa-0000-7000-8000-000000000002'),
      '[]'::jsonb, '[]'::jsonb
    )
  $$,
  'MN005', null,
  'no se crea un proyecto colgando de un cliente borrado'
);

select throws_ok(
  $$
    select public.guardar_proyecto(
      tests.proyecto('aaaaaaaa-0000-7000-8000-000000000010', 2, 'Placard de tres puertas',
                     'a_presupuestar'),
      '[]'::jsonb, '[]'::jsonb
    )
  $$,
  'MN007', null,
  'una obra en curso no vuelve a ser un presupuesto a hacer: la transición no existe'
);

select throws_ok(
  $$
    select public.guardar_proyecto(
      tests.proyecto('bbbbbbbb-0000-7000-8000-000000000010', 1, 'Robado'),
      '[]'::jsonb, '[]'::jsonb
    )
  $$,
  '42501', null,
  'A no guarda un proyecto de B: recibe lo mismo que si no existiera, no un duplicate key que delataría que está'
);

select throws_ok(
  $$ select public.guardar_proyecto(jsonb_build_object('titulo', 'Sin id'), '[]'::jsonb, '[]'::jsonb) $$,
  '22004', null,
  'el proyecto necesita id, cliente, título y estado'
);

select throws_ok(
  $$
    select public.guardar_proyecto(
      tests.proyecto('aaaaaaaa-0000-7000-8000-000000000012', null),
      jsonb_build_array(jsonb_build_object('id', 'aaaaaaaa-0000-7000-8000-000000000103', 'fecha', '2026-09-01')),
      '[]'::jsonb
    )
  $$,
  '22004', null,
  'un pago sin monto se rechaza con un código propio y no con un not null genérico'
);

select throws_ok(
  $$
    select public.guardar_proyecto(
      tests.proyecto('aaaaaaaa-0000-7000-8000-000000000013', null), '{}'::jsonb, '[]'::jsonb
    )
  $$,
  '22023', null,
  'los pagos y los gastos van en arrays'
);


-- Un proyecto liquidado no deja tocar sus pagos ni sus gastos ---------------------------------------

select lives_ok(
  $$
    select public.guardar_proyecto(
      tests.proyecto('aaaaaaaa-0000-7000-8000-000000000020', null, 'Vanitory', 'entregado'),
      jsonb_build_array(tests.pago('aaaaaaaa-0000-7000-8000-000000000111', 100000000)),
      jsonb_build_array(tests.gasto('aaaaaaaa-0000-7000-8000-000000000211', 10000000))
    )
  $$,
  'un proyecto entregado se guarda con sus pagos y sus gastos como cualquier otro'
);

select is(
  (
    select estado::text
    from public.cobrar_proyecto(
      'aaaaaaaa-0000-7000-8000-000000000020',
      (select version from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000020'),
      '2026-09-10', 100000000, 10000000, 180000000, 25000000, 9000000, 81000000, 0, 0
    )
  ),
  'cobrado',
  'y una vez entregado se cobra, que es lo que congela su distribución'
);

select throws_ok(
  $$
    select public.guardar_proyecto(
      tests.proyecto('aaaaaaaa-0000-7000-8000-000000000020',
                     (select version from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000020'),
                     'Vanitory', 'cobrado'),
      jsonb_build_array(tests.pago('aaaaaaaa-0000-7000-8000-000000000111', 90000000)),
      jsonb_build_array(tests.gasto('aaaaaaaa-0000-7000-8000-000000000211', 10000000))
    )
  $$,
  'MN001', null,
  'cambiarle el monto a un pago de un proyecto cobrado se rechaza'
);

select throws_ok(
  $$
    select public.guardar_proyecto(
      tests.proyecto('aaaaaaaa-0000-7000-8000-000000000020',
                     (select version from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000020'),
                     'Vanitory', 'cobrado'),
      jsonb_build_array(tests.pago('aaaaaaaa-0000-7000-8000-000000000111', 100000000)),
      jsonb_build_array(
        tests.gasto('aaaaaaaa-0000-7000-8000-000000000211', 10000000),
        tests.gasto('aaaaaaaa-0000-7000-8000-000000000212', 2000000)
      )
    )
  $$,
  'MN001', null,
  'agregarle un gasto a un proyecto cobrado se rechaza'
);

select throws_ok(
  $$
    select public.guardar_proyecto(
      tests.proyecto('aaaaaaaa-0000-7000-8000-000000000020',
                     (select version from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000020'),
                     'Vanitory', 'cobrado'),
      jsonb_build_array(tests.pago('aaaaaaaa-0000-7000-8000-000000000111', 100000000, true)),
      jsonb_build_array(tests.gasto('aaaaaaaa-0000-7000-8000-000000000211', 10000000))
    )
  $$,
  'MN001', null,
  'sacarle un pago a un proyecto cobrado se rechaza'
);

select is(
  tests.hint_de(
    $$
      select public.guardar_proyecto(
        tests.proyecto('aaaaaaaa-0000-7000-8000-000000000020',
                       (select version from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000020'),
                       'Vanitory', 'cobrado'),
        jsonb_build_array(tests.pago('aaaaaaaa-0000-7000-8000-000000000111', 90000000)),
        jsonb_build_array(tests.gasto('aaaaaaaa-0000-7000-8000-000000000211', 10000000))
      )
    $$
  ),
  'Para corregirlo hay que reabrir el proyecto o registrar un ajuste.',
  'el rechazo del cobrado dice cuál es el camino para corregirlo'
);

select lives_ok(
  $$
    select public.guardar_proyecto(
      tests.proyecto('aaaaaaaa-0000-7000-8000-000000000020',
                     (select version from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000020'),
                     'Vanitory', 'cobrado', 'Falta pasar a buscar el espejo'),
      jsonb_build_array(tests.pago('aaaaaaaa-0000-7000-8000-000000000111', 100000000)),
      jsonb_build_array(tests.gasto('aaaaaaaa-0000-7000-8000-000000000211', 10000000))
    )
  $$,
  'las notas de obra de un proyecto cobrado sí se editan: no tocan la distribución'
);

select is(
  (select notas from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000020'),
  'Falta pasar a buscar el espejo',
  'y quedan guardadas'
);


-- Un proyecto borrado ------------------------------------------------------------------------------

update public.proyectos set deleted_at = now()
where id = 'aaaaaaaa-0000-7000-8000-000000000010';

select throws_ok(
  $$
    select public.guardar_proyecto(
      tests.proyecto('aaaaaaaa-0000-7000-8000-000000000010', 3, 'Revivido'),
      '[]'::jsonb, '[]'::jsonb
    )
  $$,
  'MN002', null,
  'un proyecto borrado no revive guardándolo de nuevo'
);


-- Lo que devuelve ----------------------------------------------------------------------------------

select is(
  (
    with guardado as (
      select public.guardar_proyecto(
        tests.proyecto('aaaaaaaa-0000-7000-8000-000000000030', null, 'Biblioteca'),
        jsonb_build_array(
          tests.pago('aaaaaaaa-0000-7000-8000-000000000121', 15000000),
          tests.pago('aaaaaaaa-0000-7000-8000-000000000122', 5000000)
        ),
        jsonb_build_array(tests.gasto('aaaaaaaa-0000-7000-8000-000000000221', 3000000))
      ) as agregado
    )
    select jsonb_build_array(
      agregado -> 'proyecto' ->> 'titulo',
      jsonb_array_length(agregado -> 'pagos')::text,
      jsonb_array_length(agregado -> 'gastos')::text
    )
    from guardado
  ),
  jsonb_build_array('Biblioteca', '2', '1'),
  'la respuesta trae el agregado entero: el proyecto con sus pagos y sus gastos'
);

select * from finish();
