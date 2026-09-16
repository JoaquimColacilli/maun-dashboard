-- Las opciones de presupuesto y la seña esperada (ADR 0043). Lo que se prueba acá es sobre todo el
-- invariante: con opciones vivas, el presupuesto del trabajo sale de la opción aprobada y no hay otro
-- camino para escribirlo. El trigger que lo garantiza es de constraint y diferido, así que para verlo
-- fallar adentro de una transacción hay que forzar el chequeo con set constraints all immediate.

select plan(37);

select tests.guardar('ana', tests.crear_usuario('ana@maun.test'));
select tests.guardar('household_a', private.crear_household('Taller A', tests.id('ana')));
select tests.guardar('beto', tests.crear_usuario('beto@maun.test'));
select tests.guardar('household_b', private.crear_household('Taller B', tests.id('beto')));

select tests.entrar_como(tests.id('beto'));
insert into public.clientes (id, nombre) values ('bbbbbbbb-0000-7000-8000-000000000001', 'Cliente de Beto');
insert into public.proyectos (id, cliente_id, titulo)
  values ('bbbbbbbb-0000-7000-8000-000000000010', 'bbbbbbbb-0000-7000-8000-000000000001', 'Trabajo de Beto');

select tests.entrar_como(tests.id('ana'));
insert into public.clientes (id, nombre) values ('aaaaaaaa-0000-7000-8000-000000000001', 'Alan Saul');


-- La seña que se pide ---------------------------------------------------------------------------------

select is(
  (select sena_bp from public.ajustes where household_id = tests.id('household_a')),
  5000,
  'el taller pide la mitad de seña hasta que se cambie'
);

select throws_ok(
  $$ update public.ajustes set sena_bp = 12000 $$,
  '23514',
  null,
  'la seña del taller no pasa del cien por ciento'
);

select throws_ok(
  $$ insert into public.proyectos (id, cliente_id, titulo, sena_bp)
     values ('aaaaaaaa-0000-7000-8000-000000000099', 'aaaaaaaa-0000-7000-8000-000000000001', 'Mal', -1) $$,
  '23514',
  null,
  'la seña propia de un trabajo tampoco puede ser negativa'
);


-- El presupuesto sale de la opción aprobada ------------------------------------------------------------

select lives_ok(
  $$
    select public.guardar_proyecto(
      '{"id": "aaaaaaaa-0000-7000-8000-000000000010", "version": null,
        "cliente_id": "aaaaaaaa-0000-7000-8000-000000000001", "titulo": "Escritorio", "comprobante": "sin_comprobante",
        "estado": "presupuesto_enviado", "presupuesto_centavos": 99900000}'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      '[{"id": "aaaaaaaa-0000-7000-8000-000000000101", "descripcion": "Solo el escritorio de Alan",
         "monto_centavos": 124800000, "aprobada": false},
        {"id": "aaaaaaaa-0000-7000-8000-000000000102", "descripcion": "Los 2 escritorios",
         "monto_centavos": 230000000, "aprobada": false}]'::jsonb
    )
  $$,
  'se carga un trabajo con dos opciones de presupuesto'
);

select is(
  (select presupuesto_centavos from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000010'),
  null::bigint,
  'con opciones y ninguna aprobada el trabajo no tiene presupuesto, aunque el pedido mande uno'
);

select is(
  (select count(*)::int from public.opciones_de_presupuesto
   where proyecto_id = 'aaaaaaaa-0000-7000-8000-000000000010' and deleted_at is null),
  2,
  'las dos opciones quedaron guardadas'
);

select lives_ok(
  $$
    select public.guardar_proyecto(
      '{"id": "aaaaaaaa-0000-7000-8000-000000000010", "version": null,
        "cliente_id": "aaaaaaaa-0000-7000-8000-000000000001", "titulo": "Escritorio", "comprobante": "sin_comprobante",
        "estado": "presupuesto_enviado", "presupuesto_centavos": null}'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      '[{"id": "aaaaaaaa-0000-7000-8000-000000000101", "descripcion": "Solo el escritorio de Alan",
         "monto_centavos": 124800000, "aprobada": true},
        {"id": "aaaaaaaa-0000-7000-8000-000000000102", "descripcion": "Los 2 escritorios",
         "monto_centavos": 230000000, "aprobada": false}]'::jsonb
    )
  $$,
  'el cliente elige una: se tilda'
);

