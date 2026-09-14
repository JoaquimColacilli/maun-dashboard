-- Lo que usa la función de borde que manda los avisos (ADR 0036).
--
-- La función corre en el servidor con la clave del servidor: no hay un usuario en la sesión. Estas
-- funciones son solo para service_role. Qué avisar no se decide acá: lo decide @maun/domain, con la
-- misma función que arma la agenda.
--
-- La migración es aditiva: no toca ninguna tabla del taller ni ninguna fila existente.

grant usage on schema private to service_role;


create function private.suscripciones_para_probar(p_usuario uuid, p_endpoint text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
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
$$;

comment on function private.suscripciones_para_probar(uuid, text) is
  'Los dispositivos de una persona, o uno solo si se pasa el endpoint, para mandarles el aviso de prueba. El usuario lo validó la función de borde con su token.';

revoke all on function private.suscripciones_para_probar(uuid, text) from public, anon, authenticated;
grant execute on function private.suscripciones_para_probar(uuid, text) to service_role;


create function private.anotar_aviso(p_suscripcion uuid, p_dia date, p_mandado boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update private.suscripciones_de_avisos
  set ultimo_dia_avisado = greatest(coalesce(ultimo_dia_avisado, p_dia), p_dia),
      ultimo_envio = case when p_mandado then now() else ultimo_envio end
  where id = p_suscripcion;
  return found;
end;
$$;

comment on function private.anotar_aviso(uuid, date, boolean) is
  'Anota que el día ya se miró para ese dispositivo, y si además salió un aviso, cuándo. Un día sin nada que avisar también se anota: si no, se volvería a mirar en cada vuelta del trabajo.';

revoke all on function private.anotar_aviso(uuid, date, boolean) from public, anon, authenticated;
grant execute on function private.anotar_aviso(uuid, date, boolean) to service_role;


create function private.borrar_suscripcion_vencida(p_endpoint text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from private.suscripciones_de_avisos where endpoint = p_endpoint;
  return found;
end;
$$;

comment on function private.borrar_suscripcion_vencida(text) is
  'El servicio de push contestó 404 o 410: esa suscripción ya no existe. Sin borrarla la tabla crece para siempre y cada envío hace trabajo muerto.';

revoke all on function private.borrar_suscripcion_vencida(text) from public, anon, authenticated;
grant execute on function private.borrar_suscripcion_vencida(text) to service_role;


create function public.suscripciones_para_probar(p_usuario uuid, p_endpoint text default null)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.suscripciones_para_probar(p_usuario, p_endpoint)
$$;

comment on function public.suscripciones_para_probar(uuid, text) is
  'Solo para la función de borde de los avisos (service_role).';

revoke all on function public.suscripciones_para_probar(uuid, text) from public, anon, authenticated;
grant execute on function public.suscripciones_para_probar(uuid, text) to service_role;

create function public.anotar_aviso(p_suscripcion uuid, p_dia date, p_mandado boolean)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  select private.anotar_aviso(p_suscripcion, p_dia, p_mandado)
$$;

comment on function public.anotar_aviso(uuid, date, boolean) is
  'Solo para la función de borde de los avisos (service_role).';

revoke all on function public.anotar_aviso(uuid, date, boolean) from public, anon, authenticated;
grant execute on function public.anotar_aviso(uuid, date, boolean) to service_role;

create function public.borrar_suscripcion_vencida(p_endpoint text)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  select private.borrar_suscripcion_vencida(p_endpoint)
$$;

comment on function public.borrar_suscripcion_vencida(text) is
  'Solo para la función de borde de los avisos (service_role).';

revoke all on function public.borrar_suscripcion_vencida(text) from public, anon, authenticated;
grant execute on function public.borrar_suscripcion_vencida(text) to service_role;
