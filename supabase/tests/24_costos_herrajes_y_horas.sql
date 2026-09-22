-- Los costos estimados, lo que hace falta para un trabajo y las horas (ADR 0045).
--
-- Tres invariantes que no se ven leyendo el SQL:
--  - los cuatro costos estimados los escribe un update de sus columnas solas, y guardar_proyecto
--    nunca los pisa, igual que las marcas de la agenda;
--  - las horas y las necesidades siguen el patrón de la clave presente: sin la clave en el pedido, la
--    base las conserva, para que un bundle viejo no las borre;
--  - los costos estimados no tocan el presupuesto por ningún camino.

select plan(34);

select tests.guardar('ana', tests.crear_usuario('ana@maun.test'));
select tests.guardar('household_a', private.crear_household('Taller A', tests.id('ana')));
select tests.guardar('beto', tests.crear_usuario('beto@maun.test'));
select tests.guardar('household_b', private.crear_household('Taller B', tests.id('beto')));

select tests.entrar_como(tests.id('ana'));
insert into public.clientes (id, nombre) values ('aaaaaaaa-0000-7000-8000-000000000001', 'Eliseo');
insert into public.proyectos (id, cliente_id, titulo, estado, presupuesto_centavos)
  values ('aaaaaaaa-0000-7000-8000-000000000010', 'aaaaaaaa-0000-7000-8000-000000000001',
          'Baulera Habitación Huéspedes', 'a_presupuestar', 62800000);


-- Los costos estimados de cotizar -----------------------------------------------------------------

