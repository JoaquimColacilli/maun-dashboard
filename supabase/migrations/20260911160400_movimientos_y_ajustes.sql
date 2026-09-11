-- Movimientos cargados a mano, ajustes del household y el alta de un household nuevo.

-- Un movimiento mueve plata de un lado a otro. Null en un lado es "afuera": un ingreso entra desde
-- afuera, un gasto sale hacia afuera. Así toda fila tiene su contrapartida explícita (ADR 0003) y
-- una transferencia es una sola fila, no dos que se pueden desfasar.
create table public.movimientos (
  id uuid primary key default private.uuidv7(),
  household_id uuid not null default private.household_actual()
    references public.households (id) on delete cascade,
  fecha date not null,
  tipo public.tipo_movimiento not null,
  tesoro_origen public.tesoro,
  tesoro_destino public.tesoro,
  monto_centavos bigint not null,
  categoria text not null default '',
  descripcion text not null default '',
  proyecto_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,

  -- MATCH SIMPLE: con proyecto_id null la foreign key no se evalúa.
  constraint movimientos_proyecto_fk foreign key (household_id, proyecto_id)
    references public.proyectos (household_id, id),
  constraint movimientos_monto_positivo check (monto_centavos > 0),
  constraint movimientos_lados_distintos check (
    num_nonnulls(tesoro_origen, tesoro_destino) >= 1
    and tesoro_origen is distinct from tesoro_destino
  ),
  -- El coalesce no es decorativo: un check que da null pasa, y "tesoro_destino = 'cocos'" da null
  -- cuando el destino falta.
  constraint movimientos_forma_segun_tipo check (
    coalesce(
      case tipo
        when 'ingreso' then tesoro_origen is null and tesoro_destino is not null
        when 'gasto' then tesoro_origen is not null and tesoro_destino is null
        when 'transferencia' then tesoro_origen is not null and tesoro_destino is not null
        when 'pago_diezmo' then tesoro_origen = 'diezmo' and tesoro_destino is null
        when 'aporte_cocos' then tesoro_origen is not null and tesoro_destino = 'cocos'
        when 'ajuste' then num_nonnulls(tesoro_origen, tesoro_destino) = 1
      end,
      false
    )
  ),
  constraint movimientos_largos check (char_length(categoria) <= 200 and char_length(descripcion) <= 500)
);

comment on table public.movimientos is
  'Movimientos cargados a mano. Los derivados de proyectos (pagos, gastos y distribución) no se guardan acá: los arma la vista libro_mayor.';
comment on column public.movimientos.tesoro_origen is 'De dónde sale la plata. Null: viene de afuera (un ingreso).';
comment on column public.movimientos.tesoro_destino is 'A dónde va la plata. Null: se va afuera (un gasto).';
comment on column public.movimientos.monto_centavos is 'Importe en centavos, siempre positivo: el sentido lo dan origen y destino.';
comment on column public.movimientos.categoria is 'Categoría libre para agrupar: Supermercado, Servicios, Alquiler del taller.';
comment on column public.movimientos.proyecto_id is 'Opcional: un movimiento manual atribuible a un proyecto, por ejemplo un ajuste sobre una distribución cerrada.';

create index movimientos_household_actualizado on public.movimientos (household_id, updated_at);
create index movimientos_household_proyecto on public.movimientos (household_id, proyecto_id);

create trigger metadatos
  before insert or update on public.movimientos
  for each row execute function private.mantener_metadatos();


create table public.ajustes (
  id uuid primary key default private.uuidv7(),
  household_id uuid not null default private.household_actual()
    references public.households (id) on delete cascade,
  sueldo_mensual_centavos bigint not null default 0,
  costos_fijos_centavos bigint not null default 0,
  meta_cocos_centavos bigint not null default 0,
  tasa_cocos_anual_bp integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,

  -- Una fila por household. Este índice único también sirve a la RLS y al delta: con una sola fila
  -- por household, un índice (household_id, updated_at) no agregaría nada.
  constraint ajustes_household_key unique (household_id),
  constraint ajustes_importes_no_negativos check (
    sueldo_mensual_centavos >= 0 and costos_fijos_centavos >= 0 and meta_cocos_centavos >= 0
  ),
  constraint ajustes_tasa_valida check (tasa_cocos_anual_bp between 0 and 100000)
);

comment on table public.ajustes is
  'Parámetros del household: una fila por household, creada con él. Cambiarlos no reescribe las distribuciones ya congeladas.';
comment on column public.ajustes.sueldo_mensual_centavos is 'Sueldo que el taller le paga al hogar: tope del escalón de sueldo de la cascada.';
comment on column public.ajustes.costos_fijos_centavos is 'Costos fijos mensuales del taller: tope del escalón de fijos de la cascada.';
comment on column public.ajustes.meta_cocos_centavos is 'Meta de ahorro en Cocos.';
comment on column public.ajustes.tasa_cocos_anual_bp is 'Tasa anual estimada de Cocos, en puntos básicos (4000 = 40%). Solo para proyectar.';

create trigger metadatos
  before insert or update on public.ajustes
  for each row execute function private.mantener_metadatos();


-- Alta de un household ---------------------------------------------------------------------------

-- La corre el dueño de la base (script o seed), nunca un usuario: no tiene grant para nadie.
create function private.crear_household(p_nombre text, p_user_id uuid)
returns uuid
language plpgsql
set search_path = ''
as $$
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
$$;

comment on function private.crear_household(text, uuid) is
  'Crea un household con sus ajustes y, si se pasa un usuario, lo suma como titular. Solo la ejecuta el dueño de la base.';

revoke all on function private.crear_household(text, uuid) from public;


-- RLS y grants ---------------------------------------------------------------------------------

alter table public.movimientos enable row level security;
alter table public.ajustes enable row level security;

revoke all on table public.movimientos from anon, authenticated;
revoke all on table public.ajustes from anon, authenticated;

grant select on table public.movimientos to authenticated;
grant insert (
  id, fecha, tipo, tesoro_origen, tesoro_destino, monto_centavos, categoria, descripcion,
  proyecto_id, deleted_at
) on table public.movimientos to authenticated;
grant update (
  id, fecha, tipo, tesoro_origen, tesoro_destino, monto_centavos, categoria, descripcion,
  proyecto_id, deleted_at
) on table public.movimientos to authenticated;

-- Los ajustes nacen con el household: el usuario solo los edita.
grant select on table public.ajustes to authenticated;
grant update (
  sueldo_mensual_centavos, costos_fijos_centavos, meta_cocos_centavos, tasa_cocos_anual_bp
) on table public.ajustes to authenticated;

create policy movimientos_lectura on public.movimientos
  for select to authenticated
  using (household_id = any (array(select private.user_household_ids())));

create policy movimientos_alta on public.movimientos
  for insert to authenticated
  with check (household_id = any (array(select private.user_household_ids())));

create policy movimientos_edicion on public.movimientos
  for update to authenticated
  using (household_id = any (array(select private.user_household_ids())))
  with check (household_id = any (array(select private.user_household_ids())));

create policy ajustes_lectura on public.ajustes
  for select to authenticated
  using (household_id = any (array(select private.user_household_ids())));

create policy ajustes_edicion on public.ajustes
  for update to authenticated
  using (household_id = any (array(select private.user_household_ids())))
  with check (household_id = any (array(select private.user_household_ids())));
