-- Households y membresías: el contenedor de aislamiento y los helpers que usan todas las policies.

create table public.households (
  id uuid primary key default private.uuidv7(),
  nombre text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,

  constraint households_nombre_valido check (btrim(nombre) <> '' and char_length(nombre) <= 120)
);

comment on table public.households is
  'Contenedor de aislamiento multi-tenant. Toda fila de negocio pertenece a un household y la RLS filtra por él.';
comment on column public.households.updated_at is 'Lo mantiene private.mantener_metadatos(). Es la marca que usa public.delta().';
comment on column public.households.deleted_at is 'Borrado lógico. Un household borrado deja de dar acceso a sus miembros.';
comment on column public.households.version is 'Contador de cambios de la fila, mantenido por trigger. Base del control de concurrencia en las operaciones de plata.';


create table public.household_members (
  id uuid primary key default private.uuidv7(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  rol public.rol_household not null default 'miembro',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,

  -- user_id primero: este índice cubre además la foreign key a auth.users.
  constraint household_members_usuario_household_key unique (user_id, household_id)
);

comment on table public.household_members is
  'Pertenencia de un usuario de Auth a un household. Es la única fuente del household de un usuario: el cliente nunca lo manda.';
comment on column public.household_members.deleted_at is 'Borrado lógico: una membresía borrada no da acceso.';

-- Un usuario pertenece a un solo household activo. Simplifica todo lo demás: el household de la
-- sesión no es ambiguo y puede ser el default de household_id. Si algún día hace falta que alguien
-- vea dos talleres, se levanta este índice y se revisa private.household_actual().
create unique index household_members_un_household_por_usuario
  on public.household_members (user_id)
  where deleted_at is null;

-- Acceso de public.delta(): household y rango de updated_at.
create index household_members_household_actualizado
  on public.household_members (household_id, updated_at);

create trigger metadatos
  before insert or update on public.households
  for each row execute function private.mantener_metadatos();

create trigger metadatos
  before insert or update on public.household_members
  for each row execute function private.mantener_metadatos();


-- Helpers de RLS -------------------------------------------------------------------------------

-- security definer: lee household_members salteando su propia RLS. Sin esto, la policy de
-- household_members se llamaría a sí misma.
create function private.user_household_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.household_id
  from public.household_members m
  join public.households h on h.id = m.household_id
  where m.user_id = (select auth.uid())
    and m.deleted_at is null
    and h.deleted_at is null
$$;

comment on function private.user_household_ids() is
  'Households a los que pertenece el usuario de la sesión. Vacío si no hay sesión: auth.uid() es null y no matchea nada.';

revoke all on function private.user_household_ids() from public;
grant execute on function private.user_household_ids() to authenticated;


create function private.household_actual()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
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
$$;

comment on function private.household_actual() is
  'Household del usuario de la sesión. Es el default de household_id en todas las tablas: el cliente no lo manda nunca.';

revoke all on function private.household_actual() from public;
grant execute on function private.household_actual() to authenticated;


-- RLS y grants ---------------------------------------------------------------------------------

alter table public.households enable row level security;
alter table public.household_members enable row level security;

revoke all on table public.households from anon, authenticated;
revoke all on table public.household_members from anon, authenticated;

-- Los households y las membresías se crean con private.crear_household(), nunca desde el cliente.
grant select on table public.households to authenticated;
grant select on table public.household_members to authenticated;

-- Todas las policies usan "= any (array(select ...))" y no "in (select ...)". En una policy, el
-- "in (subconsulta)" queda como un filtro de hash que Postgres no puede usar como condición de
-- índice: cada consulta leería las filas de todos los households. El array se calcula una vez por
-- consulta (initPlan) y "= any" sí entra en el índice (household_id, ...).
create policy households_lectura_miembros
  on public.households
  for select
  to authenticated
  using (id = any (array(select private.user_household_ids())));

create policy household_members_lectura_miembros
  on public.household_members
  for select
  to authenticated
  using (household_id = any (array(select private.user_household_ids())));
