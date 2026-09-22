-- Los materiales como tercer tipo de lo que hace falta, y editar un ítem ya cargado (ADR 0060).
--
-- Tres invariantes:
--  - un material se guarda por el mismo camino que un herraje, con cantidad o sin ella;
--  - el tipo se valida contra el enum: lo que no es ninguno de los tres sigue rebotando con su
--    mensaje, y el enum tiene exactamente esos tres, para que un cuarto sea una decisión;
--  - editar la cantidad o el nombre de un ítem es reenviar la fila con el mismo id: se actualiza en
--    su lugar, sin tocar el tildado ni el alta, y sin crear otra fila.

select plan(19);

select tests.guardar('ana', tests.crear_usuario('ana@maun.test'));
select tests.guardar('household_a', private.crear_household('Taller A', tests.id('ana')));
select tests.guardar('beto', tests.crear_usuario('beto@maun.test'));
select tests.guardar('household_b', private.crear_household('Taller B', tests.id('beto')));

select tests.entrar_como(tests.id('ana'));
insert into public.clientes (id, nombre) values ('aaaaaaaa-0000-7000-8000-000000000001', 'Eliseo');
insert into public.proyectos (id, cliente_id, titulo, estado)
  values ('aaaaaaaa-0000-7000-8000-000000000010', 'aaaaaaaa-0000-7000-8000-000000000001',
          'Vanitory Chico', 'a_presupuestar');


-- El tipo -------------------------------------------------------------------------------------------

select is(
  (select array_agg(e.enumlabel::text order by e.enumlabel)
   from pg_enum e join pg_type t on t.oid = e.enumtypid
   where t.typname = 'tipo_de_necesidad'),
  array['herraje', 'herramienta', 'material'],
  'lo que hace falta es un material, un herraje o una herramienta, y nada más'
);


-- Un material se guarda como los otros dos ---------------------------------------------------------

select lives_ok(
  $$
    select public.guardar_proyecto(
      '{"id": "aaaaaaaa-0000-7000-8000-000000000010", "version": null,
        "cliente_id": "aaaaaaaa-0000-7000-8000-000000000001", "titulo": "Vanitory Chico",
        "comprobante": "sin_comprobante", "estado": "a_presupuestar"}'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      null,
      '[{"id": "aaaaaaaa-0000-7000-8000-000000000301", "tipo": "material", "nombre": "placas de melamina blanca 18 mm", "cantidad": 3},
        {"id": "aaaaaaaa-0000-7000-8000-000000000302", "tipo": "material", "nombre": "Laca poliuretánica"},
        {"id": "aaaaaaaa-0000-7000-8000-000000000303", "tipo": "herraje", "nombre": "Bisagras Cazoleta 35", "cantidad": 4},
        {"id": "aaaaaaaa-0000-7000-8000-000000000304", "tipo": "herramienta", "nombre": "Sargentos", "cantidad": 4}]'::jsonb
    )
  $$,
  'se cargan materiales, herrajes y herramientas en el mismo guardado'
);

select is(
  (select tipo::text from public.necesidades where id = 'aaaaaaaa-0000-7000-8000-000000000301'),
  'material',
  'la melamina quedó como material'
);

select is(
  (select cantidad from public.necesidades where id = 'aaaaaaaa-0000-7000-8000-000000000301'),
  3,
  'con su cantidad, sin unidad: la unidad va en el nombre'
);

select is(
  (select cantidad from public.necesidades where id = 'aaaaaaaa-0000-7000-8000-000000000302'),
  null::integer,
  'la cantidad de un material también es opcional'
);

select is(
  (select cantidad from public.necesidades where id = 'aaaaaaaa-0000-7000-8000-000000000304'),
  4,
  'una herramienta también puede llevar cantidad: cuatro sargentos'
);

select throws_ok(
  $$
    select public.guardar_proyecto(
      '{"id": "aaaaaaaa-0000-7000-8000-000000000010", "version": null,
        "cliente_id": "aaaaaaaa-0000-7000-8000-000000000001", "titulo": "Vanitory Chico",
        "comprobante": "sin_comprobante", "estado": "a_presupuestar"}'::jsonb,
      '[]'::jsonb, '[]'::jsonb, null,
      '[{"id": "aaaaaaaa-0000-7000-8000-000000000305", "tipo": "insumo", "nombre": "Tornillos"}]'::jsonb
    )
  $$,
  '22004',
  'Cada material, herraje o herramienta necesita id, tipo y nombre',
  'un tipo que no es ninguno de los tres sigue rebotando con su mensaje, no con el 22P02 del cast'
);

