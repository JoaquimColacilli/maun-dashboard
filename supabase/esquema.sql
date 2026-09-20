-- Esquema vivo de la base, leído del catálogo de Postgres. Es la vista del estado final que
-- se perdió al dejar el esquema declarativo (ADR 0008): no se aplica ni se edita a mano.
-- Se regenera con `pnpm --filter @maun/db db:esquema` después de cada `supabase db push`.
-- El test esquema.test.ts de @maun/db falla si este archivo no coincide con la base.
-- Quedan afuera las funciones de event triggers de la plataforma (public.rls_auto_enable).

-- Schemas ----------------------------------------------------------------------------------------

-- schema private: authenticated:USAGE, service_role:USAGE
comment on schema private is 'Helpers de RLS, triggers y funciones internas. La Data API no expone este schema: nada de acá se llama por RPC.';
-- schema public: anon:USAGE, authenticated:USAGE, public:USAGE, service_role:USAGE
comment on schema public is 'standard public schema';

-- Enums ------------------------------------------------------------------------------------------

create type public.categoria_anotacion as enum ('materiales', 'taller');
comment on type public.categoria_anotacion is 'Qué clase de cosa anotó el dueño: materiales (comprar, encargar, retirar) o taller (trabajo, mandados, cobros). Entrega, visita y presupuesto no están: son categorías de lo que se calcula, y eso no se guarda.';

create type public.comprobante as enum ('factura_a', 'factura_b', 'factura_c', 'remito', 'sin_comprobante');
comment on type public.comprobante is 'Comprobante a emitir al cliente.';

create type public.condicion_fiscal as enum ('consumidor_final', 'monotributo', 'responsable_inscripto', 'exento');
comment on type public.condicion_fiscal is 'Condición frente al IVA del cliente.';

create type public.estado_proyecto as enum ('contacto', 'presupuesto_estimativo', 'relevamiento', 'a_presupuestar', 'presupuesto_enviado', 'perdido', 'en_curso', 'entregado', 'cobrado');
comment on type public.estado_proyecto is 'Lead y proyecto son el mismo registro: los primeros seis estados son de seguimiento (contacto, presupuesto estimativo, relevamiento, a presupuestar, presupuesto enviado y perdido), los últimos tres de obra. Las transiciones válidas viven en @maun/domain.';

create type public.forma_de_cobro as enum ('transferencia', 'efectivo');
comment on type public.forma_de_cobro is 'Cómo le paga el cliente al taller una instancia de pago concreta. Transferencia es el cliente entrando a su banco o a su billetera y mandando plata al alias del taller: la arranca él y no tiene costo. Efectivo es en mano. No hay una tercera: cobrar con un link de pago o con un QR de cobro de Mercado Pago le cuesta comisión al taller y este PR no los usa (ADR 0051 y 0053).';

create type public.forma_pago as enum ('efectivo', 'transferencia', 'cuotas', 'mixto');
comment on type public.forma_pago is 'Forma de pago acordada con el cliente para el proyecto.';

create type public.origen_contacto as enum ('referido', 'redes', 'volvio', 'cartel', 'otro');
comment on type public.origen_contacto is 'Cómo llegó el cliente al taller. El detalle libre va en clientes.origen_detalle.';

create type public.rol_household as enum ('titular', 'miembro');
comment on type public.rol_household is 'Rol de un usuario dentro de su household.';

create type public.tesoro as enum ('hogar', 'maun', 'diezmo', 'cocos');
comment on type public.tesoro is 'Las cuatro cajas: hogar (la familia), maun (el taller), diezmo (lo apartado para el diezmo) y cocos (el ahorro invertido).';

create type public.tipo_de_necesidad as enum ('herraje', 'herramienta');
comment on type public.tipo_de_necesidad is 'Si lo que hace falta es un herraje (bisagras, pistones, tiradores, tarugos) o una herramienta (sierra circular, lijadora de banda, multitool). El dueño las nombró como dos listas distintas, pero las dos son «lo que necesito para este trabajo» y se repiten entre trabajos: una sola tabla con el tipo adentro (ADR 0045).';

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
  sueldo_tope_mensual boolean not null default false,
  perdido_con_sueldo boolean not null default false,
  perdido_con_diezmo boolean not null default true,
  sena_bp integer not null default 5000,
  cobro_alias text not null default ''::text,
  cobro_cbu text not null default ''::text,
  cobro_titular text not null default ''::text,
  cobro_cuit text not null default ''::text,
  cobro_link text not null default ''::text,
  constraint ajustes_cobro_alias_formato CHECK (cobro_alias = ''::text OR cobro_alias ~ '^[A-Za-z0-9.-]{6,20}$'::text),
  constraint ajustes_cobro_cbu_formato CHECK (cobro_cbu = ''::text OR cobro_cbu ~ '^[0-9]{22}$'::text),
  constraint ajustes_cobro_cuit_formato CHECK (cobro_cuit = ''::text OR cobro_cuit ~ '^[0-9]{2}-[0-9]{8}-[0-9]$'::text),
  constraint ajustes_cobro_link_formato CHECK (cobro_link = ''::text OR char_length(cobro_link) <= 300 AND cobro_link ~ '^https://(www\.mercadopago\.com\.ar|mercadopago\.com\.ar|link\.mercadopago\.com\.ar|mpago\.la|mpago\.li)/[^[:space:]]*$'::text),
  constraint ajustes_cobro_titular_largo CHECK (char_length(cobro_titular) <= 200),
  constraint ajustes_household_id_fkey FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE,
  constraint ajustes_household_key UNIQUE (household_id),
  constraint ajustes_importes_no_negativos CHECK (sueldo_mensual_centavos >= 0 AND costos_fijos_centavos >= 0 AND meta_cocos_centavos >= 0),
  constraint ajustes_pkey PRIMARY KEY (id),
  constraint ajustes_sena_valida CHECK (sena_bp >= 0 AND sena_bp <= 10000),
  constraint ajustes_tasa_valida CHECK (tasa_cocos_anual_bp >= 0 AND tasa_cocos_anual_bp <= 100000)
);
comment on table public.ajustes is 'Parámetros del household: una fila por household, creada con él. Cambiarlos no reescribe las distribuciones ya congeladas.';
comment on column public.ajustes.sueldo_mensual_centavos is 'Sueldo que el taller le paga al hogar: objetivo del escalón de sueldo, por proyecto o por mes según sueldo_tope_mensual.';
comment on column public.ajustes.costos_fijos_centavos is 'Costos fijos mensuales del taller: objetivo del escalón de fijos, que se topea por lo que falta del mes.';
comment on column public.ajustes.meta_cocos_centavos is 'Meta de ahorro en Cocos.';
comment on column public.ajustes.tasa_cocos_anual_bp is 'Tasa anual estimada de Cocos, en puntos básicos (4000 = 40%). Solo para proyectar.';
comment on column public.ajustes.sueldo_tope_mensual is 'false: cada cobro paga hasta un sueldo entero (la regla del dueño). true: el sueldo se topea por lo que falta del mes, como los fijos. El cliente no tiene grant para prenderlo: antes hay que resolver que una liquidación offline deja de ser determinista (ADR 0011).';
comment on column public.ajustes.perdido_con_sueldo is 'Si cerrar un perdido con seña retenida paga sueldo. Por defecto no: un lead que no prosperó no es un trabajo. Se aplica como objetivo de sueldo en cero para esa liquidación, no con otra cascada.';
comment on column public.ajustes.perdido_con_diezmo is 'Si la seña retenida de un perdido paga diezmo. Por defecto sí: es ingreso reconocido.';
comment on column public.ajustes.sena_bp is 'La seña que se pide para confirmar un trabajo, en puntos básicos del presupuesto (5000 = 50%, que es lo habitual). Se puede pisar por trabajo en proyectos.sena_bp.';
comment on column public.ajustes.cobro_alias is 'El alias del taller para recibir transferencias, o vacío. El check es el del BCRA: 6 a 20 caracteres, letras, números, punto y guion medio (t.o. SNP, Com. "A" 8114). Los dígitos verificadores no aplican a un alias, y la unicidad la resuelve la cámara, no esta base (ADR 0048).';
comment on column public.ajustes.cobro_cbu is 'El CBU o el CVU del taller, 22 dígitos sin espacios ni guiones, o vacío. Se guarda limpio y se muestra agrupado. El check controla la forma; los dos dígitos verificadores los revisa el dominio, que es donde el dueño ve el aviso antes de guardar (ADR 0048).';
comment on column public.ajustes.cobro_titular is 'A nombre de quién está la cuenta, o vacío. Está para que el cliente confirme contra lo que le muestra su banco antes de transferir.';
comment on column public.ajustes.cobro_cuit is 'El CUIT del titular con guiones (NN-NNNNNNNN-N), o vacío. Mismo formato que public.clientes.cuit; el dígito verificador lo revisa la app.';
comment on column public.ajustes.cobro_link is 'El link de Mercado Pago del taller para que el cliente le pague, o vacío. Lo pega el dueño: lo saca de su app, de Cobrar con QR o de Link de pago. La página del cliente lo muestra como código QR y como botón. No se deriva del alias ni del CVU porque no existe ningún link estándar que abra una billetera en «Transferir a este alias»: el QR interoperable del BCRA lo emite un PSP y es un QR de cobro. El check acota el host a Mercado Pago porque este texto se vuelve un enlace en una página pública. Cobrar por acá le cuesta comisión al taller; transferir al alias no (ADR 0051 y 0054).';
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
grant update (sueldo_mensual_centavos, costos_fijos_centavos, meta_cocos_centavos, tasa_cocos_anual_bp, perdido_con_sueldo, perdido_con_diezmo, sena_bp, cobro_alias, cobro_cbu, cobro_titular, cobro_cuit, cobro_link) on public.ajustes to authenticated;

create table public.anotaciones (
  id uuid not null default private.uuidv7(),
  household_id uuid not null default private.household_actual(),
  fecha date not null,
  hora time without time zone,
  texto text not null,
  categoria categoria_anotacion not null default 'taller'::categoria_anotacion,
  proyecto_id uuid,
  hecha boolean not null default false,
  importante boolean not null default false,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone,
  version integer not null default 1,
  constraint anotaciones_household_id_fkey FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE,
  constraint anotaciones_pkey PRIMARY KEY (id),
  constraint anotaciones_proyecto_fk FOREIGN KEY (household_id, proyecto_id) REFERENCES proyectos(household_id, id),
  constraint anotaciones_texto_valido CHECK (btrim(texto) <> ''::text AND char_length(texto) <= 500)
);
comment on table public.anotaciones is 'Lo que el dueño anota a mano en la agenda. Las visitas, las entregas y los vencimientos de presupuesto no están acá: se calculan desde el proyecto (ADR 0034).';
comment on column public.anotaciones.household_id is 'Default: el household del usuario de la sesión. El cliente de la app no lo manda.';
comment on column public.anotaciones.fecha is 'El día de la anotación. El día es la unidad de la agenda.';
comment on column public.anotaciones.hora is 'Hora opcional: «15hs retirar el pulpo». Null es «en algún momento del día».';
comment on column public.anotaciones.proyecto_id is 'Trabajo al que se refiere, si se refiere a uno. Borrar el proyecto (lógico) no borra la anotación.';
comment on column public.anotaciones.hecha is 'La tildó como hecha. Sigue en la agenda, tachada.';
comment on column public.anotaciones.importante is 'La marcó como importante: el círculo con que en el cuaderno de papel marca lo importante de la semana.';
comment on column public.anotaciones.deleted_at is 'Borrado lógico, como en todo el household: delta() lo trae para que el cliente la saque de su copia.';
CREATE INDEX anotaciones_household_actualizado ON public.anotaciones USING btree (household_id, updated_at);
CREATE INDEX anotaciones_household_proyecto ON public.anotaciones USING btree (household_id, proyecto_id);
CREATE TRIGGER metadatos BEFORE INSERT OR UPDATE ON anotaciones FOR EACH ROW EXECUTE FUNCTION private.mantener_metadatos();
alter table public.anotaciones enable row level security;
create policy anotaciones_alta on public.anotaciones as permissive
  for insert to authenticated
  with check ((household_id = ANY (ARRAY( SELECT private.user_household_ids() AS user_household_ids))));
create policy anotaciones_edicion on public.anotaciones as permissive
  for update to authenticated
  using ((household_id = ANY (ARRAY( SELECT private.user_household_ids() AS user_household_ids))))
  with check ((household_id = ANY (ARRAY( SELECT private.user_household_ids() AS user_household_ids))));
create policy anotaciones_lectura on public.anotaciones as permissive
  for select to authenticated
  using ((household_id = ANY (ARRAY( SELECT private.user_household_ids() AS user_household_ids))));
grant select on public.anotaciones to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.anotaciones to service_role;
grant insert (id, fecha, hora, texto, categoria, proyecto_id, hecha, importante, deleted_at) on public.anotaciones to authenticated;
grant update (id, fecha, hora, texto, categoria, proyecto_id, hecha, importante, deleted_at) on public.anotaciones to authenticated;

create table public.archivos (
  id uuid not null default private.uuidv7(),
  household_id uuid not null default private.household_actual(),
  proyecto_id uuid not null,
  nombre text not null,
  tipo text not null,
  bytes bigint not null,
  ancho integer,
  alto integer,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone,
  version integer not null default 1,
  visible_para_cliente boolean not null default false,
  constraint archivos_bytes_validos CHECK (bytes > 0 AND bytes <= 20971520),
  constraint archivos_household_id_fkey FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE,
  constraint archivos_medidas_validas CHECK ((ancho IS NULL) = (alto IS NULL) AND (ancho IS NULL OR ancho > 0 AND alto > 0)),
  constraint archivos_nombre_valido CHECK (btrim(nombre) <> ''::text AND char_length(nombre) <= 200),
  constraint archivos_pkey PRIMARY KEY (id),
  constraint archivos_proyecto_fk FOREIGN KEY (household_id, proyecto_id) REFERENCES proyectos(household_id, id),
  constraint archivos_tipo_valido CHECK (tipo = ANY (ARRAY['image/webp'::text, 'image/jpeg'::text, 'application/pdf'::text]))
);
comment on table public.archivos is 'Los archivos de un trabajo (contacto u obra): fotos, capturas y PDF. El binario vive en el bucket archivos, en {household}/{proyecto}/{id}.{extensión}; esta fila es lo que la réplica trae (ADR 0039).';
comment on column public.archivos.household_id is 'Default: el household del usuario de la sesión. El cliente de la app no lo manda.';
comment on column public.archivos.nombre is 'El nombre con el que se eligió el archivo, para mostrarlo. La ruta en el bucket sale del id, no del nombre.';
comment on column public.archivos.tipo is 'Lo que quedó en el bucket: image/webp o image/jpeg (la app convierte toda imagen antes de subirla) o application/pdf. La extensión de la ruta sale de acá.';
comment on column public.archivos.bytes is 'Lo que ocupa en el bucket: el archivo y, si es una imagen, su miniatura. La suma del taller es lo que se compara contra el espacio del plan.';
comment on column public.archivos.ancho is 'Ancho en píxeles de una imagen, para reservarle el lugar antes de que cargue. Null en un PDF.';
comment on column public.archivos.alto is 'Alto en píxeles de una imagen. Null en un PDF.';
comment on column public.archivos.deleted_at is 'Borrado lógico, como en todo el household. La app quita el binario del bucket cuando vence el deshacer.';
comment on column public.archivos.visible_para_cliente is 'Si este archivo se ve en la vista del cliente. Apagado por defecto, siempre: un archivo nuevo es privado hasta que el dueño decide lo contrario, nunca al revés (ADR 0046).';
CREATE INDEX archivos_household_actualizado ON public.archivos USING btree (household_id, updated_at);
CREATE INDEX archivos_household_proyecto ON public.archivos USING btree (household_id, proyecto_id);
CREATE TRIGGER metadatos BEFORE INSERT OR UPDATE ON archivos FOR EACH ROW EXECUTE FUNCTION private.mantener_metadatos();
alter table public.archivos enable row level security;
create policy archivos_alta on public.archivos as permissive
  for insert to authenticated
  with check ((household_id = ANY (ARRAY( SELECT private.user_household_ids() AS user_household_ids))));
create policy archivos_edicion on public.archivos as permissive
  for update to authenticated
  using ((household_id = ANY (ARRAY( SELECT private.user_household_ids() AS user_household_ids))))
  with check ((household_id = ANY (ARRAY( SELECT private.user_household_ids() AS user_household_ids))));
create policy archivos_lectura on public.archivos as permissive
  for select to authenticated
  using ((household_id = ANY (ARRAY( SELECT private.user_household_ids() AS user_household_ids))));
grant select on public.archivos to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.archivos to service_role;
grant insert (id, proyecto_id, nombre, tipo, bytes, ancho, alto, deleted_at) on public.archivos to authenticated;
grant update (id, proyecto_id, nombre, tipo, bytes, ancho, alto, deleted_at, visible_para_cliente) on public.archivos to authenticated;

create table public.cambios_de_estado (
  id uuid not null default private.uuidv7(),
  household_id uuid not null,
  proyecto_id uuid not null,
  desde estado_proyecto,
  hacia estado_proyecto not null,
  ocurrio_el date not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone,
  version integer not null default 1,
  constraint cambios_de_estado_cambia CHECK (desde IS DISTINCT FROM hacia),
  constraint cambios_de_estado_household_id_fkey FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE,
  constraint cambios_de_estado_pkey PRIMARY KEY (id),
  constraint cambios_de_estado_proyecto_fk FOREIGN KEY (household_id, proyecto_id) REFERENCES proyectos(household_id, id)
);
comment on table public.cambios_de_estado is 'Cuándo el trabajo pasó de una etapa a otra. Lo escribe un trigger sobre proyectos y nadie más: no hay grant de insert ni de update para la app. Hoy no lo muestra ninguna pantalla; se guarda desde ahora porque la línea de tiempo que el cliente va a ver necesita fechas que no se pueden reconstruir después (ADR 0046).';
comment on column public.cambios_de_estado.desde is 'La etapa de la que salió. Null en el alta del trabajo.';
comment on column public.cambios_de_estado.ocurrio_el is 'El día del cambio, en la hora del taller. El taller está en Argentina y un cambio guardado a las diez de la noche no puede quedar anotado al día siguiente.';
comment on column public.cambios_de_estado.deleted_at is 'Sin uso: el registro no se borra. La columna está porque toda tabla del household la tiene.';
CREATE INDEX cambios_de_estado_household_actualizado ON public.cambios_de_estado USING btree (household_id, updated_at);
CREATE INDEX cambios_de_estado_household_proyecto ON public.cambios_de_estado USING btree (household_id, proyecto_id, ocurrio_el);
CREATE TRIGGER metadatos BEFORE INSERT OR UPDATE ON cambios_de_estado FOR EACH ROW EXECUTE FUNCTION private.mantener_metadatos();
alter table public.cambios_de_estado enable row level security;
create policy cambios_de_estado_lectura on public.cambios_de_estado as permissive
  for select to authenticated
  using ((household_id = ANY (ARRAY( SELECT private.user_household_ids() AS user_household_ids))));
