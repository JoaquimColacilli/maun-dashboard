-- El aviso de la mañana también dice a quién le toca volver a escribirle (ADR 0064).
--
-- Las preferencias de avisos suman una quinta clave, seguimientos, prendida y para el mismo día. Las
-- filas que ya existen quedan como están: con cuatro claves siguen siendo válidas, y quien las lee
-- (la pantalla de avisos y el aviso de la mañana) les completa la quinta con el valor inicial. Así
-- ninguna fila cambia, y un bundle viejo que guarda cuatro claves no rebota.
--
-- Es aditiva: reemplaza funciones y cambia el default de una columna, que no toca las filas que ya
-- están.

create or replace function private.avisos_bien_formados(p_avisos jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    jsonb_typeof(p_avisos) = 'object'
    and (select array_agg(clave order by clave) from jsonb_object_keys(p_avisos) as clave) in (
      array['anotaciones', 'entregas', 'presupuestos', 'visitas'],
      array['anotaciones', 'entregas', 'presupuestos', 'seguimientos', 'visitas']
    )
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
  'Qué avisa y con cuánta anticipación: las claves de AVISOS_DE_LA_AGENDA de @maun/domain, cada una con activo y una anticipación de 0 a 3 días. Acepta también la forma de antes, sin seguimientos, para que un bundle viejo no rebote: quien la lee le completa esa clave con avisos_completos.';

create function private.avisos_completos(p_avisos jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object('seguimientos', jsonb_build_object('activo', true, 'anticipacion', 0))
    || p_avisos
$$;

comment on function private.avisos_completos(jsonb) is
  'Las preferencias de avisos con todas las claves: a las que se guardaron antes de que existiera seguimientos les agrega esa clave con su valor inicial (prendido, el mismo día), sin reescribir la fila. Gemela de PREFERENCIAS_INICIALES de @maun/domain para esa clave.';

revoke all on function private.avisos_completos(jsonb) from public, anon, authenticated;

alter table private.preferencias_de_avisos alter column avisos set default '{
  "entregas": {"activo": true, "anticipacion": 2},
  "visitas": {"activo": true, "anticipacion": 1},
  "presupuestos": {"activo": true, "anticipacion": 1},
  "seguimientos": {"activo": true, "anticipacion": 0},
  "anotaciones": {"activo": false, "anticipacion": 0}
}'::jsonb;

create or replace function private.estado_de_los_avisos(p_usuario uuid, p_endpoint text)
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
      select jsonb_build_object(
        'zona', p.zona,
        'hora', to_char(p.hora, 'HH24:MI'),
        'avisos', private.avisos_completos(p.avisos)
      )
      from private.preferencias_de_avisos p
      where p.user_id = p_usuario
    )
  )
$$;

create or replace function private.avisos_por_mandar(p_ahora timestamptz)
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
        'preferencias', private.avisos_completos(d.avisos),
        'filas', jsonb_build_object(
          'proyectos', (
            select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb)
            from public.proyectos p
            where p.household_id = d.household_id
              and p.deleted_at is null
              and p.estado in (
                'contacto', 'presupuesto_estimativo', 'relevamiento', 'a_presupuestar', 'presupuesto_enviado',
                'en_seguimiento', 'en_curso'
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
          ),
          -- A quién le toca volver a escribirle: los contactos pendientes de los próximos días. Lo
          -- registrado ya no se avisa.
          'proximos_contactos', (
            select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb)
            from public.proximos_contactos c
            where c.household_id = d.household_id
              and c.deleted_at is null
              and c.hecho_el is null
              and c.fecha between d.dia and d.dia + 3
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
  'Los dispositivos a los que les toca el aviso de la mañana en este momento, según la zona horaria y la hora de cada persona, con los datos de su taller que necesita la agenda: los trabajos, los clientes, las anotaciones y los contactos en seguimiento pendientes. Qué avisar lo decide eventosParaAvisar de @maun/domain en la función de borde, no esta consulta.';
