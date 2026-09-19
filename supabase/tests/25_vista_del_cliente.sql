-- La vista del cliente (ADR 0046): la lista blanca de campos, el link con su token hasheado, el
-- registro de los cambios de etapa, los datos para transferir (ADR 0048) y el título que alimenta
-- la vista previa del enlace (ADR 0049).
--
-- Los dos tests que importan son los primeros: toda columna de proyectos y toda columna de ajustes
-- están clasificadas, y agregar una columna a cualquiera de las dos rompe este archivo hasta que
-- alguien decida si el cliente la puede ver. Sin eso la lista blanca se pudre sola: la función
-- sigue devolviendo lo de siempre y nadie se entera de que apareció algo que habría que haber
-- mirado. Ajustes entró a la lista con los datos para transferir: desde que uno de sus campos viaja
-- a la superficie pública, la tabla entera necesita la misma vigilancia que proyectos.

select plan(50);

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


-- Toda columna de ajustes está clasificada -------------------------------------------------------------------

-- Los cuatro datos para transferir viajan, y nada más de esta tabla: el sueldo, los costos fijos,
-- la meta de Cocos, su tasa, la seña y las tres preferencias de liquidación son parte de cómo se
-- reparte la plata adentro del taller, y eso el cliente no lo ve ni de lejos. Ajustes está acá
-- desde que uno de sus campos viaja: una columna nueva rompe este test igual que en proyectos.
select set_eq(
  $$
    select a.attname::text
    from pg_attribute a
    where a.attrelid = 'public.ajustes'::regclass and a.attnum > 0 and not a.attisdropped
  $$,
  array[
    -- Viajan
    'cobro_alias', 'cobro_cbu', 'cobro_titular', 'cobro_cuit',
    -- No viajan
    'id', 'household_id', 'created_at', 'updated_at', 'deleted_at', 'version',
    'sueldo_mensual_centavos', 'costos_fijos_centavos', 'meta_cocos_centavos',
    'tasa_cocos_anual_bp', 'sueldo_tope_mensual', 'perdido_con_sueldo', 'perdido_con_diezmo',
    'sena_bp'
  ],
  'toda columna de ajustes está clasificada: una columna nueva rompe este test hasta que alguien decida si el cliente la ve'
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

-- Los ajustes del taller: los cuatro de cobro viajan y los demás no. Los números están elegidos
-- para reconocerse de un vistazo dentro del JSON entero, como los importes del trabajo.
update public.ajustes set
  sueldo_mensual_centavos = 777777,
  costos_fijos_centavos = 888888,
  meta_cocos_centavos = 999999,
  tasa_cocos_anual_bp = 6543,
  sena_bp = 1717,
  cobro_alias = 'taller.maun.ok',
  cobro_cbu = '0110001312345678901233',
  cobro_titular = 'Ana Gutiérrez',
  cobro_cuit = '27-30123456-4'
where household_id = tests.id('household_a');


-- Los campos que devuelve, uno por uno -------------------------------------------------------------------------

select set_eq(
  $$ select jsonb_object_keys(public.vista_del_cliente('aaaaaaaa-0000-7000-8000-000000000010')) $$,
  array['taller', 'cliente', 'trabajo', 'direccion', 'estado', 'precio_centavos', 'cobro', 'fechas', 'pagos', 'archivos'],
  'la vista devuelve exactamente estos campos y ninguno más'
);

select set_eq(
  $$ select jsonb_object_keys(public.vista_del_cliente('aaaaaaaa-0000-7000-8000-000000000010') -> 'cobro') $$,
  array['alias', 'cbu', 'titular', 'cuit'],
  'de los datos para transferir viajan exactamente cuatro campos'
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
        '2026-07-20', '4321',
        '777777', '888888', '999999', '6543', '1717'
      ]) as v (aguja)
      where %L like '%%' || v.aguja || '%%'
    $$,
    public.vista_del_cliente('aaaaaaaa-0000-7000-8000-000000000010')::text
  ),
  'en el JSON entero no aparece ni un costo, ni un gasto, ni un herraje, ni las notas, ni la opción que no aprobó, ni un dato del cliente que no sea su nombre, ni nada de los ajustes que no sea el cobro'
);


-- Los datos para transferir (ADR 0048) --------------------------------------------------------------------

select is(
  public.vista_del_cliente('aaaaaaaa-0000-7000-8000-000000000010') #>> '{cobro,alias}',
  'taller.maun.ok',
  'el alias del taller viaja'
);

select is(
  public.vista_del_cliente('aaaaaaaa-0000-7000-8000-000000000010') #>> '{cobro,cbu}',
  '0110001312345678901233',
  'el CBU viaja limpio, sin espacios: la pantalla lo agrupa para leerlo y lo copia así'
);

select is(
  public.vista_del_cliente('aaaaaaaa-0000-7000-8000-000000000010') #>> '{cobro,titular}',
  'Ana Gutiérrez',
  'y el titular, que es contra lo que el cliente confirma en su banco'
);

select is(
  public.vista_del_cliente('aaaaaaaa-0000-7000-8000-000000000010') #>> '{cobro,cuit}',
  '27-30123456-4',
  'y el CUIT del titular'
);

