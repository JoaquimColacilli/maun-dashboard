-- Pagos y gastos: las hijas de un proyecto. Llevan household_id aunque sea redundante contra el
-- padre: la RLS filtra sin join y el delta es un scan por índice sobre una sola tabla. La foreign
-- key compuesta (household_id, proyecto_id) garantiza que coincida con el del proyecto.

create table public.pagos (
  id uuid primary key default private.uuidv7(),
  household_id uuid not null default private.household_actual()
    references public.households (id) on delete cascade,
  proyecto_id uuid not null,
  fecha date not null,
  concepto text not null default '',
  monto_centavos bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,

  -- Compuesta a propósito: además de la consistencia del household, cierra el canal lateral de
  -- una foreign key simple, que dejaría averiguar si existe el id de un proyecto de otro household.
  constraint pagos_proyecto_fk foreign key (household_id, proyecto_id)
    references public.proyectos (household_id, id),
  constraint pagos_monto_positivo check (monto_centavos > 0),
  constraint pagos_concepto_largo check (char_length(concepto) <= 500)
);

comment on table public.pagos is
  'Cobros recibidos de un proyecto: seña, adelantos, saldo. Entran a MAUN. La distribución se calcula sobre su suma.';
comment on column public.pagos.monto_centavos is 'Importe cobrado, en centavos. Siempre positivo.';
comment on column public.pagos.deleted_at is 'Borrado lógico. No se puede tocar un pago de un proyecto cobrado.';

create index pagos_household_actualizado on public.pagos (household_id, updated_at);
create index pagos_household_proyecto on public.pagos (household_id, proyecto_id);

create trigger metadatos
  before insert or update on public.pagos
  for each row execute function private.mantener_metadatos();


create table public.gastos (
  id uuid primary key default private.uuidv7(),
  household_id uuid not null default private.household_actual()
    references public.households (id) on delete cascade,
  proyecto_id uuid not null,
  fecha date not null,
  descripcion text not null default '',
  monto_centavos bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,

  constraint gastos_proyecto_fk foreign key (household_id, proyecto_id)
    references public.proyectos (household_id, id),
  constraint gastos_monto_positivo check (monto_centavos > 0),
  constraint gastos_descripcion_largo check (char_length(descripcion) <= 500)
);

comment on table public.gastos is
  'Gastos imputados a un proyecto: materiales, herrajes, flete. Salen de MAUN y restan de la ganancia neta.';
comment on column public.gastos.monto_centavos is 'Importe gastado, en centavos. Siempre positivo.';
comment on column public.gastos.deleted_at is 'Borrado lógico. No se puede tocar un gasto de un proyecto cobrado.';

create index gastos_household_actualizado on public.gastos (household_id, updated_at);
create index gastos_household_proyecto on public.gastos (household_id, proyecto_id);

create trigger metadatos
  before insert or update on public.gastos
  for each row execute function private.mantener_metadatos();


-- El proyecto tiene que estar abierto --------------------------------------------------------------

-- Una vez cobrado, la distribución quedó calculada sobre estos pagos y gastos: tocarlos la dejaría
-- desfasada. Esta guarda es la que impide perder un cobro por una reconexión: si una mutación
-- encolada offline llega después del cobro, se rechaza y la app se lo muestra al usuario.
create function private.validar_proyecto_abierto()
returns trigger
language plpgsql
set search_path = ''
as $$
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
$$;

comment on function private.validar_proyecto_abierto() is
  'Guarda de pagos y gastos: rechaza altas y cambios sobre un proyecto cobrado (MN001) o borrado (MN002). Deja pasar el reenvío idéntico de la cola.';

revoke all on function private.validar_proyecto_abierto() from public;

create trigger validar_proyecto_abierto
  before insert or update on public.pagos
  for each row execute function private.validar_proyecto_abierto();

create trigger validar_proyecto_abierto
  before insert or update on public.gastos
  for each row execute function private.validar_proyecto_abierto();


-- Borrar un proyecto borra sus hijos, con la misma marca de tiempo para que se lea como una sola baja.
create function private.borrar_hijos_de_proyecto()
returns trigger
language plpgsql
set search_path = ''
as $$
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
$$;

revoke all on function private.borrar_hijos_de_proyecto() from public;

create trigger borrar_hijos
  after update of deleted_at on public.proyectos
  for each row
  when (new.deleted_at is not null and old.deleted_at is null)
  execute function private.borrar_hijos_de_proyecto();


-- RLS y grants ---------------------------------------------------------------------------------

alter table public.pagos enable row level security;
alter table public.gastos enable row level security;

revoke all on table public.pagos from anon, authenticated;
revoke all on table public.gastos from anon, authenticated;

grant select on table public.pagos to authenticated;
grant insert (id, proyecto_id, fecha, concepto, monto_centavos, deleted_at) on table public.pagos to authenticated;
grant update (id, proyecto_id, fecha, concepto, monto_centavos, deleted_at) on table public.pagos to authenticated;

grant select on table public.gastos to authenticated;
grant insert (id, proyecto_id, fecha, descripcion, monto_centavos, deleted_at) on table public.gastos to authenticated;
grant update (id, proyecto_id, fecha, descripcion, monto_centavos, deleted_at) on table public.gastos to authenticated;

create policy pagos_lectura on public.pagos
  for select to authenticated
  using (household_id = any (array(select private.user_household_ids())));

create policy pagos_alta on public.pagos
  for insert to authenticated
  with check (household_id = any (array(select private.user_household_ids())));

create policy pagos_edicion on public.pagos
  for update to authenticated
  using (household_id = any (array(select private.user_household_ids())))
  with check (household_id = any (array(select private.user_household_ids())));

create policy gastos_lectura on public.gastos
  for select to authenticated
  using (household_id = any (array(select private.user_household_ids())));

create policy gastos_alta on public.gastos
  for insert to authenticated
  with check (household_id = any (array(select private.user_household_ids())));

create policy gastos_edicion on public.gastos
  for update to authenticated
  using (household_id = any (array(select private.user_household_ids())))
  with check (household_id = any (array(select private.user_household_ids())));
