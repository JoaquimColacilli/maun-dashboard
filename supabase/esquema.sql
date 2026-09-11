-- Esquema vivo de la base, leído del catálogo de Postgres. Es la vista del estado final que
-- se perdió al dejar el esquema declarativo (ADR 0008): no se aplica ni se edita a mano.
-- Se regenera con `pnpm --filter @maun/db db:esquema` después de cada `supabase db push`.
-- El test esquema.test.ts de @maun/db falla si este archivo no coincide con la base.
-- Quedan afuera las funciones de event triggers de la plataforma (public.rls_auto_enable).

-- Schemas ----------------------------------------------------------------------------------------

-- schema private: authenticated:USAGE
comment on schema private is 'Helpers de RLS, triggers y funciones internas. La Data API no expone este schema: nada de acá se llama por RPC.';
-- schema public: anon:USAGE, authenticated:USAGE, public:USAGE, service_role:USAGE
comment on schema public is 'standard public schema';

-- Enums ------------------------------------------------------------------------------------------

create type public.comprobante as enum ('factura_a', 'factura_b', 'factura_c', 'remito', 'sin_comprobante');
comment on type public.comprobante is 'Comprobante a emitir al cliente.';

create type public.condicion_fiscal as enum ('consumidor_final', 'monotributo', 'responsable_inscripto', 'exento');
comment on type public.condicion_fiscal is 'Condición frente al IVA del cliente.';

create type public.estado_proyecto as enum ('contacto', 'relevamiento', 'a_presupuestar', 'presupuesto_enviado', 'perdido', 'en_curso', 'entregado', 'cobrado');
comment on type public.estado_proyecto is 'Lead y proyecto son el mismo registro: los primeros cinco estados son de seguimiento, los últimos tres de obra. Las transiciones válidas viven en @maun/domain.';

create type public.forma_pago as enum ('efectivo', 'transferencia', 'cuotas', 'mixto');
comment on type public.forma_pago is 'Forma de pago acordada con el cliente para el proyecto.';

create type public.origen_contacto as enum ('referido', 'redes', 'volvio', 'cartel', 'otro');
comment on type public.origen_contacto is 'Cómo llegó el cliente al taller. El detalle libre va en clientes.origen_detalle.';

create type public.rol_household as enum ('titular', 'miembro');
comment on type public.rol_household is 'Rol de un usuario dentro de su household.';

create type public.tesoro as enum ('hogar', 'maun', 'diezmo', 'cocos');
comment on type public.tesoro is 'Las cuatro cajas: hogar (la familia), maun (el taller), diezmo (lo apartado para el diezmo) y cocos (el ahorro invertido).';

create type public.tipo_movimiento as enum ('ingreso', 'gasto', 'transferencia', 'pago_diezmo', 'aporte_cocos', 'ajuste');
comment on type public.tipo_movimiento is 'Tipo de un movimiento cargado a mano. Cada tipo fija qué lados (origen, destino) lleva: ver el check movimientos_forma_segun_tipo.';


-- Tablas -----------------------------------------------------------------------------------------

create table public.ajustes (
  id uuid not null default private.uuidv7(),
  household_id uuid not null default private.household_actual(),
  sueldo_mensual_centavos bigint not null default 0,
  costos_fijos_centavos bigint not null default 0,
  meta_cocos_centavos bigint not null default 0,
  tasa_cocos_anual_bp integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone,
  version integer not null default 1,
  constraint ajustes_household_id_fkey FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE,
  constraint ajustes_household_key UNIQUE (household_id),
  constraint ajustes_importes_no_negativos CHECK (sueldo_mensual_centavos >= 0 AND costos_fijos_centavos >= 0 AND meta_cocos_centavos >= 0),
  constraint ajustes_pkey PRIMARY KEY (id),
  constraint ajustes_tasa_valida CHECK (tasa_cocos_anual_bp >= 0 AND tasa_cocos_anual_bp <= 100000)
);
comment on table public.ajustes is 'Parámetros del household: una fila por household, creada con él. Cambiarlos no reescribe las distribuciones ya congeladas.';
comment on column public.ajustes.sueldo_mensual_centavos is 'Sueldo que el taller le paga al hogar: tope del escalón de sueldo de la cascada.';
comment on column public.ajustes.costos_fijos_centavos is 'Costos fijos mensuales del taller: tope del escalón de fijos de la cascada.';
comment on column public.ajustes.meta_cocos_centavos is 'Meta de ahorro en Cocos.';
comment on column public.ajustes.tasa_cocos_anual_bp is 'Tasa anual estimada de Cocos, en puntos básicos (4000 = 40%). Solo para proyectar.';
CREATE TRIGGER metadatos BEFORE INSERT OR UPDATE ON ajustes FOR EACH ROW EXECUTE FUNCTION private.mantener_metadatos();
alter table public.ajustes enable row level security;
create policy ajustes_edicion on public.ajustes as permissive
  for update to authenticated
  using ((household_id = ANY (ARRAY( SELECT private.user_household_ids() AS user_household_ids))))
  with check ((household_id = ANY (ARRAY( SELECT private.user_household_ids() AS user_household_ids))));
create policy ajustes_lectura on public.ajustes as permissive
  for select to authenticated
  using ((household_id = ANY (ARRAY( SELECT private.user_household_ids() AS user_household_ids))));
grant select on public.ajustes to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.ajustes to service_role;
grant update (sueldo_mensual_centavos, costos_fijos_centavos, meta_cocos_centavos, tasa_cocos_anual_bp) on public.ajustes to authenticated;