grant select on public.cambios_de_estado to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.cambios_de_estado to service_role;

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

create table public.enlaces_publicos (
  id uuid not null default private.uuidv7(),
  household_id uuid not null default private.household_actual(),
  proyecto_id uuid not null,
  token_hash text not null,
  revocado_at timestamp with time zone,
  visitas integer not null default 0,
  ultima_visita_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone,
  version integer not null default 1,
  token text,
  constraint enlaces_publicos_hash_valido CHECK (token_hash ~ '^[0-9a-f]{64}$'::text),
  constraint enlaces_publicos_household_id_fkey FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE,
  constraint enlaces_publicos_pkey PRIMARY KEY (id),
  constraint enlaces_publicos_proyecto_fk FOREIGN KEY (household_id, proyecto_id) REFERENCES proyectos(household_id, id),
  constraint enlaces_publicos_token_coincide CHECK (token IS NULL OR encode(sha256(convert_to(token, 'UTF8'::name)), 'hex'::text) = token_hash),
  constraint enlaces_publicos_token_formato CHECK (token IS NULL OR token ~ '^[A-Za-z0-9_-]{16,128}$'::text),
  constraint enlaces_publicos_visitas_no_negativas CHECK (visitas >= 0)
);
comment on table public.enlaces_publicos is 'El link sin sesión de un trabajo. Guarda las dos cosas: token_hash, que es con lo que public.vista_compartida() resuelve el token que llega por la URL, y token, el token en claro, para que el dueño vea la dirección desde cualquiera de sus aparatos y no tenga que crear otro (ADR 0052). La consecuencia, escrita para que nadie la deduzca al revés: un volcado de esta tabla contiene enlaces que funcionan, y hay que tratarlo como tal. El rol anónimo no tiene ningún grant acá y ninguna función security definer devuelve la columna token.';
comment on column public.enlaces_publicos.household_id is 'Default: el household del usuario de la sesión. El cliente de la app no lo manda.';
comment on column public.enlaces_publicos.token_hash is 'sha256 del token en hexadecimal. El token es aleatorio y no es el id del trabajo: el id codifica el momento en que se creó y no sirve como secreto.';
comment on column public.enlaces_publicos.revocado_at is 'Cuándo se dio de baja. Null es activo. No hay caducidad automática: el uso es compartirlo al empezar una obra que dura meses, y un link que se vence a la mitad solo hace que el cliente llame (ADR 0046).';
comment on column public.enlaces_publicos.visitas is 'Cuántas veces se abrió. Lo cuenta public.vista_compartida().';
comment on column public.enlaces_publicos.ultima_visita_at is 'La última vez que se abrió.';
comment on column public.enlaces_publicos.deleted_at is 'Borrado lógico, como en todo el household. Borrar el trabajo se lleva su link.';
comment on column public.enlaces_publicos.token is 'El token del enlace en claro, o null en los enlaces creados antes de que esto existiera. Viaja en la réplica para que el dueño vea la dirección desde cualquiera de sus aparatos y no tenga que crear otro, que le rompería al cliente el que ya tiene. El check enlaces_publicos_token_coincide obliga a que su sha256 sea token_hash: acá no se puede guardar un token que no sea el de esta fila. El rol anónimo no tiene ningún grant sobre esta tabla y ninguna función security definer devuelve esta columna (ADR 0052).';
CREATE INDEX enlaces_publicos_household_actualizado ON public.enlaces_publicos USING btree (household_id, updated_at);
CREATE INDEX enlaces_publicos_household_proyecto ON public.enlaces_publicos USING btree (household_id, proyecto_id);
CREATE UNIQUE INDEX enlaces_publicos_token ON public.enlaces_publicos USING btree (token_hash);
CREATE UNIQUE INDEX enlaces_publicos_uno_vivo_por_trabajo ON public.enlaces_publicos USING btree (household_id, proyecto_id) WHERE ((revocado_at IS NULL) AND (deleted_at IS NULL));
CREATE TRIGGER metadatos BEFORE INSERT OR UPDATE ON enlaces_publicos FOR EACH ROW EXECUTE FUNCTION private.mantener_metadatos();
alter table public.enlaces_publicos enable row level security;
create policy enlaces_publicos_alta on public.enlaces_publicos as permissive
  for insert to authenticated
  with check ((household_id = ANY (ARRAY( SELECT private.user_household_ids() AS user_household_ids))));
create policy enlaces_publicos_edicion on public.enlaces_publicos as permissive
  for update to authenticated
  using ((household_id = ANY (ARRAY( SELECT private.user_household_ids() AS user_household_ids))))
  with check ((household_id = ANY (ARRAY( SELECT private.user_household_ids() AS user_household_ids))));
create policy enlaces_publicos_lectura on public.enlaces_publicos as permissive
  for select to authenticated
  using ((household_id = ANY (ARRAY( SELECT private.user_household_ids() AS user_household_ids))));
grant select on public.enlaces_publicos to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.enlaces_publicos to service_role;
grant insert (id, proyecto_id, token_hash, revocado_at, deleted_at, token) on public.enlaces_publicos to authenticated;
grant update (id, proyecto_id, token_hash, revocado_at, deleted_at, token) on public.enlaces_publicos to authenticated;

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
create policy households_edicion on public.households as permissive
  for update to authenticated
  using ((id = ANY (ARRAY( SELECT private.user_household_ids() AS user_household_ids))))
  with check ((id = ANY (ARRAY( SELECT private.user_household_ids() AS user_household_ids))));
create policy households_lectura_miembros on public.households as permissive
  for select to authenticated
  using ((id = ANY (ARRAY( SELECT private.user_household_ids() AS user_household_ids))));
grant select on public.households to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.households to service_role;
grant update (nombre) on public.households to authenticated;

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

create table public.necesidades (
  id uuid not null default private.uuidv7(),
  household_id uuid not null default private.household_actual(),
  proyecto_id uuid not null,
  tipo tipo_de_necesidad not null,
  nombre text not null,
  cantidad integer,
  listo boolean not null default false,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone,
  version integer not null default 1,
  constraint necesidades_cantidad_valida CHECK (cantidad IS NULL OR cantidad > 0),
  constraint necesidades_household_id_fkey FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE,
  constraint necesidades_nombre_valido CHECK (btrim(nombre) <> ''::text AND char_length(nombre) <= 120),
  constraint necesidades_pkey PRIMARY KEY (id),
  constraint necesidades_proyecto_fk FOREIGN KEY (household_id, proyecto_id) REFERENCES proyectos(household_id, id)
);
comment on table public.necesidades is 'Los herrajes y las herramientas que hacen falta para un trabajo. Hasta ahora el dueño las escribía a mano en las notas del trabajo, en dos listas. El catálogo de nombres no es otra tabla: son los nombres distintos que ya usó, que salen de estas mismas filas (ADR 0045).';
comment on column public.necesidades.household_id is 'Default: el household del usuario de la sesión. El cliente de la app no lo manda.';
comment on column public.necesidades.tipo is 'Herraje o herramienta. El autocompletado sugiere solo nombres del mismo tipo.';
comment on column public.necesidades.nombre is 'Cómo lo llama él: «Bisagras», «Sierra Circular». Es también la clave del catálogo derivado.';
comment on column public.necesidades.cantidad is 'Cuántos, si lleva número. Null es «hace falta y no conté»: una herramienta, o los tarugos.';
comment on column public.necesidades.listo is 'Ya lo pedió, lo compró o lo tiene separado. Se queda en la lista, tachado, como una anotación tildada de la agenda.';
comment on column public.necesidades.deleted_at is 'Borrado lógico, como en todo el household.';
CREATE INDEX necesidades_household_actualizado ON public.necesidades USING btree (household_id, updated_at);
CREATE INDEX necesidades_household_proyecto ON public.necesidades USING btree (household_id, proyecto_id);
CREATE TRIGGER metadatos BEFORE INSERT OR UPDATE ON necesidades FOR EACH ROW EXECUTE FUNCTION private.mantener_metadatos();
alter table public.necesidades enable row level security;
create policy necesidades_alta on public.necesidades as permissive
  for insert to authenticated
  with check ((household_id = ANY (ARRAY( SELECT private.user_household_ids() AS user_household_ids))));
create policy necesidades_edicion on public.necesidades as permissive
  for update to authenticated
  using ((household_id = ANY (ARRAY( SELECT private.user_household_ids() AS user_household_ids))))
  with check ((household_id = ANY (ARRAY( SELECT private.user_household_ids() AS user_household_ids))));
create policy necesidades_lectura on public.necesidades as permissive
  for select to authenticated
  using ((household_id = ANY (ARRAY( SELECT private.user_household_ids() AS user_household_ids))));
grant select on public.necesidades to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.necesidades to service_role;
grant insert (id, proyecto_id, tipo, nombre, cantidad, listo, deleted_at) on public.necesidades to authenticated;
grant update (id, proyecto_id, tipo, nombre, cantidad, listo, deleted_at) on public.necesidades to authenticated;

create table public.opciones_de_presupuesto (
  id uuid not null default private.uuidv7(),
  household_id uuid not null default private.household_actual(),
  proyecto_id uuid not null,
  descripcion text not null default ''::text,
  monto_centavos bigint not null,
  aprobada boolean not null default false,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone,
  version integer not null default 1,
  constraint opciones_de_presupuesto_descripcion_larga CHECK (char_length(descripcion) <= 500),
  constraint opciones_de_presupuesto_household_id_fkey FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE,
  constraint opciones_de_presupuesto_monto_no_negativo CHECK (monto_centavos >= 0),
  constraint opciones_de_presupuesto_pkey PRIMARY KEY (id),
  constraint opciones_de_presupuesto_proyecto_fk FOREIGN KEY (household_id, proyecto_id) REFERENCES proyectos(household_id, id),
  constraint presupuesto_aprobado TRIGGER DEFERRABLE INITIALLY DEFERRED
);
comment on table public.opciones_de_presupuesto is 'Las opciones de presupuesto que se le presentaron al cliente para un trabajo. Cuando el cliente elige, se tilda una y su importe pasa a ser el presupuesto del trabajo. Las que no eligió no se borran: son lo que se ofreció (ADR 0043).';
comment on column public.opciones_de_presupuesto.household_id is 'Default: el household del usuario de la sesión. El cliente de la app no lo manda.';
comment on column public.opciones_de_presupuesto.descripcion is 'Qué incluye esta opción, y el plan de pago si lo hay. Es donde va lo que antes se escribía en las notas.';
comment on column public.opciones_de_presupuesto.monto_centavos is 'El importe de esta opción, en centavos. Cuando se aprueba, es el presupuesto del trabajo.';
comment on column public.opciones_de_presupuesto.aprobada is 'La que eligió el cliente. Hay a lo sumo una viva por trabajo, y mientras no haya ninguna el trabajo no tiene presupuesto.';
comment on column public.opciones_de_presupuesto.deleted_at is 'Borrado lógico, como en todo el household.';
CREATE INDEX opciones_de_presupuesto_household_actualizado ON public.opciones_de_presupuesto USING btree (household_id, updated_at);
CREATE INDEX opciones_de_presupuesto_household_proyecto ON public.opciones_de_presupuesto USING btree (household_id, proyecto_id);
CREATE UNIQUE INDEX opciones_de_presupuesto_una_aprobada ON public.opciones_de_presupuesto USING btree (household_id, proyecto_id) WHERE (aprobada AND (deleted_at IS NULL));
CREATE TRIGGER metadatos BEFORE INSERT OR UPDATE ON opciones_de_presupuesto FOR EACH ROW EXECUTE FUNCTION private.mantener_metadatos();
CREATE CONSTRAINT TRIGGER presupuesto_aprobado AFTER INSERT OR UPDATE ON opciones_de_presupuesto DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION private.validar_presupuesto_aprobado();
alter table public.opciones_de_presupuesto enable row level security;
create policy opciones_de_presupuesto_alta on public.opciones_de_presupuesto as permissive
  for insert to authenticated
  with check ((household_id = ANY (ARRAY( SELECT private.user_household_ids() AS user_household_ids))));
create policy opciones_de_presupuesto_edicion on public.opciones_de_presupuesto as permissive
  for update to authenticated
  using ((household_id = ANY (ARRAY( SELECT private.user_household_ids() AS user_household_ids))))
  with check ((household_id = ANY (ARRAY( SELECT private.user_household_ids() AS user_household_ids))));
create policy opciones_de_presupuesto_lectura on public.opciones_de_presupuesto as permissive
  for select to authenticated
  using ((household_id = ANY (ARRAY( SELECT private.user_household_ids() AS user_household_ids))));
