-- El embudo del seguimiento (ADR 0038).
--
-- Tres cosas, y ninguna fila cambia de estado ni de valor:
--
-- 1. La máquina de estados conoce el presupuesto estimativo, que agregó la migración anterior. Dentro
--    del seguimiento se va y viene entre sus cinco etapas, y desde cualquiera se aprueba. Un estimativo
--    que no avanza se da por perdido, y un perdido puede volver a estimativo. Las tres funciones son
--    las gemelas de TRANSICIONES, puedeLiquidar y puedeRevertir de @maun/domain, y el comparador las
--    verifica en las 81 combinaciones.
-- 2. La consulta de los avisos de la mañana trae también los contactos en estimativo, para que avise
--    su visita.
-- 3. Cuatro columnas booleanas en proyectos: las tareas de presupuestar (diseñar, despiezar, cotizar y
--    armar el PDF). Son tildes adentro de la etapa «a presupuestar», no estados. Nacen en false para
--    todas las filas, que es «todavía no tildado»: agregar una columna con default constante no
--    reescribe la tabla ni toca los datos que hay.
--
-- Que la visita cobrada o sin cobrar cambie lo que sigue es una sugerencia de la app, no una regla de
-- la base: el dueño pidió poder presupuestar sin haber cobrado el relevamiento. Por eso no hay ningún
-- check ni ninguna guarda que mire los pagos para dejar pasar de etapa.


-- La máquina de estados ------------------------------------------------------------------------------

create or replace function private.transicion_valida(p_desde public.estado_proyecto, p_hasta public.estado_proyecto)
returns boolean
language sql
immutable
set search_path = ''
as $$
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
$$;

create or replace function private.liquidacion_valida(p_desde public.estado_proyecto, p_hacia public.estado_proyecto)
returns boolean
language sql
immutable
set search_path = ''
as $$
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
$$;

create or replace function private.reversion_valida(p_desde public.estado_proyecto, p_hacia public.estado_proyecto)
returns boolean
language sql
immutable
set search_path = ''
as $$
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
$$;


-- Los avisos de la mañana traen también los estimativos ------------------------------------------------

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
$$;


-- Las tareas de presupuestar ---------------------------------------------------------------------------

alter table public.proyectos
  add column presupuesto_diseno boolean not null default false,
  add column presupuesto_despiece boolean not null default false,
  add column presupuesto_cotizacion boolean not null default false,
  add column presupuesto_pdf boolean not null default false;

comment on column public.proyectos.presupuesto_diseno is
  'Tarea de presupuestar: el diseño está hecho. Es una tilde adentro de la etapa «a presupuestar», no un estado (ADR 0038).';
comment on column public.proyectos.presupuesto_despiece is
  'Tarea de presupuestar: el despiece está hecho.';
comment on column public.proyectos.presupuesto_cotizacion is
  'Tarea de presupuestar: la cotización está hecha (madera y herrajes, flete, ayudante).';
comment on column public.proyectos.presupuesto_pdf is
  'Tarea de presupuestar: el PDF del presupuesto está armado. Con las cuatro tildadas, la app sugiere marcar que se mandó; el estado lo cambia el dueño.';

-- Se tildan de a una, con un update de la columna sola: dos dispositivos que tildan tareas distintas
-- sin señal no se pisan. guardar_proyecto no las escribe, así que un guardado del agregado las conserva.
grant insert (presupuesto_diseno, presupuesto_despiece, presupuesto_cotizacion, presupuesto_pdf),
  update (presupuesto_diseno, presupuesto_despiece, presupuesto_cotizacion, presupuesto_pdf)
  on table public.proyectos to authenticated;

comment on column public.proyectos.vencimiento_presupuesto is
  'Fecha límite para entregar el presupuesto de un contacto. La app la propone a cinco días hábiles del relevamiento (una semana de trabajo) cuando el contacto pasa a presupuestar, y desde el día que pasa si viene de un estimativo; se edita como la entrega estimada. La agenda la muestra mientras el contacto no mandó el presupuesto ni un estimativo.';