select is(
  (select presupuesto_centavos from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000010'),
  124800000::bigint,
  'el importe de la opción aprobada pasa a ser el presupuesto del trabajo'
);

select lives_ok(
  $$
    select public.guardar_proyecto(
      '{"id": "aaaaaaaa-0000-7000-8000-000000000010", "version": null,
        "cliente_id": "aaaaaaaa-0000-7000-8000-000000000001", "titulo": "Escritorio", "comprobante": "sin_comprobante",
        "estado": "presupuesto_enviado", "presupuesto_centavos": null}'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      '[{"id": "aaaaaaaa-0000-7000-8000-000000000101", "descripcion": "Solo el escritorio de Alan",
         "monto_centavos": 124800000, "aprobada": false},
        {"id": "aaaaaaaa-0000-7000-8000-000000000102", "descripcion": "Los 2 escritorios",
         "monto_centavos": 230000000, "aprobada": true}]'::jsonb
    )
  $$,
  'el cliente cambia de opinión y aprueba la otra'
);

select is(
  (select presupuesto_centavos from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000010'),
  230000000::bigint,
  'y el presupuesto del trabajo pasa a ser el de esa'
);

select lives_ok(
  $$
    select public.guardar_proyecto(
      '{"id": "aaaaaaaa-0000-7000-8000-000000000010", "version": null,
        "cliente_id": "aaaaaaaa-0000-7000-8000-000000000001", "titulo": "Escritorio", "comprobante": "sin_comprobante",
        "estado": "presupuesto_enviado", "presupuesto_centavos": null}'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      '[{"id": "aaaaaaaa-0000-7000-8000-000000000101", "descripcion": "Solo el escritorio de Alan",
         "monto_centavos": 124800000, "aprobada": false},
        {"id": "aaaaaaaa-0000-7000-8000-000000000102", "descripcion": "Los 2 escritorios",
         "monto_centavos": 230000000, "aprobada": false}]'::jsonb
    )
  $$,
  'destildar todas también se puede: el cliente todavía no decidió'
);

select is(
  (select presupuesto_centavos from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000010'),
  null::bigint,
  'y el trabajo vuelve a no tener presupuesto'
);

select throws_ok(
  $$
    select public.guardar_proyecto(
      '{"id": "aaaaaaaa-0000-7000-8000-000000000010", "version": null,
        "cliente_id": "aaaaaaaa-0000-7000-8000-000000000001", "titulo": "Escritorio", "comprobante": "sin_comprobante",
        "estado": "presupuesto_enviado", "presupuesto_centavos": null}'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      '[{"id": "aaaaaaaa-0000-7000-8000-000000000101", "descripcion": "Solo el escritorio de Alan",
         "monto_centavos": 124800000, "aprobada": true},
        {"id": "aaaaaaaa-0000-7000-8000-000000000102", "descripcion": "Los 2 escritorios",
         "monto_centavos": 230000000, "aprobada": true}]'::jsonb
    )
  $$,
  'MN009',
  null,
  'dos opciones aprobadas a la vez se rechazan: el presupuesto quedaría indefinido'
);


-- Mover la aprobación de una a otra, sin mandar la que estaba aprobada ---------------------------------

-- El caso que destapó el 23505: el índice único parcial se evalúa fila por fila y el orden dentro del
-- upsert no está definido, así que la que se apaga tiene que apagarse antes, no en la misma sentencia.
select lives_ok(
  $$
    select public.guardar_proyecto(
      '{"id": "aaaaaaaa-0000-7000-8000-000000000010", "version": null,
        "cliente_id": "aaaaaaaa-0000-7000-8000-000000000001", "titulo": "Escritorio", "comprobante": "sin_comprobante",
        "estado": "presupuesto_enviado", "presupuesto_centavos": null}'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      '[{"id": "aaaaaaaa-0000-7000-8000-000000000102", "descripcion": "Los 2 escritorios",
         "monto_centavos": 230000000, "aprobada": true}]'::jsonb
    )
  $$,
  'se aprueba la otra sin mandar en el pedido la que estaba aprobada'
);

