-- Suscripciones a los avisos y preferencias de la persona (ADR 0036).
--
-- Una suscripción es del dispositivo, no del taller: el teléfono del dueño y la PC del taller son
-- dos filas, y los dos reciben. Por eso NO es parte de la réplica del household: no tiene
-- household_id, no entra a bootstrap() ni a delta(), y la app no la escribe por la cola de salida.
-- Es la primera escritura de la app que va por fuera de ese camino. Las dos tablas viven en private,
-- donde la API no las ve: se tocan solo por las funciones de abajo.
--
-- Las preferencias (la zona horaria, la hora y qué avisa) son de la persona: una fila por usuario,
-- que vale para todos sus dispositivos.
--
-- La migración es aditiva: no toca ninguna tabla del taller ni ninguna fila existente.


-- Tablas ------------------------------------------------------------------------------------------

create table private.suscripciones_de_avisos (
  id uuid primary key default private.uuidv7(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  creada_en timestamptz not null default now(),
  actualizada_en timestamptz not null default now(),
  ultimo_envio timestamptz,
  ultimo_dia_avisado date,

  constraint suscripciones_de_avisos_endpoint_key unique (endpoint),
  constraint suscripciones_de_avisos_endpoint_valido check (
    endpoint ~ '^https://[^[:space:]]+$' and char_length(endpoint) <= 2048
  ),
  -- Las claves que devuelve PushSubscription.toJSON(): base64url de 65 bytes (p256dh) y de 16 (auth).
  constraint suscripciones_de_avisos_claves_validas check (
    p256dh ~ '^[A-Za-z0-9_-]+=*$' and char_length(p256dh) between 80 and 100
    and auth ~ '^[A-Za-z0-9_-]+=*$' and char_length(auth) between 16 and 32
  )
);

comment on table private.suscripciones_de_avisos is
  'Una fila por dispositivo que aceptó recibir avisos. Es del dispositivo y de la persona, no del taller: no está en la réplica del household ni en la cola de salida (ADR 0036).';
comment on column private.suscripciones_de_avisos.user_id is
  'Quién recibe en este dispositivo. Registrar el mismo endpoint desde otra cuenta lo reasigna: si no, los avisos del anterior le seguirían llegando.';
comment on column private.suscripciones_de_avisos.endpoint is
  'La URL del servicio de push del navegador. Identifica al dispositivo: es única.';
comment on column private.suscripciones_de_avisos.ultimo_envio is 'Cuándo salió el último aviso a este dispositivo.';
comment on column private.suscripciones_de_avisos.ultimo_dia_avisado is
  'El día, en la zona horaria de la persona, del último aviso de la mañana. Evita mandar dos veces el mismo día.';

create index suscripciones_de_avisos_usuario on private.suscripciones_de_avisos (user_id);

alter table private.suscripciones_de_avisos enable row level security;
revoke all on table private.suscripciones_de_avisos from public, anon, authenticated, service_role;


create function private.avisos_bien_formados(p_avisos jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
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
$$;

comment on function private.avisos_bien_formados(jsonb) is
  'Qué avisa y con cuánta anticipación: las cuatro claves de AVISOS_DE_LA_AGENDA de @maun/domain, cada una con activo y una anticipación de 0 a 3 días.';

revoke all on function private.avisos_bien_formados(jsonb) from public, anon, authenticated;


create table private.preferencias_de_avisos (
  user_id uuid primary key references auth.users (id) on delete cascade,
  zona text not null,
  hora time not null default '07:30',
  avisos jsonb not null default '{
    "entregas": {"activo": true, "anticipacion": 2},
    "visitas": {"activo": true, "anticipacion": 1},
    "presupuestos": {"activo": true, "anticipacion": 1},
    "anotaciones": {"activo": false, "anticipacion": 0}
  }'::jsonb,
  actualizada_en timestamptz not null default now(),

  constraint preferencias_de_avisos_forma check (private.avisos_bien_formados(avisos))
);

comment on table private.preferencias_de_avisos is
  'A qué hora y en qué zona horaria recibe la persona el aviso de la mañana, y qué incluye. Vale para todos sus dispositivos.';
comment on column private.preferencias_de_avisos.zona is
  'Nombre IANA de la zona horaria (America/Argentina/Buenos_Aires). Se le pregunta a la persona: el que manda es un servidor, que no puede saber la hora local de nadie. No tiene default a propósito.';
comment on column private.preferencias_de_avisos.hora is 'Hora local, en esa zona, del aviso de la mañana.';
comment on column private.preferencias_de_avisos.avisos is
  'Qué avisa y con cuánta anticipación. El default es PREFERENCIAS_INICIALES de @maun/domain.';

alter table private.preferencias_de_avisos enable row level security;
revoke all on table private.preferencias_de_avisos from public, anon, authenticated, service_role;


-- Lo que ve la persona ------------------------------------------------------------------------------

-- Recibe el usuario por parámetro, así que no la puede ejecutar nadie más que las funciones de
-- abajo: con execute, cualquiera leería el estado de otro.
create function private.estado_de_los_avisos(p_usuario uuid, p_endpoint text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
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
$$;

comment on function private.estado_de_los_avisos(uuid, text) is
  'Si este dispositivo recibe avisos, cuándo salió el último, cuántos dispositivos tiene la persona y sus preferencias. Solo la llaman las funciones de avisos.';

revoke all on function private.estado_de_los_avisos(uuid, text) from public, anon, authenticated;


create function private.validar_zona(p_zona text)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_zona is null or not exists (select 1 from pg_catalog.pg_timezone_names where name = p_zona) then
    raise exception 'La zona horaria no existe' using errcode = '22023';
  end if;
end;
$$;

revoke all on function private.validar_zona(text) from public, anon, authenticated;


-- security definer: escribe en tablas sobre las que authenticated no tiene ningún grant, y reasigna
-- una fila que puede ser de otro usuario. Por eso toma el usuario de la sesión y no de un parámetro.
create function private.registrar_suscripcion(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_zona text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

comment on function private.registrar_suscripcion(text, text, text, text) is
  'Registra este dispositivo para el usuario de la sesión, reasignándolo si era de otra cuenta, y guarda la zona horaria que eligió la persona.';

revoke all on function private.registrar_suscripcion(text, text, text, text) from public, anon, authenticated;
grant execute on function private.registrar_suscripcion(text, text, text, text) to authenticated;


create function private.dar_de_baja_suscripcion(p_endpoint text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from private.suscripciones_de_avisos
  where endpoint = p_endpoint
    and user_id = (select auth.uid());
  return found;
end;
$$;

comment on function private.dar_de_baja_suscripcion(text) is
  'Borra este dispositivo si es del usuario de la sesión. Un endpoint de otra cuenta no se toca.';

revoke all on function private.dar_de_baja_suscripcion(text) from public, anon, authenticated;
grant execute on function private.dar_de_baja_suscripcion(text) to authenticated;


create function private.estado_de_mis_avisos(p_endpoint text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.estado_de_los_avisos((select auth.uid()), p_endpoint)
$$;

revoke all on function private.estado_de_mis_avisos(text) from public, anon, authenticated;
grant execute on function private.estado_de_mis_avisos(text) to authenticated;


create function private.guardar_preferencias_de_avisos(p_zona text, p_hora time, p_avisos jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

comment on function private.guardar_preferencias_de_avisos(text, time, jsonb) is
  'Guarda la zona horaria, la hora y qué avisa, para el usuario de la sesión.';

revoke all on function private.guardar_preferencias_de_avisos(text, time, jsonb) from public, anon, authenticated;
grant execute on function private.guardar_preferencias_de_avisos(text, time, jsonb) to authenticated;


-- Los envoltorios de la API -------------------------------------------------------------------------

create function public.registrar_suscripcion(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_zona text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.registrar_suscripcion(p_endpoint, p_p256dh, p_auth, p_zona)
$$;

comment on function public.registrar_suscripcion(text, text, text, text) is
  'Activa los avisos en este dispositivo. No pasa por la cola de salida: sin señal no se puede suscribir a un servicio de push de todas formas.';

revoke all on function public.registrar_suscripcion(text, text, text, text) from public, anon, authenticated;
grant execute on function public.registrar_suscripcion(text, text, text, text) to authenticated;

create function public.dar_de_baja_suscripcion(p_endpoint text)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  select private.dar_de_baja_suscripcion(p_endpoint)
$$;

comment on function public.dar_de_baja_suscripcion(text) is 'Apaga los avisos en este dispositivo.';

revoke all on function public.dar_de_baja_suscripcion(text) from public, anon, authenticated;
grant execute on function public.dar_de_baja_suscripcion(text) to authenticated;

create function public.estado_de_mis_avisos(p_endpoint text default null)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.estado_de_mis_avisos(p_endpoint)
$$;

comment on function public.estado_de_mis_avisos(text) is
  'Si este dispositivo recibe avisos y las preferencias de la persona. preferencias es null hasta que activa los avisos por primera vez.';

revoke all on function public.estado_de_mis_avisos(text) from public, anon, authenticated;
grant execute on function public.estado_de_mis_avisos(text) to authenticated;

create function public.guardar_preferencias_de_avisos(p_zona text, p_hora time, p_avisos jsonb)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.guardar_preferencias_de_avisos(p_zona, p_hora, p_avisos)
$$;

comment on function public.guardar_preferencias_de_avisos(text, time, jsonb) is
  'Cambia la zona horaria, la hora y qué avisa.';

revoke all on function public.guardar_preferencias_de_avisos(text, time, jsonb) from public, anon, authenticated;
grant execute on function public.guardar_preferencias_de_avisos(text, time, jsonb) to authenticated;