grant select on public.opciones_de_presupuesto to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.opciones_de_presupuesto to service_role;
grant insert (id, proyecto_id, descripcion, monto_centavos, aprobada, deleted_at) on public.opciones_de_presupuesto to authenticated;
grant update (id, proyecto_id, descripcion, monto_centavos, aprobada, deleted_at) on public.opciones_de_presupuesto to authenticated;

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
  reapertura_objetivo_sueldo_centavos bigint,
  reapertura_objetivo_fijos_centavos bigint,
  reapertura_fecha_cobro date,
  dist_objetivo_sueldo_centavos bigint,
  dist_objetivo_fijos_centavos bigint,
  dist_sueldo_mensual boolean,
  dist_sueldo_previo_centavos bigint,
  dist_fijos_previo_centavos bigint,
  dist_liquidado_at timestamp with time zone,
  reapertura_sueldo_mensual boolean,
  vencimiento_presupuesto date,
  presupuesto_diseno boolean not null default false,
  presupuesto_despiece boolean not null default false,
  presupuesto_cotizacion boolean not null default false,
  presupuesto_pdf boolean not null default false,
  visita_hecha boolean not null default false,
  visita_importante boolean not null default false,
  entrega_importante boolean not null default false,
  presupuesto_importante boolean not null default false,
  sena_bp integer,
  costo_madera_centavos bigint,
  costo_herrajes_centavos bigint,
  costo_flete_centavos bigint,
  costo_ayudante_centavos bigint,
  entrega_hora time without time zone,
  visita_hora time without time zone,
  cobro_sena forma_de_cobro[],
  cobro_saldo forma_de_cobro[],
  constraint presupuesto_aprobado TRIGGER DEFERRABLE INITIALLY DEFERRED,
  constraint proyectos_cliente_fk FOREIGN KEY (household_id, cliente_id) REFERENCES clientes(household_id, id),
  constraint proyectos_cobro_saldo_valido CHECK (COALESCE(cobro_saldo IS NULL OR cobro_saldo = ARRAY['transferencia'::forma_de_cobro] OR cobro_saldo = ARRAY['efectivo'::forma_de_cobro] OR cobro_saldo = ARRAY['transferencia'::forma_de_cobro, 'efectivo'::forma_de_cobro], false)),
  constraint proyectos_cobro_sena_valido CHECK (COALESCE(cobro_sena IS NULL OR cobro_sena = ARRAY['transferencia'::forma_de_cobro] OR cobro_sena = ARRAY['efectivo'::forma_de_cobro] OR cobro_sena = ARRAY['transferencia'::forma_de_cobro, 'efectivo'::forma_de_cobro], false)),
  constraint proyectos_costo_ayudante_no_negativo CHECK (costo_ayudante_centavos IS NULL OR costo_ayudante_centavos >= 0),
  constraint proyectos_costo_flete_no_negativo CHECK (costo_flete_centavos IS NULL OR costo_flete_centavos >= 0),
  constraint proyectos_costo_herrajes_no_negativo CHECK (costo_herrajes_centavos IS NULL OR costo_herrajes_centavos >= 0),
  constraint proyectos_costo_madera_no_negativo CHECK (costo_madera_centavos IS NULL OR costo_madera_centavos >= 0),
  constraint proyectos_distribucion_cuadra CHECK (dist_cobrado_centavos IS NULL OR dist_cobrado_centavos >= 0 AND dist_gastos_centavos >= 0 AND dist_diezmo_bp >= 0 AND dist_diezmo_bp <= 10000 AND dist_tope_sueldo_centavos >= 0 AND dist_tope_fijos_centavos >= 0 AND dist_diezmo_centavos >= 0 AND dist_sueldo_centavos >= 0 AND dist_sueldo_centavos <= dist_tope_sueldo_centavos AND dist_fijos_centavos >= 0 AND dist_fijos_centavos <= dist_tope_fijos_centavos AND (dist_remanente_centavos >= 0 OR (dist_diezmo_centavos + dist_sueldo_centavos + dist_fijos_centavos) = 0) AND (dist_diezmo_centavos + dist_sueldo_centavos + dist_fijos_centavos + dist_remanente_centavos) = (dist_cobrado_centavos - dist_gastos_centavos)),
  constraint proyectos_household_id_fkey FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE,
  constraint proyectos_household_id_key UNIQUE (household_id, id),
  constraint proyectos_largos CHECK (char_length(titulo) <= 200 AND char_length(descripcion) <= 10000 AND char_length(direccion_entrega) <= 500 AND char_length(notas) <= 10000),
  constraint proyectos_liquidado_con_distribucion CHECK ((estado = ANY (ARRAY['cobrado'::estado_proyecto, 'perdido'::estado_proyecto])) = (fecha_cobro IS NOT NULL) AND (num_nulls(fecha_cobro, dist_cobrado_centavos, dist_gastos_centavos, dist_diezmo_bp, dist_tope_sueldo_centavos, dist_tope_fijos_centavos, dist_diezmo_centavos, dist_sueldo_centavos, dist_fijos_centavos, dist_remanente_centavos, dist_objetivo_sueldo_centavos, dist_objetivo_fijos_centavos, dist_sueldo_mensual, dist_sueldo_previo_centavos, dist_fijos_previo_centavos, dist_liquidado_at) = ANY (ARRAY[0, 16]))),
  constraint proyectos_pkey PRIMARY KEY (id),
  constraint proyectos_presupuesto_no_negativo CHECK (presupuesto_centavos IS NULL OR presupuesto_centavos >= 0),
  constraint proyectos_reapertura_completa CHECK ((num_nulls(reapertura_objetivo_sueldo_centavos, reapertura_objetivo_fijos_centavos, reapertura_sueldo_mensual, reapertura_fecha_cobro) = ANY (ARRAY[0, 4])) AND ((estado <> ALL (ARRAY['cobrado'::estado_proyecto, 'perdido'::estado_proyecto])) OR reapertura_fecha_cobro IS NULL)),
  constraint proyectos_sena_valida CHECK (sena_bp IS NULL OR sena_bp >= 0 AND sena_bp <= 10000),
  constraint proyectos_titulo_valido CHECK (btrim(titulo) <> ''::text),
  constraint proyectos_topes_del_mes CHECK (dist_cobrado_centavos IS NULL OR COALESCE(dist_objetivo_sueldo_centavos >= 0 AND dist_objetivo_fijos_centavos >= 0 AND dist_sueldo_previo_centavos >= 0 AND dist_fijos_previo_centavos >= 0 AND dist_tope_fijos_centavos = GREATEST(0::bigint, dist_objetivo_fijos_centavos - dist_fijos_previo_centavos) AND dist_tope_sueldo_centavos =
CASE
    WHEN dist_sueldo_mensual THEN GREATEST(0::bigint, dist_objetivo_sueldo_centavos - dist_sueldo_previo_centavos)
    ELSE dist_objetivo_sueldo_centavos
END, false))
);
comment on table public.proyectos is 'Leads y proyectos: la misma fila avanza de seguimiento a obra y a cobrado, o se cierra como perdido. Liquidar (cobrar o cerrar como perdido) congela la distribución (ADR 0003 y 0011).';
comment on column public.proyectos.titulo is 'El trabajo, en pocas palabras: "Placard 3 puertas con interior en melamina".';
comment on column public.proyectos.presupuesto_centavos is 'Presupuesto acordado. Null mientras el lead no tiene presupuesto. La distribución NO se calcula sobre esto sino sobre lo cobrado.';
comment on column public.proyectos.fecha_visita is 'Visita de relevamiento, en la etapa de seguimiento.';
comment on column public.proyectos.ultimo_contacto is 'Último contacto con el cliente, en la etapa de seguimiento.';
comment on column public.proyectos.entrega_estimada is 'Entrega prometida. La app la propone a 21 días hábiles del inicio.';
comment on column public.proyectos.fecha_entrega is 'Entrega real.';
comment on column public.proyectos.fecha_cobro is 'Fecha de la liquidación: el cobro final o el cierre como perdido. No null si y solo si el proyecto está cobrado o perdido. Es la fecha de los asientos derivados en el libro mayor y define el mes de los topes.';
comment on column public.proyectos.dist_cobrado_centavos is 'Congelado al liquidar: total cobrado (suma de pagos vivos). En un perdido, la seña retenida.';
comment on column public.proyectos.dist_gastos_centavos is 'Congelado al liquidar: total de gastos del proyecto.';
comment on column public.proyectos.dist_diezmo_bp is 'Congelado al liquidar: porcentaje de diezmo aplicado, en puntos básicos (1000 = 10%). Un perdido usa 0 si ajustes.perdido_con_diezmo está apagado.';
comment on column public.proyectos.dist_tope_sueldo_centavos is 'Congelado al liquidar: tope de sueldo que se aplicó. Sale del objetivo, del modo y de lo liquidado en el mes (proyectos_topes_del_mes).';
comment on column public.proyectos.dist_tope_fijos_centavos is 'Congelado al liquidar: tope de costos fijos que se aplicó, lo que faltaba cubrir del mes.';
comment on column public.proyectos.dist_diezmo_centavos is 'Congelado al liquidar: lo que pasa de MAUN a DIEZMO.';
comment on column public.proyectos.dist_sueldo_centavos is 'Congelado al liquidar: lo que pasa de MAUN a HOGAR.';
comment on column public.proyectos.dist_fijos_centavos is 'Congelado al liquidar: la parte de la ganancia que cubre costos fijos del mes. Queda en MAUN y no mueve plata entre tesoros.';
comment on column public.proyectos.dist_remanente_centavos is 'Congelado al liquidar: lo que sobra en MAUN. Negativo solo si el proyecto dio pérdida.';
comment on column public.proyectos.deleted_at is 'Borrado lógico. Borrar un proyecto borra sus pagos y gastos; uno liquidado con pagos o gastos vivos no se borra, y uno borrado no revive.';
comment on column public.proyectos.reapertura_objetivo_sueldo_centavos is 'Objetivo de sueldo del cobro que se reabrió. El próximo cobro lo usa en vez del de los ajustes, y lo limpia.';
comment on column public.proyectos.reapertura_objetivo_fijos_centavos is 'Objetivo de costos fijos del cobro que se reabrió. El tope se recalcula contra lo liquidado hoy en ese mes.';
comment on column public.proyectos.reapertura_fecha_cobro is 'Fecha del cobro que se reabrió. El próximo cobro conserva esa fecha y ese mes: corregir no mueve la distribución en el libro mayor.';
comment on column public.proyectos.dist_objetivo_sueldo_centavos is 'Congelado al liquidar: objetivo de sueldo con el que se calculó el tope. En un perdido sin sueldo, cero.';
comment on column public.proyectos.dist_objetivo_fijos_centavos is 'Congelado al liquidar: costos fijos del mes con los que se calculó el tope.';
comment on column public.proyectos.dist_sueldo_mensual is 'Congelado al liquidar: si el sueldo se topeó por mes (true) o por proyecto (false).';
comment on column public.proyectos.dist_sueldo_previo_centavos is 'Congelado al liquidar: sueldo que el mes ya llevaba liquidado por otros proyectos en ese instante. Explica el tope; una reapertura posterior en el mismo mes no lo reescribe.';
comment on column public.proyectos.dist_fijos_previo_centavos is 'Congelado al liquidar: costos fijos que el mes ya llevaba liquidados por otros proyectos en ese instante.';
comment on column public.proyectos.dist_liquidado_at is 'Congelado al liquidar: el instante de la liquidación. Ordena las liquidaciones de un mismo mes.';
comment on column public.proyectos.reapertura_sueldo_mensual is 'Modo del sueldo del cobro que se reabrió. El próximo cobro lo conserva aunque los ajustes hayan cambiado.';
comment on column public.proyectos.vencimiento_presupuesto is 'Fecha límite para entregar el presupuesto de un contacto. La app la propone a cinco días hábiles del relevamiento (una semana de trabajo) cuando el contacto pasa a presupuestar, y desde el día que pasa si viene de un estimativo; se edita como la entrega estimada. La agenda la muestra mientras el contacto no mandó el presupuesto ni un estimativo.';
comment on column public.proyectos.presupuesto_diseno is 'Tarea de presupuestar: el diseño está hecho. Es una tilde adentro de la etapa «a presupuestar», no un estado (ADR 0038).';
comment on column public.proyectos.presupuesto_despiece is 'Tarea de presupuestar: el despiece está hecho.';
comment on column public.proyectos.presupuesto_cotizacion is 'Tarea de presupuestar: la cotización está hecha (madera y herrajes, flete, ayudante).';
comment on column public.proyectos.presupuesto_pdf is 'Tarea de presupuestar: el PDF del presupuesto está armado. Con las cuatro tildadas, la app sugiere marcar que se mandó; el estado lo cambia el dueño.';
comment on column public.proyectos.visita_hecha is 'La visita de relevamiento ya pasó. Lo anota «Ya fui a relevar» y se corrige desde la hoja del contacto; mover la visita a un día que todavía no llegó lo apaga. No sale de la etapa: cambiar de etapa, aprobar o perder el contacto no lo toca, y la agenda muestra la visita tachada en su día (ADR 0042).';
comment on column public.proyectos.visita_importante is 'Marca de importante de la visita en la agenda: el círculo que el dueño hace en su cuaderno. Una columna por evento derivado; el umbral para pasar a una tabla de marcas está en el ADR 0042.';
comment on column public.proyectos.entrega_importante is 'Marca de importante de la entrega en la agenda. La entrega entregada la conserva.';
comment on column public.proyectos.presupuesto_importante is 'Marca de importante del vencimiento del presupuesto en la agenda.';
comment on column public.proyectos.sena_bp is 'La seña de este trabajo, en puntos básicos, cuando no es la del taller. Null es "la de ajustes". El dueño dijo que la seña normal es la mitad pero puede ser otra.';
comment on column public.proyectos.costo_madera_centavos is 'Lo que el dueño calcula que va a gastar en madera para este trabajo, en centavos. Null es «todavía no lo estimé», que no es lo mismo que cero. No es un gasto real ni alimenta el presupuesto: el presupuesto incluye su ganancia y la decide él (ADR 0045).';
comment on column public.proyectos.costo_herrajes_centavos is 'Lo estimado en herrajes, en centavos. Null es «todavía no lo estimé».';
comment on column public.proyectos.costo_flete_centavos is 'Lo estimado en flete, en centavos. Null es «todavía no lo estimé».';
comment on column public.proyectos.costo_ayudante_centavos is 'Lo estimado en ayudante, en centavos. Null es «todavía no lo estimé».';
comment on column public.proyectos.entrega_hora is 'A qué hora es la entrega, si tiene hora. Null es «en algún momento de ese día», como en una anotación. La agenda pone lo que tiene hora en su renglón y lo demás en la franja de todo el día (ADR 0045).';
comment on column public.proyectos.visita_hora is 'A qué hora es la visita de relevamiento, si tiene hora. Null es «en algún momento de ese día».';
comment on column public.proyectos.cobro_sena is 'Cómo se puede pagar la seña de este trabajo, o null si el dueño no lo tocó. Null no es vacío: es «vale el valor por defecto», que private.formas_de_cobro() calcula según si el taller tiene datos para transferir cargados. El check acepta exactamente tres valores, así que un pago nunca queda sin ninguna forma (ADR 0053).';
comment on column public.proyectos.cobro_saldo is 'Lo mismo para el saldo. Son dos columnas y no una porque el dueño pide la seña por transferencia y cobra el saldo en efectivo cuando termina de instalar, que es el caso que motivó esto (ADR 0053).';
CREATE INDEX proyectos_household_actualizado ON public.proyectos USING btree (household_id, updated_at);
CREATE INDEX proyectos_household_cliente ON public.proyectos USING btree (household_id, cliente_id);
CREATE INDEX proyectos_liquidados_por_mes ON public.proyectos USING btree (household_id, fecha_cobro) WHERE (fecha_cobro IS NOT NULL);
CREATE TRIGGER anotar_el_cambio_de_estado AFTER INSERT OR UPDATE OF estado ON proyectos FOR EACH ROW EXECUTE FUNCTION private.anotar_el_cambio_de_estado();
CREATE TRIGGER borrar_hijos AFTER UPDATE OF deleted_at ON proyectos FOR EACH ROW WHEN (new.deleted_at IS NOT NULL AND old.deleted_at IS NULL) EXECUTE FUNCTION private.borrar_hijos_de_proyecto();
CREATE TRIGGER metadatos BEFORE INSERT OR UPDATE ON proyectos FOR EACH ROW EXECUTE FUNCTION private.mantener_metadatos();
CREATE CONSTRAINT TRIGGER presupuesto_aprobado AFTER INSERT OR UPDATE ON proyectos DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION private.validar_presupuesto_aprobado();
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
grant insert (id, cliente_id, titulo, descripcion, estado, presupuesto_centavos, forma_pago, comprobante, fecha_visita, ultimo_contacto, fecha_inicio, entrega_estimada, fecha_entrega, direccion_entrega, notas, deleted_at, vencimiento_presupuesto, presupuesto_diseno, presupuesto_despiece, presupuesto_cotizacion, presupuesto_pdf, visita_hecha, visita_importante, entrega_importante, presupuesto_importante, sena_bp, entrega_hora, visita_hora) on public.proyectos to authenticated;
grant update (id, cliente_id, titulo, descripcion, estado, presupuesto_centavos, forma_pago, comprobante, fecha_visita, ultimo_contacto, fecha_inicio, entrega_estimada, fecha_entrega, direccion_entrega, notas, deleted_at, vencimiento_presupuesto, presupuesto_diseno, presupuesto_despiece, presupuesto_cotizacion, presupuesto_pdf, visita_hecha, visita_importante, entrega_importante, presupuesto_importante, sena_bp, costo_madera_centavos, costo_herrajes_centavos, costo_flete_centavos, costo_ayudante_centavos, entrega_hora, visita_hora, cobro_sena, cobro_saldo) on public.proyectos to authenticated;


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
  WHERE (p.estado = ANY (ARRAY['cobrado'::estado_proyecto, 'perdido'::estado_proyecto])) AND p.deleted_at IS NULL AND d.monto_centavos <> 0;
comment on view public.libro_mayor is 'Libro mayor por tesoro: una fila por tesoro afectado, importe con signo. El saldo de un tesoro es sum(monto_centavos) where tesoro = X.';
grant select on public.libro_mayor to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.libro_mayor to service_role;


-- Triggers sobre auth.users ----------------------------------------------------------------------

CREATE TRIGGER taller_al_confirmar_el_mail AFTER UPDATE OF email_confirmed_at ON auth.users FOR EACH ROW WHEN (old.email_confirmed_at IS NULL AND new.email_confirmed_at IS NOT NULL) EXECUTE FUNCTION private.crear_taller_del_usuario();
CREATE TRIGGER taller_al_crear_la_cuenta AFTER INSERT ON auth.users FOR EACH ROW WHEN (new.email_confirmed_at IS NOT NULL) EXECUTE FUNCTION private.crear_taller_del_usuario();

-- Storage ----------------------------------------------------------------------------------------

-- bucket archivos: público, tope 10485760 bytes, tipos image/webp, image/jpeg, application/pdf
-- bucket fotos-de-perfil: público, tope 524288 bytes, tipos image/webp, image/jpeg
create policy archivos_borrar_los_del_taller on storage.objects as permissive
  for delete to authenticated
  using (((bucket_id = 'archivos'::text) AND ((storage.foldername(name))[1] = ANY (ARRAY( SELECT (h.h)::text AS h
   FROM private.user_household_ids() h(h))))));
create policy archivos_reemplazar_los_del_taller on storage.objects as permissive
  for update to authenticated
  using (((bucket_id = 'archivos'::text) AND ((storage.foldername(name))[1] = ANY (ARRAY( SELECT (h.h)::text AS h
   FROM private.user_household_ids() h(h))))))
  with check (((bucket_id = 'archivos'::text) AND ((storage.foldername(name))[1] = ANY (ARRAY( SELECT (h.h)::text AS h
   FROM private.user_household_ids() h(h))))));
create policy archivos_subir_al_taller on storage.objects as permissive
  for insert to authenticated
  with check (((bucket_id = 'archivos'::text) AND ((storage.foldername(name))[1] = ANY (ARRAY( SELECT (h.h)::text AS h
   FROM private.user_household_ids() h(h))))));
create policy archivos_ver_los_del_taller on storage.objects as permissive
  for select to authenticated
  using (((bucket_id = 'archivos'::text) AND ((storage.foldername(name))[1] = ANY (ARRAY( SELECT (h.h)::text AS h
   FROM private.user_household_ids() h(h))))));
comment on policy archivos_ver_los_del_taller on storage.objects is 'No es para leer los archivos (el bucket es público y se leen por URL): es para la subida con upsert, que chequea si el objeto existe con un select bajo la RLS del usuario. Sin esta política ese chequeo nunca encuentra el archivo anterior y la subida falla con un error de RLS.';
create policy fotos_de_perfil_borrar_la_propia on storage.objects as permissive
  for delete to authenticated
  using (((bucket_id = 'fotos-de-perfil'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));
create policy fotos_de_perfil_reemplazar_la_propia on storage.objects as permissive
  for update to authenticated
  using (((bucket_id = 'fotos-de-perfil'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)))
  with check (((bucket_id = 'fotos-de-perfil'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));
create policy fotos_de_perfil_subir_a_la_carpeta_propia on storage.objects as permissive
  for insert to authenticated
  with check (((bucket_id = 'fotos-de-perfil'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));
create policy fotos_de_perfil_ver_la_propia on storage.objects as permissive
  for select to authenticated
  using (((bucket_id = 'fotos-de-perfil'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));
comment on policy fotos_de_perfil_ver_la_propia on storage.objects is 'No es para leer las fotos (el bucket es público y se leen por URL): es para la subida con upsert, que chequea si el objeto existe con un select bajo la RLS del usuario. Sin esta política ese chequeo nunca encuentra la foto anterior y la subida falla con un error de RLS.';

-- Funciones --------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.anotar_aviso(p_suscripcion uuid, p_dia date, p_mandado boolean)
 RETURNS boolean
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select private.anotar_aviso(p_suscripcion, p_dia, p_mandado)
$function$;
-- execute: service_role:EXECUTE
comment on function anotar_aviso(uuid,date,boolean) is 'Solo para la función de borde de los avisos (service_role).';

CREATE OR REPLACE FUNCTION public.avisos_por_mandar(p_ahora timestamp with time zone DEFAULT now())
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select private.avisos_por_mandar(p_ahora)
$function$;
-- execute: service_role:EXECUTE
comment on function avisos_por_mandar(timestamp with time zone) is 'Solo para la función de borde de los avisos (service_role).';

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
    'opciones_de_presupuesto', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.opciones_de_presupuesto t where t.deleted_at is null
    ),
    'necesidades', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.necesidades t where t.deleted_at is null
    ),
    'movimientos', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.movimientos t where t.deleted_at is null
    ),
    'anotaciones', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.anotaciones t where t.deleted_at is null
    ),
    'archivos', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.archivos t where t.deleted_at is null
    ),
    'enlaces_publicos', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.enlaces_publicos t where t.deleted_at is null
    )
  )
$function$;
-- execute: authenticated:EXECUTE, service_role:EXECUTE
comment on function bootstrap() is 'Todo el household del usuario en un JSON, sin filas borradas, más el cursor para el primer delta. Es también el reconcile completo: el cliente reemplaza su copia entera con esto.';

CREATE OR REPLACE FUNCTION public.borrar_suscripcion_vencida(p_endpoint text)
 RETURNS boolean
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select private.borrar_suscripcion_vencida(p_endpoint)
$function$;
-- execute: service_role:EXECUTE
comment on function borrar_suscripcion_vencida(text) is 'Solo para la función de borde de los avisos (service_role).';

CREATE OR REPLACE FUNCTION public.cerrar_perdido(p_proyecto_id uuid, p_version integer, p_fecha date, p_cobrado_centavos bigint, p_gastos_centavos bigint, p_tope_sueldo_centavos bigint, p_tope_fijos_centavos bigint, p_diezmo_centavos bigint, p_sueldo_centavos bigint, p_fijos_centavos bigint, p_remanente_centavos bigint, p_diezmo_bp integer, p_sueldo_previo_centavos bigint DEFAULT NULL::bigint, p_fijos_previo_centavos bigint DEFAULT NULL::bigint)
 RETURNS proyectos
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select *
  from private.liquidar(
    'perdido', p_proyecto_id, p_version, p_fecha, p_cobrado_centavos, p_gastos_centavos,
    p_tope_sueldo_centavos, p_tope_fijos_centavos, p_diezmo_centavos, p_sueldo_centavos,
    p_fijos_centavos, p_remanente_centavos, p_diezmo_bp,
    p_sueldo_previo_centavos, p_fijos_previo_centavos
  )