select is(
  (select array_agg(id::text order by id) from public.opciones_de_presupuesto
   where proyecto_id = 'aaaaaaaa-0000-7000-8000-000000000010' and aprobada and deleted_at is null),
  array['aaaaaaaa-0000-7000-8000-000000000102'],
  'queda una sola aprobada: la anterior se apagó sola'
);


-- Un bundle viejo no conoce las opciones y no las puede pisar -------------------------------------------

select lives_ok(
  $$
    select public.guardar_proyecto(
      '{"id": "aaaaaaaa-0000-7000-8000-000000000010", "version": null,
        "cliente_id": "aaaaaaaa-0000-7000-8000-000000000001", "titulo": "Escritorio", "comprobante": "sin_comprobante",
        "estado": "presupuesto_enviado", "presupuesto_centavos": null}'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      '[{"id": "aaaaaaaa-0000-7000-8000-000000000101", "descripcion": "Solo el escritorio de Alan",
         "monto_centavos": 124800000, "aprobada": true},
        {"id": "aaaaaaaa-0000-7000-8000-000000000102", "descripcion": "Los 2 escritorios",
         "monto_centavos": 230000000, "aprobada": false}]'::jsonb
    )
  $$,
  'se vuelve a aprobar la de Alan'
);

select is(
  (select presupuesto_centavos from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000010'),
  124800000::bigint,
  'el presupuesto es el de la aprobada'
);

-- Tres argumentos: es lo que manda un bundle viejo servido por el service worker.
select lives_ok(
  $$
    select public.guardar_proyecto(
      '{"id": "aaaaaaaa-0000-7000-8000-000000000010", "version": null,
        "cliente_id": "aaaaaaaa-0000-7000-8000-000000000001", "titulo": "Escritorio", "comprobante": "sin_comprobante",
        "estado": "presupuesto_enviado", "presupuesto_centavos": 50000000}'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb
    )
  $$,
  'un bundle viejo guarda el trabajo con tres argumentos, sin enterarse de las opciones'
);

select is(
  (select presupuesto_centavos from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000010'),
  124800000::bigint,
  'y no le cambia el presupuesto: sigue saliendo de la opción aprobada'
);

select is(
  (select count(*)::int from public.opciones_de_presupuesto
   where proyecto_id = 'aaaaaaaa-0000-7000-8000-000000000010' and deleted_at is null),
  2,
  'ni le borra las opciones que no conoce'
);


-- La réplica y el aislamiento ---------------------------------------------------------------------------

select is(
  (select array_agg(e ->> 'id' order by e ->> 'id')
   from jsonb_array_elements(public.bootstrap() -> 'opciones_de_presupuesto') as e),
  array['aaaaaaaa-0000-7000-8000-000000000101', 'aaaaaaaa-0000-7000-8000-000000000102'],
  'bootstrap() trae las opciones del taller'
);

select throws_ok(
  $$ insert into public.opciones_de_presupuesto (proyecto_id, monto_centavos)
     values ('bbbbbbbb-0000-7000-8000-000000000010', 1000) $$,
  '23503',
  null,
  'ana no le cuelga una opción a un trabajo de otro taller'
);

select throws_ok(
  $$ insert into public.opciones_de_presupuesto (proyecto_id, monto_centavos)
     values ('aaaaaaaa-0000-7000-8000-000000000010', -1) $$,
  '23514',
  null,
  'una opción no vale menos que cero'
);

select tests.entrar_como(tests.id('beto'));

select is(
  (select count(*)::int from public.opciones_de_presupuesto),
  0,
  'beto no ve las opciones de ana'
);

select tests.entrar_como(tests.id('ana'));


-- El invariante lo garantiza la base, no la pantalla -----------------------------------------------------

-- El trigger es diferido: adentro de una transacción el proyecto se escribe antes que sus hijas, así que
-- el chequeo corre al final. Para verlo acá hay que adelantarlo a mano.
select throws_ok(
  $$
    do $prueba$
    begin
      update public.proyectos set presupuesto_centavos = 50000000
      where id = 'aaaaaaaa-0000-7000-8000-000000000010';
      execute 'set constraints all immediate';
    end
    $prueba$
  $$,
  'MN009',
  null,
  'con opciones vivas no hay forma de escribirle el presupuesto a mano por otro camino'
);

select throws_ok(
  $$
    do $prueba$
    begin
      update public.opciones_de_presupuesto set aprobada = false
      where proyecto_id = 'aaaaaaaa-0000-7000-8000-000000000010' and aprobada;
      execute 'set constraints all immediate';
    end
    $prueba$
  $$,
  'MN009',
  null,
  'y destildar la aprobada por afuera tampoco deja el presupuesto colgado'
);


-- Sin opciones, el presupuesto se carga como siempre ------------------------------------------------------

select lives_ok(
  $$
    select public.guardar_proyecto(
      '{"id": "aaaaaaaa-0000-7000-8000-000000000010", "version": null,
        "cliente_id": "aaaaaaaa-0000-7000-8000-000000000001", "titulo": "Escritorio", "comprobante": "sin_comprobante",
        "estado": "presupuesto_enviado", "presupuesto_centavos": 70000000}'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      '[{"id": "aaaaaaaa-0000-7000-8000-000000000101", "borrado": true},
        {"id": "aaaaaaaa-0000-7000-8000-000000000102", "borrado": true}]'::jsonb
    )
  $$,
  'se sacan las opciones y se carga el presupuesto a mano en el mismo guardado'
);

