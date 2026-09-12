-- El taller se crea con la cuenta: el registro es auto-servicio (ADR 0012).
--
-- Quien confirma su mail sale con household, membresía de titular y la fila de ajustes en cero, en
-- la misma transacción que crea la cuenta. Si algo de eso falla, falla el alta entera: no queda una
-- cuenta de Auth sin taller. Esa atomicidad es lo que elimina el estado intermedio, y por eso la
-- app no necesita una pantalla que lo explique.
--
-- Dispara al confirmar el mail y no al registrarse: con registro abierto, cada dirección inventada
-- que nunca confirma dejaría un taller vacío. No hay ventana problemática, porque sin confirmar no
-- se puede iniciar sesión: no existe una sesión abierta sin taller.

create function private.crear_taller_del_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

comment on function private.crear_taller_del_usuario() is
  'Trigger de auth.users: a la cuenta que confirma su mail le crea el taller, la membresía de titular y los ajustes en cero. Idempotente: si ya tuvo taller, no hace nada.';

revoke all on function private.crear_taller_del_usuario() from public;

-- Dos caminos, una función: el alta que ya viene confirmada (una cuenta creada desde el dashboard
-- con auto-confirmar) y la confirmación posterior del mail, que es el camino del registro público.
create trigger taller_al_crear_la_cuenta
  after insert on auth.users
  for each row
  when (new.email_confirmed_at is not null)
  execute function private.crear_taller_del_usuario();

create trigger taller_al_confirmar_el_mail
  after update of email_confirmed_at on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function private.crear_taller_del_usuario();


-- El nombre del taller lo pone el usuario ---------------------------------------------------------

-- Es el único campo de households que el cliente escribe: el trigger lo crea con un nombre
-- provisorio y la primera configuración lo reemplaza. El resto de la fila (id, metadatos, borrado)
-- sigue sin grant, y las membresías no tienen ninguno: las crea únicamente el trigger.
grant update (nombre) on table public.households to authenticated;

create policy households_edicion
  on public.households
  for update
  to authenticated
  using (id = any (array(select private.user_household_ids())))
  with check (id = any (array(select private.user_household_ids())));


-- Backfill ----------------------------------------------------------------------------------------

-- Las cuentas que se registraron antes de este cambio no pasaron por el trigger: reciben lo mismo
-- que habría creado él, su propio taller vacío. Las que todavía no confirmaron el mail lo reciben
-- al confirmar. El household del seed no tiene miembros, así que nadie queda apuntado ahí.
select private.crear_household('Mi taller', u.id)
from auth.users u
where u.email_confirmed_at is not null
  and not exists (select 1 from public.household_members m where m.user_id = u.id);