$function$;
-- execute: authenticated:EXECUTE, service_role:EXECUTE
comment on function cerrar_perdido(uuid,integer,date,bigint,bigint,bigint,bigint,bigint,bigint,bigint,bigint,integer,bigint,bigint) is 'RPC de cierre como perdido de un lead o de una obra que se cayó. Liquida la seña retenida con la misma cascada que un cobro. Los mismos parámetros que cobrar_proyecto, más el diezmo que vio el usuario: en un perdido es un dato de los ajustes, no una regla.';

CREATE OR REPLACE FUNCTION public.cobrar_proyecto(p_proyecto_id uuid, p_version integer, p_fecha_cobro date, p_cobrado_centavos bigint, p_gastos_centavos bigint, p_tope_sueldo_centavos bigint, p_tope_fijos_centavos bigint, p_diezmo_centavos bigint, p_sueldo_centavos bigint, p_fijos_centavos bigint, p_remanente_centavos bigint, p_sueldo_previo_centavos bigint DEFAULT NULL::bigint, p_fijos_previo_centavos bigint DEFAULT NULL::bigint)
 RETURNS proyectos
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select *
  from private.liquidar(
    'cobrado', p_proyecto_id, p_version, p_fecha_cobro, p_cobrado_centavos, p_gastos_centavos,
    p_tope_sueldo_centavos, p_tope_fijos_centavos, p_diezmo_centavos, p_sueldo_centavos,
    p_fijos_centavos, p_remanente_centavos, null,
    p_sueldo_previo_centavos, p_fijos_previo_centavos
  )
$function$;
-- execute: authenticated:EXECUTE, service_role:EXECUTE
comment on function cobrar_proyecto(uuid,integer,date,bigint,bigint,bigint,bigint,bigint,bigint,bigint,bigint,bigint,bigint) is 'RPC de cobro de un proyecto entregado. La app manda la versión del proyecto, los totales, los topes, la fecha, la distribución que le mostró al usuario y el acumulado del mes que vio. Si ese acumulado no es el de la base, la liquidación se congela con el de la base y la app lo ve comparando dist_sueldo_previo_centavos contra lo que mandó.';

CREATE OR REPLACE FUNCTION public.dar_de_baja_suscripcion(p_endpoint text)
 RETURNS boolean
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select private.dar_de_baja_suscripcion(p_endpoint)
$function$;
-- execute: authenticated:EXECUTE, service_role:EXECUTE
comment on function dar_de_baja_suscripcion(text) is 'Apaga los avisos en este dispositivo.';

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
    'opciones_de_presupuesto', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.opciones_de_presupuesto t where t.updated_at >= v_desde
    ),
    'necesidades', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.necesidades t where t.updated_at >= v_desde
    ),
    'movimientos', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.movimientos t where t.updated_at >= v_desde
    ),
    'anotaciones', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.anotaciones t where t.updated_at >= v_desde
    ),
    'archivos', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.archivos t where t.updated_at >= v_desde
    ),
    'enlaces_publicos', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.enlaces_publicos t where t.updated_at >= v_desde
    )
  );
end;
$function$;
-- execute: authenticated:EXECUTE, service_role:EXECUTE
comment on function delta(timestamp with time zone) is 'Filas del household cambiadas desde el cursor, incluidas las borradas (deleted_at no null), más el cursor siguiente. Aplica un solape de cinco minutos.';

CREATE OR REPLACE FUNCTION public.estado_de_mis_avisos(p_endpoint text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select private.estado_de_mis_avisos(p_endpoint)
$function$;
-- execute: authenticated:EXECUTE, service_role:EXECUTE
comment on function estado_de_mis_avisos(text) is 'Si este dispositivo recibe avisos y las preferencias de la persona. preferencias es null hasta que activa los avisos por primera vez.';

CREATE OR REPLACE FUNCTION public.guardar_preferencias_de_avisos(p_zona text, p_hora time without time zone, p_avisos jsonb)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select private.guardar_preferencias_de_avisos(p_zona, p_hora, p_avisos)
$function$;
-- execute: authenticated:EXECUTE, service_role:EXECUTE
comment on function guardar_preferencias_de_avisos(text,time without time zone,jsonb) is 'Cambia la zona horaria, la hora y qué avisa.';

CREATE OR REPLACE FUNCTION public.guardar_proyecto(p_proyecto jsonb, p_pagos jsonb, p_gastos jsonb, p_opciones jsonb DEFAULT NULL::jsonb, p_necesidades jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_p record;
  v_actual public.proyectos;
  v_fila public.proyectos;
  v_existia boolean;
  v_sin_cambios boolean;
  v_vencimiento date;
  v_visita_hecha boolean;
  v_sena_bp integer;
  v_entrega_hora time;
  v_visita_hora time;
  v_household_id uuid;
  v_cuantas integer;
  v_aprobadas integer;
  v_monto_aprobado bigint;
  v_presupuesto bigint;
begin
  if p_proyecto is null or jsonb_typeof(p_proyecto) <> 'object' then
    raise exception 'El proyecto va en un objeto jsonb' using errcode = '22023';
  end if;

  if jsonb_typeof(coalesce(p_pagos, 'null'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_gastos, 'null'::jsonb)) <> 'array'
  then
    raise exception 'Los pagos y los gastos van en arrays jsonb' using errcode = '22023';
  end if;

  if p_opciones is not null and jsonb_typeof(p_opciones) <> 'array' then
    raise exception 'Las opciones de presupuesto van en un array jsonb' using errcode = '22023';
  end if;

  if p_necesidades is not null and jsonb_typeof(p_necesidades) <> 'array' then
    raise exception 'Los herrajes y las herramientas van en un array jsonb' using errcode = '22023';
  end if;

  -- Las horas se leen como texto por la misma razón que las fechas: un <input type="time"> vacío
  -- manda "" y un cast directo cortaría la llamada entera con 22007, un rechazo definitivo sin
  -- mensaje que tapa la cola (ADR 0015).
  select * into v_p from jsonb_to_record(p_proyecto) as x (
    id uuid,
    version integer,
    cliente_id uuid,
    titulo text,
    descripcion text,
    estado public.estado_proyecto,
    presupuesto_centavos bigint,
    forma_pago public.forma_pago,
    comprobante public.comprobante,
    fecha_visita date,
    ultimo_contacto date,
    fecha_inicio date,
    entrega_estimada date,
    fecha_entrega date,
    direccion_entrega text,
    notas text,
    vencimiento_presupuesto text,
    visita_hecha boolean,
    sena_bp integer,
    entrega_hora text,
    visita_hora text
  );

  if v_p.id is null or v_p.cliente_id is null or v_p.titulo is null or v_p.estado is null then
    raise exception 'El proyecto necesita id, cliente, título y estado' using errcode = '22004';
  end if;

  -- Una fila hija sin id o sin monto rebotaría contra un not null con un 23502 genérico, que no es
  -- un mensaje para el usuario y que tapa la cola igual que cualquier otro rechazo definitivo.
  if exists (
    select 1
    from jsonb_to_recordset(p_pagos) as r (id uuid, fecha text, monto_centavos bigint, borrado boolean)
    where r.id is null
       or (not coalesce(r.borrado, false) and (nullif(r.fecha, '') is null or r.monto_centavos is null))
  ) then
    raise exception 'Cada pago necesita id, fecha y monto' using errcode = '22004';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_gastos) as r (id uuid, fecha text, monto_centavos bigint, borrado boolean)
    where r.id is null
       or (not coalesce(r.borrado, false) and (nullif(r.fecha, '') is null or r.monto_centavos is null))
  ) then
    raise exception 'Cada gasto necesita id, fecha y monto' using errcode = '22004';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_opciones, '[]'::jsonb))
      as r (id uuid, monto_centavos bigint, borrado boolean)
    where r.id is null
       or (not coalesce(r.borrado, false) and r.monto_centavos is null)
  ) then
    raise exception 'Cada opción de presupuesto necesita id y monto' using errcode = '22004';
  end if;

  -- El tipo se lee como texto y se valida contra sus dos valores: castearlo de una cortaría con un
  -- 22P02 crudo, que es definitivo y no tiene traducción.
  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_necesidades, '[]'::jsonb))
      as r (id uuid, tipo text, nombre text, borrado boolean)
    where r.id is null
       or (
         not coalesce(r.borrado, false)
         and (
           coalesce(r.tipo, '') not in ('herraje', 'herramienta')
           or btrim(coalesce(r.nombre, '')) = ''
         )
       )
  ) then
    raise exception 'Cada herraje o herramienta necesita id, tipo y nombre' using errcode = '22004';
  end if;

  -- Primer lock: el proyecto, con for update, la misma disciplina que private.liquidar. La guarda
  -- de pagos y gastos toma for share sobre esta misma fila, así que un cobro que llega en el mismo
  -- instante se serializa con este guardado: o la liquidación espera y suma los pagos nuevos, o
  -- este guardado espera y ve el proyecto ya liquidado, y entonces la guarda lo rechaza con MN001.
  select * into v_actual from public.proyectos p where p.id = v_p.id for update;
  v_existia := found;

  v_vencimiento := case
    when p_proyecto ? 'vencimiento_presupuesto' then nullif(v_p.vencimiento_presupuesto, '')::date
    else v_actual.vencimiento_presupuesto
  end;

  v_visita_hecha := case
    when p_proyecto ? 'visita_hecha' then coalesce(v_p.visita_hecha, false)
    else coalesce(v_actual.visita_hecha, false)
  end;

  -- Como el vencimiento: un bundle viejo que no manda la clave no borra la seña propia del trabajo.
  v_sena_bp := case
    when p_proyecto ? 'sena_bp' then v_p.sena_bp
    else v_actual.sena_bp
  end;

  v_entrega_hora := case
    when p_proyecto ? 'entrega_hora' then nullif(v_p.entrega_hora, '')::time
    else v_actual.entrega_hora
  end;

  v_visita_hora := case
    when p_proyecto ? 'visita_hora' then nullif(v_p.visita_hora, '')::time
    else v_actual.visita_hora
  end;

  v_household_id := coalesce(v_actual.household_id, private.household_actual());

  -- El presupuesto que va a quedar, calculado ANTES de escribir el proyecto y sobre el conjunto de
  -- opciones que va a quedar: las que ya están, más las que vienen, menos las que vienen marcadas de
  -- baja. Si se escribiera después habría que corregir el proyecto con un update más, y ese update
  -- subiría la version una segunda vez: el cliente mandaría la versión vieja en el guardado siguiente
  -- y rebotaría con MN006.
  with entrantes as (
    select r.id, r.monto_centavos, coalesce(r.aprobada, false) as aprobada,
           coalesce(r.borrado, false) as borrado
    from jsonb_to_recordset(coalesce(p_opciones, '[]'::jsonb))
      as r (id uuid, monto_centavos bigint, aprobada boolean, borrado boolean)
  ),
  existentes as (
    select o.id, o.monto_centavos, o.aprobada
    from public.opciones_de_presupuesto o
    where o.household_id = v_household_id
      and o.proyecto_id = v_p.id
      and o.deleted_at is null
  ),
  quedan as (
    select coalesce(e.monto_centavos, x.monto_centavos) as monto_centavos,
           coalesce(e.aprobada, x.aprobada) as aprobada
    from existentes x
    full outer join entrantes e on e.id = x.id
    where not coalesce(e.borrado, false)
  )
  select count(*)::integer,
         count(*) filter (where aprobada)::integer,
         min(monto_centavos) filter (where aprobada)
  into v_cuantas, v_aprobadas, v_monto_aprobado
  from quedan;

  if v_aprobadas > 1 then
    raise exception 'Solo se puede tildar una opción del presupuesto'
      using errcode = 'MN009',
            hint = 'Destildá la que no va y dejá tildada la que te aprobaron.';
  end if;

  -- Con opciones, el presupuesto no se elige: sale de la aprobada, y no hay ninguna mientras el
  -- cliente no eligió. Sin opciones, es el campo que manda el usuario, como siempre.
  v_presupuesto := case
    when v_cuantas > 0 then (case when v_aprobadas > 0 then v_monto_aprobado else null end)
    else v_p.presupuesto_centavos
  end;

  if v_existia then
    if v_actual.deleted_at is not null then
      raise exception 'El proyecto está borrado' using errcode = 'MN002';
    end if;

    v_sin_cambios := (
      v_actual.cliente_id, v_actual.titulo, v_actual.descripcion, v_actual.estado,
      v_actual.presupuesto_centavos, v_actual.forma_pago, v_actual.comprobante,
      v_actual.fecha_visita, v_actual.ultimo_contacto, v_actual.fecha_inicio,
      v_actual.entrega_estimada, v_actual.fecha_entrega, v_actual.direccion_entrega, v_actual.notas,
      v_actual.vencimiento_presupuesto, v_actual.visita_hecha, v_actual.sena_bp,
      v_actual.entrega_hora, v_actual.visita_hora
    ) is not distinct from (
      v_p.cliente_id, v_p.titulo, coalesce(v_p.descripcion, ''), v_p.estado,
      v_presupuesto, v_p.forma_pago, v_p.comprobante,
      v_p.fecha_visita, v_p.ultimo_contacto, v_p.fecha_inicio,
      v_p.entrega_estimada, v_p.fecha_entrega, coalesce(v_p.direccion_entrega, ''),
      coalesce(v_p.notas, ''), v_vencimiento, v_visita_hecha, v_sena_bp,
      v_entrega_hora, v_visita_hora
    );

    -- Un guardado hecho sin señal sobre una versión vieja no pisa en silencio lo que hay. La
    -- excepción es el reenvío de la cola: este mismo guardado ya se aplicó (la versión subió
    -- exactamente uno y la fila quedó igual a lo que se manda) y la respuesta se perdió. Reaplicar
    -- entonces no hace nada, porque el update de abajo y las bajas ya son no-op.
    if v_p.version is not null
      and v_actual.version <> v_p.version
      and not (v_sin_cambios and v_actual.version = v_p.version + 1)
    then
      raise exception 'El proyecto cambió desde que lo abriste'
        using errcode = 'MN006',
              detail = format('versión vista %s, versión actual %s', v_p.version, v_actual.version),
              hint = 'Abrilo de nuevo para ver lo que hay ahora y volvé a cargar lo que te falte.';
    end if;
  end if;

  -- Alta y edición se escriben por separado, no con un upsert. En un `insert ... on conflict do
  -- update`, Postgres evalúa los check de la tabla sobre la fila propuesta antes de resolver el
  -- conflicto: guardar las notas de un proyecto cobrado proponía una fila con estado cobrado y la
  -- distribución en null, y eso choca contra proyectos_liquidado_con_distribucion. El reenvío del
  -- alta cae igual en la rama de edición, porque el select de arriba ya encontró la fila.
  --
  -- La edición manda la fila entera y no solo las columnas que cambiaron, al revés que el resto de
  -- las mutaciones (ADR 0010): acá el chequeo de versión es la garantía más fuerte, porque si el
  -- servidor cambió algo el guardado se rechaza en vez de pisarlo en silencio. Los cuatro costos
  -- estimados quedan afuera a propósito: van por su propio update, como las marcas de la agenda.
  if v_existia then
    update public.proyectos set
      cliente_id = v_p.cliente_id,
      titulo = v_p.titulo,
      descripcion = coalesce(v_p.descripcion, ''),
      estado = v_p.estado,
      presupuesto_centavos = v_presupuesto,
      forma_pago = v_p.forma_pago,
      comprobante = v_p.comprobante,
      fecha_visita = v_p.fecha_visita,
      ultimo_contacto = v_p.ultimo_contacto,
      fecha_inicio = v_p.fecha_inicio,
      entrega_estimada = v_p.entrega_estimada,
      fecha_entrega = v_p.fecha_entrega,
      direccion_entrega = coalesce(v_p.direccion_entrega, ''),
      notas = coalesce(v_p.notas, ''),
      vencimiento_presupuesto = v_vencimiento,
      visita_hecha = v_visita_hecha,
      sena_bp = v_sena_bp,
      entrega_hora = v_entrega_hora,
      visita_hora = v_visita_hora
    where id = v_p.id
    returning * into v_fila;
  else
    begin
      insert into public.proyectos (
        id, cliente_id, titulo, descripcion, estado, presupuesto_centavos, forma_pago, comprobante,
        fecha_visita, ultimo_contacto, fecha_inicio, entrega_estimada, fecha_entrega,
        direccion_entrega, notas, vencimiento_presupuesto, visita_hecha, sena_bp,
        entrega_hora, visita_hora
      ) values (
        v_p.id, v_p.cliente_id, v_p.titulo, coalesce(v_p.descripcion, ''), v_p.estado,
        v_presupuesto, v_p.forma_pago, v_p.comprobante,
        v_p.fecha_visita, v_p.ultimo_contacto, v_p.fecha_inicio, v_p.entrega_estimada,
        v_p.fecha_entrega, coalesce(v_p.direccion_entrega, ''), coalesce(v_p.notas, ''),
        v_vencimiento, v_visita_hecha, v_sena_bp, v_entrega_hora, v_visita_hora
      )
      returning * into v_fila;
    exception
      -- El id existe pero el select de arriba no lo vio: es de otro household. Se responde lo mismo
      -- que si no existiera, que es lo que la RLS ya dice, en vez de filtrar que está. Un duplicate
      -- key crudo sería además un rechazo definitivo sin mensaje, y la cola drena de a una.
      when unique_violation then
        raise exception 'El proyecto no existe o no es tuyo' using errcode = '42501';
    end;
  end if;

  -- Los hijos van después del proyecto: la foreign key compuesta exige que el padre exista.
  insert into public.pagos (id, proyecto_id, fecha, concepto, monto_centavos)
  select r.id, v_fila.id, r.fecha::date, coalesce(r.concepto, ''), r.monto_centavos
  from jsonb_to_recordset(p_pagos) as r (
    id uuid, fecha text, concepto text, monto_centavos bigint, borrado boolean
  )
  where not coalesce(r.borrado, false)
  on conflict (id) do update set
    proyecto_id = excluded.proyecto_id,
    fecha = excluded.fecha,
    concepto = excluded.concepto,
    monto_centavos = excluded.monto_centavos;

  insert into public.gastos (id, proyecto_id, fecha, descripcion, monto_centavos)
  select r.id, v_fila.id, r.fecha::date, coalesce(r.descripcion, ''), r.monto_centavos
  from jsonb_to_recordset(p_gastos) as r (
    id uuid, fecha text, descripcion text, monto_centavos bigint, borrado boolean
  )
  where not coalesce(r.borrado, false)
  on conflict (id) do update set
    proyecto_id = excluded.proyecto_id,
    fecha = excluded.fecha,
    descripcion = excluded.descripcion,
    monto_centavos = excluded.monto_centavos;

  -- Las opciones solo se tocan si el pedido las trae: p_opciones en null es un bundle viejo, que no
  -- las conoce y no tiene por qué borrarlas.
  if p_opciones is not null then
    -- Apagar antes de escribir. El índice único parcial de la aprobada se evalúa fila por fila, y el
    -- orden dentro del upsert no está definido: sin este paso, mover la aprobación de una opción a
    -- otra dejaba dos prendidas a la vez y cortaba con 23505.
    update public.opciones_de_presupuesto
    set aprobada = false
    where household_id = v_fila.household_id
      and proyecto_id = v_fila.id
      and aprobada
      and deleted_at is null;

    insert into public.opciones_de_presupuesto (id, proyecto_id, descripcion, monto_centavos, aprobada)
    select r.id, v_fila.id, coalesce(r.descripcion, ''), r.monto_centavos, coalesce(r.aprobada, false)
    from jsonb_to_recordset(p_opciones) as r (
      id uuid, descripcion text, monto_centavos bigint, aprobada boolean, borrado boolean
    )
    where not coalesce(r.borrado, false)
    on conflict (id) do update set
      proyecto_id = excluded.proyecto_id,
      descripcion = excluded.descripcion,
      monto_centavos = excluded.monto_centavos,
      aprobada = excluded.aprobada;
  end if;

  -- Lo mismo con lo que hace falta: sin la clave no se toca. No hay índice único parcial acá, así que
  -- el upsert va de una y el orden entre filas no importa.
  if p_necesidades is not null then
    insert into public.necesidades (id, proyecto_id, tipo, nombre, cantidad, listo)
    select r.id, v_fila.id, r.tipo::public.tipo_de_necesidad, btrim(r.nombre), r.cantidad,
           coalesce(r.listo, false)
    from jsonb_to_recordset(p_necesidades) as r (
      id uuid, tipo text, nombre text, cantidad integer, listo boolean, borrado boolean
    )
    where not coalesce(r.borrado, false)
    on conflict (id) do update set
      proyecto_id = excluded.proyecto_id,
      tipo = excluded.tipo,
      nombre = excluded.nombre,
      cantidad = excluded.cantidad,
      listo = excluded.listo;
  end if;

  -- La baja de una fila hija es la que el cliente vio y sacó del formulario, marcada en el mismo
  -- array. Nunca es "todo lo que no vino en el pedido": la version del proyecto no se mueve cuando
  -- solo cambian sus hijos, así que un guardado viejo borraría en silencio un pago cargado desde
  -- otro lado. El filtro por deleted_at deja el reenvío en no-op y conserva la primera marca.
  update public.pagos g
  set deleted_at = now()
  from jsonb_to_recordset(p_pagos) as r (id uuid, borrado boolean)
  where g.id = r.id
    and coalesce(r.borrado, false)
    and g.proyecto_id = v_fila.id
    and g.deleted_at is null;

  update public.gastos g
  set deleted_at = now()
  from jsonb_to_recordset(p_gastos) as r (id uuid, borrado boolean)
  where g.id = r.id
    and coalesce(r.borrado, false)
    and g.proyecto_id = v_fila.id
    and g.deleted_at is null;

  update public.opciones_de_presupuesto o
  set deleted_at = now()
  from jsonb_to_recordset(coalesce(p_opciones, '[]'::jsonb)) as r (id uuid, borrado boolean)
  where o.id = r.id
    and coalesce(r.borrado, false)
    and o.proyecto_id = v_fila.id
    and o.deleted_at is null;

  update public.necesidades n
  set deleted_at = now()
  from jsonb_to_recordset(coalesce(p_necesidades, '[]'::jsonb)) as r (id uuid, borrado boolean)
  where n.id = r.id
    and coalesce(r.borrado, false)
    and n.proyecto_id = v_fila.id
    and n.deleted_at is null;

  -- Vuelve el agregado entero: las filas vivas más las que este guardado dio de baja, para que el
  -- cliente las saque de su réplica sin esperar al próximo delta.
  return jsonb_build_object(
    'proyecto', to_jsonb(v_fila),
    'pagos', (
      select coalesce(jsonb_agg(to_jsonb(g)), '[]'::jsonb)
      from public.pagos g
      where g.household_id = v_fila.household_id
        and g.proyecto_id = v_fila.id
        and (
          g.deleted_at is null
          or g.id in (select (r ->> 'id')::uuid from jsonb_array_elements(p_pagos) as r)
        )
    ),
    'gastos', (
      select coalesce(jsonb_agg(to_jsonb(g)), '[]'::jsonb)
      from public.gastos g
      where g.household_id = v_fila.household_id
        and g.proyecto_id = v_fila.id
        and (
          g.deleted_at is null
          or g.id in (select (r ->> 'id')::uuid from jsonb_array_elements(p_gastos) as r)
        )
    ),
    'opciones_de_presupuesto', (
      select coalesce(jsonb_agg(to_jsonb(o)), '[]'::jsonb)
      from public.opciones_de_presupuesto o
      where o.household_id = v_fila.household_id
        and o.proyecto_id = v_fila.id
        and (
          o.deleted_at is null
          or o.id in (
            select (r ->> 'id')::uuid from jsonb_array_elements(coalesce(p_opciones, '[]'::jsonb)) as r
          )
        )
    ),
    'necesidades', (
      select coalesce(jsonb_agg(to_jsonb(n)), '[]'::jsonb)
      from public.necesidades n
      where n.household_id = v_fila.household_id
        and n.proyecto_id = v_fila.id
        and (
          n.deleted_at is null
          or n.id in (
            select (r ->> 'id')::uuid from jsonb_array_elements(coalesce(p_necesidades, '[]'::jsonb)) as r
          )
        )
    )
  );