select throws_ok(
  $$
    select public.guardar_proyecto(
      '{"id": "aaaaaaaa-0000-7000-8000-000000000010", "version": null,
        "cliente_id": "aaaaaaaa-0000-7000-8000-000000000001", "titulo": "Vanitory Chico",
        "comprobante": "sin_comprobante", "estado": "a_presupuestar"}'::jsonb,
      '[]'::jsonb, '[]'::jsonb, null,
      '[{"id": "aaaaaaaa-0000-7000-8000-000000000306", "nombre": "Tornillos"}]'::jsonb
    )
  $$,
  '22004',
  'Cada material, herraje o herramienta necesita id, tipo y nombre',
  'y uno sin tipo también'
);

select is(
  (select count(distinct nombre)::int from public.necesidades
   where household_id = tests.id('household_a') and tipo = 'material' and deleted_at is null),
  2,
  'el catálogo de materiales sale de las filas de materiales: no se mezcla con el de herrajes'
);


-- Editar la cantidad y el nombre en la fila --------------------------------------------------------

update public.necesidades set listo = true where id = 'aaaaaaaa-0000-7000-8000-000000000303';

select lives_ok(
  $$
    select public.guardar_proyecto(
      '{"id": "aaaaaaaa-0000-7000-8000-000000000010", "version": null,
        "cliente_id": "aaaaaaaa-0000-7000-8000-000000000001", "titulo": "Vanitory Chico",
        "comprobante": "sin_comprobante", "estado": "a_presupuestar"}'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      null,
      '[{"id": "aaaaaaaa-0000-7000-8000-000000000301", "tipo": "material", "nombre": "placas de melamina blanca 18 mm", "cantidad": 3},
        {"id": "aaaaaaaa-0000-7000-8000-000000000302", "tipo": "material", "nombre": "Laca poliuretánica"},
        {"id": "aaaaaaaa-0000-7000-8000-000000000303", "tipo": "herraje", "nombre": "  Bisagras Cazoleta 35 Cierre Suave  ", "cantidad": 6, "listo": true},
        {"id": "aaaaaaaa-0000-7000-8000-000000000304", "tipo": "herramienta", "nombre": "Sargentos", "cantidad": 4}]'::jsonb
    )
  $$,
  'editar la cantidad y el nombre de las bisagras es reenviar su fila con el mismo id'
);

select is(
  (select cantidad from public.necesidades where id = 'aaaaaaaa-0000-7000-8000-000000000303'),
  6,
  'la cantidad pasó de 4 a 6'
);

select is(
  (select nombre from public.necesidades where id = 'aaaaaaaa-0000-7000-8000-000000000303'),
  'Bisagras Cazoleta 35 Cierre Suave',
  'el nombre cambió, recortado'
);

select is(
  (select listo from public.necesidades where id = 'aaaaaaaa-0000-7000-8000-000000000303'),
  true,
  'editar no destilda: el tildado viaja como estaba'
);

select is(
  (select version from public.necesidades where id = 'aaaaaaaa-0000-7000-8000-000000000303'),
  3,
  'y es la misma fila, actualizada en su lugar: el alta, la tilde y la edición'
);

select is(
  (select count(*)::int from public.necesidades
   where proyecto_id = 'aaaaaaaa-0000-7000-8000-000000000010' and deleted_at is null),
  4,
  'siguen siendo cuatro: editar no suma filas'
);

select is(
  (select count(*)::int from public.necesidades
   where household_id = tests.id('household_a') and tipo = 'herraje'
     and nombre = 'Bisagras Cazoleta 35' and deleted_at is null),
  0,
  'el nombre viejo ya no está en ninguna fila viva, así que deja de sugerirse'
);

select throws_ok(
  $$
    select public.guardar_proyecto(
      '{"id": "aaaaaaaa-0000-7000-8000-000000000010", "version": null,
        "cliente_id": "aaaaaaaa-0000-7000-8000-000000000001", "titulo": "Vanitory Chico",
        "comprobante": "sin_comprobante", "estado": "a_presupuestar"}'::jsonb,
      '[]'::jsonb, '[]'::jsonb, null,
      '[{"id": "aaaaaaaa-0000-7000-8000-000000000303", "tipo": "herraje", "nombre": "Bisagras", "cantidad": 0, "listo": true}]'::jsonb
    )
  $$,
  '23514',
  null,
  'una cantidad editada a cero rebota en la base: la pantalla vuelve al valor anterior antes de mandarla'
);


-- Otro taller ---------------------------------------------------------------------------------------

select tests.entrar_como(tests.id('beto'));

select is(
  (select count(*)::int from public.necesidades where tipo = 'material'),
  0,
  'otro taller no ve los materiales de este'
);

select tests.entrar_como(tests.id('ana'));

select is(
  (select count(*)::int from public.necesidades
   where proyecto_id = 'aaaaaaaa-0000-7000-8000-000000000010' and tipo = 'material' and deleted_at is null),
  2,
  'y acá siguen los dos materiales'
);

select * from finish();