select is(
  (select costo_madera_centavos from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000010'),
  null::bigint,
  'un trabajo nace sin costos estimados: null es «todavía no lo estimé», no cero'
);

select throws_ok(
  $$ update public.proyectos set costo_madera_centavos = -1
     where id = 'aaaaaaaa-0000-7000-8000-000000000010' $$,
  '23514',
  null,
  'un costo estimado no puede ser negativo'
);

select lives_ok(
  $$ update public.proyectos set
       costo_madera_centavos = 19786353,
       costo_herrajes_centavos = 12000000,
       costo_flete_centavos = 10000000,
       costo_ayudante_centavos = 30000000
     where id = 'aaaaaaaa-0000-7000-8000-000000000010' $$,
  'los cuatro costos estimados se escriben con un update de sus columnas solas'
);

select is(
  (select costo_madera_centavos + costo_herrajes_centavos + costo_flete_centavos + costo_ayudante_centavos
   from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000010'),
  71786353::bigint,
  'los cuatro quedaron guardados'
);

select is(
  (select presupuesto_centavos from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000010'),
  62800000::bigint,
  'cargar los costos estimados no toca el presupuesto'
);

select lives_ok(
  $$ update public.proyectos set costo_flete_centavos = 0
     where id = 'aaaaaaaa-0000-7000-8000-000000000010' $$,
  'un costo estimado en cero vale: es «este trabajo no lleva flete»'
);


-- guardar_proyecto no pisa los costos estimados ----------------------------------------------------

select lives_ok(
  $$
    select public.guardar_proyecto(
      '{"id": "aaaaaaaa-0000-7000-8000-000000000010", "version": null,
        "cliente_id": "aaaaaaaa-0000-7000-8000-000000000001", "titulo": "Baulera Habitación Huéspedes",
        "comprobante": "sin_comprobante", "estado": "a_presupuestar", "presupuesto_centavos": 62800000,
        "costo_madera_centavos": 1, "costo_herrajes_centavos": 1,
        "costo_flete_centavos": 1, "costo_ayudante_centavos": 1}'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb
    )
  $$,
  'guardar_proyecto acepta un pedido que trae los costos estimados'
);

select is(
  (select costo_madera_centavos from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000010'),
  19786353::bigint,
  'y los ignora: los costos estimados no entran por el agregado, como las marcas de la agenda'
);

select is(
  (select costo_flete_centavos from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000010'),
  0::bigint,
  'tampoco pisa el que estaba en cero'
);


-- La hora de la entrega y de la visita -------------------------------------------------------------

select is(
  (select entrega_hora from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000010'),
  null::time,
  'un trabajo nace sin hora de entrega: null es «en algún momento de ese día»'
);

select lives_ok(
  $$
    select public.guardar_proyecto(
      '{"id": "aaaaaaaa-0000-7000-8000-000000000010", "version": null,
        "cliente_id": "aaaaaaaa-0000-7000-8000-000000000001", "titulo": "Baulera Habitación Huéspedes",
        "comprobante": "sin_comprobante", "estado": "a_presupuestar", "presupuesto_centavos": 62800000,
        "entrega_estimada": "2026-10-09", "entrega_hora": "10:00",
        "fecha_visita": "2026-09-09", "visita_hora": "15:30"}'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb
    )
  $$,
  'las horas se guardan con el agregado'
);

select is(
  (select entrega_hora from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000010'),
  '10:00'::time,
  'la entrega quedó a las diez'
);

select is(
  (select visita_hora from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000010'),
  '15:30'::time,
  'la visita quedó a las tres y media'
);

select lives_ok(
  $$
    select public.guardar_proyecto(
      '{"id": "aaaaaaaa-0000-7000-8000-000000000010", "version": null,
        "cliente_id": "aaaaaaaa-0000-7000-8000-000000000001", "titulo": "Baulera Habitación Huéspedes",
        "comprobante": "sin_comprobante", "estado": "a_presupuestar", "presupuesto_centavos": 62800000,
        "entrega_estimada": "2026-10-09", "fecha_visita": "2026-09-09"}'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb
    )
  $$,
  'un pedido sin las claves de las horas se acepta'
);

select is(
  (select entrega_hora from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000010'),
  '10:00'::time,
  'y conserva la hora: un bundle viejo no la borra'
);

select lives_ok(
  $$
    select public.guardar_proyecto(
      '{"id": "aaaaaaaa-0000-7000-8000-000000000010", "version": null,
        "cliente_id": "aaaaaaaa-0000-7000-8000-000000000001", "titulo": "Baulera Habitación Huéspedes",
        "comprobante": "sin_comprobante", "estado": "a_presupuestar", "presupuesto_centavos": 62800000,
        "entrega_estimada": "2026-10-09", "entrega_hora": "",
        "fecha_visita": "2026-09-09", "visita_hora": ""}'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb
    )
  $$,
  'una hora vacía, que es lo que manda un <input type="time"> sin cargar, no corta la llamada'
);

select is(
  (select entrega_hora from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000010'),
  null::time,
  'y borra la hora, como una fecha vacía borra la fecha'
);


-- Lo que hace falta para un trabajo -----------------------------------------------------------------

select lives_ok(
  $$
    select public.guardar_proyecto(
      '{"id": "aaaaaaaa-0000-7000-8000-000000000010", "version": null,
        "cliente_id": "aaaaaaaa-0000-7000-8000-000000000001", "titulo": "Baulera Habitación Huéspedes",
        "comprobante": "sin_comprobante", "estado": "a_presupuestar", "presupuesto_centavos": 62800000}'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      null,
      '[{"id": "aaaaaaaa-0000-7000-8000-000000000201", "tipo": "herraje", "nombre": "Bisagras", "cantidad": 6},
        {"id": "aaaaaaaa-0000-7000-8000-000000000202", "tipo": "herraje", "nombre": "Tarugos"},
        {"id": "aaaaaaaa-0000-7000-8000-000000000203", "tipo": "herramienta", "nombre": "Sierra Circular"}]'::jsonb
    )
  $$,
  'se cargan herrajes con cantidad, herrajes sin cantidad y herramientas en el mismo guardado'
);

select is(
  (select count(*)::int from public.necesidades
   where proyecto_id = 'aaaaaaaa-0000-7000-8000-000000000010' and deleted_at is null),
  3,
  'las tres quedaron guardadas'
);

select is(
  (select cantidad from public.necesidades where id = 'aaaaaaaa-0000-7000-8000-000000000202'),
  null::integer,
  'la cantidad es opcional: «Tarugos» entra sin número'
);

select is(
  (select listo from public.necesidades where id = 'aaaaaaaa-0000-7000-8000-000000000201'),
  false,
  'nada nace listo'
);

select throws_ok(
  $$
    select public.guardar_proyecto(
      '{"id": "aaaaaaaa-0000-7000-8000-000000000010", "version": null,
        "cliente_id": "aaaaaaaa-0000-7000-8000-000000000001", "titulo": "Baulera Habitación Huéspedes",
        "comprobante": "sin_comprobante", "estado": "a_presupuestar"}'::jsonb,
      '[]'::jsonb, '[]'::jsonb, null,
      '[{"id": "aaaaaaaa-0000-7000-8000-000000000204", "tipo": "insumo", "nombre": "Melamina"}]'::jsonb
    )
  $$,
  '22004',
  'Cada material, herraje o herramienta necesita id, tipo y nombre',
  'un tipo que no existe se rechaza con un mensaje, no con el 22P02 crudo del cast'
);

select throws_ok(
  $$
    select public.guardar_proyecto(
      '{"id": "aaaaaaaa-0000-7000-8000-000000000010", "version": null,
        "cliente_id": "aaaaaaaa-0000-7000-8000-000000000001", "titulo": "Baulera Habitación Huéspedes",
        "comprobante": "sin_comprobante", "estado": "a_presupuestar"}'::jsonb,
      '[]'::jsonb, '[]'::jsonb, null,
      '[{"id": "aaaaaaaa-0000-7000-8000-000000000205", "tipo": "herraje", "nombre": "   "}]'::jsonb
    )
  $$,
  '22004',
  'Cada material, herraje o herramienta necesita id, tipo y nombre',
  'un nombre en blanco se rechaza antes de llegar al check de la tabla'
);

select throws_ok(
  $$
    select public.guardar_proyecto(
      '{"id": "aaaaaaaa-0000-7000-8000-000000000010", "version": null,
        "cliente_id": "aaaaaaaa-0000-7000-8000-000000000001", "titulo": "Baulera Habitación Huéspedes",
        "comprobante": "sin_comprobante", "estado": "a_presupuestar"}'::jsonb,
      '[]'::jsonb, '[]'::jsonb, null,
      '[{"id": "aaaaaaaa-0000-7000-8000-000000000206", "tipo": "herraje", "nombre": "Pistones", "cantidad": 0}]'::jsonb
    )
  $$,
  '23514',
  null,
  'una cantidad en cero no vale: o es un número de verdad o no va ninguno'
);

select lives_ok(
  $$
    select public.guardar_proyecto(
      '{"id": "aaaaaaaa-0000-7000-8000-000000000010", "version": null,
        "cliente_id": "aaaaaaaa-0000-7000-8000-000000000001", "titulo": "Baulera Habitación Huéspedes",
        "comprobante": "sin_comprobante", "estado": "a_presupuestar", "presupuesto_centavos": 62800000}'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb
    )
  $$,
  'un pedido sin la clave de lo que hace falta se acepta'
);

