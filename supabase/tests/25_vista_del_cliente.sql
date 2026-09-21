-- La vista del cliente (ADR 0046): la lista blanca de campos, el link con su huella y su dirección
-- (ADR 0052), el registro de los cambios de etapa, los datos para transferir (ADR 0048), el título
-- que alimenta la vista previa del enlace (ADR 0049) y cómo te paga, la forma de cobro por trabajo y
-- por instancia de pago (ADR 0053).
--
-- Los dos tests que importan son los primeros: toda columna de proyectos y toda columna de ajustes
-- están clasificadas, y agregar una columna a cualquiera de las dos rompe este archivo hasta que
-- alguien decida si el cliente la puede ver. Sin eso la lista blanca se pudre sola: la función
-- sigue devolviendo lo de siempre y nadie se entera de que apareció algo que habría que haber
-- mirado. Ajustes entró a la lista con los datos para transferir: desde que uno de sus campos viaja
-- a la superficie pública, la tabla entera necesita la misma vigilancia que proyectos.

select plan(99);

select tests.guardar('ana', tests.crear_usuario('ana@maun.test'));
select tests.guardar('household_a', private.crear_household('Taller de Ana', tests.id('ana')));
select tests.guardar('beto', tests.crear_usuario('beto@maun.test'));
select tests.guardar('household_b', private.crear_household('Taller de Beto', tests.id('beto')));


-- Toda columna de proyectos está clasificada ---------------------------------------------------------------

