-- La máquina de estados aplicada por la base. Las tablas enteras las compara contra @maun/domain
-- packages/db/tests/dominio-vs-sql.test.ts; acá se prueba que la guarda las hace cumplir. Cerrar
-- como perdido y reactivar se prueban en 11_perdido.sql.

select plan(13);

select tests.guardar('a', tests.crear_usuario('a@maun.test'));
select tests.guardar('household_a', private.crear_household('Taller A', tests.id('a')));

select tests.entrar_como(tests.id('a'));

insert into public.clientes (id, nombre) values ('aaaaaaaa-0000-7000-8000-000000000001', 'Marcela');
insert into public.proyectos (id, cliente_id, titulo)
  values ('aaaaaaaa-0000-7000-8000-000000000010', 'aaaaaaaa-0000-7000-8000-000000000001', 'Placard');

update public.proyectos set estado = 'relevamiento' where id = 'aaaaaaaa-0000-7000-8000-000000000010';
update public.proyectos set estado = 'a_presupuestar' where id = 'aaaaaaaa-0000-7000-8000-000000000010';
update public.proyectos set estado = 'presupuesto_enviado' where id = 'aaaaaaaa-0000-7000-8000-000000000010';

select is(
  (select estado::text from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000010'),
  'presupuesto_enviado',
  'un lead avanza por el seguimiento'
);

select throws_ok(
  $$ update public.proyectos set estado = 'entregado' where id = 'aaaaaaaa-0000-7000-8000-000000000010' $$,
  'MN007', null, 'un lead no salta a entregado'
);

select lives_ok(
  $$ update public.proyectos set estado = 'en_curso' where id = 'aaaaaaaa-0000-7000-8000-000000000010' $$,
  'un presupuesto aceptado pasa a obra'
);

select throws_ok(
  $$ update public.proyectos set estado = 'contacto' where id = 'aaaaaaaa-0000-7000-8000-000000000010' $$,
  'MN007', null, 'una obra no vuelve a contacto'
);

select lives_ok(
  $$ update public.proyectos set estado = 'entregado' where id = 'aaaaaaaa-0000-7000-8000-000000000010' $$,
  'la obra se entrega'
);

select throws_ok(
  $$ update public.proyectos set estado = 'cobrado' where id = 'aaaaaaaa-0000-7000-8000-000000000010' $$,
  'MN007', null, 'a cobrado no se llega editando el estado: se llega con cobrar_proyecto'
);

select throws_ok(
  $$ update public.proyectos set estado = 'perdido' where id = 'aaaaaaaa-0000-7000-8000-000000000010' $$,
  'MN007', null, 'lo entregado tampoco pasa a perdido editando el estado'
);

select lives_ok(
  $$ update public.proyectos set estado = 'en_curso' where id = 'aaaaaaaa-0000-7000-8000-000000000010' $$,
  'lo entregado puede volver al taller'
);

select lives_ok(
  $$ update public.proyectos set estado = 'en_curso', notas = 'Sigue en obra' where id = 'aaaaaaaa-0000-7000-8000-000000000010' $$,
  'repetir el mismo estado junto con otro cambio no es una transición'
);

select throws_ok(
  $$ update public.proyectos set estado = 'perdido' where id = 'aaaaaaaa-0000-7000-8000-000000000010' $$,
  'MN007', null, 'una obra que se cae se cierra con cerrar_perdido, no editando el estado'
);

select throws_ok(
  $$ insert into public.proyectos (cliente_id, titulo, estado) values ('aaaaaaaa-0000-7000-8000-000000000001', 'Nace cobrado', 'cobrado') $$,
  'MN007', null, 'un proyecto no se crea cobrado'
);

select throws_ok(
  $$ insert into public.proyectos (cliente_id, titulo, estado) values ('aaaaaaaa-0000-7000-8000-000000000001', 'Nace perdido', 'perdido') $$,
  'MN007', null, 'ni perdido: los dos se llegan liquidando'
);

select lives_ok(
  $$ insert into public.proyectos (cliente_id, titulo, estado) values ('aaaaaaaa-0000-7000-8000-000000000001', 'Migrado del sistema viejo', 'entregado') $$,
  'un proyecto puede nacer en cualquier otro estado, por ejemplo al migrar datos'
);

select * from finish();
