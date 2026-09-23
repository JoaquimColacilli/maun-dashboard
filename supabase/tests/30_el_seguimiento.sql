-- El seguimiento de un «por ahora no» (ADR 0064): se entra desde cualquier etapa de las consultas con
-- el día en que hay que volver a escribirle, la base guarda la etapa a la que vuelve, un trabajo tiene
-- a lo sumo un contacto pendiente y está en seguimiento si y solo si lo tiene. Se sale reactivando,
-- dando por perdido o con otra fecha, y lo registrado queda como historia. El cliente no se entera.
--
-- Las guardas que miran el estado y el pendiente juntos son diferidas al commit, que en un test no
-- llega nunca: los casos que las prueban las disparan con set constraints all immediate, y las devuelven
-- a diferidas en la misma sentencia. Un set constraints suelto se filtra a los tests que siguen en el
-- ensayo, que corre todos los archivos en una sola transacción: al volver al savepoint, Postgres no
-- deshace lo que cambió una subtransacción ya confirmada, como la de lives_ok.

select plan(42);

select tests.guardar('a', tests.crear_usuario('a@maun.test'));
select tests.guardar('household_a', private.crear_household('Taller A', tests.id('a')));
select set_config('maun.hoy_en_el_taller', '2026-09-23', true);

create function pg_temp.proyecto(p_id uuid, p_titulo text, p_estado text, p_extra jsonb default '{}')
returns jsonb
language sql
as $$
  select jsonb_build_object(
    'id', p_id,
    'version', (select version from public.proyectos where id = p_id),
    'cliente_id', 'aaaaaaaa-0000-7000-8000-000000000001',
    'titulo', p_titulo,
    'estado', p_estado,
    'comprobante', 'sin_comprobante',
    'presupuesto_centavos', (select presupuesto_centavos from public.proyectos where id = p_id)
  ) || p_extra
$$;

select tests.entrar_como(tests.id('a'));

insert into public.clientes (id, nombre) values ('aaaaaaaa-0000-7000-8000-000000000001', 'Lucía');
insert into public.proyectos (id, cliente_id, titulo, estado, presupuesto_centavos) values
  ('aaaaaaaa-0000-7000-8000-000000000010', 'aaaaaaaa-0000-7000-8000-000000000001', 'Placard', 'presupuesto_enviado', 90000000),
  ('aaaaaaaa-0000-7000-8000-000000000020', 'aaaaaaaa-0000-7000-8000-000000000001', 'Mesa', 'a_presupuestar', null),
  ('aaaaaaaa-0000-7000-8000-000000000030', 'aaaaaaaa-0000-7000-8000-000000000001', 'Vestidor', 'presupuesto_estimativo', 50000000),
  ('aaaaaaaa-0000-7000-8000-000000000040', 'aaaaaaaa-0000-7000-8000-000000000001', 'En obra', 'en_curso', null),
  ('aaaaaaaa-0000-7000-8000-000000000050', 'aaaaaaaa-0000-7000-8000-000000000001', 'Rack', 'contacto', null),
  ('aaaaaaaa-0000-7000-8000-000000000060', 'aaaaaaaa-0000-7000-8000-000000000001', 'Biblioteca', 'presupuesto_enviado', 70000000);


-- Entrar en seguimiento ------------------------------------------------------------------------------

select lives_ok(
  $$ select public.guardar_proyecto(
       pg_temp.proyecto('aaaaaaaa-0000-7000-8000-000000000010', 'Placard', 'en_seguimiento'),
       '[]', '[]', null, null,
       '[{"id": "aaaaaaaa-0000-7000-8000-000000000101", "fecha": "2026-10-23", "nota": "Después de las vacaciones", "etapa_previa": "contacto"}]') $$,
  'un presupuesto enviado pasa a seguimiento con el día en que hay que volver a escribirle'
);

