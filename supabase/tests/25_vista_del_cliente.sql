-- La vista del cliente (ADR 0046): la lista blanca de campos, el link con su token hasheado y el
-- registro de los cambios de etapa.
--
-- El test que importa es el primero: toda columna de proyectos está clasificada, y agregar una
-- columna rompe este archivo hasta que alguien decida si el cliente la puede ver. Sin eso la lista
-- blanca se pudre sola: la función sigue devolviendo lo de siempre y nadie se entera de que apareció
-- algo que habría que haber mirado.

select plan(28);

select tests.guardar('ana', tests.crear_usuario('ana@maun.test'));
select tests.guardar('household_a', private.crear_household('Taller de Ana', tests.id('ana')));
select tests.guardar('beto', tests.crear_usuario('beto@maun.test'));
select tests.guardar('household_b', private.crear_household('Taller de Beto', tests.id('beto')));


-- Toda columna de proyectos está clasificada ---------------------------------------------------------------

-- Las ocho que viajan, aunque sea con otro nombre: titulo es «trabajo», presupuesto_centavos es
-- «precio», direccion_entrega es «direccion» y las cuatro fechas arman el camino. Todas las demás
-- no salen de la base, y eso incluye los costos estimados, el margen que se deriva de ellos, las
-- tareas de presupuestar, las notas de obra, la distribución congelada y las marcas de la agenda.
select set_eq(
  $$
    select a.attname::text
    from pg_attribute a
    where a.attrelid = 'public.proyectos'::regclass and a.attnum > 0 and not a.attisdropped
  $$,
  array[
    -- Viajan
    'titulo', 'estado', 'presupuesto_centavos', 'direccion_entrega',
    'fecha_inicio', 'entrega_estimada', 'fecha_entrega', 'fecha_cobro',
    -- No viajan
    'id', 'household_id', 'cliente_id', 'descripcion', 'forma_pago', 'comprobante',
    'fecha_visita', 'ultimo_contacto', 'notas', 'vencimiento_presupuesto',
    'created_at', 'updated_at', 'deleted_at', 'version',
    'dist_cobrado_centavos', 'dist_gastos_centavos', 'dist_diezmo_bp',
    'dist_tope_sueldo_centavos', 'dist_tope_fijos_centavos', 'dist_diezmo_centavos',
    'dist_sueldo_centavos', 'dist_fijos_centavos', 'dist_remanente_centavos',
    'dist_objetivo_sueldo_centavos', 'dist_objetivo_fijos_centavos', 'dist_sueldo_mensual',
    'dist_sueldo_previo_centavos', 'dist_fijos_previo_centavos', 'dist_liquidado_at',
    'reapertura_objetivo_sueldo_centavos', 'reapertura_objetivo_fijos_centavos',
    'reapertura_sueldo_mensual', 'reapertura_fecha_cobro',
    'presupuesto_diseno', 'presupuesto_despiece', 'presupuesto_cotizacion', 'presupuesto_pdf',
    'visita_hecha', 'visita_importante', 'entrega_importante', 'presupuesto_importante',
    'sena_bp', 'entrega_hora', 'visita_hora',
    'costo_madera_centavos', 'costo_herrajes_centavos', 'costo_flete_centavos',
    'costo_ayudante_centavos'
  ],
  'toda columna de proyectos está clasificada: una columna nueva rompe este test hasta que alguien decida si el cliente la ve'
);


-- Un trabajo con todo lo que el cliente no tiene que ver -----------------------------------------------------

select tests.entrar_como(tests.id('ana'));

insert into public.clientes (id, nombre, telefono, notas)
  values ('aaaaaaaa-0000-7000-8000-000000000001', 'Marcela Duarte', '11-5555-0001', 'Paga tarde');

insert into public.proyectos (
  id, cliente_id, titulo, descripcion, estado, presupuesto_centavos, forma_pago, comprobante,
  fecha_visita, fecha_inicio, entrega_estimada, direccion_entrega, notas, sena_bp
) values (
  'aaaaaaaa-0000-7000-8000-000000000010', 'aaaaaaaa-0000-7000-8000-000000000001',
  'Placard 3 puertas', 'Melamina blanca con herrajes Blum', 'en_curso', 124000000,
  'transferencia', 'factura_b',
  '2026-07-20', '2026-08-24', '2026-10-02', 'Olazábal 1240, Ituzaingó',
  'OJO: el cliente regatea, no bajar de 900', 4321
);

update public.proyectos set
  costo_madera_centavos = 111111,
  costo_herrajes_centavos = 222222,
  costo_flete_centavos = 333333,
  costo_ayudante_centavos = 444444