-- Las diez que viajan, aunque sea con otro nombre: titulo es «trabajo», presupuesto_centavos es
-- «precio», direccion_entrega es «direccion», las cuatro fechas arman el camino, y cobro_sena y
-- cobro_saldo deciden «pago», que es cómo puede pagar lo que le toca. Ojo con esas dos: no viaja su
-- valor crudo, viaja el de la instancia que toca, pasado por private.formas_de_cobro(). Todas las
-- demás no salen de la base, y eso incluye los costos estimados, el margen que se deriva de ellos,
-- las tareas de presupuestar, las notas de obra, la distribución congelada, las marcas de la agenda
-- y sena_bp, que es el porcentaje y sigue sin viajar: lo que viaja es el importe que falta.
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
    'cobro_sena', 'cobro_saldo',
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
-- desde que uno de sus campos viaja: una columna nueva rompe este test igual que en proyectos. El
-- enlace de reseña no viaja por esta puerta: sale por la de la encuesta, y su clasificación está en
-- 27_encuesta_publica.sql.
select set_eq(
  $$
    select a.attname::text
    from pg_attribute a
    where a.attrelid = 'public.ajustes'::regclass and a.attnum > 0 and not a.attisdropped
  $$,
  array[
    -- Viajan
    'cobro_alias', 'cobro_cbu', 'cobro_titular', 'cobro_cuit', 'cobro_link',
    -- No viajan
    'id', 'household_id', 'created_at', 'updated_at', 'deleted_at', 'version',
    'sueldo_mensual_centavos', 'costos_fijos_centavos', 'meta_cocos_centavos',
    'tasa_cocos_anual_bp', 'sueldo_tope_mensual', 'perdido_con_sueldo', 'perdido_con_diezmo',
    'sena_bp', 'resena_link'
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
  'cuotas', 'factura_b',
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
  array['taller', 'cliente', 'trabajo', 'direccion', 'estado', 'precio_centavos', 'pago', 'cobro', 'fechas', 'pagos', 'archivos'],
  'la vista devuelve exactamente estos campos y ninguno más'
);

select set_eq(
  $$ select jsonb_object_keys(public.vista_del_cliente('aaaaaaaa-0000-7000-8000-000000000010') -> 'pago') $$,
  array['instancia', 'formas', 'monto_centavos', 'siguiente'],
  'del pago que toca viajan exactamente cuatro cosas: cuál es, cómo se paga, cuánto falta y cuál viene después'
);

select set_eq(
  $$ select jsonb_object_keys(public.vista_del_cliente('aaaaaaaa-0000-7000-8000-000000000010') -> 'cobro') $$,
  array['alias', 'cbu', 'titular', 'cuit', 'link'],
  'de los datos para pagarle al taller viajan exactamente cinco campos: los cuatro de la cuenta y el link'
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
-- La forma de pago del trabajo es «cuotas» y no «transferencia» a propósito: desde que el payload
-- dice cómo puede pagar el cliente, la palabra «transferencia» aparece ahí de manera legítima, y
-- una aguja que la busque dejaría de probar lo que quiere probar, que proyectos.forma_pago no sale.
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
        'factura_b', 'cuotas',
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
    'cuit', null,
    'link', null
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
  jsonb_build_object('alias', null, 'cbu', null, 'titular', null, 'cuit', null, 'link', null),
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


-- La dirección del enlace, guardada entera (ADR 0052) ----------------------------------------------------------------

-- El token en claro vive en la fila para que el dueño lo vea desde cualquiera de sus aparatos. Lo
-- que esta sección cuida es que no se pueda guardar cualquier cosa ahí y que no salga por ninguna
-- de las dos puertas públicas.

select tests.salir();
select tests.entrar_como(tests.id('ana'));

insert into public.proyectos (id, cliente_id, titulo, estado)
  values ('aaaaaaaa-0000-7000-8000-000000000030', 'aaaaaaaa-0000-7000-8000-000000000001', 'Biblioteca', 'en_curso');

-- La huella es la de «corto», así que lo único que falla acá es la forma: los dos checks se prueban
-- de a uno, porque Postgres corta en el primero que no pasa.
select throws_ok(
  $$
    insert into public.enlaces_publicos (proyecto_id, token_hash, token)
    values (
      'aaaaaaaa-0000-7000-8000-000000000030',
      encode(sha256(convert_to('corto', 'UTF8')), 'hex'),
      'corto'
    )
  $$,
  '23514',
  'new row for relation "enlaces_publicos" violates check constraint "enlaces_publicos_token_formato"',
  'un token con forma inválida no entra, aunque su huella sea la suya'
);

select throws_ok(
  $$
    insert into public.enlaces_publicos (proyecto_id, token_hash, token)
    values (
      'aaaaaaaa-0000-7000-8000-000000000030',
      encode(sha256(convert_to('el-token-de-la-biblioteca', 'UTF8')), 'hex'),
      'otro-token-que-no-es-el-de-esta-fila'
    )
  $$,
  '23514',
  'new row for relation "enlaces_publicos" violates check constraint "enlaces_publicos_token_coincide"',
  'y un token que no es el de esta fila tampoco: la base no deja guardar una dirección que no abre este enlace'
);

insert into public.enlaces_publicos (id, proyecto_id, token_hash, token)
  values (
    'aaaaaaaa-0000-7000-8000-000000000303',
    'aaaaaaaa-0000-7000-8000-000000000030',
    encode(sha256(convert_to('el-token-de-la-biblioteca', 'UTF8')), 'hex'),
    'el-token-de-la-biblioteca'
  );

select is(
  (select token from public.enlaces_publicos where id = 'aaaaaaaa-0000-7000-8000-000000000303'),
  'el-token-de-la-biblioteca',
  'el token que coincide con la huella sí entra, y el dueño lo lee desde cualquier aparato'
);

-- El relleno de los enlaces de antes: el aparato que todavía lo tiene guardado lo sube. Va en su
-- propio trabajo porque el índice parcial no deja dos enlaces vivos en el mismo (ADR 0043).
insert into public.proyectos (id, cliente_id, titulo, estado)
  values ('aaaaaaaa-0000-7000-8000-000000000031', 'aaaaaaaa-0000-7000-8000-000000000001', 'Vitrina', 'en_curso');

insert into public.enlaces_publicos (id, proyecto_id, token_hash)
  values (
    'aaaaaaaa-0000-7000-8000-000000000304',
    'aaaaaaaa-0000-7000-8000-000000000031',
    encode(sha256(convert_to('el-token-de-los-de-antes', 'UTF8')), 'hex')
  );

update public.enlaces_publicos
  set token = 'el-token-de-los-de-antes'
  where id = 'aaaaaaaa-0000-7000-8000-000000000304' and token is null;

select is(
  (select token from public.enlaces_publicos where id = 'aaaaaaaa-0000-7000-8000-000000000304'),
  'el-token-de-los-de-antes',
  'un enlace de los de antes se rellena con update, que es el grant que tiene la app'
);

-- El mismo update, otra vez, con otra dirección: no tiene que pisar nada. Es lo que hace que dos
-- aparatos rellenando a la vez no puedan romperse entre ellos.
update public.enlaces_publicos
  set token = 'el-token-de-otro-aparato'
  where id = 'aaaaaaaa-0000-7000-8000-000000000304' and token is null;

select is(
  (select token from public.enlaces_publicos where id = 'aaaaaaaa-0000-7000-8000-000000000304'),
  'el-token-de-los-de-antes',
  'y el relleno nunca pisa una dirección ya guardada: el «where token is null» es el que lo garantiza'
);

-- Las dos puertas públicas no devuelven la dirección.
select tests.entrar_como_anon();

select is(
  public.vista_compartida('el-token-de-la-biblioteca') ? 'token',
  false,
  'la vista del cliente no trae la clave token'
);

select is(
  public.vista_compartida('el-token-de-la-biblioteca')::text like '%el-token-de-la-biblioteca%',
  false,
  'ni el token en ningún lado del payload: el cliente no recibe la llave de su propio enlace'
);

select is(
  public.titulo_compartido('el-token-de-la-biblioteca')::text like '%el-token-de-la-biblioteca%',
  false,
  'y la vista previa del enlace tampoco lo devuelve'
);


-- Cómo te paga (ADR 0053) --------------------------------------------------------------------------------------------

-- Un trabajo propio, con su presupuesto redondo y su porcentaje de seña, para que las cuentas se
-- lean de un vistazo: $1.000.000 de presupuesto, 50 % de seña, así que la seña son $500.000.

select tests.salir();
select tests.entrar_como(tests.id('ana'));

update public.ajustes set
  sena_bp = 5000,
  cobro_alias = 'taller.maun.ok',
  cobro_cbu = '0110001312345678901233',
  cobro_titular = 'Ana Gutiérrez',
  cobro_cuit = '27-30123456-4'
where household_id = tests.id('household_a');

insert into public.proyectos (id, cliente_id, titulo, estado, presupuesto_centavos)
  values (
    'aaaaaaaa-0000-7000-8000-000000000040', 'aaaaaaaa-0000-7000-8000-000000000001',
    'Vestidor', 'en_curso', 100000000
  );

insert into public.enlaces_publicos (id, proyecto_id, token_hash)
  values (
    'aaaaaaaa-0000-7000-8000-000000000400',
    'aaaaaaaa-0000-7000-8000-000000000040',
    encode(sha256(convert_to('el-token-del-vestidor-aa', 'UTF8')), 'hex')
  );

-- Sin configurar y con datos para transferir cargados: las dos formas.

select is(
  public.vista_del_cliente('aaaaaaaa-0000-7000-8000-000000000040') -> 'pago',
  jsonb_build_object(
    'instancia', 'sena',
    'formas', jsonb_build_array('transferencia', 'efectivo'),
    'monto_centavos', 50000000,
    'siguiente', jsonb_build_object(
      'instancia', 'saldo',
      'formas', jsonb_build_array('transferencia', 'efectivo'),
      'monto_centavos', 50000000
    )
  ),
  'un trabajo que nadie configuró ofrece las dos formas y pide la seña: la mitad del presupuesto'
);

select is(
  public.vista_del_cliente('aaaaaaaa-0000-7000-8000-000000000040') #>> '{cobro,alias}',
  'taller.maun.ok',
  'y como se puede transferir, los datos de la cuenta viajan'
);

-- Sin datos para transferir en Ajustes, el valor por defecto es solo efectivo: ofrecer una
-- transferencia sin adónde transferir sería mandarle al cliente una pantalla vacía.

update public.ajustes set cobro_alias = '', cobro_cbu = ''
  where household_id = tests.id('household_a');

select is(
  public.vista_del_cliente('aaaaaaaa-0000-7000-8000-000000000040') #> '{pago,formas}',
  jsonb_build_array('efectivo'),
  'sin alias ni CBU en Ajustes, por defecto el pago es solo en efectivo'
);

update public.ajustes set cobro_alias = 'taller.maun.ok', cobro_cbu = '0110001312345678901233'
  where household_id = tests.id('household_a');

-- La configuración del dueño: la seña por transferencia y el saldo en efectivo.

update public.proyectos set
  cobro_sena = array['transferencia']::public.forma_de_cobro[],
  cobro_saldo = array['efectivo']::public.forma_de_cobro[]
where id = 'aaaaaaaa-0000-7000-8000-000000000040';

select is(
  public.vista_del_cliente('aaaaaaaa-0000-7000-8000-000000000040') -> 'pago',
  jsonb_build_object(
    'instancia', 'sena',
    'formas', jsonb_build_array('transferencia'),
    'monto_centavos', 50000000,
    'siguiente', jsonb_build_object(
      'instancia', 'saldo',
      'formas', jsonb_build_array('efectivo'),
      'monto_centavos', 50000000
    )
  ),
  'con la seña pendiente manda las formas de la seña, y el que sigue con las suyas'
);

select is(
  public.vista_del_cliente('aaaaaaaa-0000-7000-8000-000000000040') -> 'cobro',
  jsonb_build_object(
    'alias', 'taller.maun.ok',
    'cbu', '0110001312345678901233',
    'titular', 'Ana Gutiérrez',
    'cuit', '27-30123456-4',
    'link', null
  ),
  'y con la seña por transferencia, los cuatro datos de la cuenta viajan'
);

-- Un pago parcial de la seña: lo que toca es lo que falta, no la seña entera.

insert into public.pagos (id, proyecto_id, fecha, concepto, monto_centavos)
  values ('aaaaaaaa-0000-7000-8000-000000000410', 'aaaaaaaa-0000-7000-8000-000000000040', '2026-09-10', 'A cuenta', 20000000);

select is(
  public.vista_del_cliente('aaaaaaaa-0000-7000-8000-000000000040') #> '{pago,monto_centavos}',
  to_jsonb(30000000::bigint),
  'con parte de la seña cobrada, el importe que viaja es lo que falta de la seña'
);

-- Con la seña cubierta pasa a tocar el saldo, que este trabajo cobra en efectivo. Y ahí los datos
-- de la cuenta dejan de viajar: lo que no se muestra, no se manda.

insert into public.pagos (id, proyecto_id, fecha, concepto, monto_centavos)
  values ('aaaaaaaa-0000-7000-8000-000000000411', 'aaaaaaaa-0000-7000-8000-000000000040', '2026-09-12', 'Resto de la seña', 30000000);

select is(
  public.vista_del_cliente('aaaaaaaa-0000-7000-8000-000000000040') -> 'pago',
  jsonb_build_object(
    'instancia', 'saldo',
    'formas', jsonb_build_array('efectivo'),
    'monto_centavos', 50000000,
    'siguiente', null
  ),
  'cubierta la seña, lo que toca es el saldo con las formas del saldo, y ya no viene ninguno más'
);

select is(
  public.vista_del_cliente('aaaaaaaa-0000-7000-8000-000000000040') -> 'cobro',
  jsonb_build_object('alias', null, 'cbu', null, 'titular', null, 'cuit', null, 'link', null),
  'y como el saldo es en efectivo, los datos de la cuenta no viajan aunque estén cargados'
);

select is(
  public.vista_del_cliente('aaaaaaaa-0000-7000-8000-000000000040')::text like '%taller.maun.ok%',
  false,
  'ni el alias aparece en ningún lado del payload'
);

-- Las dos formas a la vez.

update public.proyectos
  set cobro_saldo = array['transferencia', 'efectivo']::public.forma_de_cobro[]
where id = 'aaaaaaaa-0000-7000-8000-000000000040';

select is(
  public.vista_del_cliente('aaaaaaaa-0000-7000-8000-000000000040') #> '{pago,formas}',
  jsonb_build_array('transferencia', 'efectivo'),
  'el saldo puede ofrecer las dos'
);

select is(
  public.vista_del_cliente('aaaaaaaa-0000-7000-8000-000000000040') #>> '{cobro,cbu}',
  '0110001312345678901233',
  'y con transferencia entre las dos, la cuenta vuelve a viajar'
);

-- Saldado: no toca ninguna instancia, no hay formas y no hay cuenta.

insert into public.pagos (id, proyecto_id, fecha, concepto, monto_centavos)
  values ('aaaaaaaa-0000-7000-8000-000000000412', 'aaaaaaaa-0000-7000-8000-000000000040', '2026-09-14', 'Saldo', 50000000);

select is(
  public.vista_del_cliente('aaaaaaaa-0000-7000-8000-000000000040') -> 'pago',
  jsonb_build_object(
    'instancia', null, 'formas', jsonb_build_array(), 'monto_centavos', null, 'siguiente', null
  ),
  'con todo pagado no toca ninguna instancia y no hay ninguna forma que ofrecer'
);

select is(
  public.vista_del_cliente('aaaaaaaa-0000-7000-8000-000000000040') -> 'cobro',
  jsonb_build_object('alias', null, 'cbu', null, 'titular', null, 'cuit', null, 'link', null),
  'y la cuenta tampoco viaja: no queda nada que transferir'
);

-- Sin presupuesto, la instancia es la seña y el importe no existe: el porcentaje es política
-- comercial del taller y no viaja, así que el peso no se puede calcular todavía.

insert into public.proyectos (id, cliente_id, titulo, estado)
  values (
    'aaaaaaaa-0000-7000-8000-000000000041', 'aaaaaaaa-0000-7000-8000-000000000001',
    'Mueble de baño', 'presupuesto_enviado'
  );

select is(
  public.vista_del_cliente('aaaaaaaa-0000-7000-8000-000000000041') -> 'pago',
  jsonb_build_object(
    'instancia', 'sena',
    'formas', jsonb_build_array('transferencia', 'efectivo'),
    'monto_centavos', null,
    'siguiente', jsonb_build_object(
      'instancia', 'saldo',
      'formas', jsonb_build_array('transferencia', 'efectivo'),
      'monto_centavos', null
    )
  ),
  'sin presupuesto lo que viene es la seña y después el saldo, los dos sin importe'
);

-- El check: un pago no puede quedarse sin ninguna forma, ni con repetidos, ni con un null adentro,
-- ni con las dos al revés. Postgres corta en el primer check que no pasa, así que van de a uno.

select throws_ok(
  $ck$
    update public.proyectos set cobro_sena = array[]::public.forma_de_cobro[]
    where id = 'aaaaaaaa-0000-7000-8000-000000000040'
  $ck$,
  '23514',
  null,
  'un pago sin ninguna forma lo frena la base, no la pantalla'
);

select throws_ok(
  $ck$
    update public.proyectos set cobro_sena = array['efectivo', 'efectivo']::public.forma_de_cobro[]
    where id = 'aaaaaaaa-0000-7000-8000-000000000040'
  $ck$,
  '23514',
  null,
  'y la misma forma repetida también'
);

select throws_ok(
  $ck$
    update public.proyectos set cobro_sena = array[null]::public.forma_de_cobro[]
    where id = 'aaaaaaaa-0000-7000-8000-000000000040'
  $ck$,
  '23514',
  null,
  'y un null adentro del arreglo: por eso el check va envuelto en coalesce'
);

select throws_ok(
  $ck$
    update public.proyectos set cobro_saldo = array['efectivo', 'transferencia']::public.forma_de_cobro[]
    where id = 'aaaaaaaa-0000-7000-8000-000000000040'
  $ck$,
  '23514',
  null,
  'las dos formas se guardan siempre en el mismo orden: una sola representación de lo mismo'
);

select lives_ok(
  $ck$
    update public.proyectos set cobro_sena = null, cobro_saldo = null
    where id = 'aaaaaaaa-0000-7000-8000-000000000040'
  $ck$,
  'volver a null siempre se puede: es «no lo configuré», y ahí vale el valor por defecto'
);

-- Las dos reglas, sueltas, que son las que tienen gemela en @maun/domain.

select is(
  private.formas_de_cobro(null, true),
  array['transferencia', 'efectivo']::public.forma_de_cobro[],
  'sin nada guardado y con datos para transferir, las dos'
);

select is(
  private.formas_de_cobro(null, false),
  array['efectivo']::public.forma_de_cobro[],
  'sin nada guardado y sin datos para transferir, solo efectivo'
);

select is(
  private.formas_de_cobro(array['transferencia']::public.forma_de_cobro[], false),
  array['transferencia']::public.forma_de_cobro[],
  'lo que el dueño guardó manda, aunque Ajustes esté vacío: es su decisión, no la nuestra'
);

select is(
  (
    select jsonb_agg(jsonb_build_object('i', r.instancia, 'm', r.monto_centavos) order by r.orden)
    from private.pagos_por_delante(100000000, 0, 5000) as r
  ),
  jsonb_build_array(
    jsonb_build_object('i', 'sena', 'm', 50000000),
    jsonb_build_object('i', 'saldo', 'm', 50000000)
  ),
  'sin nada pagado faltan los dos, cada uno con su importe'
);

-- Con parte de la seña cobrada, lo que falta de la seña baja y el saldo de después no se mueve:
-- son dos cuentas distintas y esta es la que se equivocaría si se restaran entre sí.
select is(
  (
    select jsonb_agg(jsonb_build_object('i', r.instancia, 'm', r.monto_centavos) order by r.orden)
    from private.pagos_por_delante(100000000, 20000000, 5000) as r
  ),
  jsonb_build_array(
    jsonb_build_object('i', 'sena', 'm', 30000000),
    jsonb_build_object('i', 'saldo', 'm', 50000000)
  ),
  'con parte de la seña cobrada, el saldo de después sigue siendo el presupuesto menos la seña entera'
);

select is(
  (select monto_centavos from private.pagos_por_delante(1, 0, 5000) where orden = 1),
  1::bigint,
  'el redondeo es el mismo que el del dominio: medio centavo para arriba'
);

select is(
  (
    select count(*)::int
    from private.pagos_por_delante(100000000, 0, 10000)
  ),
  1,
  'con la seña al 100 % no hay saldo después: es un pago solo'
);

select is_empty(
  $ck$ select 1 from private.pagos_por_delante(100000000, 100000000, 5000) $ck$,
  'con todo pagado no falta ningún pago'
);


-- El link de cobro del taller (ADR 0054) --------------------------------------------------------------------------

-- Este texto se convierte en un enlace y en un QR adentro de una página que abre un desconocido,
-- así que el host lo cierra la base. Lo que el dueño pega tiene que ser de Mercado Pago o no entra.

select throws_ok(
  format(
    $$ update public.ajustes set cobro_link = 'https://pagame-aca.com/taller' where household_id = %L $$,
    tests.id('household_a')
  ),
  '23514',
  null,
  'un link que no es de Mercado Pago lo frena la base: el host es lista cerrada'
);

select throws_ok(
  format(
    $$ update public.ajustes set cobro_link = 'http://mpago.la/2vXyZ1' where household_id = %L $$,
    tests.id('household_a')
  ),
  '23514',
  null,
  'y sin https tampoco: el cliente escribe un importe del otro lado'
);

select throws_ok(
  format(
    $$ update public.ajustes set cobro_link = %L where household_id = %L $$,
    'https://mpago.la/' || repeat('x', 300),
    tests.id('household_a')
  ),
  '23514',
  null,
  'ni uno más largo de trescientos caracteres'
);

select lives_ok(
  format(
    $$ update public.ajustes set cobro_link = 'https://mpago.la/2vXyZ1' where household_id = %L $$,
    tests.id('household_a')
  ),
  'el link de cobro que sale de la app de Mercado Pago se guarda'
);

select is(
  public.vista_del_cliente('aaaaaaaa-0000-7000-8000-000000000041') -> 'cobro',
  jsonb_build_object(
    'alias', 'taller.maun.ok',
    'cbu', '0110001312345678901233',
    'titular', 'Ana Gutiérrez',
    'cuit', '27-30123456-4',
    'link', 'https://mpago.la/2vXyZ1'
  ),
  'con el pago por transferencia el link viaja igual que los cuatro datos de la cuenta'
);

-- La misma regla de siempre: lo que no se ofrece para el pago de ahora, no se manda. El link no es
-- una excepción, y por eso es el quinto campo del mismo objeto y no uno suelto.
update public.proyectos set cobro_sena = array['efectivo']::public.forma_de_cobro[]
  where id = 'aaaaaaaa-0000-7000-8000-000000000041';

select is(
  public.vista_del_cliente('aaaaaaaa-0000-7000-8000-000000000041') -> 'cobro',
  jsonb_build_object('alias', null, 'cbu', null, 'titular', null, 'cuit', null, 'link', null),
  'y con ese pago en efectivo el link tampoco viaja, aunque esté cargado'
);

update public.proyectos set cobro_sena = null
  where id = 'aaaaaaaa-0000-7000-8000-000000000041';

-- Tener link alcanza para que un trabajo sin configurar ofrezca las dos formas: es lo mismo que
-- hace hayComoTransferir() de @maun/domain, que también mira los tres.
update public.ajustes set cobro_alias = '', cobro_cbu = ''
  where household_id = tests.id('household_a');

select is(
  public.vista_del_cliente('aaaaaaaa-0000-7000-8000-000000000041') #> '{pago,formas}',
  jsonb_build_array('transferencia', 'efectivo'),
  'sin alias y sin CBU, tener link solo ya alcanza para que el valor por defecto siga siendo las dos formas'
);

select is(
  public.vista_del_cliente('aaaaaaaa-0000-7000-8000-000000000041') -> 'cobro',
  jsonb_build_object('alias', null, 'cbu', null, 'titular', 'Ana Gutiérrez', 'cuit', '27-30123456-4', 'link', 'https://mpago.la/2vXyZ1'),
  'y lo único que viaja para pagar es el link'
);

select lives_ok(
  format(
    $$ update public.ajustes set cobro_link = '' where household_id = %L $$,
    tests.id('household_a')
  ),
  'vaciarlo siempre se puede: es opcional como los otros cuatro'
);

select is(
  public.vista_del_cliente('aaaaaaaa-0000-7000-8000-000000000041') #>> '{cobro,link}',
  null,
  'y vacío viaja en null, no en cadena vacía'
);

update public.ajustes set cobro_alias = 'taller.maun.ok', cobro_cbu = '0110001312345678901233'
  where household_id = tests.id('household_a');



-- El rol anónimo no gana nada con esto ---------------------------------------------------------------------------

-- La puerta del link es la misma de siempre y devuelve lo mismo que la de adentro, con el pago
-- incluido. Las dos funciones nuevas viven en private, que la API no expone.

select tests.entrar_como_anon();

select is(
  public.vista_compartida('el-token-del-vestidor-aa') -> 'pago',
  jsonb_build_object(
    'instancia', null, 'formas', jsonb_build_array(), 'monto_centavos', null, 'siguiente', null
  ),
  'por el link se ve el mismo pago que desde la app: es la misma función'
);

select throws_ok(
  $ck$ select private.formas_de_cobro(null, true) $ck$,
  '42501',
  null,
  'y el rol anónimo no puede ejecutar la regla del valor por defecto: vive en private'
);

select throws_ok(
  $ck$ select * from private.pagos_por_delante(100, 0, 5000) $ck$,
  '42501',
  null,
  'ni la de los pagos que faltan'
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