end;
$function$;
-- execute: authenticated:EXECUTE, service_role:EXECUTE
comment on function guardar_proyecto(jsonb,jsonb,jsonb,jsonb,jsonb) is 'Guarda un proyecto con sus pagos, sus gastos, sus opciones de presupuesto y lo que hace falta para el trabajo en una sola transacción, idempotente por el id del proyecto. El alta es un upsert; la edición manda la version que vio el cliente y se rechaza con MN006 si la fila cambió. Las bajas de las filas hijas vienen marcadas con borrado en su propio array. Con opciones vivas, el presupuesto del proyecto sale de la opción aprobada y no de lo que manda el cliente. p_opciones y p_necesidades en null quieren decir "no toques eso", para que un bundle viejo no lo borre. Los cuatro costos estimados no los escribe esta función: van por un update de sus columnas solas.';

CREATE OR REPLACE FUNCTION private.anotar_aviso(p_suscripcion uuid, p_dia date, p_mandado boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  update private.suscripciones_de_avisos
  set ultimo_dia_avisado = greatest(coalesce(ultimo_dia_avisado, p_dia), p_dia),
      ultimo_envio = case when p_mandado then now() else ultimo_envio end
  where id = p_suscripcion;
  return found;
end;
$function$;
-- execute: service_role:EXECUTE
comment on function private.anotar_aviso(uuid,date,boolean) is 'Anota que el día ya se miró para ese dispositivo, y si además salió un aviso, cuándo. Un día sin nada que avisar también se anota: si no, se volvería a mirar en cada vuelta del trabajo.';

CREATE OR REPLACE FUNCTION private.anotar_el_cambio_de_estado()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if tg_op = 'UPDATE' and new.estado is not distinct from old.estado then
    return null;
  end if;

  insert into public.cambios_de_estado (household_id, proyecto_id, desde, hacia, ocurrio_el)
  values (
    new.household_id,
    new.id,
    case when tg_op = 'UPDATE' then old.estado end,
    new.estado,
    (now() at time zone 'America/Argentina/Buenos_Aires')::date
  );

  return null;
end;
$function$;
-- execute: solo el dueño
comment on function private.anotar_el_cambio_de_estado() is 'Anota en public.cambios_de_estado cada vez que un trabajo cambia de etapa, venga de donde venga (el agregado, el cobro, la reapertura). Es security definer porque la app no tiene grant de insert sobre esa tabla: la historia no la escribe el cliente.';

CREATE OR REPLACE FUNCTION private.avisos_bien_formados(p_avisos jsonb)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select coalesce(
    jsonb_typeof(p_avisos) = 'object'
    and (select array_agg(clave order by clave) from jsonb_object_keys(p_avisos) as clave)
      = array['anotaciones', 'entregas', 'presupuestos', 'visitas']
    and (
      select bool_and(
        case
          when jsonb_typeof(valor) <> 'object' then false
          else jsonb_typeof(valor -> 'activo') = 'boolean'
            and coalesce(valor ->> 'anticipacion', '') in ('0', '1', '2', '3')
            and valor - 'activo' - 'anticipacion' = '{}'::jsonb
        end
      )
      from jsonb_each(p_avisos) as e (clave, valor)
    ),
    false
  )
$function$;
-- execute: solo el dueño
comment on function private.avisos_bien_formados(jsonb) is 'Qué avisa y con cuánta anticipación: las cuatro claves de AVISOS_DE_LA_AGENDA de @maun/domain, cada una con activo y una anticipación de 0 a 3 días.';

CREATE OR REPLACE FUNCTION private.avisos_por_mandar(p_ahora timestamp with time zone)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with locales as (
    select
      s.id,
      s.user_id,
      s.endpoint,
      s.p256dh,
      s.auth,
      s.ultimo_dia_avisado,
      p.avisos,
      p.hora,
      (p_ahora at time zone p.zona) as ahora_local
    from private.suscripciones_de_avisos s
    join private.preferencias_de_avisos p on p.user_id = s.user_id
  ),
  debidas as (
    select
      l.*,
      l.ahora_local::date as dia,
      (
        select m.household_id
        from public.household_members m
        where m.user_id = l.user_id and m.deleted_at is null
        order by m.created_at
        limit 1
      ) as household_id
    from locales l
    -- La hora local de cada persona, calculada acá con su zona: desde la hora que eligió y durante
    -- tres horas, una vez por día local.
    where l.ahora_local >= l.ahora_local::date + l.hora
      and l.ahora_local < l.ahora_local::date + l.hora + interval '3 hours'
      and (l.ultimo_dia_avisado is null or l.ultimo_dia_avisado < l.ahora_local::date)
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', d.id,
        'endpoint', d.endpoint,
        'p256dh', d.p256dh,
        'auth', d.auth,
        'dia', d.dia,
        'preferencias', d.avisos,
        'filas', jsonb_build_object(
          'proyectos', (
            select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb)
            from public.proyectos p
            where p.household_id = d.household_id
              and p.deleted_at is null
              and p.estado in (
                'contacto', 'presupuesto_estimativo', 'relevamiento', 'a_presupuestar', 'presupuesto_enviado',
                'en_curso'
              )
          ),
          'clientes', (
            select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'nombre', c.nombre, 'zona', c.zona)), '[]'::jsonb)
            from public.clientes c
            where c.household_id = d.household_id and c.deleted_at is null
          ),
          'anotaciones', (
            select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb)
            from public.anotaciones a
            where a.household_id = d.household_id
              and a.deleted_at is null
              and not a.hecha
              and a.fecha between d.dia and d.dia + 3
          )
        )
      )
      order by d.id
    ),
    '[]'::jsonb
  )
  from debidas d
  where d.household_id is not null
$function$;
-- execute: service_role:EXECUTE
comment on function private.avisos_por_mandar(timestamp with time zone) is 'Los dispositivos a los que les toca el aviso de la mañana en este momento, según la zona horaria y la hora de cada persona, con los datos de su taller que necesita la agenda. Qué avisar lo decide eventosParaAvisar de @maun/domain en la función de borde, no esta consulta.';

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

  update public.archivos
  set deleted_at = new.deleted_at
  where household_id = new.household_id
    and proyecto_id = new.id
    and deleted_at is null;

  update public.opciones_de_presupuesto
  set deleted_at = new.deleted_at
  where household_id = new.household_id
    and proyecto_id = new.id
    and deleted_at is null;

  update public.necesidades
  set deleted_at = new.deleted_at
  where household_id = new.household_id
    and proyecto_id = new.id
    and deleted_at is null;

  -- Lo que agrega esta migración: un trabajo borrado no puede seguir abriéndose desde afuera.
  update public.enlaces_publicos
  set deleted_at = new.deleted_at
  where household_id = new.household_id
    and proyecto_id = new.id
    and deleted_at is null;

  return null;
end;
$function$;
-- execute: solo el dueño