create table public.clientes (
  id uuid not null default private.uuidv7(),
  household_id uuid not null default private.household_actual(),
  nombre text not null,
  zona text not null default ''::text,
  telefono text not null default ''::text,
  email text not null default ''::text,
  direccion text not null default ''::text,
  origen_contacto origen_contacto,
  origen_detalle text not null default ''::text,
  condicion_fiscal condicion_fiscal not null default 'consumidor_final'::condicion_fiscal,
  cuit text not null default ''::text,
  razon_social text not null default ''::text,
  domicilio_fiscal text not null default ''::text,
  notas text not null default ''::text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone,
  version integer not null default 1,
  constraint clientes_cuit_formato CHECK (cuit = ''::text OR cuit ~ '^[0-9]{2}-[0-9]{8}-[0-9]$'::text),
  constraint clientes_email_formato CHECK (email = ''::text OR email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'::text),
  constraint clientes_household_id_fkey FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE,
  constraint clientes_household_id_key UNIQUE (household_id, id),
  constraint clientes_largos CHECK (char_length(nombre) <= 200 AND char_length(zona) <= 200 AND char_length(telefono) <= 200 AND char_length(email) <= 200 AND char_length(razon_social) <= 200 AND char_length(direccion) <= 500 AND char_length(domicilio_fiscal) <= 500 AND char_length(origen_detalle) <= 500 AND char_length(notas) <= 10000),
  constraint clientes_nombre_valido CHECK (btrim(nombre) <> ''::text),
  constraint clientes_pkey PRIMARY KEY (id)
);
comment on table public.clientes is 'Clientes del taller. Un cliente puede tener varios proyectos a lo largo del tiempo.';
comment on column public.clientes.household_id is 'Default: el household del usuario de la sesión. El cliente de la app no lo manda.';
comment on column public.clientes.zona is 'Barrio o localidad, para ubicar al cliente de un vistazo.';
comment on column public.clientes.origen_detalle is 'Detalle libre del origen: quién lo refirió, por qué red escribió.';
comment on column public.clientes.cuit is 'CUIT con guiones (NN-NNNNNNNN-N), o vacío. El dígito verificador lo valida la app.';
comment on column public.clientes.deleted_at is 'Borrado lógico. No se puede borrar un cliente con proyectos vivos.';
CREATE INDEX clientes_household_actualizado ON public.clientes USING btree (household_id, updated_at);
CREATE TRIGGER metadatos BEFORE INSERT OR UPDATE ON clientes FOR EACH ROW EXECUTE FUNCTION private.mantener_metadatos();
CREATE TRIGGER validar_baja BEFORE UPDATE OF deleted_at ON clientes FOR EACH ROW EXECUTE FUNCTION private.validar_baja_cliente();
alter table public.clientes enable row level security;
create policy clientes_alta on public.clientes as permissive
  for insert to authenticated
  with check ((household_id = ANY (ARRAY( SELECT private.user_household_ids() AS user_household_ids))));
create policy clientes_edicion on public.clientes as permissive
  for update to authenticated
  using ((household_id = ANY (ARRAY( SELECT private.user_household_ids() AS user_household_ids))))
  with check ((household_id = ANY (ARRAY( SELECT private.user_household_ids() AS user_household_ids))));
create policy clientes_lectura on public.clientes as permissive
  for select to authenticated
  using ((household_id = ANY (ARRAY( SELECT private.user_household_ids() AS user_household_ids))));
grant select on public.clientes to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.clientes to service_role;
grant insert (id, nombre, zona, telefono, email, direccion, origen_contacto, origen_detalle, condicion_fiscal, cuit, razon_social, domicilio_fiscal, notas, deleted_at) on public.clientes to authenticated;
grant update (id, nombre, zona, telefono, email, direccion, origen_contacto, origen_detalle, condicion_fiscal, cuit, razon_social, domicilio_fiscal, notas, deleted_at) on public.clientes to authenticated;

create table public.gastos (
  id uuid not null default private.uuidv7(),
  household_id uuid not null default private.household_actual(),
  proyecto_id uuid not null,
  fecha date not null,
  descripcion text not null default ''::text,
  monto_centavos bigint not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone,
  version integer not null default 1,
  constraint gastos_descripcion_largo CHECK (char_length(descripcion) <= 500),
  constraint gastos_household_id_fkey FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE,
  constraint gastos_monto_positivo CHECK (monto_centavos > 0),
  constraint gastos_pkey PRIMARY KEY (id),
  constraint gastos_proyecto_fk FOREIGN KEY (household_id, proyecto_id) REFERENCES proyectos(household_id, id)
);
comment on table public.gastos is 'Gastos imputados a un proyecto: materiales, herrajes, flete. Salen de MAUN y restan de la ganancia neta.';
comment on column public.gastos.monto_centavos is 'Importe gastado, en centavos. Siempre positivo.';
comment on column public.gastos.deleted_at is 'Borrado lógico. No se puede tocar un gasto de un proyecto cobrado.';
CREATE INDEX gastos_household_actualizado ON public.gastos USING btree (household_id, updated_at);
CREATE INDEX gastos_household_proyecto ON public.gastos USING btree (household_id, proyecto_id);
CREATE TRIGGER metadatos BEFORE INSERT OR UPDATE ON gastos FOR EACH ROW EXECUTE FUNCTION private.mantener_metadatos();
CREATE TRIGGER validar_proyecto_abierto BEFORE INSERT OR UPDATE ON gastos FOR EACH ROW EXECUTE FUNCTION private.validar_proyecto_abierto();
alter table public.gastos enable row level security;
create policy gastos_alta on public.gastos as permissive
  for insert to authenticated
  with check ((household_id = ANY (ARRAY( SELECT private.user_household_ids() AS user_household_ids))));
create policy gastos_edicion on public.gastos as permissive
  for update to authenticated
  using ((household_id = ANY (ARRAY( SELECT private.user_household_ids() AS user_household_ids))))
  with check ((household_id = ANY (ARRAY( SELECT private.user_household_ids() AS user_household_ids))));
create policy gastos_lectura on public.gastos as permissive
  for select to authenticated
  using ((household_id = ANY (ARRAY( SELECT private.user_household_ids() AS user_household_ids))));
grant select on public.gastos to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.gastos to service_role;
grant insert (id, proyecto_id, fecha, descripcion, monto_centavos, deleted_at) on public.gastos to authenticated;
grant update (id, proyecto_id, fecha, descripcion, monto_centavos, deleted_at) on public.gastos to authenticated;

create table public.household_members (
  id uuid not null default private.uuidv7(),
  household_id uuid not null,
  user_id uuid not null,
  rol rol_household not null default 'miembro'::rol_household,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone,
  version integer not null default 1,
  constraint household_members_household_id_fkey FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE,
  constraint household_members_pkey PRIMARY KEY (id),
  constraint household_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  constraint household_members_usuario_household_key UNIQUE (user_id, household_id)
);
comment on table public.household_members is 'Pertenencia de un usuario de Auth a un household. Es la única fuente del household de un usuario: el cliente nunca lo manda.';
comment on column public.household_members.deleted_at is 'Borrado lógico: una membresía borrada no da acceso.';
CREATE INDEX household_members_household_actualizado ON public.household_members USING btree (household_id, updated_at);
CREATE UNIQUE INDEX household_members_un_household_por_usuario ON public.household_members USING btree (user_id) WHERE (deleted_at IS NULL);
CREATE TRIGGER metadatos BEFORE INSERT OR UPDATE ON household_members FOR EACH ROW EXECUTE FUNCTION private.mantener_metadatos();
alter table public.household_members enable row level security;
create policy household_members_lectura_miembros on public.household_members as permissive
  for select to authenticated
  using ((household_id = ANY (ARRAY( SELECT private.user_household_ids() AS user_household_ids))));
grant select on public.household_members to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.household_members to service_role;

create table public.households (
  id uuid not null default private.uuidv7(),
  nombre text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone,
  version integer not null default 1,
  constraint households_nombre_valido CHECK (btrim(nombre) <> ''::text AND char_length(nombre) <= 120),
  constraint households_pkey PRIMARY KEY (id)
);
comment on table public.households is 'Contenedor de aislamiento multi-tenant. Toda fila de negocio pertenece a un household y la RLS filtra por él.';
comment on column public.households.updated_at is 'Lo mantiene private.mantener_metadatos(). Es la marca que usa public.delta().';
comment on column public.households.deleted_at is 'Borrado lógico. Un household borrado deja de dar acceso a sus miembros.';
comment on column public.households.version is 'Contador de cambios de la fila, mantenido por trigger. Base del control de concurrencia en las operaciones de plata.';
CREATE TRIGGER metadatos BEFORE INSERT OR UPDATE ON households FOR EACH ROW EXECUTE FUNCTION private.mantener_metadatos();
alter table public.households enable row level security;
create policy households_lectura_miembros on public.households as permissive
  for select to authenticated
  using ((id = ANY (ARRAY( SELECT private.user_household_ids() AS user_household_ids))));
grant select on public.households to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.households to service_role;

create table public.movimientos (
  id uuid not null default private.uuidv7(),
  household_id uuid not null default private.household_actual(),
  fecha date not null,
  tipo tipo_movimiento not null,
  tesoro_origen tesoro,
  tesoro_destino tesoro,
  monto_centavos bigint not null,
  categoria text not null default ''::text,
  descripcion text not null default ''::text,
  proyecto_id uuid,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone,
  version integer not null default 1,
  constraint movimientos_forma_segun_tipo CHECK (COALESCE(
CASE tipo
    WHEN 'ingreso'::tipo_movimiento THEN tesoro_origen IS NULL AND tesoro_destino IS NOT NULL
    WHEN 'gasto'::tipo_movimiento THEN tesoro_origen IS NOT NULL AND tesoro_destino IS NULL
    WHEN 'transferencia'::tipo_movimiento THEN tesoro_origen IS NOT NULL AND tesoro_destino IS NOT NULL
    WHEN 'pago_diezmo'::tipo_movimiento THEN tesoro_origen = 'diezmo'::tesoro AND tesoro_destino IS NULL
    WHEN 'aporte_cocos'::tipo_movimiento THEN tesoro_origen IS NOT NULL AND tesoro_destino = 'cocos'::tesoro
    WHEN 'ajuste'::tipo_movimiento THEN num_nonnulls(tesoro_origen, tesoro_destino) = 1
    ELSE NULL::boolean
END, false)),
  constraint movimientos_household_id_fkey FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE,
  constraint movimientos_lados_distintos CHECK (num_nonnulls(tesoro_origen, tesoro_destino) >= 1 AND tesoro_origen IS DISTINCT FROM tesoro_destino),
  constraint movimientos_largos CHECK (char_length(categoria) <= 200 AND char_length(descripcion) <= 500),
  constraint movimientos_monto_positivo CHECK (monto_centavos > 0),
  constraint movimientos_pkey PRIMARY KEY (id),
  constraint movimientos_proyecto_fk FOREIGN KEY (household_id, proyecto_id) REFERENCES proyectos(household_id, id)
);
comment on table public.movimientos is 'Movimientos cargados a mano. Los derivados de proyectos (pagos, gastos y distribución) no se guardan acá: los arma la vista libro_mayor.';
comment on column public.movimientos.tesoro_origen is 'De dónde sale la plata. Null: viene de afuera (un ingreso).';
comment on column public.movimientos.tesoro_destino is 'A dónde va la plata. Null: se va afuera (un gasto).';
comment on column public.movimientos.monto_centavos is 'Importe en centavos, siempre positivo: el sentido lo dan origen y destino.';
comment on column public.movimientos.categoria is 'Categoría libre para agrupar: Supermercado, Servicios, Alquiler del taller.';
comment on column public.movimientos.proyecto_id is 'Opcional: un movimiento manual atribuible a un proyecto, por ejemplo un ajuste sobre una distribución cerrada.';
CREATE INDEX movimientos_household_actualizado ON public.movimientos USING btree (household_id, updated_at);
CREATE INDEX movimientos_household_proyecto ON public.movimientos USING btree (household_id, proyecto_id);
CREATE TRIGGER metadatos BEFORE INSERT OR UPDATE ON movimientos FOR EACH ROW EXECUTE FUNCTION private.mantener_metadatos();
alter table public.movimientos enable row level security;
create policy movimientos_alta on public.movimientos as permissive
  for insert to authenticated
  with check ((household_id = ANY (ARRAY( SELECT private.user_household_ids() AS user_household_ids))));
create policy movimientos_edicion on public.movimientos as permissive
  for update to authenticated
  using ((household_id = ANY (ARRAY( SELECT private.user_household_ids() AS user_household_ids))))
  with check ((household_id = ANY (ARRAY( SELECT private.user_household_ids() AS user_household_ids))));
create policy movimientos_lectura on public.movimientos as permissive
  for select to authenticated
  using ((household_id = ANY (ARRAY( SELECT private.user_household_ids() AS user_household_ids))));
grant select on public.movimientos to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.movimientos to service_role;
grant insert (id, fecha, tipo, tesoro_origen, tesoro_destino, monto_centavos, categoria, descripcion, proyecto_id, deleted_at) on public.movimientos to authenticated;
grant update (id, fecha, tipo, tesoro_origen, tesoro_destino, monto_centavos, categoria, descripcion, proyecto_id, deleted_at) on public.movimientos to authenticated;

create table public.pagos (
  id uuid not null default private.uuidv7(),
  household_id uuid not null default private.household_actual(),
  proyecto_id uuid not null,
  fecha date not null,
  concepto text not null default ''::text,
  monto_centavos bigint not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone,
  version integer not null default 1,
  constraint pagos_concepto_largo CHECK (char_length(concepto) <= 500),
  constraint pagos_household_id_fkey FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE,
  constraint pagos_monto_positivo CHECK (monto_centavos > 0),
  constraint pagos_pkey PRIMARY KEY (id),
  constraint pagos_proyecto_fk FOREIGN KEY (household_id, proyecto_id) REFERENCES proyectos(household_id, id)
);
comment on table public.pagos is 'Cobros recibidos de un proyecto: seña, adelantos, saldo. Entran a MAUN. La distribución se calcula sobre su suma.';
comment on column public.pagos.monto_centavos is 'Importe cobrado, en centavos. Siempre positivo.';
comment on column public.pagos.deleted_at is 'Borrado lógico. No se puede tocar un pago de un proyecto cobrado.';
CREATE INDEX pagos_household_actualizado ON public.pagos USING btree (household_id, updated_at);
CREATE INDEX pagos_household_proyecto ON public.pagos USING btree (household_id, proyecto_id);
CREATE TRIGGER metadatos BEFORE INSERT OR UPDATE ON pagos FOR EACH ROW EXECUTE FUNCTION private.mantener_metadatos();
CREATE TRIGGER validar_proyecto_abierto BEFORE INSERT OR UPDATE ON pagos FOR EACH ROW EXECUTE FUNCTION private.validar_proyecto_abierto();
alter table public.pagos enable row level security;
create policy pagos_alta on public.pagos as permissive
  for insert to authenticated
  with check ((household_id = ANY (ARRAY( SELECT private.user_household_ids() AS user_household_ids))));
create policy pagos_edicion on public.pagos as permissive
  for update to authenticated
  using ((household_id = ANY (ARRAY( SELECT private.user_household_ids() AS user_household_ids))))
  with check ((household_id = ANY (ARRAY( SELECT private.user_household_ids() AS user_household_ids))));
create policy pagos_lectura on public.pagos as permissive
  for select to authenticated
  using ((household_id = ANY (ARRAY( SELECT private.user_household_ids() AS user_household_ids))));
grant select on public.pagos to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.pagos to service_role;
grant insert (id, proyecto_id, fecha, concepto, monto_centavos, deleted_at) on public.pagos to authenticated;
grant update (id, proyecto_id, fecha, concepto, monto_centavos, deleted_at) on public.pagos to authenticated;

create table public.proyectos (
  id uuid not null default private.uuidv7(),
  household_id uuid not null default private.household_actual(),
  cliente_id uuid not null,
  titulo text not null,
  descripcion text not null default ''::text,
  estado estado_proyecto not null default 'contacto'::estado_proyecto,
  presupuesto_centavos bigint,
  forma_pago forma_pago,
  comprobante comprobante not null default 'sin_comprobante'::comprobante,
  fecha_visita date,
  ultimo_contacto date,
  fecha_inicio date,
  entrega_estimada date,
  fecha_entrega date,
  direccion_entrega text not null default ''::text,
  notas text not null default ''::text,
  fecha_cobro date,
  dist_cobrado_centavos bigint,
  dist_gastos_centavos bigint,
  dist_diezmo_bp integer,
  dist_tope_sueldo_centavos bigint,
  dist_tope_fijos_centavos bigint,
  dist_diezmo_centavos bigint,
  dist_sueldo_centavos bigint,
  dist_fijos_centavos bigint,
  dist_remanente_centavos bigint,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone,
  version integer not null default 1,
  constraint proyectos_cliente_fk FOREIGN KEY (household_id, cliente_id) REFERENCES clientes(household_id, id),
  constraint proyectos_cobrado_con_distribucion CHECK ((estado = 'cobrado'::estado_proyecto) = (fecha_cobro IS NOT NULL) AND (num_nulls(fecha_cobro, dist_cobrado_centavos, dist_gastos_centavos, dist_diezmo_bp, dist_tope_sueldo_centavos, dist_tope_fijos_centavos, dist_diezmo_centavos, dist_sueldo_centavos, dist_fijos_centavos, dist_remanente_centavos) = ANY (ARRAY[0, 10]))),
  constraint proyectos_distribucion_cuadra CHECK (dist_cobrado_centavos IS NULL OR dist_cobrado_centavos >= 0 AND dist_gastos_centavos >= 0 AND dist_diezmo_bp >= 0 AND dist_diezmo_bp <= 10000 AND dist_tope_sueldo_centavos >= 0 AND dist_tope_fijos_centavos >= 0 AND dist_diezmo_centavos >= 0 AND dist_sueldo_centavos >= 0 AND dist_sueldo_centavos <= dist_tope_sueldo_centavos AND dist_fijos_centavos >= 0 AND dist_fijos_centavos <= dist_tope_fijos_centavos AND (dist_remanente_centavos >= 0 OR (dist_diezmo_centavos + dist_sueldo_centavos + dist_fijos_centavos) = 0) AND (dist_diezmo_centavos + dist_sueldo_centavos + dist_fijos_centavos + dist_remanente_centavos) = (dist_cobrado_centavos - dist_gastos_centavos)),
  constraint proyectos_household_id_fkey FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE,
  constraint proyectos_household_id_key UNIQUE (household_id, id),
  constraint proyectos_largos CHECK (char_length(titulo) <= 200 AND char_length(descripcion) <= 10000 AND char_length(direccion_entrega) <= 500 AND char_length(notas) <= 10000),
  constraint proyectos_pkey PRIMARY KEY (id),
  constraint proyectos_presupuesto_no_negativo CHECK (presupuesto_centavos IS NULL OR presupuesto_centavos >= 0),
  constraint proyectos_titulo_valido CHECK (btrim(titulo) <> ''::text)
);
comment on table public.proyectos is 'Leads y proyectos: la misma fila avanza de seguimiento a obra y a cobrado. Al cobrar se congela la distribución (ADR 0003).';
comment on column public.proyectos.titulo is 'El trabajo, en pocas palabras: "Placard 3 puertas con interior en melamina".';
comment on column public.proyectos.presupuesto_centavos is 'Presupuesto acordado. Null mientras el lead no tiene presupuesto. La distribución NO se calcula sobre esto sino sobre lo cobrado.';
comment on column public.proyectos.fecha_visita is 'Visita de relevamiento, en la etapa de seguimiento.';
comment on column public.proyectos.ultimo_contacto is 'Último contacto con el cliente, en la etapa de seguimiento.';
comment on column public.proyectos.entrega_estimada is 'Entrega prometida. La app la propone a 21 días hábiles del inicio.';
comment on column public.proyectos.fecha_entrega is 'Entrega real.';
comment on column public.proyectos.fecha_cobro is 'Fecha del cobro final. No null si y solo si estado = cobrado. Es la fecha de los movimientos derivados en el libro mayor.';
comment on column public.proyectos.dist_cobrado_centavos is 'Congelado al cobrar: total cobrado (suma de pagos vivos) sobre el que se calculó la distribución.';
comment on column public.proyectos.dist_gastos_centavos is 'Congelado al cobrar: total de gastos del proyecto.';
comment on column public.proyectos.dist_diezmo_bp is 'Congelado al cobrar: porcentaje de diezmo aplicado, en puntos básicos (1000 = 10%).';
comment on column public.proyectos.dist_tope_sueldo_centavos is 'Congelado al cobrar: tope de sueldo que se aplicó. Si cambian los ajustes, la historia no se reescribe.';
comment on column public.proyectos.dist_tope_fijos_centavos is 'Congelado al cobrar: tope de costos fijos que se aplicó.';
comment on column public.proyectos.dist_diezmo_centavos is 'Congelado al cobrar: lo que pasa de MAUN a DIEZMO.';
comment on column public.proyectos.dist_sueldo_centavos is 'Congelado al cobrar: lo que pasa de MAUN a HOGAR.';
comment on column public.proyectos.dist_fijos_centavos is 'Congelado al cobrar: lo que queda en MAUN para costos fijos. No mueve plata entre tesoros.';
comment on column public.proyectos.dist_remanente_centavos is 'Congelado al cobrar: lo que sobra en MAUN. Negativo solo si el proyecto dio pérdida.';
comment on column public.proyectos.deleted_at is 'Borrado lógico. Borrar un proyecto borra sus pagos y gastos; un proyecto cobrado no se borra y uno borrado no revive.';
CREATE INDEX proyectos_household_actualizado ON public.proyectos USING btree (household_id, updated_at);
CREATE INDEX proyectos_household_cliente ON public.proyectos USING btree (household_id, cliente_id);
CREATE TRIGGER borrar_hijos AFTER UPDATE OF deleted_at ON proyectos FOR EACH ROW WHEN (new.deleted_at IS NOT NULL AND old.deleted_at IS NULL) EXECUTE FUNCTION private.borrar_hijos_de_proyecto();
CREATE TRIGGER metadatos BEFORE INSERT OR UPDATE ON proyectos FOR EACH ROW EXECUTE FUNCTION private.mantener_metadatos();
CREATE TRIGGER validar_proyecto BEFORE INSERT OR UPDATE ON proyectos FOR EACH ROW EXECUTE FUNCTION private.validar_proyecto();
alter table public.proyectos enable row level security;
create policy proyectos_alta on public.proyectos as permissive
  for insert to authenticated
  with check ((household_id = ANY (ARRAY( SELECT private.user_household_ids() AS user_household_ids))));
create policy proyectos_edicion on public.proyectos as permissive
  for update to authenticated
  using ((household_id = ANY (ARRAY( SELECT private.user_household_ids() AS user_household_ids))))
  with check ((household_id = ANY (ARRAY( SELECT private.user_household_ids() AS user_household_ids))));
create policy proyectos_lectura on public.proyectos as permissive
  for select to authenticated
  using ((household_id = ANY (ARRAY( SELECT private.user_household_ids() AS user_household_ids))));
grant select on public.proyectos to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.proyectos to service_role;
grant insert (id, cliente_id, titulo, descripcion, estado, presupuesto_centavos, forma_pago, comprobante, fecha_visita, ultimo_contacto, fecha_inicio, entrega_estimada, fecha_entrega, direccion_entrega, notas, deleted_at) on public.proyectos to authenticated;
grant update (id, cliente_id, titulo, descripcion, estado, presupuesto_centavos, forma_pago, comprobante, fecha_visita, ultimo_contacto, fecha_inicio, entrega_estimada, fecha_entrega, direccion_entrega, notas, deleted_at) on public.proyectos to authenticated;


-- Vistas -----------------------------------------------------------------------------------------

create view public.libro_mayor with (security_invoker=true) as
 SELECT m.household_id,
    'manual'::text AS origen,
    m.id AS asiento_id,
    m.fecha,
    m.tesoro_destino AS tesoro,
    m.tesoro_origen AS contrapartida,
    m.monto_centavos,
    m.tipo::text AS concepto,
    m.categoria,
    m.descripcion,
    m.proyecto_id
   FROM movimientos m
  WHERE m.deleted_at IS NULL AND m.tesoro_destino IS NOT NULL
UNION ALL
 SELECT m.household_id,
    'manual'::text AS origen,
    m.id AS asiento_id,
    m.fecha,
    m.tesoro_origen AS tesoro,
    m.tesoro_destino AS contrapartida,
    - m.monto_centavos AS monto_centavos,
    m.tipo::text AS concepto,
    m.categoria,
    m.descripcion,
    m.proyecto_id
   FROM movimientos m
  WHERE m.deleted_at IS NULL AND m.tesoro_origen IS NOT NULL
UNION ALL
 SELECT pg.household_id,
    'pago'::text AS origen,
    pg.id AS asiento_id,
    pg.fecha,
    'maun'::tesoro AS tesoro,
    NULL::tesoro AS contrapartida,
    pg.monto_centavos,
    'cobro'::text AS concepto,
    'Cobro'::text AS categoria,
    pg.concepto AS descripcion,
    pg.proyecto_id
   FROM pagos pg
     JOIN proyectos p ON p.household_id = pg.household_id AND p.id = pg.proyecto_id
  WHERE pg.deleted_at IS NULL AND p.deleted_at IS NULL
UNION ALL
 SELECT g.household_id,
    'gasto_proyecto'::text AS origen,
    g.id AS asiento_id,
    g.fecha,
    'maun'::tesoro AS tesoro,
    NULL::tesoro AS contrapartida,
    - g.monto_centavos AS monto_centavos,
    'gasto'::text AS concepto,
    'Materiales'::text AS categoria,
    g.descripcion,
    g.proyecto_id
   FROM gastos g
     JOIN proyectos p ON p.household_id = g.household_id AND p.id = g.proyecto_id
  WHERE g.deleted_at IS NULL AND p.deleted_at IS NULL
UNION ALL
 SELECT p.household_id,
    'distribucion'::text AS origen,
    p.id AS asiento_id,
    p.fecha_cobro AS fecha,
    d.tesoro,
    d.contrapartida,
    d.monto_centavos,
    d.concepto,
    'Distribución'::text AS categoria,
    p.titulo AS descripcion,
    p.id AS proyecto_id
   FROM proyectos p
     CROSS JOIN LATERAL ( VALUES ('diezmo'::tesoro,'maun'::tesoro,p.dist_diezmo_centavos,'diezmo'::text), ('maun'::tesoro,'diezmo'::tesoro,- p.dist_diezmo_centavos,'diezmo'::text), ('hogar'::tesoro,'maun'::tesoro,p.dist_sueldo_centavos,'sueldo'::text), ('maun'::tesoro,'hogar'::tesoro,- p.dist_sueldo_centavos,'sueldo'::text)) d(tesoro, contrapartida, monto_centavos, concepto)
  WHERE p.estado = 'cobrado'::estado_proyecto AND p.deleted_at IS NULL AND d.monto_centavos <> 0;
comment on view public.libro_mayor is 'Libro mayor por tesoro: una fila por tesoro afectado, importe con signo. El saldo de un tesoro es sum(monto_centavos) where tesoro = X.';
grant select on public.libro_mayor to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.libro_mayor to service_role;


-- Funciones --------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.bootstrap()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select jsonb_build_object(
    'cursor', now(),
    'households', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.households t where t.deleted_at is null
    ),
    'household_members', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.household_members t where t.deleted_at is null
    ),
    'ajustes', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.ajustes t where t.deleted_at is null
    ),
    'clientes', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.clientes t where t.deleted_at is null
    ),
    'proyectos', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.proyectos t where t.deleted_at is null
    ),
    'pagos', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.pagos t where t.deleted_at is null
    ),
    'gastos', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.gastos t where t.deleted_at is null
    ),
    'movimientos', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.movimientos t where t.deleted_at is null
    )
  )