select is(
  (select estado::text from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000010'),
  'en_seguimiento', 'queda en seguimiento'
);

select is(
  (select etapa_previa::text from public.proximos_contactos where id = 'aaaaaaaa-0000-7000-8000-000000000101'),
  'presupuesto_enviado',
  'la etapa a la que vuelve la pone la base con la que tenía el trabajo, no la que dijo la app'
);

select is(
  (select array[fecha::text, nota] from public.proximos_contactos where id = 'aaaaaaaa-0000-7000-8000-000000000101'),
  array['2026-10-23', 'Después de las vacaciones'],
  'el pendiente guarda el día y la nota'
);

select lives_ok($$ set constraints all immediate; set constraints all deferred $$, 'en seguimiento con su pendiente: la guarda del commit pasa');

select throws_ok(
  $$ select public.guardar_proyecto(
       pg_temp.proyecto('aaaaaaaa-0000-7000-8000-000000000010', 'Placard', 'en_seguimiento'),
       '[]', '[]', null, null,
       '[{"id": "aaaaaaaa-0000-7000-8000-000000000109", "fecha": "2026-11-01", "etapa_previa": "presupuesto_enviado"}]') $$,
  'MN006', null, 'un segundo pendiente sin cerrar el primero choca como un cambio desde otro lado'
);

select throws_ok(
  $$ select public.guardar_proyecto(
       pg_temp.proyecto('aaaaaaaa-0000-7000-8000-000000000010', 'Placard', 'en_seguimiento'),
       '[]', '[]', null, null,
       '[{"id": "aaaaaaaa-0000-7000-8000-000000000109", "fecha": "2026-11-01", "etapa_previa": "en_curso"}]') $$,
  '22004', null, 'no se vuelve a la obra: la etapa previa es una de las consultas'
);

select throws_ok(
  $$ select public.guardar_proyecto(
       pg_temp.proyecto('aaaaaaaa-0000-7000-8000-000000000010', 'Placard', 'en_seguimiento'),
       '[]', '[]', null, null,
       '[{"id": "aaaaaaaa-0000-7000-8000-000000000109", "etapa_previa": "presupuesto_enviado"}]') $$,
  '22004', null, 'un próximo contacto sin día no se guarda'
);


-- Registrar el contacto: sigue con otra fecha --------------------------------------------------------

select lives_ok(
  $$ select public.guardar_proyecto(
       pg_temp.proyecto('aaaaaaaa-0000-7000-8000-000000000010', 'Placard', 'en_seguimiento', '{"ultimo_contacto": "2026-09-23"}'),
       '[]', '[]', null, null,
       '[{"id": "aaaaaaaa-0000-7000-8000-000000000101", "fecha": "2026-10-23", "nota": "Después de las vacaciones", "etapa_previa": "presupuesto_enviado", "hecho_el": "2026-09-23", "resultado": "otra_fecha", "respuesta": "Que le escriba en noviembre"},
         {"id": "aaaaaaaa-0000-7000-8000-000000000102", "fecha": "2026-11-15", "etapa_previa": "presupuesto_enviado"}]') $$,
  'cerrar el pendiente y abrir el siguiente van en el mismo guardado'
);

select is(
  (select array_agg(id::text) from public.proximos_contactos
   where proyecto_id = 'aaaaaaaa-0000-7000-8000-000000000010' and hecho_el is null and deleted_at is null),
  array['aaaaaaaa-0000-7000-8000-000000000102'],
  'queda un solo pendiente, el nuevo'
);

select is(
  (select array[hecho_el::text, resultado, respuesta] from public.proximos_contactos where id = 'aaaaaaaa-0000-7000-8000-000000000101'),
  array['2026-09-23', 'otra_fecha', 'Que le escriba en noviembre'],
  'el anterior queda como historia: el día, el resultado y lo que contestó'
);

select lives_ok($$ set constraints all immediate; set constraints all deferred $$, 'con otra fecha sigue en seguimiento con su pendiente');

select throws_ok(
  $$ update public.proximos_contactos set hecho_el = null, resultado = null where id = 'aaaaaaaa-0000-7000-8000-000000000101' $$,
  'MN019', null, 'lo registrado no se reabre'
);

select throws_ok(
  $$ update public.proximos_contactos set hecho_el = '2026-09-24', resultado = 'reactivado' where id = 'aaaaaaaa-0000-7000-8000-000000000102' $$,
  'MN017', null, 'un contacto no se registra en un día que todavía no llegó'
);

select throws_ok(
  $$ update public.proximos_contactos set hecho_el = '2026-09-23' where id = 'aaaaaaaa-0000-7000-8000-000000000102' $$,
  '23514', null, 'registrado quiere decir con resultado'
);


-- Salir del seguimiento --------------------------------------------------------------------------------

select throws_ok(
  $$ select public.guardar_proyecto(
       pg_temp.proyecto('aaaaaaaa-0000-7000-8000-000000000010', 'Placard', 'en_curso'),
       '[]', '[]') $$,
  'MN007', null, 'del seguimiento no se aprueba directo: primero vuelve a las consultas'
);

select lives_ok(
  $$ select public.guardar_proyecto(
       pg_temp.proyecto('aaaaaaaa-0000-7000-8000-000000000010', 'Placard', 'presupuesto_estimativo'),
       '[]', '[]', null, null,
       '[{"id": "aaaaaaaa-0000-7000-8000-000000000102", "fecha": "2026-11-15", "etapa_previa": "presupuesto_enviado", "hecho_el": "2026-09-22", "resultado": "reactivado", "respuesta": "Quiere el más barato"}]') $$,
  'reactivar vuelve a la etapa que se elige, con el contacto registrado en el mismo guardado'
);

select is(
  (select estado::text from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000010'),
  'presupuesto_estimativo', 'vuelve a las consultas, en otra etapa que la de antes si así se eligió'
);

select is(
  (select array[hecho_el::text, resultado, respuesta] from public.proximos_contactos where id = 'aaaaaaaa-0000-7000-8000-000000000102'),
  array['2026-09-22', 'reactivado', 'Quiere el más barato'],
  'el cierre que manda la app pisa al que pone la base: su día y lo que contestó'
);

select lives_ok($$ set constraints all immediate; set constraints all deferred $$, 'fuera del seguimiento y sin pendiente: la guarda pasa');

select lives_ok(
  $$ select public.guardar_proyecto(
       pg_temp.proyecto('aaaaaaaa-0000-7000-8000-000000000030', 'Vestidor', 'en_seguimiento'),
       '[]', '[]', null, null,
       '[{"id": "aaaaaaaa-0000-7000-8000-000000000301", "fecha": "2026-12-01", "etapa_previa": "presupuesto_estimativo"}]') $$,
  'un estimativo también pasa a seguimiento'
);

select lives_ok(
  $$ select public.guardar_proyecto(
       pg_temp.proyecto('aaaaaaaa-0000-7000-8000-000000000030', 'Vestidor', 'relevamiento'),
       '[]', '[]') $$,
  'cambiar la etapa desde el formulario, o desde un bundle viejo, también lo saca del seguimiento'
);

select is(
  (select array[hecho_el::text, resultado] from public.proximos_contactos where id = 'aaaaaaaa-0000-7000-8000-000000000301'),
  array['2026-09-23', 'reactivado'],
  'y el pendiente se cierra solo, reactivado con el día de hoy en el taller'
);

select lives_ok(
  $$ select public.guardar_proyecto(
       pg_temp.proyecto('aaaaaaaa-0000-7000-8000-000000000020', 'Mesa', 'en_seguimiento'),
       '[]', '[]', null, null,
       '[{"id": "aaaaaaaa-0000-7000-8000-000000000201", "fecha": "2026-10-01", "etapa_previa": "a_presupuestar"}]') $$,
  'un trabajo a presupuestar pasa a seguimiento'
);

select lives_ok(
  format(
    $$ select public.cerrar_perdido('aaaaaaaa-0000-7000-8000-000000000020', %s, '2026-09-20', 0, 0, 0, 0, 0, 0, 0, 0, 1000) $$,
    (select version from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000020')
  ),
  'un por ahora no también se da por perdido, por el camino de siempre'
);

select is(
  (select array[hecho_el::text, resultado] from public.proximos_contactos where id = 'aaaaaaaa-0000-7000-8000-000000000201'),
  array['2026-09-20', 'perdido'],
  'el pendiente se cierra como perdido, con el día del cierre'
);

select throws_ok(
  format(
    $$ select public.reactivar_perdido('aaaaaaaa-0000-7000-8000-000000000020', %s, 'en_seguimiento') $$,
    (select version from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000020')
  ),
  'MN007', null, 'un perdido se reactiva a una consulta, no directo a seguimiento: entrar pide la fecha'
);


-- Seguimiento si y solo si hay un pendiente -------------------------------------------------------------

select throws_ok(
  $$ do $b$ begin
       update public.proyectos set estado = 'en_seguimiento' where id = 'aaaaaaaa-0000-7000-8000-000000000050';
       set constraints all immediate;
     end $b$ $$,
  'MN019', null, 'un trabajo no queda en seguimiento sin el día en que hay que escribirle'
);

select throws_ok(
  $$ do $b$ begin
       insert into public.proximos_contactos (proyecto_id, fecha, etapa_previa)
       values ('aaaaaaaa-0000-7000-8000-000000000050', '2026-10-01', 'contacto');
       set constraints all immediate;
     end $b$ $$,
  'MN019', null, 'ni un pendiente queda colgado de un trabajo que no está en seguimiento'
);

select throws_ok(
  $$ do $b$ begin
       insert into public.proyectos (cliente_id, titulo, estado)
       values ('aaaaaaaa-0000-7000-8000-000000000001', 'Nace en seguimiento', 'en_seguimiento');
       set constraints all immediate;
     end $b$ $$,
  'MN019', null, 'tampoco nace en seguimiento sin su pendiente'
);


-- El cliente no se entera ------------------------------------------------------------------------------

select lives_ok(
  $$ select public.guardar_proyecto(
       pg_temp.proyecto('aaaaaaaa-0000-7000-8000-000000000060', 'Biblioteca', 'en_seguimiento'),
       '[]', '[]', null, null,
       '[{"id": "aaaaaaaa-0000-7000-8000-000000000601", "fecha": "2026-10-10", "nota": "Aguja del seguimiento", "etapa_previa": "presupuesto_enviado"}]') $$,
  'la biblioteca pasa a seguimiento'
);

select is(
  public.vista_del_cliente('aaaaaaaa-0000-7000-8000-000000000060') ->> 'estado',
  'presupuesto_enviado',
  'el cliente sigue viendo la etapa en la que estaba'
);

select is(
  (public.vista_del_cliente('aaaaaaaa-0000-7000-8000-000000000060') ->> 'precio_centavos')::bigint,
  70000000::bigint,
  'y el mismo precio'
);

select ok(
  position('Aguja del seguimiento' in public.vista_del_cliente('aaaaaaaa-0000-7000-8000-000000000060')::text) = 0
    and position('en_seguimiento' in public.vista_del_cliente('aaaaaaaa-0000-7000-8000-000000000060')::text) = 0,
  'ni la nota ni el estado nuevo viajan al cliente'
);

select lives_ok(
  $$ select public.guardar_proyecto(
       pg_temp.proyecto('aaaaaaaa-0000-7000-8000-000000000010', 'Placard', 'en_seguimiento'),
       '[]', '[]', null, null,
       '[{"id": "aaaaaaaa-0000-7000-8000-000000000103", "fecha": "2026-12-15", "etapa_previa": "presupuesto_enviado"}]') $$,
  'el placard, que había vuelto a estimativo, vuelve a seguimiento'
);

select is(
  public.vista_del_cliente('aaaaaaaa-0000-7000-8000-000000000010') -> 'precio_centavos',
  'null'::jsonb,
  'y como estaba en estimativo, al cliente el precio no le viaja, igual que antes'
);


-- Un bundle viejo, la sincronización y la baja ----------------------------------------------------------

select lives_ok(
  $$ select public.guardar_proyecto(
       pg_temp.proyecto('aaaaaaaa-0000-7000-8000-000000000060', 'Biblioteca', 'en_seguimiento', '{"notas": "Editado desde un bundle viejo"}'),
       '[]', '[]') $$,
  'un bundle viejo edita un trabajo en seguimiento sin conocer los contactos'
);

select is(
  (select count(*)::integer from public.proximos_contactos
   where proyecto_id = 'aaaaaaaa-0000-7000-8000-000000000060' and hecho_el is null and deleted_at is null),
  1,
  'y el pendiente sigue ahí: sin la clave no se toca'
);

select is(
  jsonb_array_length(public.bootstrap() -> 'proximos_contactos'),
  (select count(*)::integer from public.proximos_contactos where deleted_at is null),
  'bootstrap() trae el seguimiento, con la historia'
);

select ok(
  (select bool_or(e ->> 'id' = 'aaaaaaaa-0000-7000-8000-000000000601')
   from jsonb_array_elements(public.delta(now() - interval '1 minute') -> 'proximos_contactos') as e),
  'delta() trae lo que cambió'
);

update public.proyectos set deleted_at = now() where id = 'aaaaaaaa-0000-7000-8000-000000000060';

select is(
  (select deleted_at is not null from public.proximos_contactos where id = 'aaaaaaaa-0000-7000-8000-000000000601'),
  true,
  'borrar el trabajo se lleva su seguimiento'
);

select lives_ok($$ set constraints all immediate; set constraints all deferred $$, 'un trabajo borrado en seguimiento no pide su pendiente');

select * from finish();