where id = 'aaaaaaaa-0000-7000-8000-000000000010';

insert into public.gastos (proyecto_id, fecha, descripcion, monto_centavos)
  values ('aaaaaaaa-0000-7000-8000-000000000010', '2026-08-25', 'Maderera Suárez', 555555);

insert into public.necesidades (proyecto_id, tipo, nombre, cantidad)
  values ('aaaaaaaa-0000-7000-8000-000000000010', 'herraje', 'Bisagras Blum cazoleta', 12);

insert into public.pagos (id, proyecto_id, fecha, concepto, monto_centavos) values
  ('aaaaaaaa-0000-7000-8000-000000000100', 'aaaaaaaa-0000-7000-8000-000000000010', '2026-08-04', 'Seña', 40000000),
  ('aaaaaaaa-0000-7000-8000-000000000101', 'aaaaaaaa-0000-7000-8000-000000000010', '2026-09-02', 'Adelanto', 40000000);

-- Dos opciones: la aprobada manda el presupuesto y la otra es lo que le ofreció y no eligió.
insert into public.opciones_de_presupuesto (proyecto_id, descripcion, monto_centavos, aprobada) values
  ('aaaaaaaa-0000-7000-8000-000000000010', 'Con frentes de melamina', 124000000, true),
  ('aaaaaaaa-0000-7000-8000-000000000010', 'Con frentes laqueados', 189000000, false);

insert into public.archivos (id, proyecto_id, nombre, tipo, bytes, ancho, alto) values
  ('aaaaaaaa-0000-7000-8000-000000000200', 'aaaaaaaa-0000-7000-8000-000000000010', 'Plano de frente', 'image/webp', 120000, 1600, 900),
  ('aaaaaaaa-0000-7000-8000-000000000201', 'aaaaaaaa-0000-7000-8000-000000000010', 'Despiece de corte', 'application/pdf', 90000, null, null);

-- Compartir es un update aparte: no hay grant de insert sobre visible_para_cliente, así que ningún
-- camino puede subir un archivo ya compartido.
update public.archivos set visible_para_cliente = true
  where id = 'aaaaaaaa-0000-7000-8000-000000000200';


-- Los campos que devuelve, uno por uno -------------------------------------------------------------------------

select set_eq(
  $$ select jsonb_object_keys(public.vista_del_cliente('aaaaaaaa-0000-7000-8000-000000000010')) $$,
  array['taller', 'cliente', 'trabajo', 'direccion', 'estado', 'precio_centavos', 'fechas', 'pagos', 'archivos'],
  'la vista devuelve exactamente estos campos y ninguno más'
);

select set_eq(
  $$ select jsonb_object_keys(public.vista_del_cliente('aaaaaaaa-0000-7000-8000-000000000010') -> 'fechas') $$,
  array['presupuesto', 'aprobado', 'inicio', 'entrega_pautada', 'entregado', 'cobro'],
  'las fechas que viajan son exactamente seis'
);

select set_eq(
  $$
    select jsonb_object_keys(e)
    from jsonb_array_elements(public.vista_del_cliente('aaaaaaaa-0000-7000-8000-000000000010') -> 'pagos') as e
  $$,
  array['id', 'fecha', 'concepto', 'monto_centavos'],
  'de cada pago viajan el día, el concepto y el importe: nada más'
);

select set_eq(
  $$
    select jsonb_object_keys(e)
    from jsonb_array_elements(public.vista_del_cliente('aaaaaaaa-0000-7000-8000-000000000010') -> 'archivos') as e
  $$,
  array['id', 'nombre', 'tipo', 'ancho', 'alto', 'fecha', 'ruta', 'ruta_mini'],
  'de cada archivo viaja lo justo para mostrarlo y traerlo del bucket'
);


-- Y lo que no devuelve ------------------------------------------------------------------------------------------

-- Los importes de arriba están puestos para que se reconozcan de un vistazo dentro del JSON entero.
select is_empty(
  format(
    $$
      select v.aguja
      from unnest(array[
        '111111', '222222', '333333', '444444',
        '555555', 'Maderera Suárez',
        'Bisagras Blum cazoleta',
        'OJO: el cliente regatea',
        'Melamina blanca con herrajes Blum',
        '189000000', 'Con frentes laqueados',
        '11-5555-0001', 'Paga tarde',
        'factura_b', 'transferencia',
        '2026-07-20', '4321'
      ]) as v (aguja)
      where %L like '%%' || v.aguja || '%%'
    $$,
    public.vista_del_cliente('aaaaaaaa-0000-7000-8000-000000000010')::text
  ),
  'en el JSON entero no aparece ni un costo, ni un gasto, ni un herraje, ni las notas, ni la opción que no aprobó, ni un dato del cliente que no sea su nombre'
);