$function$;
-- execute: authenticated:EXECUTE, service_role:EXECUTE
comment on function bootstrap() is 'Todo el household del usuario en un JSON, sin filas borradas, más el cursor para el primer delta. Es también el reconcile completo: el cliente reemplaza su copia entera con esto.';

CREATE OR REPLACE FUNCTION public.delta(p_desde timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  v_desde timestamptz;
begin
  if p_desde is null then
    raise exception 'delta() necesita un cursor: sin cursor corresponde bootstrap()'
      using errcode = '22004';
  end if;

  v_desde := p_desde - interval '5 minutes';

  return jsonb_build_object(
    'cursor', now(),
    'households', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.households t where t.updated_at >= v_desde
    ),
    'household_members', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.household_members t where t.updated_at >= v_desde
    ),
    'ajustes', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.ajustes t where t.updated_at >= v_desde
    ),
    'clientes', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.clientes t where t.updated_at >= v_desde
    ),
    'proyectos', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.proyectos t where t.updated_at >= v_desde
    ),
    'pagos', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.pagos t where t.updated_at >= v_desde
    ),
    'gastos', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.gastos t where t.updated_at >= v_desde
    ),
    'movimientos', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.movimientos t where t.updated_at >= v_desde
    )
  );
end;
$function$;
-- execute: authenticated:EXECUTE, service_role:EXECUTE
comment on function delta(timestamp with time zone) is 'Filas del household cambiadas desde el cursor, incluidas las borradas (deleted_at no null), más el cursor siguiente. Aplica un solape de cinco minutos.';