-- Un dato que el dueño no cargó no viaja como cadena vacía: viaja como null, y la pantalla no lo
-- muestra. Si están los cuatro vacíos, el bloque entero no aparece.
update public.ajustes set cobro_alias = '', cobro_cuit = ''
  where household_id = tests.id('household_a');

select is(
  public.vista_del_cliente('aaaaaaaa-0000-7000-8000-000000000010') -> 'cobro',
  jsonb_build_object(
    'alias', null,
    'cbu', '0110001312345678901233',
    'titular', 'Ana Gutiérrez',
    'cuit', null
  ),
  'lo que el dueño dejó vacío viaja en null, no en cadena vacía'
);

select throws_ok(
  format(
    $$ update public.ajustes set cobro_alias = 'ab' where household_id = %L $$,
    tests.id('household_a')
  ),
  '23514',
  null,
  'un alias más corto que el mínimo del BCRA lo frena la base'
);

select throws_ok(
  format(
    $$ update public.ajustes set cobro_alias = 'plata_del_taller' where household_id = %L $$,
    tests.id('household_a')
  ),
  '23514',
  null,
  'y el guion bajo también: la lista de caracteres del BCRA es cerrada'
);

select throws_ok(
  format(
    $$ update public.ajustes set cobro_cbu = '0110 0013 1234 5678 9012 33' where household_id = %L $$,
    tests.id('household_a')
  ),
  '23514',
  null,
  'el CBU se guarda en 22 dígitos pelados: con espacios lo frena la base'
);

select lives_ok(
  format(
    $$ update public.ajustes set cobro_cbu = '', cobro_titular = '' where household_id = %L $$,
    tests.id('household_a')
  ),
  'vaciar cualquiera de los cuatro siempre se puede: son todos opcionales'
);

select is(
  public.vista_del_cliente('aaaaaaaa-0000-7000-8000-000000000010') -> 'cobro',
  jsonb_build_object('alias', null, 'cbu', null, 'titular', null, 'cuit', null),
  'con los cuatro vacíos no viaja ni un dato de cobro'
);

-- Los datos de cobro vuelven, y el sueldo y los fijos se dejan de nuevo en cero: más abajo hay un
-- cerrar_perdido que manda los topes que vio la app, y con objetivos distintos de cero rebotaría
-- con MN006 por un motivo que no tiene nada que ver con lo que este archivo prueba.
update public.ajustes set
  sueldo_mensual_centavos = 0,
  costos_fijos_centavos = 0,
  cobro_alias = 'taller.maun.ok',
  cobro_cbu = '0110001312345678901233',
  cobro_titular = 'Ana Gutiérrez',
  cobro_cuit = '27-30123456-4'
where household_id = tests.id('household_a');

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


-- El título de la vista previa (ADR 0049) ------------------------------------------------------------------

-- Cuántas visitas tenía el link antes de que pase el rastreador.
select tests.salir();
select tests.entrar_como(tests.id('ana'));
select set_config(
  'tests.visitas',
  (select visitas::text from public.enlaces_publicos where id = 'aaaaaaaa-0000-7000-8000-000000000301'),
  true
);

-- La vista previa la pide un rastreador sin sesión, como el cliente.
select tests.entrar_como_anon();

select set_eq(
  $$ select jsonb_object_keys(public.titulo_compartido('el-token-nuevo-de-marcela')) $$,
  array['trabajo', 'taller'],
  'el título devuelve exactamente dos campos: ni un importe, ni la etapa, ni el nombre del cliente'
);

select is(
  public.titulo_compartido('el-token-nuevo-de-marcela') ->> 'trabajo',
  'Placard 3 puertas',
  'el título del trabajo, tal como lo escribió el dueño'
);

select is(
  public.titulo_compartido('el-token-nuevo-de-marcela') ->> 'taller',
  'Taller de Ana',
  'y el nombre del taller'
);

select is(
  public.titulo_compartido('el-token-nuevo-de-marcela')::text,
  public.titulo_compartido('el-token-nuevo-de-marcela')::text,
  'leerlo dos veces devuelve lo mismo: no tiene efectos'
);

select tests.salir();
select tests.entrar_como(tests.id('ana'));

select is(
  (select visitas from public.enlaces_publicos where id = 'aaaaaaaa-0000-7000-8000-000000000301'),
  current_setting('tests.visitas')::int,
  'cuatro lecturas del título y el contador no se movió: un rastreador no cuenta como una visita del cliente'
);

select tests.entrar_como_anon();

select is(
  public.titulo_compartido('el-token-de-marcela-2026'),
  null,
  'un enlace dado de baja no tiene título'
);

select is(
  public.titulo_compartido('un-token-que-nunca-existio'),
  null,
  'uno inexistente tampoco'
);

select is(
  public.titulo_compartido('no-sirve'),
  null,
  'y uno con forma inválida ni llega a consultarse'
);

select is(
  public.titulo_compartido(null),
  null,
  'sin token, nada'
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

select is(
  public.titulo_compartido('el-token-de-la-mesada-xx'),
  null,
  'y su vista previa tampoco dice nada: el título de un perdido no se filtra por esa puerta'
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
