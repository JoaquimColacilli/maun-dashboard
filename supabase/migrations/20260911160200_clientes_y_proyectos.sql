-- Clientes y proyectos. El lead de seguimiento y el proyecto en obra son la misma fila: cambia el
-- estado, no la tabla.

create table public.clientes (
  id uuid primary key default private.uuidv7(),
  household_id uuid not null default private.household_actual()
    references public.households (id) on delete cascade,
  nombre text not null,
  zona text not null default '',
  telefono text not null default '',
  email text not null default '',
  direccion text not null default '',
  origen_contacto public.origen_contacto,
  origen_detalle text not null default '',
  condicion_fiscal public.condicion_fiscal not null default 'consumidor_final',
  cuit text not null default '',
  razon_social text not null default '',
  domicilio_fiscal text not null default '',
  notas text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,

  -- Destino de las foreign keys compuestas de los hijos: garantiza que un proyecto y su cliente
  -- estén en el mismo household sin depender de un trigger.
  constraint clientes_household_id_key unique (household_id, id),
  constraint clientes_nombre_valido check (btrim(nombre) <> ''),
  constraint clientes_cuit_formato check (cuit = '' or cuit ~ '^[0-9]{2}-[0-9]{8}-[0-9]$'),
  constraint clientes_email_formato check (email = '' or email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  constraint clientes_largos check (
    char_length(nombre) <= 200 and char_length(zona) <= 200 and char_length(telefono) <= 200
    and char_length(email) <= 200 and char_length(razon_social) <= 200
    and char_length(direccion) <= 500 and char_length(domicilio_fiscal) <= 500
    and char_length(origen_detalle) <= 500 and char_length(notas) <= 10000
  )
);

comment on table public.clientes is 'Clientes del taller. Un cliente puede tener varios proyectos a lo largo del tiempo.';
comment on column public.clientes.household_id is 'Default: el household del usuario de la sesión. El cliente de la app no lo manda.';
comment on column public.clientes.zona is 'Barrio o localidad, para ubicar al cliente de un vistazo.';
comment on column public.clientes.origen_detalle is 'Detalle libre del origen: quién lo refirió, por qué red escribió.';
comment on column public.clientes.cuit is 'CUIT con guiones (NN-NNNNNNNN-N), o vacío. El dígito verificador lo valida la app.';
comment on column public.clientes.deleted_at is 'Borrado lógico. No se puede borrar un cliente con proyectos vivos.';

create index clientes_household_actualizado on public.clientes (household_id, updated_at);

create trigger metadatos
  before insert or update on public.clientes
  for each row execute function private.mantener_metadatos();


create table public.proyectos (
  id uuid primary key default private.uuidv7(),
  household_id uuid not null default private.household_actual()
    references public.households (id) on delete cascade,
  cliente_id uuid not null,
  titulo text not null,
  descripcion text not null default '',
  estado public.estado_proyecto not null default 'contacto',
  presupuesto_centavos bigint,
  forma_pago public.forma_pago,
  comprobante public.comprobante not null default 'sin_comprobante',
  fecha_visita date,
  ultimo_contacto date,
  fecha_inicio date,
  entrega_estimada date,
  fecha_entrega date,
  direccion_entrega text not null default '',
  notas text not null default '',

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

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,

  constraint proyectos_household_id_key unique (household_id, id),
  constraint proyectos_cliente_fk foreign key (household_id, cliente_id)
    references public.clientes (household_id, id),
  constraint proyectos_titulo_valido check (btrim(titulo) <> ''),
  constraint proyectos_largos check (
    char_length(titulo) <= 200 and char_length(descripcion) <= 10000
    and char_length(direccion_entrega) <= 500 and char_length(notas) <= 10000
  ),
  constraint proyectos_presupuesto_no_negativo check (presupuesto_centavos is null or presupuesto_centavos >= 0),

  -- Cobrado si y solo si la distribución está congelada, y la distribución va completa o no va.
  constraint proyectos_cobrado_con_distribucion check (
    (estado = 'cobrado') = (fecha_cobro is not null)
    and num_nulls(
      fecha_cobro, dist_cobrado_centavos, dist_gastos_centavos, dist_diezmo_bp,
      dist_tope_sueldo_centavos, dist_tope_fijos_centavos, dist_diezmo_centavos,
      dist_sueldo_centavos, dist_fijos_centavos, dist_remanente_centavos
    ) in (0, 10)
  ),

  -- Los escalones de la cascada suman exactamente la ganancia neta, ninguno es negativo salvo el
  -- remanente cuando hubo pérdida, y ni el sueldo ni los fijos pasan su tope. El redondeo del
  -- diezmo es de @maun/domain: este check no lo fija, solo exige que la cuenta cierre.
  constraint proyectos_distribucion_cuadra check (
    dist_cobrado_centavos is null
    or (
      dist_cobrado_centavos >= 0
      and dist_gastos_centavos >= 0
      and dist_diezmo_bp between 0 and 10000
      and dist_tope_sueldo_centavos >= 0
      and dist_tope_fijos_centavos >= 0
      and dist_diezmo_centavos >= 0
      and dist_sueldo_centavos between 0 and dist_tope_sueldo_centavos
      and dist_fijos_centavos between 0 and dist_tope_fijos_centavos
      and (dist_remanente_centavos >= 0 or dist_diezmo_centavos + dist_sueldo_centavos + dist_fijos_centavos = 0)
      and dist_diezmo_centavos + dist_sueldo_centavos + dist_fijos_centavos + dist_remanente_centavos
        = dist_cobrado_centavos - dist_gastos_centavos
    )
  )
);

comment on table public.proyectos is
  'Leads y proyectos: la misma fila avanza de seguimiento a obra y a cobrado. Al cobrar se congela la distribución (ADR 0003).';
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

create index proyectos_household_actualizado on public.proyectos (household_id, updated_at);
-- Foreign key compuesta hacia clientes.
create index proyectos_household_cliente on public.proyectos (household_id, cliente_id);

create trigger metadatos
  before insert or update on public.proyectos
  for each row execute function private.mantener_metadatos();


-- Reglas de negocio ------------------------------------------------------------------------------

-- Un cliente con proyectos vivos no se borra. La regla inversa (un proyecto vivo no cuelga de un
-- cliente borrado) la cuida private.validar_proyecto(), que bloquea al cliente con for share: el
-- update de esta baja espera a ese lock y el exists de abajo ve el proyecto ya commiteado.
create function private.validar_baja_cliente()
returns trigger
language plpgsql
set search_path = ''
as $$
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
$$;

revoke all on function private.validar_baja_cliente() from public;

create trigger validar_baja
  before update of deleted_at on public.clientes
  for each row execute function private.validar_baja_cliente();


-- Las reglas de un proyecto que un check no puede expresar, con código propio para que la cola de
-- salida las muestre en vez de reintentarlas (ADR 0010).
create function private.validar_proyecto()
returns trigger
language plpgsql
set search_path = ''
as $$
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
$$;

comment on function private.validar_proyecto() is
  'Guarda de proyectos: un cobrado no cambia de estado ni se borra (MN001), un borrado no revive (MN002) y un proyecto vivo no cuelga de un cliente borrado (MN005). Deja pasar el reenvío idéntico de la cola.';

revoke all on function private.validar_proyecto() from public;

create trigger validar_proyecto
  before insert or update on public.proyectos
  for each row execute function private.validar_proyecto();


-- RLS y grants ---------------------------------------------------------------------------------

alter table public.clientes enable row level security;
alter table public.proyectos enable row level security;

revoke all on table public.clientes from anon, authenticated;
revoke all on table public.proyectos from anon, authenticated;

grant select on table public.clientes to authenticated;
grant insert (
  id, nombre, zona, telefono, email, direccion, origen_contacto, origen_detalle,
  condicion_fiscal, cuit, razon_social, domicilio_fiscal, notas, deleted_at
) on table public.clientes to authenticated;
-- id entra en el update porque el upsert de PostgREST lo incluye en el SET; cambiarlo de verdad
-- lo rechaza private.mantener_metadatos().
grant update (
  id, nombre, zona, telefono, email, direccion, origen_contacto, origen_detalle,
  condicion_fiscal, cuit, razon_social, domicilio_fiscal, notas, deleted_at
) on table public.clientes to authenticated;

-- Las columnas de la distribución congelada no tienen grant: solo las escribe la función de cobro
-- (security definer), que calcula la cascada en la base. Tampoco hay grant de delete: los borrados
-- son lógicos, por update de deleted_at.
grant select on table public.proyectos to authenticated;
grant insert (
  id, cliente_id, titulo, descripcion, estado, presupuesto_centavos, forma_pago, comprobante,
  fecha_visita, ultimo_contacto, fecha_inicio, entrega_estimada, fecha_entrega,
  direccion_entrega, notas, deleted_at
) on table public.proyectos to authenticated;
grant update (
  id, cliente_id, titulo, descripcion, estado, presupuesto_centavos, forma_pago, comprobante,
  fecha_visita, ultimo_contacto, fecha_inicio, entrega_estimada, fecha_entrega,
  direccion_entrega, notas, deleted_at
) on table public.proyectos to authenticated;

create policy clientes_lectura on public.clientes
  for select to authenticated
  using (household_id = any (array(select private.user_household_ids())));

create policy clientes_alta on public.clientes
  for insert to authenticated
  with check (household_id = any (array(select private.user_household_ids())));

create policy clientes_edicion on public.clientes
  for update to authenticated
  using (household_id = any (array(select private.user_household_ids())))
  with check (household_id = any (array(select private.user_household_ids())));

create policy proyectos_lectura on public.proyectos
  for select to authenticated
  using (household_id = any (array(select private.user_household_ids())));

create policy proyectos_alta on public.proyectos
  for insert to authenticated
  with check (household_id = any (array(select private.user_household_ids())));

create policy proyectos_edicion on public.proyectos
  for update to authenticated
  using (household_id = any (array(select private.user_household_ids())))
  with check (household_id = any (array(select private.user_household_ids())));