CREATE OR REPLACE FUNCTION private.borrar_hijos_de_proyecto()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  update public.pagos
  set deleted_at = new.deleted_at
  where household_id = new.household_id
    and proyecto_id = new.id
    and deleted_at is null;

  update public.gastos
  set deleted_at = new.deleted_at
  where household_id = new.household_id
    and proyecto_id = new.id
    and deleted_at is null;

  return null;
end;
$function$;
-- execute: solo el dueño

CREATE OR REPLACE FUNCTION private.crear_household(p_nombre text, p_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_household uuid;
begin
  insert into public.households (nombre) values (p_nombre) returning id into v_household;

  if p_user_id is not null then
    insert into public.household_members (household_id, user_id, rol)
    values (v_household, p_user_id, 'titular');
  end if;

  insert into public.ajustes (household_id) values (v_household);

  return v_household;
end;
$function$;
-- execute: solo el dueño
comment on function private.crear_household(text,uuid) is 'Crea un household con sus ajustes y, si se pasa un usuario, lo suma como titular. Solo la ejecuta el dueño de la base.';

CREATE OR REPLACE FUNCTION private.es_reenvio(p_old jsonb, p_new jsonb)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select (p_old - array['created_at', 'updated_at', 'version']) = (p_new - array['created_at', 'updated_at', 'version'])
$function$;
-- execute: authenticated:EXECUTE

CREATE OR REPLACE FUNCTION private.household_actual()
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  v_household uuid;
begin
  select id into v_household from private.user_household_ids() as id limit 1;

  if v_household is null then
    raise exception 'El usuario no pertenece a ningún household'
      using errcode = '42501',
            hint = 'La cuenta existe en Auth pero nadie la asignó a un taller.';
  end if;

  return v_household;
end;
$function$;
-- execute: authenticated:EXECUTE
comment on function private.household_actual() is 'Household del usuario de la sesión. Es el default de household_id en todas las tablas: el cliente no lo manda nunca.';

CREATE OR REPLACE FUNCTION private.mantener_metadatos()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if tg_op = 'INSERT' then
    new.updated_at := clock_timestamp();
    new.version := 1;
    return new;
  end if;

  if new.id is distinct from old.id then
    raise exception 'El id de una fila no se puede cambiar (tabla %)', tg_table_name
      using errcode = 'MN004';
  end if;

  if (to_jsonb(new) -> 'household_id') is distinct from (to_jsonb(old) -> 'household_id') then
    raise exception 'Una fila no se puede mover de household (tabla %)', tg_table_name
      using errcode = 'MN004';
  end if;

  new.created_at := old.created_at;
  new.updated_at := old.updated_at;
  new.version := old.version;

  -- Borrar lo que ya está borrado no cambia la marca: una baja reenviada, o hecha también desde el
  -- otro dispositivo, conserva la primera y cae en el no-op de abajo.
  if old.deleted_at is not null and new.deleted_at is not null then
    new.deleted_at := old.deleted_at;
  end if;

  -- Un update que no cambia nada (la cola de salida reenviando una mutación ya aplicada) no toca
  -- updated_at ni version: así drenar la cola dos veces no genera deltas ni conflictos falsos.
  if new is not distinct from old then
    return new;
  end if;

  -- clock_timestamp() y no now(): la marca queda lo más cerca posible del commit, lo que achica
  -- la ventana de la trampa de la marca de agua (ver public.delta).
  new.updated_at := clock_timestamp();
  new.version := old.version + 1;
  return new;
end;
$function$;
-- execute: solo el dueño
comment on function private.mantener_metadatos() is 'Trigger BEFORE INSERT OR UPDATE de toda tabla: updated_at y version los pone la base, nunca el cliente; id y household_id son inmutables; un update sin cambios es un no-op.';

CREATE OR REPLACE FUNCTION private.user_household_ids()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select m.household_id
  from public.household_members m
  join public.households h on h.id = m.household_id
  where m.user_id = (select auth.uid())
    and m.deleted_at is null
    and h.deleted_at is null
$function$;
-- execute: authenticated:EXECUTE
comment on function private.user_household_ids() is 'Households a los que pertenece el usuario de la sesión. Vacío si no hay sesión: auth.uid() es null y no matchea nada.';

CREATE OR REPLACE FUNCTION private.uuidv7()
 RETURNS uuid
 LANGUAGE sql
 PARALLEL SAFE
 SET search_path TO ''
AS $function$
  -- 48 bits de milisegundos Unix sobre los 128 bits aleatorios de gen_random_uuid(). Los bits 52
  -- y 53 pasan la versión de 4 (0100) a 7 (0111); los de variante ya vienen en 10.
  select encode(
    set_bit(
      set_bit(
        overlay(
          uuid_send(gen_random_uuid())
          placing substring(int8send(floor(extract(epoch from clock_timestamp()) * 1000)::bigint) from 3)
          from 1 for 6
        ),
        52, 1
      ),
      53, 1
    ),
    'hex'
  )::uuid
$function$;
-- execute: authenticated:EXECUTE
comment on function private.uuidv7() is 'UUID versión 7 (RFC 9562): ordenado por tiempo, así los inserts caen al final del índice. Default de las columnas id.';

CREATE OR REPLACE FUNCTION private.validar_baja_cliente()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if new.deleted_at is not null and old.deleted_at is null and exists (
    select 1
    from public.proyectos p
    where p.household_id = new.household_id
      and p.cliente_id = new.id
      and p.deleted_at is null
  ) then
    raise exception 'El cliente tiene proyectos: borralos o reasignalos antes de borrar el cliente'
      using errcode = 'MN003';
  end if;

  return new;
end;
$function$;
-- execute: solo el dueño

CREATE OR REPLACE FUNCTION private.validar_proyecto_abierto()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_proyectos uuid[];
begin
  if tg_op = 'INSERT' then
    -- En un upsert que choca contra una fila existente, este trigger corre antes de detectar el
    -- conflicto. Se deja pasar y decide el trigger de UPDATE, que ve la fila vieja.
    if tg_table_name = 'pagos' then
      perform 1 from public.pagos where id = new.id;
    else
      perform 1 from public.gastos where id = new.id;
    end if;
    if found then
      return new;
    end if;
    v_proyectos := array[new.proyecto_id];
  else
    if private.es_reenvio(to_jsonb(old), to_jsonb(new)) then
      return new;
    end if;
    v_proyectos := array[old.proyecto_id, new.proyecto_id];
  end if;

  -- Bloquea el proyecto antes de mirarlo. Sin esto, un pago que entra mientras otra sesión cobra
  -- el proyecto pasa la guarda con el estado viejo y queda fuera de la distribución congelada: la
  -- foreign key solo toma un lock que no choca con el update del cobro. Con for share, este trigger
  -- espera al cobro y los exists de abajo, que son consultas nuevas, ya lo ven commiteado. El
  -- contrato del otro lado: la función de cobro bloquea el proyecto con for update antes de sumar.
  perform 1
  from public.proyectos p
  where p.household_id = new.household_id
    and p.id = any (v_proyectos)
  order by p.id
  for share;

  if exists (
    select 1
    from public.proyectos p
    where p.household_id = new.household_id
      and p.id = any (v_proyectos)
      and p.estado = 'cobrado'
  ) then
    raise exception 'El proyecto ya está cobrado y su distribución congelada: sus pagos y gastos no se modifican'
      using errcode = 'MN001',
            hint = 'Para corregirlo hay que reabrir el proyecto o registrar un ajuste.';
  end if;

  -- Un hijo de un proyecto borrado solo puede quedar borrado (es lo que hace la baja en cascada).
  if new.deleted_at is null and exists (
    select 1
    from public.proyectos p
    where p.household_id = new.household_id
      and p.id = new.proyecto_id
      and p.deleted_at is not null
  ) then
    raise exception 'El proyecto está borrado'
      using errcode = 'MN002';
  end if;

  return new;
end;
$function$;
-- execute: solo el dueño
comment on function private.validar_proyecto_abierto() is 'Guarda de pagos y gastos: rechaza altas y cambios sobre un proyecto cobrado (MN001) o borrado (MN002). Deja pasar el reenvío idéntico de la cola.';

CREATE OR REPLACE FUNCTION private.validar_proyecto()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_cliente_borrado timestamptz;
begin
  if tg_op = 'INSERT' then
    -- Upsert que choca contra una fila existente: decide la rama UPDATE, que ve la fila vieja.
    perform 1 from public.proyectos where id = new.id;
    if found then
      return new;
    end if;
  elsif private.es_reenvio(to_jsonb(old), to_jsonb(new)) then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    -- Lo congelado solo se mueve reabriendo, y la reapertura limpia fecha_cobro. Sin esta guarda,
    -- una edición encolada con el estado viejo rebotaría contra un check con un 23514 genérico.
    if old.estado = 'cobrado' and new.fecha_cobro is not null and new.estado <> 'cobrado' then
      raise exception 'El proyecto ya está cobrado: su estado solo cambia al reabrirlo'
        using errcode = 'MN001',
              hint = 'Para corregirlo hay que reabrir el proyecto o registrar un ajuste.';
    end if;

    if old.estado = 'cobrado' and old.deleted_at is null and new.deleted_at is not null then
      raise exception 'Un proyecto cobrado no se borra: tiene la distribución congelada'
        using errcode = 'MN001';
    end if;

    -- La baja se lleva los pagos y gastos, y des-borrar no los trae de vuelta: un proyecto
    -- borrado se queda borrado. Evita que una edición vieja encolada lo resucite vacío.
    if old.deleted_at is not null and new.deleted_at is null then
      raise exception 'El proyecto está borrado'
        using errcode = 'MN002';
    end if;
  end if;

  if new.deleted_at is null and (tg_op = 'INSERT' or new.cliente_id is distinct from old.cliente_id) then
    select c.deleted_at into v_cliente_borrado
    from public.clientes c
    where c.household_id = new.household_id
      and c.id = new.cliente_id
    for share;

    if v_cliente_borrado is not null then
      raise exception 'El cliente está borrado'
        using errcode = 'MN005';
    end if;
  end if;

  return new;
end;
$function$;
-- execute: solo el dueño
comment on function private.validar_proyecto() is 'Guarda de proyectos: un cobrado no cambia de estado ni se borra (MN001), un borrado no revive (MN002) y un proyecto vivo no cuelga de un cliente borrado (MN005). Deja pasar el reenvío idéntico de la cola.';