CREATE OR REPLACE FUNCTION private.borrar_suscripcion_vencida(p_endpoint text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  delete from private.suscripciones_de_avisos where endpoint = p_endpoint;
  return found;
end;
$function$;
-- execute: service_role:EXECUTE
comment on function private.borrar_suscripcion_vencida(text) is 'El servicio de push contestó 404 o 410: esa suscripción ya no existe. Sin borrarla la tabla crece para siempre y cada envío hace trabajo muerto.';

CREATE OR REPLACE FUNCTION private.cascada(p_cobrado_centavos bigint, p_gastos_centavos bigint, p_diezmo_bp integer, p_tope_sueldo_centavos bigint, p_tope_fijos_centavos bigint, OUT neta_centavos bigint, OUT diezmo_centavos bigint, OUT sueldo_centavos bigint, OUT fijos_centavos bigint, OUT remanente_centavos bigint)
 RETURNS record
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare
  -- Number.MAX_SAFE_INTEGER: el mayor entero que Money representa exacto. Fuera de ese rango la
  -- cascada de TypeScript corta, así que esta también.
  c_maximo constant bigint := 9007199254740991;
  v_resto bigint;
begin
  if num_nulls(p_cobrado_centavos, p_gastos_centavos, p_diezmo_bp, p_tope_sueldo_centavos, p_tope_fijos_centavos) > 0 then
    raise exception 'La cascada necesita todos sus parámetros' using errcode = '22004';
  end if;

  if p_cobrado_centavos < 0 or p_gastos_centavos < 0 or p_tope_sueldo_centavos < 0 or p_tope_fijos_centavos < 0 then
    raise exception 'La cascada no acepta importes negativos' using errcode = '22023';
  end if;

  if p_diezmo_bp not between 0 and 10000 then
    raise exception 'El diezmo va en puntos básicos entre 0 y 10000' using errcode = '22023';
  end if;

  if greatest(p_cobrado_centavos, p_gastos_centavos, p_tope_sueldo_centavos, p_tope_fijos_centavos) > c_maximo then
    raise exception 'Importe fuera del rango exacto de Money' using errcode = '22003';
  end if;

  neta_centavos := p_cobrado_centavos - p_gastos_centavos;

  -- Sin ganancia no hay nada que repartir: la pérdida entera queda en el remanente, así los
  -- escalones siempre suman la neta (proyectos_distribucion_cuadra).
  if neta_centavos <= 0 then
    diezmo_centavos := 0;
    sueldo_centavos := 0;
    fijos_centavos := 0;
    remanente_centavos := neta_centavos;
    return;
  end if;

  if neta_centavos * p_diezmo_bp + 5000 > c_maximo then
    raise exception 'Importe fuera del rango exacto de Money' using errcode = '22003';
  end if;

  -- Mitad hacia arriba al centavo, en aritmética entera: la misma cuenta que aplicarPorcentaje.
  diezmo_centavos := (neta_centavos * p_diezmo_bp + 5000) / 10000;
  v_resto := neta_centavos - diezmo_centavos;
  sueldo_centavos := least(p_tope_sueldo_centavos, v_resto);
  v_resto := v_resto - sueldo_centavos;
  fijos_centavos := least(p_tope_fijos_centavos, v_resto);
  remanente_centavos := v_resto - fijos_centavos;
end;
$function$;
-- execute: solo el dueño
comment on function private.cascada(bigint,bigint,integer,bigint,bigint) is 'La cascada: neta = cobrado - gastos; diezmo (mitad hacia arriba); sueldo y fijos topeados por lo que queda; remanente. Gemela de calcularDistribucion de @maun/domain, con el mismo rango de importes.';

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

CREATE OR REPLACE FUNCTION private.crear_taller_del_usuario()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  -- Idempotente, y por eso los dos triggers comparten la función: si la cuenta ya tuvo taller
  -- alguna vez, no se crea otro. Cuenta también la membresía revocada: crear uno nuevo dejaría el
  -- anterior con datos y sin ningún miembro vivo, invisible por RLS.
  if exists (select 1 from public.household_members m where m.user_id = new.id) then
    return null;
  end if;

  -- El nombre es una constante y no un dato del registro: lo que viene de afuera puede violar
  -- households_nombre_valido, y un rechazo acá no rompe un alta sino todas. El taller se renombra
  -- desde la app, en la primera configuración.
  perform private.crear_household('Mi taller', new.id);
  return null;
end;
$function$;
-- execute: solo el dueño
comment on function private.crear_taller_del_usuario() is 'Trigger de auth.users: a la cuenta que confirma su mail le crea el taller, la membresía de titular y los ajustes en cero. Idempotente: si ya tuvo taller, no hace nada.';

CREATE OR REPLACE FUNCTION private.dar_de_baja_suscripcion(p_endpoint text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  delete from private.suscripciones_de_avisos
  where endpoint = p_endpoint
    and user_id = (select auth.uid());
  return found;
end;
$function$;
-- execute: authenticated:EXECUTE
comment on function private.dar_de_baja_suscripcion(text) is 'Borra este dispositivo si es del usuario de la sesión. Un endpoint de otra cuenta no se toca.';

CREATE OR REPLACE FUNCTION private.es_reenvio(p_old jsonb, p_new jsonb)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select (p_old - array['created_at', 'updated_at', 'version']) = (p_new - array['created_at', 'updated_at', 'version'])
$function$;
-- execute: authenticated:EXECUTE

CREATE OR REPLACE FUNCTION private.estado_de_los_avisos(p_usuario uuid, p_endpoint text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select jsonb_build_object(
    'suscripto', exists (
      select 1 from private.suscripciones_de_avisos s
      where s.user_id = p_usuario and s.endpoint = p_endpoint
    ),
    'ultimo_envio', (
      select s.ultimo_envio from private.suscripciones_de_avisos s
      where s.user_id = p_usuario and s.endpoint = p_endpoint
    ),
    'dispositivos', (
      select count(*) from private.suscripciones_de_avisos s where s.user_id = p_usuario
    ),
    'preferencias', (
      select jsonb_build_object('zona', p.zona, 'hora', to_char(p.hora, 'HH24:MI'), 'avisos', p.avisos)
      from private.preferencias_de_avisos p
      where p.user_id = p_usuario
    )
  )
$function$;
-- execute: solo el dueño
comment on function private.estado_de_los_avisos(uuid,text) is 'Si este dispositivo recibe avisos, cuándo salió el último, cuántos dispositivos tiene la persona y sus preferencias. Solo la llaman las funciones de avisos.';

CREATE OR REPLACE FUNCTION private.estado_de_mis_avisos(p_endpoint text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select private.estado_de_los_avisos((select auth.uid()), p_endpoint)
$function$;
-- execute: authenticated:EXECUTE

CREATE OR REPLACE FUNCTION private.formas_de_cobro(p_guardado forma_de_cobro[], p_hay_como_transferir boolean)
 RETURNS forma_de_cobro[]
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select coalesce(
    p_guardado,
    case
      when p_hay_como_transferir then array['transferencia', 'efectivo']::public.forma_de_cobro[]
      else array['efectivo']::public.forma_de_cobro[]
    end
  );
$function$;
-- execute: authenticated:EXECUTE
comment on function private.formas_de_cobro(forma_de_cobro[],boolean) is 'Las formas que valen para una instancia de pago: lo que el dueño guardó, o el valor por defecto. Por defecto son las dos, salvo que el taller no tenga ni alias ni CBU cargados en Ajustes, y entonces solo efectivo: ofrecer transferencia sin adónde transferir sería mandarle al cliente una pantalla vacía. Tiene gemela en TypeScript (formasDeCobro, en @maun/domain), que es la que usa la pantalla del dueño; las dos se comparan en scripts/comparacion.ts (ADR 0053).';

CREATE OR REPLACE FUNCTION private.guardar_preferencias_de_avisos(p_zona text, p_hora time without time zone, p_avisos jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_usuario uuid := (select auth.uid());
begin
  if v_usuario is null then
    raise exception 'Hace falta una sesión para cambiar los avisos' using errcode = '42501';
  end if;
  perform private.validar_zona(p_zona);
  if p_hora is null or not private.avisos_bien_formados(p_avisos) then
    raise exception 'Las preferencias de avisos no tienen la forma esperada' using errcode = '22023';
  end if;

  insert into private.preferencias_de_avisos (user_id, zona, hora, avisos)
  values (v_usuario, p_zona, p_hora, p_avisos)
  on conflict (user_id) do update set
    zona = excluded.zona,
    hora = excluded.hora,
    avisos = excluded.avisos,
    actualizada_en = now();

  return private.estado_de_los_avisos(v_usuario, null);
end;
$function$;
-- execute: authenticated:EXECUTE
comment on function private.guardar_preferencias_de_avisos(text,time without time zone,jsonb) is 'Guarda la zona horaria, la hora y qué avisa, para el usuario de la sesión.';

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

CREATE OR REPLACE FUNCTION private.liquidacion_valida(p_desde estado_proyecto, p_hacia estado_proyecto)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select coalesce(
    case p_hacia
      when 'cobrado' then p_desde = 'entregado'
      when 'perdido' then p_desde in (
        'contacto', 'presupuesto_estimativo', 'relevamiento', 'a_presupuestar', 'presupuesto_enviado', 'en_curso'
      )
      else false
    end,
    false
  )
$function$;
-- execute: authenticated:EXECUTE
comment on function private.liquidacion_valida(estado_proyecto,estado_proyecto) is 'Desde qué estado se liquida hacia cobrado o perdido. Gemela de puedeLiquidar de @maun/domain.';

CREATE OR REPLACE FUNCTION private.liquidar(p_destino estado_proyecto, p_proyecto_id uuid, p_version integer, p_fecha date, p_cobrado_centavos bigint, p_gastos_centavos bigint, p_tope_sueldo_centavos bigint, p_tope_fijos_centavos bigint, p_diezmo_centavos bigint, p_sueldo_centavos bigint, p_fijos_centavos bigint, p_remanente_centavos bigint, p_diezmo_bp integer, p_sueldo_previo_centavos bigint DEFAULT NULL::bigint, p_fijos_previo_centavos bigint DEFAULT NULL::bigint)
 RETURNS proyectos
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  -- DIEZMO de @maun/domain.
  c_diezmo_bp constant integer := 1000;
  v_proyecto public.proyectos;
  v_ajustes public.ajustes;
  v_fecha date;
  v_inicio_mes date;
  v_diezmo_bp integer;
  v_objetivo_sueldo bigint;
  v_objetivo_fijos bigint;
  v_sueldo_mensual boolean;
  v_sueldo_previo bigint;
  v_fijos_previo bigint;
  v_topes record;
  v_topes_vistos record;
  v_ajustada boolean := false;
  v_cobrado bigint;
  v_gastos bigint;
  v_dist record;
  v_dist_vista record;
begin
  if num_nulls(
    p_destino, p_proyecto_id, p_version, p_fecha, p_cobrado_centavos, p_gastos_centavos,
    p_tope_sueldo_centavos, p_tope_fijos_centavos, p_diezmo_centavos, p_sueldo_centavos,
    p_fijos_centavos, p_remanente_centavos
  ) > 0 then
    raise exception 'La liquidación necesita todos sus parámetros' using errcode = '22004';
  end if;

  -- El acumulado del mes son dos números o ninguno: con uno solo no se puede saber si la app vio
  -- lo mismo que la base.
  if num_nulls(p_sueldo_previo_centavos, p_fijos_previo_centavos) = 1 then
    raise exception 'El acumulado del mes va entero o no va' using errcode = '22004';
  end if;

  if p_destino not in ('cobrado', 'perdido') then
    raise exception 'Solo se liquida hacia cobrado o perdido' using errcode = '22023';
  end if;

  -- El diezmo de un perdido es un dato (ajustes.perdido_con_diezmo), no una regla: la app manda el
  -- que vio, y si cambió es MN006. En un cobro es la regla (DIEZMO) y no se manda: si cambia, MN008.
  if p_destino = 'perdido' and p_diezmo_bp is null then
    raise exception 'El cierre de un perdido necesita el diezmo que vio el usuario' using errcode = '22004';
  end if;

  -- Primer lock: el proyecto. La guarda de pagos y gastos toma for share sobre esta misma fila, así
  -- que un pago que llega en el mismo instante espera a que la liquidación termine (y entonces lo
  -- ve liquidado), o la liquidación espera a que el pago termine (y entonces lo suma).
  select p.* into v_proyecto
  from public.proyectos p
  where p.id = p_proyecto_id
    and p.household_id = any (array(select private.user_household_ids()))
  for update;

  if not found then
    raise exception 'El proyecto no existe o no es tuyo' using errcode = '42501';
  end if;

  -- El reenvío de la cola: esta misma liquidación ya se aplicó (la versión subió exactamente uno) y
  -- la respuesta se perdió. Se devuelve la fila tal cual, sin rechazar algo que salió bien.
  if v_proyecto.estado = p_destino
    and v_proyecto.version = p_version + 1
    and (
      v_proyecto.fecha_cobro, v_proyecto.dist_cobrado_centavos, v_proyecto.dist_gastos_centavos,
      v_proyecto.dist_tope_sueldo_centavos, v_proyecto.dist_tope_fijos_centavos,
      v_proyecto.dist_diezmo_centavos, v_proyecto.dist_sueldo_centavos,
      v_proyecto.dist_fijos_centavos, v_proyecto.dist_remanente_centavos
    ) = (
      p_fecha, p_cobrado_centavos, p_gastos_centavos, p_tope_sueldo_centavos,
      p_tope_fijos_centavos, p_diezmo_centavos, p_sueldo_centavos, p_fijos_centavos,
      p_remanente_centavos
    )
    and (p_diezmo_bp is null or v_proyecto.dist_diezmo_bp = p_diezmo_bp)
  then
    return v_proyecto;
  end if;

  -- El reenvío de una liquidación que salió ajustada. Los topes y los cuatro escalones congelados no
  -- son los que mandó la app —ese es justamente el ajuste—, así que el reenvío se reconoce por las
  -- entradas que la app sí controla. La última condición es la guarda: esta rama solo vale cuando el
  -- acumulado que vio la app no es el que quedó congelado, que es la definición de ajustada. Sin
  -- esto, un cobro ajustado cuya respuesta se perdió rebotaría con MN001 al reintentarlo.
  if p_sueldo_previo_centavos is not null
    and v_proyecto.estado = p_destino
    and v_proyecto.version = p_version + 1
    and (
      v_proyecto.fecha_cobro, v_proyecto.dist_cobrado_centavos, v_proyecto.dist_gastos_centavos
    ) = (
      p_fecha, p_cobrado_centavos, p_gastos_centavos
    )
    and (p_diezmo_bp is null or v_proyecto.dist_diezmo_bp = p_diezmo_bp)
    and (v_proyecto.dist_sueldo_previo_centavos, v_proyecto.dist_fijos_previo_centavos)
      is distinct from (p_sueldo_previo_centavos, p_fijos_previo_centavos)
  then
    return v_proyecto;
  end if;

  if v_proyecto.deleted_at is not null then
    raise exception 'El proyecto está borrado' using errcode = 'MN002';
  end if;

  if v_proyecto.estado in ('cobrado', 'perdido') then
    raise exception 'El proyecto ya está %', v_proyecto.estado using errcode = 'MN001';
  end if;

  if not private.liquidacion_valida(v_proyecto.estado, p_destino) then
    raise exception '%', case p_destino
        when 'cobrado' then format('Solo se cobra un proyecto entregado, y este está en %s', v_proyecto.estado)
        else 'Lo entregado no se da por perdido: se cobra'
      end
      using errcode = 'MN007';
  end if;

  if v_proyecto.version <> p_version then
    raise exception 'El proyecto cambió desde que lo viste'
      using errcode = 'MN006',
            detail = format('versión vista %s, versión actual %s', p_version, v_proyecto.version);
  end if;

  -- Segundo lock: la fila de ajustes del household. Toda liquidación y toda reversión la toman, así
  -- que dos liquidaciones del mismo household se serializan y la segunda suma el mes después de
  -- que la primera commiteó. for no key update: choca con otra liquidación y con una edición de
  -- los ajustes, no con las foreign keys. Es por household, más grueso que por mes (ADR 0011).
  select a.* into v_ajustes
  from public.ajustes a
  where a.household_id = v_proyecto.household_id
  for no key update;

  if not found then
    raise exception 'El household no tiene ajustes' using errcode = 'P0002';
  end if;

  -- Con qué fecha, diezmo y objetivos se liquida. Gemela de planDeLiquidacion.
  if p_destino = 'perdido' then
    -- Un cierre como perdido es un evento nuevo: no usa la foto de una reapertura. El sueldo del
    -- perdido es un objetivo en cero cuando perdido_con_sueldo está apagado, no otra cascada.
    v_fecha := p_fecha;
    v_diezmo_bp := case when v_ajustes.perdido_con_diezmo then c_diezmo_bp else 0 end;
    v_objetivo_sueldo := case when v_ajustes.perdido_con_sueldo then v_ajustes.sueldo_mensual_centavos else 0 end;
    v_objetivo_fijos := v_ajustes.costos_fijos_centavos;
    v_sueldo_mensual := v_ajustes.sueldo_tope_mensual;
  elsif v_proyecto.reapertura_fecha_cobro is not null then
    -- Un cobro reabierto se vuelve a cobrar con la fecha y los objetivos del original.
    v_fecha := v_proyecto.reapertura_fecha_cobro;
    v_diezmo_bp := c_diezmo_bp;
    v_objetivo_sueldo := v_proyecto.reapertura_objetivo_sueldo_centavos;
    v_objetivo_fijos := v_proyecto.reapertura_objetivo_fijos_centavos;
    v_sueldo_mensual := v_proyecto.reapertura_sueldo_mensual;
  else
    v_fecha := p_fecha;
    v_diezmo_bp := c_diezmo_bp;
    v_objetivo_sueldo := v_ajustes.sueldo_mensual_centavos;
    v_objetivo_fijos := v_ajustes.costos_fijos_centavos;
    v_sueldo_mensual := v_ajustes.sueldo_tope_mensual;
  end if;

  -- Lo que el mes ya lleva liquidado por otros proyectos, en una sentencia posterior al lock de
  -- ajustes. Gemela de liquidadoDelMes. No se guarda en ningún lado: reabrir un proyecto lo saca
  -- de esta suma por el solo hecho de descongelarlo.
  v_inicio_mes := make_date(extract(year from v_fecha)::integer, extract(month from v_fecha)::integer, 1);

  select coalesce(sum(p.dist_sueldo_centavos), 0), coalesce(sum(p.dist_fijos_centavos), 0)
  into v_sueldo_previo, v_fijos_previo
  from public.proyectos p
  where p.household_id = v_proyecto.household_id
    and p.fecha_cobro >= v_inicio_mes
    and p.fecha_cobro < (v_inicio_mes + interval '1 month')::date
    and p.deleted_at is null
    and p.id <> v_proyecto.id;

  select * into v_topes
  from private.topes_de_la_liquidacion(
    v_objetivo_sueldo, v_objetivo_fijos, v_sueldo_mensual, v_sueldo_previo, v_fijos_previo
  );

  -- La liquidación sale ajustada cuando la app mandó el acumulado del mes y no es el de la base.
  -- Es lo único que la app no podía conocer: otra liquidación del mismo mes hecha en otro
  -- dispositivo, o una reapertura que todavía no replicó.
  v_ajustada := p_sueldo_previo_centavos is not null
    and (p_sueldo_previo_centavos, p_fijos_previo_centavos)
      is distinct from (v_sueldo_previo, v_fijos_previo);

  if v_ajustada then
    select * into v_topes_vistos
    from private.topes_de_la_liquidacion(
      v_objetivo_sueldo, v_objetivo_fijos, v_sueldo_mensual,
      p_sueldo_previo_centavos, p_fijos_previo_centavos
    );
  else
    v_topes_vistos := v_topes;
  end if;

  select coalesce(sum(g.monto_centavos), 0) into v_cobrado
  from public.pagos g
  where g.household_id = v_proyecto.household_id
    and g.proyecto_id = v_proyecto.id
    and g.deleted_at is null;

  select coalesce(sum(g.monto_centavos), 0) into v_gastos
  from public.gastos g
  where g.household_id = v_proyecto.household_id
    and g.proyecto_id = v_proyecto.id
    and g.deleted_at is null;

  -- Lo que se congela tiene que salir de lo que el usuario vio. Un tope distinto quiere decir que
  -- la app no veía otra liquidación del mes (o una reapertura), o que cambiaron los ajustes. Con el
  -- acumulado a la vista eso deja de ser una adivinanza: si el acumulado coincide, un tope distinto
  -- solo puede venir de los objetivos, y sigue siendo MN006.
  if v_cobrado <> p_cobrado_centavos
    or v_gastos <> p_gastos_centavos
    or v_fecha <> p_fecha
    or v_diezmo_bp <> coalesce(p_diezmo_bp, v_diezmo_bp)
    or (
      not v_ajustada
      and (
        v_topes.tope_sueldo_centavos <> p_tope_sueldo_centavos
        or v_topes.tope_fijos_centavos <> p_tope_fijos_centavos
      )
    )
  then
    raise exception 'Los pagos, los gastos, los topes, el diezmo o la fecha cambiaron desde que viste la distribución'
      using errcode = 'MN006',
            detail = format(
              'cobrado %s, gastos %s, tope de sueldo %s, tope de fijos %s, diezmo %s bp, fecha %s; el mes ya llevaba %s de sueldo y %s de fijos',
              v_cobrado, v_gastos, v_topes.tope_sueldo_centavos, v_topes.tope_fijos_centavos, v_diezmo_bp,
              v_fecha, v_sueldo_previo, v_fijos_previo
            );
  end if;

  -- Una liquidación ajustada no afloja el MN008: la app tiene que haber aplicado bien la regla de
  -- los topes contra su propio acumulado. Si ni eso cierra, no es que vio otro mes: es que está
  -- calculando distinto. Va antes de la cascada porque un tope negativo la cortaría con un 22023.
  if v_ajustada
    and (
      v_topes_vistos.tope_sueldo_centavos <> p_tope_sueldo_centavos
      or v_topes_vistos.tope_fijos_centavos <> p_tope_fijos_centavos
    )
  then
    raise exception 'Los topes que viste no son los que salen de ese acumulado: actualizá la app'
      using errcode = 'MN008',
            detail = format(
              'con el mes en %s de sueldo y %s de fijos, los topes son %s y %s',
              p_sueldo_previo_centavos, p_fijos_previo_centavos,
              v_topes_vistos.tope_sueldo_centavos, v_topes_vistos.tope_fijos_centavos
            );
  end if;

  -- Y la distribución que se le mostró tiene que ser la que calcula la base con las entradas que la
  -- app tenía. Si no, la app y la base están aplicando reglas distintas (una versión vieja de la
  -- app, o un bug): mejor un rechazo visible que congelar otra cosa.
  select * into v_dist_vista
  from private.cascada(v_cobrado, v_gastos, v_diezmo_bp, p_tope_sueldo_centavos, p_tope_fijos_centavos);

  if (v_dist_vista.diezmo_centavos, v_dist_vista.sueldo_centavos, v_dist_vista.fijos_centavos, v_dist_vista.remanente_centavos)
    is distinct from (p_diezmo_centavos, p_sueldo_centavos, p_fijos_centavos, p_remanente_centavos)
  then
    raise exception 'La distribución que viste no es la que calcula la base: actualizá la app'
      using errcode = 'MN008',
            detail = format(
              'diezmo %s, sueldo %s, fijos %s, remanente %s',
              v_dist_vista.diezmo_centavos, v_dist_vista.sueldo_centavos,
              v_dist_vista.fijos_centavos, v_dist_vista.remanente_centavos
            );
  end if;

  -- Recién acá se congela con el acumulado de la base. Cuando no hubo ajuste, es exactamente la
  -- misma cuenta que acaba de pasar el MN008.
  if v_ajustada then
    select * into v_dist
    from private.cascada(v_cobrado, v_gastos, v_diezmo_bp, v_topes.tope_sueldo_centavos, v_topes.tope_fijos_centavos);
  else
    v_dist := v_dist_vista;
  end if;

  update public.proyectos set
    estado = p_destino,
    fecha_cobro = v_fecha,
    dist_cobrado_centavos = v_cobrado,
    dist_gastos_centavos = v_gastos,
    dist_diezmo_bp = v_diezmo_bp,
    dist_tope_sueldo_centavos = v_topes.tope_sueldo_centavos,
    dist_tope_fijos_centavos = v_topes.tope_fijos_centavos,
    dist_diezmo_centavos = v_dist.diezmo_centavos,
    dist_sueldo_centavos = v_dist.sueldo_centavos,
    dist_fijos_centavos = v_dist.fijos_centavos,
    dist_remanente_centavos = v_dist.remanente_centavos,
    dist_objetivo_sueldo_centavos = v_objetivo_sueldo,
    dist_objetivo_fijos_centavos = v_objetivo_fijos,
    dist_sueldo_mensual = v_sueldo_mensual,
    dist_sueldo_previo_centavos = v_sueldo_previo,
    dist_fijos_previo_centavos = v_fijos_previo,
    dist_liquidado_at = clock_timestamp(),
    reapertura_objetivo_sueldo_centavos = null,
    reapertura_objetivo_fijos_centavos = null,
    reapertura_sueldo_mensual = null,
    reapertura_fecha_cobro = null
  where id = v_proyecto.id
  returning * into v_proyecto;

  return v_proyecto;
end;
$function$;
-- execute: authenticated:EXECUTE
comment on function private.liquidar(estado_proyecto,uuid,integer,date,bigint,bigint,bigint,bigint,bigint,bigint,bigint,bigint,integer,bigint,bigint) is 'Liquida un proyecto hacia cobrado o perdido y congela su distribución. Bloquea el proyecto y después los ajustes, suma lo liquidado en el mes, y rechaza con MN006 si la versión, los totales, el diezmo o la fecha no son los que vio el cliente, y con MN008 si la distribución no es la de la base. Si el cliente manda el acumulado del mes que vio y no es el de la base, recalcula los topes con el suyo y congela eso en vez de rechazar: el MN008 se sigue exigiendo contra lo que el cliente vio. Reconoce el reenvío, ajustado o no.';

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

CREATE OR REPLACE FUNCTION private.pagos_por_delante(p_precio_centavos bigint, p_pagado_centavos bigint, p_sena_bp integer)
 RETURNS TABLE(orden integer, instancia text, monto_centavos bigint)
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare
  v_falta bigint;
  v_sena bigint;
  v_despues bigint;
begin
  -- Sin presupuesto no hay importe que calcular, pero el camino se conoce igual: primero la seña y
  -- después el saldo. La pantalla los anticipa sin número.
  if p_precio_centavos is null then
    return query values (1, 'sena', null::bigint), (2, 'saldo', null::bigint);
    return;
  end if;

  v_falta := p_precio_centavos - p_pagado_centavos;
  if v_falta <= 0 then
    return;
  end if;

  -- La misma cuenta que aplicarPorcentaje() de @maun/domain y que el diezmo de private.cascada():
  -- medio punto para redondear y división entera, que con importes no negativos es piso.
  v_sena := (p_precio_centavos * p_sena_bp + 5000) / 10000;

  if p_pagado_centavos >= v_sena then
    return query values (1, 'saldo', v_falta);
    return;
  end if;

  -- Lo que queda después de cubrir la seña no es «lo que falta menos la seña que falta»: es el
  -- presupuesto menos la seña entera. Con parte de la seña ya cobrada las dos cuentas no dan lo
  -- mismo, y la que el cliente va a tener que pagar es esta.
  v_despues := p_precio_centavos - v_sena;
  if v_despues <= 0 then
    return query values (1, 'sena', v_sena - p_pagado_centavos);
    return;
  end if;

  return query values (1, 'sena', v_sena - p_pagado_centavos), (2, 'saldo', v_despues);
end;
$function$;
-- execute: authenticated:EXECUTE
comment on function private.pagos_por_delante(bigint,bigint,integer) is 'Los pagos que le faltan al cliente, en el orden en que los va a hacer: la seña mientras no esté cubierta y después el saldo, o nada cuando ya pagó todo. El importe de la seña es lo que falta de ella, con todo lo cobrado hasta hoy ya descontado —la visita incluida, que entra como un pago más—; el del saldo es el presupuesto menos la seña entera, que es lo que va a quedar cuando la termine de pagar. Sin presupuesto devuelve los dos sin importe: el porcentaje de seña es política comercial del taller y no viaja. Es la gemela en SQL de pagosPorDelante() de @maun/domain y scripts/comparacion.ts las compara caso por caso (ADR 0053).';

CREATE OR REPLACE FUNCTION private.pedir_los_avisos()
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_url text;
  v_secreto text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'avisos_url';
  select decrypted_secret into v_secreto from vault.decrypted_secrets where name = 'avisos_secreto';
  if v_url is null or v_secreto is null then
    return null;
  end if;

  return net.http_post(
    url := v_url,
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secreto
    ),
    timeout_milliseconds := 30000
  );
end;
$function$;
-- execute: solo el dueño
comment on function private.pedir_los_avisos() is 'Le pide a la función de borde que mande los avisos que tocan. La llama pg_cron. Sin avisos_url y avisos_secreto en Vault devuelve null y no pide nada.';

CREATE OR REPLACE FUNCTION private.registrar_suscripcion(p_endpoint text, p_p256dh text, p_auth text, p_zona text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_usuario uuid := (select auth.uid());
begin
  if v_usuario is null then
    raise exception 'Hace falta una sesión para activar los avisos' using errcode = '42501';
  end if;
  perform private.validar_zona(p_zona);

  -- El mismo endpoint es el mismo dispositivo. Si lo registra otra cuenta (cambió de usuario en el
  -- mismo teléfono), pasa a ser suyo y arranca de cero: los avisos del anterior dejan de llegar.
  insert into private.suscripciones_de_avisos as s (user_id, endpoint, p256dh, auth)
  values (v_usuario, p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update set
    user_id = excluded.user_id,
    p256dh = excluded.p256dh,
    auth = excluded.auth,
    actualizada_en = now(),
    ultimo_envio = case when s.user_id = excluded.user_id then s.ultimo_envio end,
    ultimo_dia_avisado = case when s.user_id = excluded.user_id then s.ultimo_dia_avisado end;

  insert into private.preferencias_de_avisos (user_id, zona)
  values (v_usuario, p_zona)
  on conflict (user_id) do update set zona = excluded.zona, actualizada_en = now();

  return private.estado_de_los_avisos(v_usuario, p_endpoint);
end;
$function$;
-- execute: authenticated:EXECUTE
comment on function private.registrar_suscripcion(text,text,text,text) is 'Registra este dispositivo para el usuario de la sesión, reasignándolo si era de otra cuenta, y guarda la zona horaria que eligió la persona.';

CREATE OR REPLACE FUNCTION private.reversion_valida(p_desde estado_proyecto, p_hacia estado_proyecto)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select coalesce(
    case p_desde
      when 'cobrado' then p_hacia = 'entregado'
      when 'perdido' then p_hacia in (
        'contacto', 'presupuesto_estimativo', 'relevamiento', 'a_presupuestar', 'presupuesto_enviado'
      )
      else false
    end,
    false
  )
$function$;
-- execute: authenticated:EXECUTE
comment on function private.reversion_valida(estado_proyecto,estado_proyecto) is 'A qué estado vuelve una liquidación revertida. Gemela de puedeRevertir de @maun/domain.';

CREATE OR REPLACE FUNCTION private.revertir_liquidacion(p_proyecto_id uuid, p_version integer, p_desde estado_proyecto, p_hacia estado_proyecto)
 RETURNS proyectos
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_proyecto public.proyectos;
begin
  if num_nulls(p_proyecto_id, p_version, p_desde, p_hacia) > 0 then
    raise exception 'La reversión necesita todos sus parámetros' using errcode = '22004';
  end if;

  select p.* into v_proyecto
  from public.proyectos p
  where p.id = p_proyecto_id
    and p.household_id = any (array(select private.user_household_ids()))
  for update;

  if not found then
    raise exception 'El proyecto no existe o no es tuyo' using errcode = '42501';
  end if;

  -- El reenvío de la cola: esta misma reversión ya se aplicó y la respuesta se perdió. Reabrir un
  -- cobro deja la foto de la reapertura; reactivar un perdido no deja ninguna.
  if v_proyecto.estado = p_hacia
    and v_proyecto.fecha_cobro is null
    and v_proyecto.version = p_version + 1
    and (p_desde = 'cobrado') = (v_proyecto.reapertura_fecha_cobro is not null)
  then
    return v_proyecto;
  end if;

  if v_proyecto.deleted_at is not null then
    raise exception 'El proyecto está borrado' using errcode = 'MN002';
  end if;

  if v_proyecto.estado <> p_desde or not private.reversion_valida(p_desde, p_hacia) then
    raise exception '%', case p_desde
        when 'cobrado' then format('Solo se reabre un proyecto cobrado, y este está en %s', v_proyecto.estado)
        else format('Solo se reactiva un perdido, a un estado de seguimiento: este está en %s y el destino es %s', v_proyecto.estado, p_hacia)
      end
      using errcode = 'MN007';
  end if;

  if v_proyecto.version <> p_version then
    raise exception 'El proyecto cambió desde que lo viste'
      using errcode = 'MN006',
            detail = format('versión vista %s, versión actual %s', p_version, v_proyecto.version);
  end if;

  -- El mismo segundo lock que la liquidación: una liquidación del mismo mes que corre en paralelo
  -- ve el mes con este proyecto adentro o afuera, nunca a medias.
  perform 1
  from public.ajustes a
  where a.household_id = v_proyecto.household_id
  for no key update;

  -- Reabrir un cobro guarda la fecha, los objetivos y el modo del original para el cobro
  -- siguiente (ADR 0003). Reactivar un perdido no guarda nada: un lead que revive es un lead vivo
  -- otra vez, y un cierre posterior es un evento nuevo con su fecha.
  update public.proyectos set
    estado = p_hacia,
    reapertura_objetivo_sueldo_centavos = case when p_desde = 'cobrado' then dist_objetivo_sueldo_centavos end,
    reapertura_objetivo_fijos_centavos = case when p_desde = 'cobrado' then dist_objetivo_fijos_centavos end,
    reapertura_sueldo_mensual = case when p_desde = 'cobrado' then dist_sueldo_mensual end,
    reapertura_fecha_cobro = case when p_desde = 'cobrado' then fecha_cobro end,
    fecha_cobro = null,
    dist_cobrado_centavos = null,
    dist_gastos_centavos = null,
    dist_diezmo_bp = null,
    dist_tope_sueldo_centavos = null,
    dist_tope_fijos_centavos = null,
    dist_diezmo_centavos = null,
    dist_sueldo_centavos = null,
    dist_fijos_centavos = null,
    dist_remanente_centavos = null,
    dist_objetivo_sueldo_centavos = null,
    dist_objetivo_fijos_centavos = null,
    dist_sueldo_mensual = null,
    dist_sueldo_previo_centavos = null,
    dist_fijos_previo_centavos = null,
    dist_liquidado_at = null
  where id = v_proyecto.id
  returning * into v_proyecto;

  return v_proyecto;
end;
$function$;
-- execute: authenticated:EXECUTE
comment on function private.revertir_liquidacion(uuid,integer,estado_proyecto,estado_proyecto) is 'Descongela la distribución de un proyecto liquidado: reabre un cobrado a entregado guardando la foto del cobro, o reactiva un perdido a un estado de seguimiento sin foto. Los demás proyectos del mes no se recalculan. Rechaza con MN006 si el proyecto cambió. Reconoce el reenvío idéntico.';

CREATE OR REPLACE FUNCTION private.ruta_del_archivo(p_household_id uuid, p_proyecto_id uuid, p_archivo_id uuid, p_tipo text, p_miniatura boolean)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select p_household_id::text || '/' || p_proyecto_id::text || '/' || p_archivo_id::text
    || case
         when p_miniatura and p_tipo in ('image/webp', 'image/jpeg') then '.mini'
         else ''
       end
    || case p_tipo
         when 'image/webp' then '.webp'
         when 'image/jpeg' then '.jpg'
         when 'application/pdf' then '.pdf'
         else '.bin'
       end
$function$;
-- execute: authenticated:EXECUTE
comment on function private.ruta_del_archivo(uuid,uuid,uuid,text,boolean) is 'La ruta del binario en el bucket archivos, la misma que arma la app (ADR 0039). La vista del cliente la manda ya armada para que el navegador del cliente no tenga que conocer la convención.';

CREATE OR REPLACE FUNCTION private.suscripciones_para_probar(p_usuario uuid, p_endpoint text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce(
    jsonb_agg(
      jsonb_build_object('id', s.id, 'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth)
      order by s.creada_en
    ),
    '[]'::jsonb
  )
  from private.suscripciones_de_avisos s
  where s.user_id = p_usuario
    and (p_endpoint is null or s.endpoint = p_endpoint)
$function$;
-- execute: service_role:EXECUTE
comment on function private.suscripciones_para_probar(uuid,text) is 'Los dispositivos de una persona, o uno solo si se pasa el endpoint, para mandarles el aviso de prueba. El usuario lo validó la función de borde con su token.';

CREATE OR REPLACE FUNCTION private.topes_de_la_liquidacion(p_objetivo_sueldo_centavos bigint, p_objetivo_fijos_centavos bigint, p_sueldo_mensual boolean, p_sueldo_previo_centavos bigint, p_fijos_previo_centavos bigint, OUT tope_sueldo_centavos bigint, OUT tope_fijos_centavos bigint)
 RETURNS record
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare
  -- Number.MAX_SAFE_INTEGER, como en private.cascada.
  c_maximo constant bigint := 9007199254740991;
begin
  if num_nulls(
    p_objetivo_sueldo_centavos, p_objetivo_fijos_centavos, p_sueldo_mensual,
    p_sueldo_previo_centavos, p_fijos_previo_centavos
  ) > 0 then
    raise exception 'Los topes necesitan todos sus parámetros' using errcode = '22004';
  end if;

  if least(
    p_objetivo_sueldo_centavos, p_objetivo_fijos_centavos, p_sueldo_previo_centavos, p_fijos_previo_centavos
  ) < 0 then
    raise exception 'Los topes no aceptan importes negativos' using errcode = '22023';
  end if;

  if greatest(
    p_objetivo_sueldo_centavos, p_objetivo_fijos_centavos, p_sueldo_previo_centavos, p_fijos_previo_centavos
  ) > c_maximo then
    raise exception 'Importe fuera del rango exacto de Money' using errcode = '22003';
  end if;

  tope_fijos_centavos := greatest(0, p_objetivo_fijos_centavos - p_fijos_previo_centavos);
  tope_sueldo_centavos := case
    when p_sueldo_mensual then greatest(0, p_objetivo_sueldo_centavos - p_sueldo_previo_centavos)
    else p_objetivo_sueldo_centavos
  end;
end;
$function$;
-- execute: solo el dueño
comment on function private.topes_de_la_liquidacion(bigint,bigint,boolean,bigint,bigint) is 'Los topes de una liquidación: fijos por lo que falta del mes; sueldo por proyecto (el objetivo entero) o por mes. Gemela de topesDeLaLiquidacion de @maun/domain.';

CREATE OR REPLACE FUNCTION private.transicion_valida(p_desde estado_proyecto, p_hasta estado_proyecto)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from (
      values
        ('contacto', 'presupuesto_estimativo'), ('contacto', 'relevamiento'), ('contacto', 'a_presupuestar'),
        ('contacto', 'presupuesto_enviado'), ('contacto', 'en_curso'),
        ('presupuesto_estimativo', 'contacto'), ('presupuesto_estimativo', 'relevamiento'),
        ('presupuesto_estimativo', 'a_presupuestar'), ('presupuesto_estimativo', 'presupuesto_enviado'),
        ('presupuesto_estimativo', 'en_curso'),
        ('relevamiento', 'contacto'), ('relevamiento', 'presupuesto_estimativo'), ('relevamiento', 'a_presupuestar'),
        ('relevamiento', 'presupuesto_enviado'), ('relevamiento', 'en_curso'),
        ('a_presupuestar', 'contacto'), ('a_presupuestar', 'presupuesto_estimativo'), ('a_presupuestar', 'relevamiento'),
        ('a_presupuestar', 'presupuesto_enviado'), ('a_presupuestar', 'en_curso'),
        ('presupuesto_enviado', 'contacto'), ('presupuesto_enviado', 'presupuesto_estimativo'),
        ('presupuesto_enviado', 'relevamiento'), ('presupuesto_enviado', 'a_presupuestar'),
        ('presupuesto_enviado', 'en_curso'),
        ('en_curso', 'presupuesto_enviado'), ('en_curso', 'entregado'),
        ('entregado', 'en_curso')
    ) as t (desde, hasta)
    where t.desde::public.estado_proyecto = p_desde
      and t.hasta::public.estado_proyecto = p_hasta
  )
$function$;
-- execute: authenticated:EXECUTE
comment on function private.transicion_valida(estado_proyecto,estado_proyecto) is 'Transiciones manuales de estado. Liquidar y revertir no están: son operaciones. Gemela de TRANSICIONES de @maun/domain.';

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

CREATE OR REPLACE FUNCTION private.validar_presupuesto_aprobado()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_household_id uuid;
  v_proyecto_id uuid;
  v_presupuesto bigint;
  v_cuantas integer;
  v_esperado bigint;
begin
  if tg_table_name = 'proyectos' then
    v_household_id := new.household_id;
    v_proyecto_id := new.id;
  else
    v_household_id := new.household_id;
    v_proyecto_id := new.proyecto_id;
  end if;

  select p.presupuesto_centavos into v_presupuesto
  from public.proyectos p
  where p.household_id = v_household_id and p.id = v_proyecto_id;

  -- El trabajo ya no está: lo borró la misma transacción y la baja en cascada se llevó sus opciones.
  if not found then
    return null;
  end if;

  select count(*)::integer, min(monto_centavos) filter (where aprobada)
  into v_cuantas, v_esperado
  from public.opciones_de_presupuesto
  where household_id = v_household_id
    and proyecto_id = v_proyecto_id
    and deleted_at is null;

  -- Sin opciones, el presupuesto es un campo más y lo carga el usuario: nada que validar.
  if v_cuantas = 0 then
    return null;
  end if;

  if v_presupuesto is distinct from v_esperado then
    raise exception 'El presupuesto de un trabajo con opciones sale de la opción aprobada'
      using errcode = 'MN009',
            detail = format(
              'presupuesto %s, opciones vivas %s, esperado %s',
              coalesce(v_presupuesto::text, 'sin presupuesto'),
              v_cuantas,
              coalesce(v_esperado::text, 'sin presupuesto')
            ),
            hint = 'Tildá la opción que te aprobaron, o sacá las opciones si querés cargar el presupuesto a mano.';
  end if;

  return null;
end;
$function$;
-- execute: solo el dueño
comment on function private.validar_presupuesto_aprobado() is 'Con opciones vivas, el presupuesto del trabajo tiene que ser el de la opción aprobada (o null si no hay ninguna). Es un trigger de constraint diferido: adentro de una transacción el proyecto se escribe antes que sus hijas, así que el par recién tiene que cerrar al final.';

CREATE OR REPLACE FUNCTION private.validar_proyecto_abierto()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_proyectos uuid[];
  v_liquidado public.estado_proyecto;
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

  -- Bloquea el proyecto antes de mirarlo. Sin esto, un pago que entra mientras otra sesión liquida
  -- el proyecto pasa la guarda con el estado viejo y queda fuera de la distribución congelada: la
  -- foreign key solo toma un lock que no choca con el update de la liquidación. Con for share, este
  -- trigger espera a la liquidación y la consulta de abajo, que es nueva, ya la ve commiteada. El
  -- contrato del otro lado: private.liquidar bloquea el proyecto con for update antes de sumar.
  perform 1
  from public.proyectos p
  where p.household_id = new.household_id
    and p.id = any (v_proyectos)
  order by p.id
  for share;

  select p.estado into v_liquidado
  from public.proyectos p
  where p.household_id = new.household_id
    and p.id = any (v_proyectos)
    and p.estado in ('cobrado', 'perdido')
  limit 1;

  if found then
    raise exception 'El proyecto está % y su distribución congelada: sus pagos y gastos no se modifican', v_liquidado
      using errcode = 'MN001',
            hint = case v_liquidado
              when 'cobrado' then 'Para corregirlo hay que reabrir el proyecto o registrar un ajuste.'
              else 'Para cargarlo hay que reactivar el perdido y volver a cerrarlo.'
            end;
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
comment on function private.validar_proyecto_abierto() is 'Guarda de pagos y gastos: rechaza altas y cambios sobre un proyecto liquidado, cobrado o perdido (MN001), o borrado (MN002). Deja pasar el reenvío idéntico de la cola.';

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

    -- Un proyecto no nace liquidado: cobrar y cerrar como perdido son operaciones, no datos.
    if new.estado in ('cobrado', 'perdido') and new.fecha_cobro is null then
      raise exception 'Un proyecto no se crea %: se cobra con cobrar_proyecto y se pierde con cerrar_perdido', new.estado
        using errcode = 'MN007';
    end if;
  elsif private.es_reenvio(to_jsonb(old), to_jsonb(new)) then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    -- Lo congelado solo se mueve revirtiendo, y la reversión limpia fecha_cobro. Sin esta guarda,
    -- una edición encolada con el estado viejo rebotaría contra un check con un 23514 genérico.
    if old.estado in ('cobrado', 'perdido') and new.fecha_cobro is not null and new.estado <> old.estado then
      raise exception 'El proyecto está % y su distribución congelada: su estado no cambia editándolo', old.estado
        using errcode = 'MN001',
              hint = case old.estado
                when 'cobrado' then 'Para corregirlo hay que reabrir el proyecto o registrar un ajuste.'
                else 'Un perdido vuelve al seguimiento con reactivar_perdido.'
              end;
    end if;

    -- Borrar un proyecto borra sus pagos y gastos: si está liquidado y movió plata, eso la sacaría
    -- del libro mayor. Un liquidado sin pagos ni gastos (el lead perdido sin seña) sí se borra.
    if old.fecha_cobro is not null and old.deleted_at is null and new.deleted_at is not null and (
      exists (
        select 1 from public.pagos g
        where g.household_id = old.household_id and g.proyecto_id = old.id and g.deleted_at is null
      )
      or exists (
        select 1 from public.gastos g
        where g.household_id = old.household_id and g.proyecto_id = old.id and g.deleted_at is null
      )
    ) then
      raise exception 'Un proyecto % con pagos o gastos no se borra: tiene la distribución congelada', old.estado
        using errcode = 'MN001';
    end if;

    -- La baja se lleva los pagos y gastos, y des-borrar no los trae de vuelta: un proyecto
    -- borrado se queda borrado. Evita que una edición vieja encolada lo resucite vacío.
    if old.deleted_at is not null and new.deleted_at is null then
      raise exception 'El proyecto está borrado'
        using errcode = 'MN002';
    end if;

    if new.estado is distinct from old.estado then
      if new.estado in ('cobrado', 'perdido') then
        -- Solo private.liquidar llega acá con la distribución congelada: el cliente no tiene grant
        -- sobre fecha_cobro.
        if new.fecha_cobro is null or not private.liquidacion_valida(old.estado, new.estado) then
          raise exception 'Un proyecto no pasa de % a % editando el estado: se cobra con cobrar_proyecto y se pierde con cerrar_perdido', old.estado, new.estado
            using errcode = 'MN007';
        end if;
      elsif old.estado in ('cobrado', 'perdido') then
        -- Solo private.revertir_liquidacion llega acá, porque es la única que limpia fecha_cobro.
        if not private.reversion_valida(old.estado, new.estado) then
          raise exception 'Un proyecto % no vuelve a %', old.estado, new.estado
            using errcode = 'MN007';
        end if;
      elsif not private.transicion_valida(old.estado, new.estado) then
        raise exception 'Un proyecto no pasa de % a %', old.estado, new.estado
          using errcode = 'MN007';
      end if;
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
comment on function private.validar_proyecto() is 'Guarda de proyectos: un liquidado (cobrado o perdido) no cambia de estado editándolo, y con pagos o gastos no se borra (MN001); un borrado no revive (MN002); un proyecto vivo no cuelga de un cliente borrado (MN005); el estado solo sigue transiciones válidas (MN007). Deja pasar el reenvío idéntico de la cola.';

CREATE OR REPLACE FUNCTION private.validar_zona(p_zona text)
 RETURNS void
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
begin
  if p_zona is null or not exists (select 1 from pg_catalog.pg_timezone_names where name = p_zona) then
    raise exception 'La zona horaria no existe' using errcode = '22023';
  end if;
end;
$function$;
-- execute: solo el dueño

CREATE OR REPLACE FUNCTION public.reabrir_proyecto(p_proyecto_id uuid, p_version integer)
 RETURNS proyectos
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select * from private.revertir_liquidacion(p_proyecto_id, p_version, 'cobrado', 'entregado')
$function$;
-- execute: authenticated:EXECUTE, service_role:EXECUTE
comment on function reabrir_proyecto(uuid,integer) is 'RPC de reapertura de un proyecto cobrado: vuelve a entregado y guarda la fecha y los objetivos del cobro.';

CREATE OR REPLACE FUNCTION public.reactivar_perdido(p_proyecto_id uuid, p_version integer, p_estado estado_proyecto)
 RETURNS proyectos
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select * from private.revertir_liquidacion(p_proyecto_id, p_version, 'perdido', p_estado)
$function$;
-- execute: authenticated:EXECUTE, service_role:EXECUTE
comment on function reactivar_perdido(uuid,integer,estado_proyecto) is 'RPC de reactivación de un perdido: descongela su liquidación y lo vuelve al estado de seguimiento elegido.';

CREATE OR REPLACE FUNCTION public.registrar_suscripcion(p_endpoint text, p_p256dh text, p_auth text, p_zona text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select private.registrar_suscripcion(p_endpoint, p_p256dh, p_auth, p_zona)
$function$;
-- execute: authenticated:EXECUTE, service_role:EXECUTE
comment on function registrar_suscripcion(text,text,text,text) is 'Activa los avisos en este dispositivo. No pasa por la cola de salida: sin señal no se puede suscribir a un servicio de push de todas formas.';

CREATE OR REPLACE FUNCTION public.suscripciones_para_probar(p_usuario uuid, p_endpoint text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select private.suscripciones_para_probar(p_usuario, p_endpoint)
$function$;
-- execute: service_role:EXECUTE
comment on function suscripciones_para_probar(uuid,text) is 'Solo para la función de borde de los avisos (service_role).';

CREATE OR REPLACE FUNCTION public.titulo_compartido(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_enlace public.enlaces_publicos;
  v_p public.proyectos;
  v_taller text;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{16,128}$' then
    return null;
  end if;

  select * into v_enlace
  from public.enlaces_publicos e
  where e.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
    and e.revocado_at is null
    and e.deleted_at is null;

  if not found then
    return null;
  end if;

  select * into v_p
  from public.proyectos p
  where p.id = v_enlace.proyecto_id
    and p.deleted_at is null
    and p.estado <> 'perdido';

  if not found then
    return null;
  end if;

  select h.nombre into v_taller from public.households h where h.id = v_p.household_id;

  return jsonb_build_object('trabajo', v_p.titulo, 'taller', v_taller);
end;
$function$;
-- execute: anon:EXECUTE, authenticated:EXECUTE, service_role:EXECUTE
comment on function titulo_compartido(text) is 'Devuelve solamente el título del trabajo y el nombre del taller, y no llama a public.vista_del_cliente(). Tiene que ser así por dos motivos. El primero es qué pide quien la llama: la vista previa que arma WhatsApp cuando se pega el enlace queda guardada en el chat, así que ahí no puede ir ni un importe, ni la etapa, ni el nombre ni la dirección del cliente, que son justamente las cosas que sí devuelve la vista. El segundo es quién la llama: la pide un rastreador, no una persona, y la vista cuenta cada lectura como una visita del cliente (public.vista_compartida incrementa visitas). Si la vista previa usara esa puerta, el contador que el dueño mira en la pantalla de compartir contaría robots. Es stable a propósito: no escribe nada. Un token inválido, uno dado de baja, uno inexistente y un trabajo perdido devuelven null, los cuatro iguales (ADR 0049).';

CREATE OR REPLACE FUNCTION public.vista_compartida(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_enlace public.enlaces_publicos;
begin
  -- Un token que no tiene la forma de un token no llega ni a consultarse.
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{16,128}$' then
    raise exception 'Este link no funciona' using errcode = 'MN010';
  end if;

  select * into v_enlace
  from public.enlaces_publicos e
  where e.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
    and e.revocado_at is null
    and e.deleted_at is null;

  -- Inexistente, revocado y de un trabajo borrado contestan exactamente lo mismo: el que tiene el
  -- link no se entera de si alguna vez existió, ni de quién es, ni de nada.
  if not found then
    raise exception 'Este link no funciona' using errcode = 'MN010';
  end if;

  update public.enlaces_publicos
  set visitas = visitas + 1, ultima_visita_at = now()
  where id = v_enlace.id;

  return public.vista_del_cliente(v_enlace.proyecto_id);
exception
  -- La vista rechaza con 42501 lo que no existe, lo que no es del household y lo que se dio por
  -- perdido. Desde afuera todo eso es la misma frase: el link no funciona.
  when insufficient_privilege then
    raise exception 'Este link no funciona' using errcode = 'MN010';
end;
$function$;
-- execute: anon:EXECUTE, authenticated:EXECUTE, service_role:EXECUTE
comment on function vista_compartida(text) is 'La puerta del link: resuelve el token contra token_hash, cuenta la visita y devuelve exactamente lo mismo que public.vista_del_cliente(). Es security definer porque quien la llama es el rol anónimo, que no puede leer ninguna de las tablas que ella toca. Un token inválido, uno dado de baja, uno de un trabajo borrado y uno de un trabajo perdido contestan los cuatro lo mismo, MN010, sin decir si el trabajo existe ni el nombre de nadie (ADR 0046). No devuelve la columna token: el cliente llega con su token en la mano y no necesita que se lo contesten (ADR 0052).';

CREATE OR REPLACE FUNCTION public.vista_del_cliente(p_proyecto_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  v_p public.proyectos;
  v_taller text;
  v_cliente text;
  v_ajustes public.ajustes;
  v_alias text;
  v_cbu text;
  v_link text;
  v_hay_como_transferir boolean;
  v_pagado bigint;
  v_ahora record;
  v_despues record;
  v_formas public.forma_de_cobro[];
  v_por_transferencia boolean;
  v_siguiente jsonb;
begin
  select * into v_p from public.proyectos p where p.id = p_proyecto_id and p.deleted_at is null;

  -- Lo mismo que si no existiera. Con la RLS puesta, un trabajo de otro household no se ve, y esta
  -- respuesta no distingue «no existe» de «no es tuyo».
  if not found then
    raise exception 'El trabajo no existe o no es tuyo' using errcode = '42501';
  end if;

  -- Un trabajo dado por perdido no tiene nada que contarle al cliente, y decirle que se perdió
  -- sería contarle una decisión del taller. El link se comporta como si no sirviera.
  if v_p.estado = 'perdido' then
    raise exception 'El trabajo no existe o no es tuyo' using errcode = '42501';
  end if;

  select h.nombre into v_taller from public.households h where h.id = v_p.household_id;
  select c.nombre into v_cliente from public.clientes c where c.id = v_p.cliente_id;
  select * into v_ajustes from public.ajustes a where a.household_id = v_p.household_id;

  v_alias := nullif(v_ajustes.cobro_alias, '');
  v_cbu := nullif(v_ajustes.cobro_cbu, '');
  v_link := nullif(v_ajustes.cobro_link, '');
  v_hay_como_transferir := v_alias is not null or v_cbu is not null or v_link is not null;

  select coalesce(sum(g.monto_centavos), 0) into v_pagado
  from public.pagos g
  where g.household_id = v_p.household_id
    and g.proyecto_id = v_p.id
    and g.deleted_at is null;

  select * into v_ahora from private.pagos_por_delante(
    v_p.presupuesto_centavos,
    v_pagado,
    coalesce(v_p.sena_bp, v_ajustes.sena_bp, 5000)
  ) where orden = 1;

  select * into v_despues from private.pagos_por_delante(
    v_p.presupuesto_centavos,
    v_pagado,
    coalesce(v_p.sena_bp, v_ajustes.sena_bp, 5000)
  ) where orden = 2;

  -- Con todo pagado no hay ninguna instancia, así que tampoco hay formas ni datos de la cuenta.
  if v_ahora.instancia is null then
    v_formas := array[]::public.forma_de_cobro[];
  elsif v_ahora.instancia = 'sena' then
    v_formas := private.formas_de_cobro(v_p.cobro_sena, v_hay_como_transferir);
  else
    v_formas := private.formas_de_cobro(v_p.cobro_saldo, v_hay_como_transferir);
  end if;

  v_por_transferencia := 'transferencia' = any (v_formas);

  if v_despues.instancia is null then
    v_siguiente := null;
  else
    v_siguiente := jsonb_build_object(
      'instancia', v_despues.instancia,
      'formas', to_jsonb(
        case
          when v_despues.instancia = 'sena'
            then private.formas_de_cobro(v_p.cobro_sena, v_hay_como_transferir)
          else private.formas_de_cobro(v_p.cobro_saldo, v_hay_como_transferir)
        end
      ),
      'monto_centavos', v_despues.monto_centavos
    );
  end if;

  -- Los campos van enumerados uno por uno, a propósito. Si esto fuera to_jsonb(v_p) con la pantalla
  -- filtrando, el día que alguien le agregue una columna a proyectos esa columna quedaría expuesta
  -- sin que nadie lo decida: lo que el cliente ve se decide acá, no en el navegador. La suite lo
  -- controla con supabase/tests/25_vista_del_cliente.sql, que falla apenas aparece una columna
  -- nueva en proyectos o en ajustes hasta que alguien la clasifica como pública o privada.
  return jsonb_build_object(
    'taller', jsonb_build_object('nombre', v_taller),
    'cliente', jsonb_build_object('nombre', v_cliente),
    'trabajo', v_p.titulo,
    'direccion', v_p.direccion_entrega,
    'estado', v_p.estado,
    'precio_centavos', v_p.presupuesto_centavos,
    -- El pago que toca ahora y, si hay otro después, cuánto es y cómo se paga. Los importes salen
    -- de lo que ya está guardado; el porcentaje de seña sigue sin viajar, que es lo que dejó
    -- abierto el ADR 0048.
    'pago', jsonb_build_object(
      'instancia', v_ahora.instancia,
      'formas', to_jsonb(v_formas),
      'monto_centavos', v_ahora.monto_centavos,
      'siguiente', v_siguiente
    ),
    -- Cómo pagarle al taller, y solo si el pago que toca se puede pagar así: los cuatro datos de
    -- la cuenta para transferir y el link de Mercado Pago para pagar desde la misma página. De
    -- ajustes no viaja nada más: ni el sueldo, ni los costos fijos, ni la meta de Cocos, ni la seña.
    'cobro', jsonb_build_object(
      'alias', case when v_por_transferencia then v_alias end,
      'cbu', case when v_por_transferencia then v_cbu end,
      'titular', case when v_por_transferencia then nullif(v_ajustes.cobro_titular, '') end,
      'cuit', case when v_por_transferencia then nullif(v_ajustes.cobro_cuit, '') end,
      'link', case when v_por_transferencia then v_link end
    ),
    'fechas', jsonb_build_object(
      'presupuesto', (
        select min(c.ocurrio_el)
        from public.cambios_de_estado c
        where c.household_id = v_p.household_id
          and c.proyecto_id = v_p.id
          and c.hacia = 'presupuesto_enviado'
      ),
      'aprobado', (
        select min(c.ocurrio_el)
        from public.cambios_de_estado c
        where c.household_id = v_p.household_id
          and c.proyecto_id = v_p.id
          and c.hacia = 'en_curso'
      ),
      'inicio', v_p.fecha_inicio,
      'entrega_pautada', v_p.entrega_estimada,
      'entregado', v_p.fecha_entrega,
      'cobro', case when v_p.estado = 'cobrado' then v_p.fecha_cobro end
    ),
    'pagos', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', g.id,
            'fecha', g.fecha,
            'concepto', g.concepto,
            'monto_centavos', g.monto_centavos
          )
          order by g.fecha, g.id
        ),
        '[]'::jsonb
      )
      from public.pagos g
      where g.household_id = v_p.household_id
        and g.proyecto_id = v_p.id
        and g.deleted_at is null
    ),
    'archivos', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', a.id,
            'nombre', a.nombre,
            'tipo', a.tipo,
            'ancho', a.ancho,
            'alto', a.alto,
            'fecha', a.created_at,
            -- La ruta en el bucket, que es pública y se sirve por el CDN. Sale del id, como en la
            -- app: private.ruta_del_archivo() es el único lugar donde se arma.
            'ruta', private.ruta_del_archivo(a.household_id, a.proyecto_id, a.id, a.tipo, false),
            'ruta_mini', private.ruta_del_archivo(a.household_id, a.proyecto_id, a.id, a.tipo, true)
          )
          order by a.created_at desc, a.id desc
        ),
        '[]'::jsonb
      )
      from public.archivos a
      where a.household_id = v_p.household_id
        and a.proyecto_id = v_p.id
        and a.deleted_at is null
        and a.visible_para_cliente
    )
  );
end;
$function$;
-- execute: authenticated:EXECUTE, service_role:EXECUTE
comment on function vista_del_cliente(uuid) is 'Lo único que un cliente puede ver de su trabajo: cuánto vale, cuánto pagó, en qué anda, la dirección de entrega, los archivos que el dueño marcó, qué pago le toca ahora, cuánto es, cómo puede pagarlo y cuál viene después. Enumera los campos uno por uno y nunca devuelve la fila entera: convertirla en un select * expondría cada columna nueva de proyectos sin que nadie lo decida, costos estimados y margen incluidos. De ajustes viajan exactamente los cinco campos de cobro —los cuatro de la cuenta y el link de Mercado Pago—, y solo cuando el pago que toca AHORA se ofrece por transferencia: lo que no se muestra, no se manda. El porcentaje de seña no viaja nunca; lo que viaja son los importes que salen de él. Es security invoker: desde la app la llama el dueño y la RLS decide; desde el link la llama public.vista_compartida(), que ya resolvió el token (ADR 0046, 0048, 0053 y 0054).';