select is(
  (select presupuesto_centavos from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000010'),
  70000000::bigint,
  'sin opciones, el presupuesto es el que manda el usuario'
);

select is(
  (select count(*)::int from public.opciones_de_presupuesto
   where proyecto_id = 'aaaaaaaa-0000-7000-8000-000000000010' and deleted_at is null),
  0,
  'y las opciones quedaron dadas de baja'
);


-- La seña propia del trabajo ------------------------------------------------------------------------------

select lives_ok(
  $$
    select public.guardar_proyecto(
      '{"id": "aaaaaaaa-0000-7000-8000-000000000010", "version": null,
        "cliente_id": "aaaaaaaa-0000-7000-8000-000000000001", "titulo": "Escritorio", "comprobante": "sin_comprobante",
        "estado": "presupuesto_enviado", "presupuesto_centavos": 70000000, "sena_bp": 4000}'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb
    )
  $$,
  'a este trabajo se le pide otra seña'
);

select is(
  (select sena_bp from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000010'),
  4000,
  'la seña propia del trabajo quedó guardada'
);

select lives_ok(
  $$
    select public.guardar_proyecto(
      '{"id": "aaaaaaaa-0000-7000-8000-000000000010", "version": null,
        "cliente_id": "aaaaaaaa-0000-7000-8000-000000000001", "titulo": "Escritorio", "comprobante": "sin_comprobante",
        "estado": "presupuesto_enviado", "presupuesto_centavos": 70000000}'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb
    )
  $$,
  'un guardado que no manda la clave de la seña'
);

select is(
  (select sena_bp from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000010'),
  4000,
  'no la borra, igual que el vencimiento y la visita hecha'
);


-- Borrar el trabajo se lleva sus opciones ------------------------------------------------------------------

select lives_ok(
  $$
    select public.guardar_proyecto(
      '{"id": "aaaaaaaa-0000-7000-8000-000000000020", "version": null,
        "cliente_id": "aaaaaaaa-0000-7000-8000-000000000001", "titulo": "Vanitory", "comprobante": "sin_comprobante",
        "estado": "a_presupuestar", "presupuesto_centavos": null}'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      '[{"id": "aaaaaaaa-0000-7000-8000-000000000201", "descripcion": "Con bacha de apoyo",
         "monto_centavos": 49420000, "aprobada": false}]'::jsonb
    )
  $$,
  'otro trabajo, con una opción'
);

select lives_ok(
  $$ update public.proyectos set deleted_at = now() where id = 'aaaaaaaa-0000-7000-8000-000000000020' $$,
  'se borra ese trabajo'
);

select isnt(
  (select deleted_at from public.opciones_de_presupuesto where id = 'aaaaaaaa-0000-7000-8000-000000000201'),
  null,
  'borrar un trabajo se lleva sus opciones, como sus pagos y sus gastos'
);

select tests.entrar_como_anon();

select throws_ok(
  $$ insert into public.opciones_de_presupuesto (proyecto_id, monto_centavos)
     values ('aaaaaaaa-0000-7000-8000-000000000010', 1000) $$,
  '42501',
  null,
  'sin sesión no se carga ninguna opción'
);

select * from finish();
