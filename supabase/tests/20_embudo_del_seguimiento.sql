-- El embudo del seguimiento (ADR 0038). Las 81 combinaciones de estados las compara contra @maun/domain
-- packages/db/tests/dominio-vs-sql.test.ts; acá se prueba que la guarda deja entrar y salir del
-- presupuesto estimativo por los caminos del taller, que un estimativo se cierra como perdido y se
-- reactiva, y que las tareas de presupuestar se tildan de a una, sin que un guardado del agregado las
-- pise ni otro taller las toque.

select plan(18);

select tests.guardar('a', tests.crear_usuario('a@maun.test'));
select tests.guardar('household_a', private.crear_household('Taller A', tests.id('a')));
select tests.guardar('b', tests.crear_usuario('b@maun.test'));
select tests.guardar('household_b', private.crear_household('Taller B', tests.id('b')));

select tests.entrar_como(tests.id('a'));

insert into public.clientes (id, nombre) values ('aaaaaaaa-0000-7000-8000-000000000001', 'Marcela');
insert into public.proyectos (id, cliente_id, titulo) values
  ('aaaaaaaa-0000-7000-8000-000000000010', 'aaaaaaaa-0000-7000-8000-000000000001', 'Consulta por un placard');
insert into public.proyectos (id, cliente_id, titulo, estado) values
  ('aaaaaaaa-0000-7000-8000-000000000020', 'aaaaaaaa-0000-7000-8000-000000000001', 'Estimativo que no salió', 'presupuesto_estimativo'),
  ('aaaaaaaa-0000-7000-8000-000000000030', 'aaaaaaaa-0000-7000-8000-000000000001', 'Estimativo aprobado', 'presupuesto_estimativo');


-- El estimativo en la máquina de estados ---------------------------------------------------------------

select lives_ok(
  $$ update public.proyectos set estado = 'presupuesto_estimativo' where id = 'aaaaaaaa-0000-7000-8000-000000000010' $$,
  'una consulta pasa a estimativo'
);

select lives_ok(
  $$ update public.proyectos set estado = 'relevamiento' where id = 'aaaaaaaa-0000-7000-8000-000000000010' $$,
  'si avanza, del estimativo se agenda la visita'
);

select lives_ok(
  $$ update public.proyectos set estado = 'presupuesto_estimativo' where id = 'aaaaaaaa-0000-7000-8000-000000000010' $$,
  'un relevamiento sin cobrar puede pasar a estimativo'
);

select throws_ok(
  $$ update public.proyectos set estado = 'entregado' where id = 'aaaaaaaa-0000-7000-8000-000000000010' $$,
  'MN007', null, 'un estimativo no salta a entregado'
);

select lives_ok(
  $$ update public.proyectos set estado = 'a_presupuestar' where id = 'aaaaaaaa-0000-7000-8000-000000000010' $$,
  'con el estimativo aprobado y pago, pasa a presupuestar'
);

select lives_ok(
  $$ update public.proyectos set estado = 'en_curso' where id = 'aaaaaaaa-0000-7000-8000-000000000030' $$,
  'un estimativo se puede aprobar directo, como un contacto'
);

select throws_ok(
  $$ update public.proyectos set estado = 'presupuesto_estimativo' where id = 'aaaaaaaa-0000-7000-8000-000000000030' $$,
  'MN007', null, 'una obra no vuelve a estimativo: vuelve a presupuesto enviado'
);


-- Un estimativo que no avanzó se cierra y se reactiva --------------------------------------------------

select lives_ok(
  format(
    $$ select public.cerrar_perdido('aaaaaaaa-0000-7000-8000-000000000020', %s, '2026-09-15', 0, 0, 0, 0, 0, 0, 0, 0, 1000) $$,
    (select version from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000020')
  ),
  'un estimativo sin seña se da por perdido'
);

select is(
  (select estado::text from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000020'),
  'perdido',
  'y queda en el historial'
);

select lives_ok(
  format(
    $$ select public.reactivar_perdido('aaaaaaaa-0000-7000-8000-000000000020', %s, 'presupuesto_estimativo') $$,
    (select version from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000020')
  ),
  'si el cliente vuelve, el perdido se reactiva en estimativo'
);

select is(
  (select estado::text from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000020'),
  'presupuesto_estimativo',
  'y vuelve al seguimiento en esa etapa'
);


-- Las tareas de presupuestar ------------------------------------------------------------------------------

select col_default_is(
  'public', 'proyectos', 'presupuesto_pdf', 'false',
  'las tareas nacen sin tildar'
);

select is(
  (select array[presupuesto_diseno, presupuesto_despiece, presupuesto_cotizacion, presupuesto_pdf]
   from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000010'),
  array[false, false, false, false],
  'un contacto a presupuestar arranca con las cuatro sin tildar'
);

select lives_ok(
  $$ update public.proyectos set presupuesto_despiece = true where id = 'aaaaaaaa-0000-7000-8000-000000000010' $$,
  'una tarea se tilda con su columna sola'
);

select lives_ok(
  format(
    $$ select public.guardar_proyecto(%L::jsonb, '[]'::jsonb, '[]'::jsonb) $$,
    jsonb_build_object(
      'id', 'aaaaaaaa-0000-7000-8000-000000000010',
      'version', (select version from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000010'),
      'cliente_id', 'aaaaaaaa-0000-7000-8000-000000000001',
      'titulo', 'Consulta por un placard',
      'descripcion', '',
      'estado', 'presupuesto_enviado',
      'comprobante', 'sin_comprobante',
      'notas', ''
    )
  ),
  'mandar el presupuesto guarda el agregado entero'
);

select is(
  (select presupuesto_despiece from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000010'),
  true,
  'y la tarea tildada sigue tildada: guardar_proyecto no escribe las tareas'
);

select tests.entrar_como(tests.id('b'));
update public.proyectos set presupuesto_pdf = true where id = 'aaaaaaaa-0000-7000-8000-000000000010';
select tests.salir();

select is(
  (select presupuesto_pdf from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000010'),
  false,
  'otro taller no le tilda nada: la RLS no le deja ver la fila'
);

select tests.entrar_como_anon();

select throws_ok(
  $$ update public.proyectos set presupuesto_diseno = true where id = 'aaaaaaaa-0000-7000-8000-000000000010' $$,
  '42501', null, 'sin sesión no se tilda nada'
);

select * from finish();
