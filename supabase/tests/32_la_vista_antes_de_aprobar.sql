-- La vista del cliente antes de aprobar (ADR 0067). Un campo cargado no es un hecho: un trabajo sin
-- aprobar puede tener la dirección, el inicio y la entrega cargados, y la vista no los manda. Cada
-- dato viaja desde la etapa en la que es cierto; la seña sale de una sola función; hasta cuándo vale
-- el presupuesto viaja solo mientras espera la seña, y guardar_proyecto la escribe solo si viene la
-- clave.

select plan(48);

select tests.guardar('ana', tests.crear_usuario('ana@maun.test'));
select tests.guardar('household_a', private.crear_household('Taller de Ana', tests.id('ana')));

create function tests.la_vista()
returns jsonb
language sql
as $$
  select public.vista_del_cliente('bbbbbbbb-0000-7000-8000-000000000010')
$$;

create function tests.el_contacto(p_version integer, p_extra jsonb default '{}'::jsonb)
returns jsonb
language sql
as $$
  select jsonb_build_object(
    'id', 'bbbbbbbb-0000-7000-8000-000000000020', 'version', p_version,
    'cliente_id', 'bbbbbbbb-0000-7000-8000-000000000001', 'titulo', 'Rack', 'descripcion', '',
    'estado', 'presupuesto_enviado', 'comprobante', 'sin_comprobante', 'notas', ''
  ) || p_extra
$$;

create function tests.vale_hasta_del_contacto()
returns date
language sql
as $$
  select presupuesto_vale_hasta from public.proyectos where id = 'bbbbbbbb-0000-7000-8000-000000000020'
$$;

select tests.entrar_como(tests.id('ana'));

update public.ajustes set cobro_alias = 'taller.maun.ok'
  where household_id = tests.id('household_a');

insert into public.clientes (id, nombre)
  values ('bbbbbbbb-0000-7000-8000-000000000001', 'Lucía Ferreyra');

-- Con el presupuesto mandado y sin aprobar, pero con todo lo que después se promete ya cargado: es lo
-- que tiene el Escritorio en producción, que vino así del sistema viejo. Vale hasta el 2 de octubre.
insert into public.proyectos (
  id, cliente_id, titulo, estado, presupuesto_centavos, fecha_inicio, entrega_estimada,
  direccion_entrega, presupuesto_vale_hasta
) values (
  'bbbbbbbb-0000-7000-8000-000000000010', 'bbbbbbbb-0000-7000-8000-000000000001', 'Escritorio',
  'presupuesto_enviado', 124800000, '2026-08-14', '2026-10-10', 'Belgrano 455, Haedo',
  '2026-10-02'
);

insert into public.pagos (id, proyecto_id, fecha, concepto, monto_centavos)
  values ('bbbbbbbb-0000-7000-8000-000000000100', 'bbbbbbbb-0000-7000-8000-000000000010',
          '2026-08-13', 'Relevamiento Tecnico', 12000000);


-- Presupuesto mandado y sin aprobar: lo cargado no viaja ----------------------------------------------

select is(
  tests.la_vista() ->> 'direccion',
  '',
  'sin aprobar, la dirección no viaja: la clave va vacía para que una versión vieja de la app la siga leyendo'
);