select is(
  (select count(*)::int from public.necesidades
   where proyecto_id = 'aaaaaaaa-0000-7000-8000-000000000010' and deleted_at is null),
  3,
  'y no borra nada: sin la clave, la base no toca lo que hace falta'
);

select lives_ok(
  $$
    select public.guardar_proyecto(
      '{"id": "aaaaaaaa-0000-7000-8000-000000000010", "version": null,
        "cliente_id": "aaaaaaaa-0000-7000-8000-000000000001", "titulo": "Baulera Habitación Huéspedes",
        "comprobante": "sin_comprobante", "estado": "a_presupuestar", "presupuesto_centavos": 62800000}'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      null,
      '[{"id": "aaaaaaaa-0000-7000-8000-000000000201", "tipo": "herraje", "nombre": "Bisagras", "cantidad": 6, "listo": true},
        {"id": "aaaaaaaa-0000-7000-8000-000000000202", "borrado": true}]'::jsonb
    )
  $$,
  'se tilda una como lista y se saca otra de la lista, en el mismo guardado'
);

select is(
  (select listo from public.necesidades where id = 'aaaaaaaa-0000-7000-8000-000000000201'),
  true,
  'las bisagras quedaron listas'
);

select isnt(
  (select deleted_at from public.necesidades where id = 'aaaaaaaa-0000-7000-8000-000000000202'),
  null,
  'los tarugos quedaron de baja, lógica: la fila sigue para que el delta se la lleve al otro dispositivo'
);

select is(
  (select count(*)::int from public.necesidades
   where proyecto_id = 'aaaaaaaa-0000-7000-8000-000000000010' and deleted_at is null),
  2,
  'quedan dos vivas'
);


-- El catálogo sale de las filas, y no cruza de taller ------------------------------------------------

select is(
  (select count(distinct nombre)::int from public.necesidades
   where household_id = tests.id('household_a') and tipo = 'herraje' and deleted_at is null),
  1,
  'el catálogo de herrajes del taller son los nombres distintos que ya usó: no hay tabla aparte'
);

select tests.entrar_como(tests.id('beto'));

select is(
  (select count(*)::int from public.necesidades),
  0,
  'otro taller no ve lo que hace falta en este: la RLS aísla igual que en el resto'
);

select tests.entrar_como(tests.id('ana'));


-- Borrar el trabajo se lleva lo que hacía falta ------------------------------------------------------

select lives_ok(
  $$ update public.proyectos set deleted_at = now()
     where id = 'aaaaaaaa-0000-7000-8000-000000000010' $$,
  'se borra el trabajo'
);

select is(
  (select count(*)::int from public.necesidades
   where proyecto_id = 'aaaaaaaa-0000-7000-8000-000000000010' and deleted_at is null),
  0,
  'y la baja en cascada se lleva lo que hacía falta, como se lleva los pagos y las opciones'
);

select * from finish();