select is(
  public.vista_del_cliente('aaaaaaaa-0000-7000-8000-000000000010') -> 'precio_centavos',
  to_jsonb(124000000::bigint),
  'el precio es el que le presupuestaron'
);

select is(
  public.vista_del_cliente('aaaaaaaa-0000-7000-8000-000000000010') #>> '{cliente,nombre}',
  'Marcela Duarte',
  'el cliente ve su nombre'
);

select is(
  public.vista_del_cliente('aaaaaaaa-0000-7000-8000-000000000010') #>> '{taller,nombre}',
  'Taller de Ana',
  'y el nombre del taller'
);

select is(
  jsonb_array_length(public.vista_del_cliente('aaaaaaaa-0000-7000-8000-000000000010') -> 'pagos'),
  2,
  'los dos pagos viajan'
);


-- Los archivos: solo los que el dueño marcó -----------------------------------------------------------------------

select is(
  (
    select array_agg(e ->> 'nombre')
    from jsonb_array_elements(public.vista_del_cliente('aaaaaaaa-0000-7000-8000-000000000010') -> 'archivos') as e
  ),
  array['Plano de frente'],
  'solo viaja el archivo marcado: el despiece no existe para el cliente'
);

select is(
  (
    select e ->> 'ruta_mini'
    from jsonb_array_elements(public.vista_del_cliente('aaaaaaaa-0000-7000-8000-000000000010') -> 'archivos') as e
  ),
  tests.id('household_a')::text
    || '/aaaaaaaa-0000-7000-8000-000000000010/aaaaaaaa-0000-7000-8000-000000000200.mini.webp',
  'la ruta de la miniatura sale del id, como en la app'
);

insert into public.archivos (id, proyecto_id, nombre, tipo, bytes)
  values ('aaaaaaaa-0000-7000-8000-000000000202', 'aaaaaaaa-0000-7000-8000-000000000010', 'Transferencia al proveedor', 'application/pdf', 1000);

select is(
  (select visible_para_cliente from public.archivos where id = 'aaaaaaaa-0000-7000-8000-000000000202'),
  false,
  'un archivo nuevo nace privado: el comprobante que sube mañana está oculto porque sí, no porque se acordó'
);

select is(
  jsonb_array_length(public.vista_del_cliente('aaaaaaaa-0000-7000-8000-000000000010') -> 'archivos'),
  1,
  'y por eso no aparece en la vista sin que nadie haga nada'
);


-- La historia de las etapas -----------------------------------------------------------------------------------------

select is(
  (
    select array_agg(c.hacia::text order by c.id)
    from public.cambios_de_estado c
    where c.proyecto_id = 'aaaaaaaa-0000-7000-8000-000000000010'
  ),
  array['en_curso'],
  'el alta del trabajo ya deja anotada su etapa'
);

update public.proyectos set estado = 'entregado', fecha_entrega = '2026-09-16'
  where id = 'aaaaaaaa-0000-7000-8000-000000000010';

select is(
  (
    select array_agg(coalesce(c.desde::text, 'alta') || ' a ' || c.hacia::text order by c.id)
    from public.cambios_de_estado c
    where c.proyecto_id = 'aaaaaaaa-0000-7000-8000-000000000010'
  ),
  array['alta a en_curso', 'en_curso a entregado'],
  'cambiar de etapa lo anota, con la etapa de la que salió'
);

update public.proyectos set notas = 'otra cosa' where id = 'aaaaaaaa-0000-7000-8000-000000000010';

select is(
  (
    select count(*)::int from public.cambios_de_estado c
    where c.proyecto_id = 'aaaaaaaa-0000-7000-8000-000000000010'
  ),
  2,
  'editar cualquier otra cosa no anota nada: el registro es de etapas'
);

select throws_ok(
  $$
    insert into public.cambios_de_estado (household_id, proyecto_id, hacia, ocurrio_el)
    values ('00000000-0000-7000-8000-000000000001', 'aaaaaaaa-0000-7000-8000-000000000010', 'cobrado', '2026-01-01')
  $$,
  '42501',
  null,
  'la app no escribe la historia: no tiene grant de insert, la pone el trigger'
);


-- El link ------------------------------------------------------------------------------------------------------------

