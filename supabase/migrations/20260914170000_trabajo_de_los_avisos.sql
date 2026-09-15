-- El trabajo programado que manda los avisos de la mañana (ADR 0036).
--
-- pg_cron corre cada quince minutos y le pide a la función de borde que mande. La cuenta de a quién
-- le toca la hace la base: el que manda es un servidor sin navegador y no sabe qué hora es en la
-- casa de nadie. Postgres sí sabe de husos, y cada persona guardó el nombre de su zona horaria.
--
-- Es un recordatorio de mejor esfuerzo. El programador puede saltear una vuelta sin reintentarla ni
-- avisar, y en el plan gratuito el proyecto se pausa a los siete días sin actividad y los avisos se
-- cortan en silencio. Por eso la ventana es de tres horas desde la hora elegida (una vuelta salteada
-- la toma la siguiente) y la app dice que lo que manda es la agenda, no el aviso.
--
-- La migración es aditiva: instala dos extensiones, crea funciones y agenda un trabajo. No toca filas.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;


-- A quién le toca, y con qué datos --------------------------------------------------------------

create function private.avisos_por_mandar(p_ahora timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
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
              and p.estado in ('contacto', 'relevamiento', 'a_presupuestar', 'presupuesto_enviado', 'en_curso')
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
$$;

comment on function private.avisos_por_mandar(timestamptz) is
  'Los dispositivos a los que les toca el aviso de la mañana en este momento, según la zona horaria y la hora de cada persona, con los datos de su taller que necesita la agenda. Qué avisar lo decide eventosParaAvisar de @maun/domain en la función de borde, no esta consulta.';

revoke all on function private.avisos_por_mandar(timestamptz) from public, anon, authenticated;
grant execute on function private.avisos_por_mandar(timestamptz) to service_role;

create function public.avisos_por_mandar(p_ahora timestamptz default now())
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.avisos_por_mandar(p_ahora)
$$;

comment on function public.avisos_por_mandar(timestamptz) is
  'Solo para la función de borde de los avisos (service_role).';

revoke all on function public.avisos_por_mandar(timestamptz) from public, anon, authenticated;
grant execute on function public.avisos_por_mandar(timestamptz) to service_role;


-- El pedido a la función de borde ------------------------------------------------------------------

-- La URL de la función y el secreto viven en Vault, no en el repo. Sin ellos, el trabajo no hace nada.
create function private.pedir_los_avisos()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

comment on function private.pedir_los_avisos() is
  'Le pide a la función de borde que mande los avisos que tocan. La llama pg_cron. Sin avisos_url y avisos_secreto en Vault devuelve null y no pide nada.';

revoke all on function private.pedir_los_avisos() from public, anon, authenticated;


-- El trabajo ------------------------------------------------------------------------------------------

select cron.unschedule(jobid) from cron.job where jobname = 'avisos-de-la-manana';

select cron.schedule('avisos-de-la-manana', '*/15 * * * *', 'select private.pedir_los_avisos()');