select is(tests.la_vista() #> '{fechas,inicio}', 'null'::jsonb, 'ni el día de inicio');

select is(tests.la_vista() #> '{fechas,entrega_pautada}', 'null'::jsonb, 'ni la entrega');

select is(tests.la_vista() #> '{fechas,aprobado}', 'null'::jsonb, 'ni un día de aprobación');

select is_empty(
  format(
    $$
      select v.aguja
      from unnest(array['Belgrano 455', '2026-08-14', '2026-10-10']) as v (aguja)
      where %L like '%%' || v.aguja || '%%'
    $$,
    tests.la_vista()::text
  ),
  'en el JSON entero no aparece ni la dirección, ni el inicio, ni la entrega cargados'
);

select is(
  tests.la_vista() #>> '{pagos,0,concepto}',
  'Relevamiento Tecnico',
  'el pago del relevamiento viaja, con su nombre'
);

select is(
  tests.la_vista() -> 'precio_centavos',
  to_jsonb(124800000::bigint),
  'y el presupuesto también: es lo que el cliente tiene que aprobar'
);

select is(
  tests.la_vista() #>> '{fechas,vale_hasta}',
  '2026-10-02',
  'y hasta cuándo vale el presupuesto, que es la fecha de la proyección'
);


-- La seña: una sola cuenta ---------------------------------------------------------------------------------

select is(
  tests.la_vista() -> 'sena_centavos',
  to_jsonb(62400000::bigint),
  'la seña para arrancar viaja en pesos: la mitad del presupuesto, con el porcentaje del taller'
);

select is(
  tests.la_vista() -> 'pago',
  jsonb_build_object(
    'instancia', 'sena',
    'formas', jsonb_build_array('transferencia', 'efectivo'),
    'monto_centavos', 50400000,
    'siguiente', jsonb_build_object(
      'instancia', 'saldo',
      'formas', jsonb_build_array('transferencia', 'efectivo'),
      'monto_centavos', 62400000
    )
  ),
  'lo que se le pide es la seña menos lo que ya pagó: el relevamiento queda a cuenta'
);

select is(
  (tests.la_vista() ->> 'sena_centavos')::bigint - 12000000,
  (tests.la_vista() #>> '{pago,monto_centavos}')::bigint,
  'la seña de arriba menos lo pagado es exactamente lo que pide «Cómo pagar»: salen de la misma función'
);

select is(
  private.sena_esperada(124800000, 5000),
  62400000::bigint,
  'private.sena_esperada es la cuenta de la seña'
);

select is(private.sena_esperada(1, 5000), 1::bigint, 'con medio centavo para arriba, como el dominio');

select is(private.sena_esperada(null, 5000), null::bigint, 'y sin presupuesto no hay seña');

-- Con la seña cubierta antes de aprobar, para aprobar no le falta pagar nada: el saldo existe desde
-- que aprueba, así que tampoco se le pide.
insert into public.pagos (id, proyecto_id, fecha, concepto, monto_centavos)
  values ('bbbbbbbb-0000-7000-8000-000000000101', 'bbbbbbbb-0000-7000-8000-000000000010',
          '2026-08-20', 'A cuenta', 60000000);

select is(
  tests.la_vista() -> 'pago',
  jsonb_build_object(
    'instancia', null, 'formas', jsonb_build_array(), 'monto_centavos', null, 'siguiente', null
  ),
  'con la seña cubierta y sin aprobar, no se le pide el saldo'
);

select is(
  tests.la_vista() -> 'cobro',
  jsonb_build_object('alias', null, 'cbu', null, 'titular', null, 'cuit', null, 'link', null),
  'y como no toca ningún pago, la cuenta no viaja'
);

select is(
  tests.la_vista() -> 'sena_centavos',
  to_jsonb(62400000::bigint),
  'la seña sigue siendo la seña: la pantalla dice que ya la cubrió'
);

update public.pagos set deleted_at = now() where id = 'bbbbbbbb-0000-7000-8000-000000000101';


-- Antes de mandar el presupuesto, el número guardado es un borrador ----------------------------------------

update public.proyectos set estado = 'a_presupuestar'
  where id = 'bbbbbbbb-0000-7000-8000-000000000010';

select is(
  tests.la_vista() -> 'precio_centavos',
  'null'::jsonb,
  'a presupuestar, el presupuesto guardado no viaja: todavía no se le mandó'
);

select is(tests.la_vista() -> 'sena_centavos', 'null'::jsonb, 'ni la seña que saldría de él');

select is(
  tests.la_vista() #> '{fechas,vale_hasta}',
  'null'::jsonb,
  'ni hasta cuándo vale: no hay presupuesto mandado'
);

select is(
  tests.la_vista() #> '{pago,monto_centavos}',
  'null'::jsonb,
  'y lo que viene se anticipa sin importe, como en cualquier trabajo sin presupuesto'
);


-- Aprobado: desde ahí todo es cierto y todo viaja ----------------------------------------------------------

update public.proyectos set estado = 'presupuesto_enviado'
  where id = 'bbbbbbbb-0000-7000-8000-000000000010';
update public.proyectos set estado = 'en_curso'
  where id = 'bbbbbbbb-0000-7000-8000-000000000010';

select is(tests.la_vista() ->> 'direccion', 'Belgrano 455, Haedo', 'aprobado, la dirección viaja');

select is(tests.la_vista() #>> '{fechas,inicio}', '2026-08-14', 'y el día de inicio');

select is(tests.la_vista() #>> '{fechas,entrega_pautada}', '2026-10-10', 'y la entrega pautada');

select is(
  tests.la_vista() #>> '{fechas,aprobado}',
  ((now() at time zone 'America/Argentina/Buenos_Aires')::date)::text,
  'y el día de la aprobación, que sale de su registro y no de un pago'
);

select is(
  tests.la_vista() #> '{fechas,vale_hasta}',
  'null'::jsonb,
  'hasta cuándo valía el presupuesto ya no viaja: está aprobado'
);

select is(
  tests.la_vista() -> 'sena_centavos',
  to_jsonb(62400000::bigint),
  'la seña acordada viaja en pesos'
);

select is(
  tests.la_vista() #>> '{pago,instancia}',
  'sena',
  'aprobado sin la seña completa, lo que toca es lo que falta de ella'
);

insert into public.pagos (id, proyecto_id, fecha, concepto, monto_centavos)
  values ('bbbbbbbb-0000-7000-8000-000000000102', 'bbbbbbbb-0000-7000-8000-000000000010',
          '2026-09-24', 'Seña', 50400000);

select is(
  tests.la_vista() -> 'pago',
  jsonb_build_object(
    'instancia', 'saldo',
    'formas', jsonb_build_array('transferencia', 'efectivo'),
    'monto_centavos', 62400000,
    'siguiente', null
  ),
  'con la seña cubierta, desde la aprobación lo que toca es el saldo'
);

-- Una entrega cargada con la obra todavía en el taller no es una entrega.
update public.proyectos set fecha_entrega = '2026-09-30'
  where id = 'bbbbbbbb-0000-7000-8000-000000000010';

select is(
  tests.la_vista() #> '{fechas,entregado}',
  'null'::jsonb,
  'en curso, el día de entrega cargado no viaja'
);

update public.proyectos set estado = 'entregado'
  where id = 'bbbbbbbb-0000-7000-8000-000000000010';

select is(tests.la_vista() #>> '{fechas,entregado}', '2026-09-30', 'entregado, viaja');

-- Si vuelve a presupuesto, vuelve a no estar aprobado, aunque el registro de la aprobación quede.
update public.proyectos set estado = 'en_curso', fecha_entrega = null
  where id = 'bbbbbbbb-0000-7000-8000-000000000010';
update public.proyectos set estado = 'presupuesto_enviado'
  where id = 'bbbbbbbb-0000-7000-8000-000000000010';

select is(
  array[
    tests.la_vista() ->> 'direccion',
    tests.la_vista() #>> '{fechas,aprobado}',
    tests.la_vista() #>> '{fechas,inicio}',
    tests.la_vista() #>> '{fechas,entrega_pautada}'
  ],
  array['', null, null, null],
  'vuelto a presupuesto, ni la dirección, ni la aprobación, ni el inicio, ni la entrega viajan'
);


-- Las dos puertas dicen lo mismo ------------------------------------------------------------------------------

insert into public.enlaces_publicos (id, proyecto_id, token_hash)
  values (
    'bbbbbbbb-0000-7000-8000-000000000300',
    'bbbbbbbb-0000-7000-8000-000000000010',
    encode(sha256(convert_to('el-token-del-escritorio-26', 'UTF8')), 'hex')
  );

select set_config('tests.payload', tests.la_vista()::text, true);

select tests.entrar_como_anon();

select is(
  public.vista_compartida('el-token-del-escritorio-26')::text,
  current_setting('tests.payload'),
  'por el enlace se ve exactamente lo mismo que desde la app, también antes de aprobar'
);

select throws_ok(
  $$ select private.sena_esperada(100, 5000) $$,
  '42501',
  null,
  'el rol anónimo no puede ejecutar la cuenta de la seña: vive en private'
);

select is(
  has_column_privilege('anon', 'public.proyectos', 'presupuesto_vale_hasta', 'SELECT'),
  false,
  'ni leer hasta cuándo vale un presupuesto'
);

select is(
  has_column_privilege('anon', 'public.ajustes', 'presupuesto_vale_dias', 'SELECT'),
  false,
  'ni los días que valen en el taller'
);

select tests.salir();
select tests.entrar_como(tests.id('ana'));


-- Los días que vale un presupuesto, en Ajustes --------------------------------------------------------------

select is(
  (select presupuesto_vale_dias from public.ajustes where household_id = tests.id('household_a')),
  15,
  'un taller arranca con presupuestos que valen quince días'
);

select throws_ok(
  format(
    $$ update public.ajustes set presupuesto_vale_dias = 0 where household_id = %L $$,
    tests.id('household_a')
  ),
  '23514',
  null,
  'un presupuesto que vale cero días lo frena la base'
);

select throws_ok(
  format(
    $$ update public.ajustes set presupuesto_vale_dias = 366 where household_id = %L $$,
    tests.id('household_a')
  ),
  '23514',
  null,
  'y uno de más de un año también'
);

select lives_ok(
  format(
    $$ update public.ajustes set presupuesto_vale_dias = 30 where household_id = %L $$,
    tests.id('household_a')
  ),
  'el dueño los cambia: la columna tiene grant de update'
);


-- guardar_proyecto la escribe solo si viene la clave ------------------------------------------------------

select lives_ok(
  format(
    $$ select public.guardar_proyecto(%L::jsonb, '[]'::jsonb, '[]'::jsonb) $$,
    tests.el_contacto(null, jsonb_build_object('presupuesto_vale_hasta', '2026-10-09'))
  ),
  'un alta con la fecha la guarda'
);

select is(tests.vale_hasta_del_contacto(), '2026-10-09'::date, 'y queda guardada');

select lives_ok(
  format(
    $$ select public.guardar_proyecto(%L::jsonb, '[]'::jsonb, '[]'::jsonb) $$,
    tests.el_contacto(
      (select version from public.proyectos where id = 'bbbbbbbb-0000-7000-8000-000000000020'),
      jsonb_build_object('titulo', 'Rack de living')
    )
  ),
  'un guardado sin la clave, como el de un bundle viejo, no rebota'
);

select is(
  tests.vale_hasta_del_contacto(),
  '2026-10-09'::date,
  'y no borra la fecha que no conoce'
);

select lives_ok(
  format(
    $$ select public.guardar_proyecto(%L::jsonb, '[]'::jsonb, '[]'::jsonb) $$,
    tests.el_contacto(
      (select version from public.proyectos where id = 'bbbbbbbb-0000-7000-8000-000000000020'),
      jsonb_build_object('titulo', 'Rack de living', 'presupuesto_vale_hasta', '2026-10-16')
    )
  ),
  'con la clave la cambia'
);

select is(tests.vale_hasta_del_contacto(), '2026-10-16'::date, 'y queda la nueva');

select lives_ok(
  format(
    $$ select public.guardar_proyecto(%L::jsonb, '[]'::jsonb, '[]'::jsonb) $$,
    tests.el_contacto(
      (select version from public.proyectos where id = 'bbbbbbbb-0000-7000-8000-000000000020'),
      jsonb_build_object('titulo', 'Rack de living', 'presupuesto_vale_hasta', '')
    )
  ),
  'vacía, como la manda un campo de fecha borrado, no rebota'
);

select is(tests.vale_hasta_del_contacto(), null::date, 'y la borra: el presupuesto queda sin fecha');

select * from finish();