insert into public.enlaces_publicos (id, proyecto_id, token_hash)
  values (
    'aaaaaaaa-0000-7000-8000-000000000300',
    'aaaaaaaa-0000-7000-8000-000000000010',
    encode(sha256(convert_to('el-token-de-marcela-2026', 'UTF8')), 'hex')
  );

-- La misma vista, desde las dos puertas: se guarda la de adentro y se compara contra la del link.
select set_config(
  'tests.payload',
  public.vista_del_cliente('aaaaaaaa-0000-7000-8000-000000000010')::text,
  true
);

select tests.entrar_como_anon();

select is(
  public.vista_compartida('el-token-de-marcela-2026') #>> '{cliente,nombre}',
  'Marcela Duarte',
  'con el token bueno, el cliente ve su trabajo sin sesión'
);

select is(
  public.vista_compartida('el-token-de-marcela-2026')::text,
  current_setting('tests.payload'),
  'y ve exactamente lo mismo que ve el dueño desde la app: es la misma función'
);

select tests.salir();
select tests.entrar_como(tests.id('ana'));

select is(
  (select visitas from public.enlaces_publicos where id = 'aaaaaaaa-0000-7000-8000-000000000300'),
  2,
  'cada visita queda contada, que es lo que el dueño ve en la pantalla de compartir'
);

-- Generar otro revoca el que había: primero se apaga el viejo, en su propia sentencia, y recién
-- después entra el nuevo (ADR 0043).
update public.enlaces_publicos set revocado_at = now()
  where proyecto_id = 'aaaaaaaa-0000-7000-8000-000000000010' and revocado_at is null;

insert into public.enlaces_publicos (id, proyecto_id, token_hash)
  values (
    'aaaaaaaa-0000-7000-8000-000000000301',
    'aaaaaaaa-0000-7000-8000-000000000010',
    encode(sha256(convert_to('el-token-nuevo-de-marcela', 'UTF8')), 'hex')
  );

select throws_ok(
  $$
    insert into public.enlaces_publicos (proyecto_id, token_hash)
    values ('aaaaaaaa-0000-7000-8000-000000000010', repeat('b', 64))
  $$,
  '23505',
  null,
  'no hay dos links vivos del mismo trabajo'
);

select tests.entrar_como_anon();

select throws_ok(
  $$ select public.vista_compartida('el-token-de-marcela-2026') $$,
  'MN010',
  'Este link no funciona',
  'el link anterior deja de andar apenas se genera otro'
);

select is(
  public.vista_compartida('el-token-nuevo-de-marcela') #>> '{trabajo}',
  'Placard 3 puertas',
  'y el nuevo anda'
);


-- Un trabajo que se dio por perdido ---------------------------------------------------------------------------------

select tests.salir();
select tests.entrar_como(tests.id('ana'));

insert into public.proyectos (id, cliente_id, titulo, estado)
  values ('aaaaaaaa-0000-7000-8000-000000000020', 'aaaaaaaa-0000-7000-8000-000000000001', 'Mesada', 'contacto');

insert into public.enlaces_publicos (id, proyecto_id, token_hash)
  values (
    'aaaaaaaa-0000-7000-8000-000000000302',
    'aaaaaaaa-0000-7000-8000-000000000020',
    encode(sha256(convert_to('el-token-de-la-mesada-xx', 'UTF8')), 'hex')
  );

select public.cerrar_perdido(
  'aaaaaaaa-0000-7000-8000-000000000020',
  (select version from public.proyectos where id = 'aaaaaaaa-0000-7000-8000-000000000020'),
  '2026-09-10', 0, 0, 0, 0, 0, 0, 0, 0, 1000
);

select tests.entrar_como_anon();

select throws_ok(
  $$ select public.vista_compartida('el-token-de-la-mesada-xx') $$,
  'MN010',
  'Este link no funciona',
  'un trabajo dado por perdido deja de contestar, y no dice que se perdió'
);


-- Un trabajo ajeno -------------------------------------------------------------------------------------------------

select tests.salir();
select tests.entrar_como(tests.id('beto'));

select throws_ok(
  $$ select public.vista_del_cliente('aaaaaaaa-0000-7000-8000-000000000010') $$,
  '42501',
  'El trabajo no existe o no es tuyo',
  'la vista de adentro de la app es security invoker: un trabajo de otro taller no existe'
);

select is_empty(
  $$ select 1 from public.enlaces_publicos $$,
  'y los links de otro taller tampoco se ven'
);

select is_empty(
  $$ select 1 from public.cambios_de_estado $$,
  'ni su historia de etapas'
);

select * from finish();
