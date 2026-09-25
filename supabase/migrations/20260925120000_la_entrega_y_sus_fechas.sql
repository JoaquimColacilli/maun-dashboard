-- La entrega y sus fechas (ADR 0071).
--
-- Hasta acá un trabajo tenía una sola fecha prometida, entrega_estimada, que el formulario, el pase a
-- Proyectos y la agenda pisaban sin dejar historia, y nada decía que el mueble ya estaba terminado.
-- Desde acá cada fecha tiene un solo significado y los hechos se anotan con su día:
--
-- - entrega_estimada es la que calcula el taller, y puede moverse;
-- - entrega_comprometida, con su franja, es el día que se acordó con el cliente;
-- - fecha_entrega es el día en que se entregó;
-- - listo_el es el día en que se terminó de fabricar. Es un hecho, no un estado nuevo.
--
-- Suma el tipo de proyecto (un texto libre para agrupar en el analítico de entregas), las propuestas
-- de entrega que el taller le hace al cliente, lo que el cliente contesta, y la historia de las
-- fechas, que escribe la base con cuántos trabajos había en curso cada vez.
--
-- Aditiva: cuatro columnas nullable en proyectos, con checks que miran columnas nuevas (todas en
-- null), cinco tipos, tres tablas y sus triggers, y el reemplazo de cinco funciones con la misma
-- firma, que conservan sus grants. La siembra escribe filas en una tabla nueva. Ninguna fila
-- existente cambia de valor.


-- Los tipos ---------------------------------------------------------------------------------------------

create type public.franja_de_entrega as enum ('manana', 'tarde');

comment on type public.franja_de_entrega is
  'La franja de una entrega: a la mañana o a la tarde. Así coordinan las entregas las mueblerías de acá; lo que haga falta afinar va en la nota del cliente (ADR 0071).';

create type public.forma_de_coordinar as enum ('un_dia', 'sus_dias');

comment on type public.forma_de_coordinar is
  'Cómo le pide el taller el día de la entrega al cliente: proponiéndole un día (un_dia), que el cliente acepta con un botón, o pidiéndole que marque los días y las franjas que le quedan bien (sus_dias).';

create type public.respuesta_de_entrega as enum ('me_queda_bien', 'mis_dias');

comment on type public.respuesta_de_entrega is
  'Lo que contestó el cliente a una propuesta de entrega: que el día propuesto le queda bien, o los días y franjas que le quedan bien a él.';

create type public.tipo_de_fecha as enum ('estimada', 'comprometida');

comment on type public.tipo_de_fecha is
  'Qué fecha cambió en la historia de un trabajo: la estimada, que calcula el taller, o la comprometida, que se acordó con el cliente. La real no está: es fecha_entrega y se anota una vez.';

create type public.origen_de_la_fecha as enum ('taller', 'cliente', 'importada');

comment on type public.origen_de_la_fecha is
  'Quién fijó una fecha de la historia: el taller, el cliente desde su página (aceptando el día propuesto), o importada, que es la que ya estaba cargada el día que empezó a guardarse la historia.';


-- Las columnas del trabajo -------------------------------------------------------------------------------

alter table public.proyectos
  add column listo_el date,
  add column entrega_comprometida date,
  add column entrega_comprometida_franja public.franja_de_entrega,
  add column tipo_de_proyecto text,
  -- La franja va con su día: una franja suelta no es un acuerdo.
  add constraint proyectos_franja_con_su_dia
    check (entrega_comprometida_franja is null or entrega_comprometida is not null),
  -- Antes de aprobar no hay nada terminado ni acordado. La guarda de abajo lo limpia al volver a una
  -- consulta; este check es la red.
  add constraint proyectos_la_entrega_desde_aprobado
    check (
      (listo_el is null and entrega_comprometida is null)
      or estado in ('en_curso', 'entregado', 'cobrado', 'perdido')
    ),
  -- Un mueble no se entrega antes de estar terminado.
  add constraint proyectos_listo_antes_de_entregar
    check (listo_el is null or fecha_entrega is null or listo_el <= fecha_entrega),
  add constraint proyectos_tipo_de_proyecto_valido
    check (
      tipo_de_proyecto is null
      or (char_length(tipo_de_proyecto) between 1 and 60 and tipo_de_proyecto = btrim(tipo_de_proyecto))
    );

comment on column public.proyectos.entrega_estimada is
  'La entrega estimada: la fecha probable que calcula el taller, a 21 días hábiles del inicio por defecto, y que puede moverse. No es un acuerdo con el cliente: eso es entrega_comprometida. Mientras el trabajo está en curso, cada cambio queda en public.cambios_de_fecha con cuántos trabajos había en curso ese día, y el analítico mide contra la primera (ADR 0071).';

comment on column public.proyectos.fecha_entrega is
  'La entrega real: el día en que se entregó. La escribe «Ya lo entregué» con el día de hoy y «Volvió al taller» la borra. Con el trabajo en curso vale null siempre: la guarda private.cuidar_las_fechas_de_la_entrega() limpia la que quede de antes (ADR 0071).';

comment on column public.proyectos.listo_el is
  'El día en que se terminó de fabricar, o null si todavía no está listo. Es un hecho con su día, no un estado: lo anota «Ya está listo» y lo borra «Todavía no está listo». Solo existe con el trabajo aprobado, y nunca después de la entrega. Viaja a la vista del cliente como fechas.listo (ADR 0071).';

comment on column public.proyectos.entrega_comprometida is
  'La entrega comprometida: el día que se acordó con el cliente, porque el dueño lo confirmó o porque el cliente aceptó el día que le propusieron. Existe con el trabajo aprobado; volver a una consulta la limpia. Mientras el trabajo está en curso viaja a la vista del cliente, que la lee como «Entrega confirmada». Cada cambio queda en public.cambios_de_fecha (ADR 0071).';

comment on column public.proyectos.entrega_comprometida_franja is
  'A la mañana o a la tarde, si la entrega comprometida tiene franja. Solo con su día (ADR 0071).';

comment on column public.proyectos.tipo_de_proyecto is
  'Qué clase de trabajo es («Cocina», «Placard»), en palabras del dueño: un texto libre de 1 a 60 caracteres, sin espacios en los bordes, o null. Agrupa el analítico de entregas sin mayúsculas ni acentos. No viaja al cliente (ADR 0071).';

grant insert (listo_el, entrega_comprometida, entrega_comprometida_franja, tipo_de_proyecto),
      update (listo_el, entrega_comprometida, entrega_comprometida_franja, tipo_de_proyecto)
  on public.proyectos to authenticated;


-- La coherencia de las fechas de la entrega -----------------------------------------------------------------

create function private.cuidar_las_fechas_de_la_entrega()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Antes de aprobar no hay nada terminado ni acordado: volver a presupuesto, o reactivar un perdido,
  -- se lleva el listo y la comprometida. La historia de la comprometida queda en cambios_de_fecha.
  if new.estado in (
    'contacto', 'presupuesto_estimativo', 'relevamiento', 'a_presupuestar', 'presupuesto_enviado',
    'en_seguimiento'
  ) then
    new.listo_el := null;
    new.entrega_comprometida := null;
  end if;

  -- En curso todavía no se entregó. La entrega vieja que el formulario reenvía sin mostrarla, o la que
  -- quedó de antes de volver al taller, no puede quedar como si hubiera pasado.
  if new.estado = 'en_curso' then
    new.fecha_entrega := null;
  end if;

  -- La franja va con su día: sacar la comprometida se la lleva.
  if new.entrega_comprometida is null then
    new.entrega_comprometida_franja := null;
  end if;

  return new;
end;
$$;

comment on function private.cuidar_las_fechas_de_la_entrega() is
  'Guarda de proyectos, antes de escribir y venga de donde venga el cambio (la ficha, el formulario, reactivar un perdido): un trabajo en una etapa de antes de aprobar no tiene listo ni entrega comprometida, uno en curso no tiene fecha de entrega, y la franja no queda sin su día. Corre antes que private.mantener_metadatos(), así un reenvío que solo difiere en lo que esto limpia sigue siendo un no-op (ADR 0071).';

revoke all on function private.cuidar_las_fechas_de_la_entrega() from public, anon, authenticated;

-- El nombre la ordena antes que metadatos y que validar_proyecto: Postgres corre los triggers de un
-- mismo momento por orden alfabético.
create trigger cuidar_las_fechas_de_la_entrega
  before insert or update on public.proyectos
  for each row execute function private.cuidar_las_fechas_de_la_entrega();


-- Lo que el taller le pide al cliente ------------------------------------------------------------------------

create table public.propuestas_de_entrega (
  id uuid primary key default private.uuidv7(),
  household_id uuid not null default private.household_actual()
    references public.households (id) on delete cascade,
  proyecto_id uuid not null,
  forma public.forma_de_coordinar not null,
  fecha date,
  franja public.franja_de_entrega,
  cerrada_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,

  constraint propuestas_de_entrega_proyecto_fk foreign key (household_id, proyecto_id)
    references public.proyectos (household_id, id),
  -- La que respalda la foreign key de las respuestas: una respuesta es de una propuesta de su trabajo.
  constraint propuestas_de_entrega_del_trabajo unique (household_id, proyecto_id, id),
  -- Un día propuesto lleva su día; pedirle sus días no lleva ninguno.
  constraint propuestas_de_entrega_dia_segun_la_forma check ((forma = 'un_dia') = (fecha is not null)),
  constraint propuestas_de_entrega_franja_con_su_dia check (franja is null or forma = 'un_dia')
);

comment on table public.propuestas_de_entrega is
  'Lo que el taller le pide al cliente para acordar la entrega de un mueble listo: un día, que el cliente acepta con un botón, o que marque los días y las franjas que le quedan bien. A lo sumo una abierta por trabajo; abrir otra cierra la anterior en su propia sentencia. La base la cierra sola cuando se fija una entrega comprometida y cuando el trabajo deja de estar en curso y listo. El dueño la escribe por public.proponer_la_entrega(), que necesita señal (ADR 0071).';
comment on column public.propuestas_de_entrega.household_id is 'Default: el household del usuario de la sesión. El cliente de la app no lo manda.';
comment on column public.propuestas_de_entrega.forma is 'un_dia: el taller propone un día; sus_dias: le pide al cliente los suyos.';
comment on column public.propuestas_de_entrega.fecha is 'El día propuesto, con la forma un_dia; null con sus_dias. Desde mañana, contado en la hora del taller.';
comment on column public.propuestas_de_entrega.franja is 'La franja del día propuesto, si la tiene. Solo con un_dia.';
comment on column public.propuestas_de_entrega.cerrada_at is 'Cuándo se cerró: porque el taller propuso otra cosa, porque se comprometió la entrega o porque el trabajo dejó de estar en curso y listo. Null es abierta, y el cliente solo le contesta a la abierta.';
comment on column public.propuestas_de_entrega.deleted_at is 'Borrado lógico, como en todo el household. Se borra con el trabajo.';

create index propuestas_de_entrega_household_actualizado on public.propuestas_de_entrega (household_id, updated_at);
create index propuestas_de_entrega_household_proyecto on public.propuestas_de_entrega (household_id, proyecto_id, created_at);
-- Una sola abierta por trabajo.
create unique index propuestas_de_entrega_una_abierta on public.propuestas_de_entrega (household_id, proyecto_id)
  where cerrada_at is null and deleted_at is null;

create trigger metadatos
  before insert or update on public.propuestas_de_entrega
  for each row execute function private.mantener_metadatos();

create trigger avisar_los_cambios
  after insert or update or delete on public.propuestas_de_entrega
  for each row execute function private.avisar_los_cambios('household_id');

alter table public.propuestas_de_entrega enable row level security;

revoke all on table public.propuestas_de_entrega from anon, authenticated;

grant select on table public.propuestas_de_entrega to authenticated;
-- Las escribe public.proponer_la_entrega(), que es security invoker: el alta con lo que se propone, y
-- el cierre. La baja la hace el borrado del trabajo. Sin grant de delete: la baja es lógica.
grant insert (id, proyecto_id, forma, fecha, franja) on table public.propuestas_de_entrega to authenticated;
grant update (cerrada_at, deleted_at) on table public.propuestas_de_entrega to authenticated;

create policy propuestas_de_entrega_lectura on public.propuestas_de_entrega
  for select to authenticated
  using (household_id = any (array(select private.user_household_ids())));

create policy propuestas_de_entrega_alta on public.propuestas_de_entrega
  for insert to authenticated
  with check (household_id = any (array(select private.user_household_ids())));

create policy propuestas_de_entrega_edicion on public.propuestas_de_entrega
  for update to authenticated
  using (household_id = any (array(select private.user_household_ids())))
  with check (household_id = any (array(select private.user_household_ids())));


create function private.cuidar_la_propuesta_de_entrega()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_estado public.estado_proyecto;
  v_listo date;
  v_comprometida date;
  v_borrado timestamptz;
begin
  -- Bloquea el trabajo antes de mirarlo: marcar que todavía no está listo, o comprometer la entrega,
  -- en el mismo instante, espera a esta alta o la ve ya hecha y la cierra.
  select p.estado, p.listo_el, p.entrega_comprometida, p.deleted_at
  into v_estado, v_listo, v_comprometida, v_borrado
  from public.proyectos p
  where p.household_id = new.household_id and p.id = new.proyecto_id
  for share;

  -- Un trabajo que no es de este household lo rechaza la foreign key compuesta, que corre después.
  if not found then
    return new;
  end if;

  if v_borrado is not null then
    raise exception 'El proyecto está borrado' using errcode = 'MN002';
  end if;

  if v_estado <> 'en_curso' or v_listo is null then
    raise exception 'La entrega se coordina con el mueble listo'
      using errcode = 'MN021',
            detail = 'sin_listo',
            hint = 'Marcá en la ficha que ya está listo y proponele el día.';
  end if;

  if v_comprometida is not null then
    raise exception 'La entrega ya está comprometida'
      using errcode = 'MN021',
            detail = 'comprometida',
            hint = 'Para cambiarla, cambiá la fecha comprometida en la ficha.';
  end if;

  if new.fecha is not null and new.fecha < private.hoy_en_el_taller() + 1 then
    raise exception 'El día que le proponés tiene que ser desde mañana'
      using errcode = 'MN021',
            detail = 'fecha',
            hint = 'Elegí un día desde mañana.';
  end if;

  return new;
end;
$$;

comment on function private.cuidar_la_propuesta_de_entrega() is
  'Guarda del alta de una propuesta de entrega: el trabajo tiene que estar en curso y listo, sin entrega comprometida, y el día propuesto tiene que ser desde mañana en la hora del taller. Rechaza con MN021 y el motivo en el detail (sin_listo, comprometida o fecha), o con MN002 si el trabajo está borrado (ADR 0071).';

revoke all on function private.cuidar_la_propuesta_de_entrega() from public, anon, authenticated;

create trigger cuidar_la_propuesta_de_entrega
  before insert on public.propuestas_de_entrega
  for each row execute function private.cuidar_la_propuesta_de_entrega();


-- La base cierra la propuesta cuando ya no hay nada que coordinar ----------------------------------------

create function private.cerrar_la_propuesta_de_entrega()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.propuestas_de_entrega
  set cerrada_at = now()
  where household_id = new.household_id
    and proyecto_id = new.id
    and cerrada_at is null
    and deleted_at is null;

  return null;
end;
$$;

comment on function private.cerrar_la_propuesta_de_entrega() is
  'Cierra la propuesta de entrega abierta de un trabajo cuando se fija la entrega comprometida (la confirmó el dueño o la aceptó el cliente) o cuando el trabajo deja de estar en curso y listo: ya no hay nada que el cliente pueda contestar. Corre con los permisos de quien escribe el trabajo, que tiene grant de update sobre cerrada_at (ADR 0071).';

revoke all on function private.cerrar_la_propuesta_de_entrega() from public, anon, authenticated;

create trigger cerrar_la_propuesta_de_entrega
  after update on public.proyectos
  for each row
  when (new.entrega_comprometida is not null or new.estado <> 'en_curso' or new.listo_el is null)
  execute function private.cerrar_la_propuesta_de_entrega();


-- Lo que contesta el cliente -----------------------------------------------------------------------------

create table public.respuestas_de_entrega (
  id uuid primary key default private.uuidv7(),
  household_id uuid not null references public.households (id) on delete cascade,
  proyecto_id uuid not null,
  propuesta_id uuid not null,
  respuesta public.respuesta_de_entrega not null,
  dias jsonb not null default '[]'::jsonb,
  nota text not null default '',
  leida_at timestamptz,
  -- El instante del reloj y no el de la transacción, como en cambios_de_fecha: la vista le muestra al
  -- cliente la última que mandó, y dos de la misma transacción tienen que quedar en su orden.
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,

  -- Una respuesta es de una propuesta de su mismo trabajo y de su mismo taller.
  constraint respuestas_de_entrega_propuesta_fk foreign key (household_id, proyecto_id, propuesta_id)
    references public.propuestas_de_entrega (household_id, proyecto_id, id),
  constraint respuestas_de_entrega_dias_es_una_lista
    check (jsonb_typeof(dias) = 'array' and jsonb_array_length(dias) <= 10),
  constraint respuestas_de_entrega_nota_valida check (char_length(nota) <= 500),
  -- Aceptar el día propuesto no lleva días ni nota: el día es el de la propuesta.
  constraint respuestas_de_entrega_me_queda_bien_sola
    check (respuesta <> 'me_queda_bien' or (dias = '[]'::jsonb and nota = ''))
);

comment on table public.respuestas_de_entrega is
  'Lo que contestó el cliente a una propuesta de entrega desde su página: que el día propuesto le queda bien, o los días y las franjas que le quedan bien, con una nota. La escribe public.responder_la_entrega(), que corre elevada; el dueño no tiene grant de insert y lo único que escribe es leida_at. Hasta 20 por propuesta: el cliente puede cambiar sus días (ADR 0071).';
comment on column public.respuestas_de_entrega.household_id is 'Sin default: la fila la escribe la función pública, que no tiene sesión, y pone el household del enlace.';
comment on column public.respuestas_de_entrega.dias is 'Los días que le quedan bien, en orden: una lista de {fecha, franjas}, con franjas manana y tarde. Vacía con me_queda_bien, y con mis_dias si lo dijo todo en la nota.';
comment on column public.respuestas_de_entrega.nota is 'Lo que hay que saber para la entrega, en palabras del cliente: el piso, la escalera, quién lo recibe. Hasta 500 caracteres, sin blancos en las puntas.';
comment on column public.respuestas_de_entrega.leida_at is 'Cuándo la leyó el dueño, o null si todavía no. Es del dueño y se escribe por la cola como cualquier otra cosa suya.';
comment on column public.respuestas_de_entrega.deleted_at is 'Borrado lógico. Solo lo pone el borrado del trabajo.';

create index respuestas_de_entrega_household_actualizado on public.respuestas_de_entrega (household_id, updated_at);
create index respuestas_de_entrega_household_propuesta on public.respuestas_de_entrega (household_id, proyecto_id, propuesta_id, created_at);

create trigger metadatos
  before insert or update on public.respuestas_de_entrega
  for each row execute function private.mantener_metadatos();

create trigger avisar_los_cambios
  after insert or update or delete on public.respuestas_de_entrega
  for each row execute function private.avisar_los_cambios('household_id');

alter table public.respuestas_de_entrega enable row level security;

revoke all on table public.respuestas_de_entrega from anon, authenticated;

grant select on table public.respuestas_de_entrega to authenticated;
grant update (leida_at) on table public.respuestas_de_entrega to authenticated;

create policy respuestas_de_entrega_lectura on public.respuestas_de_entrega
  for select to authenticated
  using (household_id = any (array(select private.user_household_ids())));

create policy respuestas_de_entrega_edicion on public.respuestas_de_entrega
  for update to authenticated
  using (household_id = any (array(select private.user_household_ids())))
  with check (household_id = any (array(select private.user_household_ids())));


-- La historia de las fechas -----------------------------------------------------------------------------

create table public.cambios_de_fecha (
  id uuid primary key default private.uuidv7(),
  household_id uuid not null references public.households (id) on delete cascade,
  proyecto_id uuid not null,
  tipo public.tipo_de_fecha not null,
  fecha date,
  fecha_anterior date,
  franja public.franja_de_entrega,
  origen public.origen_de_la_fecha not null,
  decidido_el date not null,
  trabajos_en_curso integer,
  trabajos_sin_terminar integer,
  -- El instante del reloj y no el de la transacción: la línea de base es la primera fila por
  -- created_at, y dos cambios de la misma transacción (la siembra, un test) tienen que quedar en el
  -- orden en que pasaron y no en el que les toque a sus ids.
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,

  constraint cambios_de_fecha_proyecto_fk foreign key (household_id, proyecto_id)
    references public.proyectos (household_id, id),
  -- La franja es de la comprometida y va con su día.
  constraint cambios_de_fecha_franja_de_la_comprometida
    check (franja is null or (tipo = 'comprometida' and fecha is not null)),
  -- Los dos conteos van juntos, y los que no están listos son parte de los que están en curso. Una
  -- importada no los tiene: la carga del taller de ese día no se puede reconstruir.
  constraint cambios_de_fecha_conteos
    check (
      (trabajos_en_curso is null) = (trabajos_sin_terminar is null)
      and (
        trabajos_en_curso is null
        or (trabajos_en_curso >= 0 and trabajos_sin_terminar between 0 and trabajos_en_curso)
      )
    ),
  constraint cambios_de_fecha_importada_sin_conteos
    check (origen <> 'importada' or trabajos_en_curso is null)
);

comment on table public.cambios_de_fecha is
  'La historia de las fechas prometidas de cada trabajo: cada entrega estimada que se fija con el trabajo en curso y cada entrega comprometida, con quién la fijó, el día en el taller y cuántos otros trabajos había en curso ese día. La escribe un trigger sobre proyectos y nadie más: el dueño solo tiene select. La primera de cada trabajo y tipo es la línea de base contra la que el analítico mide la entrega real. Está en la réplica, al revés que cambios_de_estado: son pocas filas y el analítico la lee en el aparato (ADR 0071).';
comment on column public.cambios_de_fecha.fecha is 'La fecha que quedó, o null si se sacó.';
comment on column public.cambios_de_fecha.fecha_anterior is 'La fecha de la fila anterior del mismo trabajo y tipo, o null si es la primera.';
comment on column public.cambios_de_fecha.franja is 'La franja de la comprometida, si la tiene.';
comment on column public.cambios_de_fecha.origen is 'taller, cliente (aceptó el día que le propusieron) o importada (la que ya estaba cargada cuando empezó la historia).';
comment on column public.cambios_de_fecha.decidido_el is 'El día en el taller en que llegó a la base. Una edición que esperó en la cola sin señal queda con el día en que se sincronizó, como en cambios_de_estado.';
comment on column public.cambios_de_fecha.trabajos_en_curso is 'Cuántos otros trabajos del taller estaban en curso cuando se fijó, contados en la misma transacción. Null en las importadas. Es lo que necesita la estimación por carga del taller que el dueño imagina para más adelante: reconstruirlo después no alcanza.';
comment on column public.cambios_de_fecha.trabajos_sin_terminar is 'De esos, cuántos todavía no estaban listos. Null en las importadas.';
comment on column public.cambios_de_fecha.deleted_at is 'Borrado lógico. Solo lo pone el borrado del trabajo.';
comment on column public.cambios_de_fecha.created_at is 'El instante en que la base anotó el cambio, con clock_timestamp(): la primera fila de cada trabajo y tipo por created_at, y después por id, es la línea de base del analítico.';

create index cambios_de_fecha_household_actualizado on public.cambios_de_fecha (household_id, updated_at);
create index cambios_de_fecha_household_proyecto on public.cambios_de_fecha (household_id, proyecto_id, tipo, created_at);

create trigger metadatos
  before insert or update on public.cambios_de_fecha
  for each row execute function private.mantener_metadatos();

create trigger avisar_los_cambios
  after insert or update or delete on public.cambios_de_fecha
  for each row execute function private.avisar_los_cambios('household_id');

alter table public.cambios_de_fecha enable row level security;

revoke all on table public.cambios_de_fecha from anon, authenticated;

grant select on table public.cambios_de_fecha to authenticated;

create policy cambios_de_fecha_lectura on public.cambios_de_fecha
  for select to authenticated
  using (household_id = any (array(select private.user_household_ids())));


create function private.anotar_los_cambios_de_fecha()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entra_en_curso boolean;
  v_estimada boolean;
  v_comprometida boolean;
  v_origen public.origen_de_la_fecha;
  v_en_curso integer;
  v_sin_terminar integer;
begin
  if new.deleted_at is not null then
    return null;
  end if;

  v_entra_en_curso := new.estado = 'en_curso'
    and (tg_op = 'INSERT' or old.estado is distinct from 'en_curso');

  -- La estimada se anota cuando el trabajo entra en curso con una, y cada vez que cambia mientras está
  -- en curso. Antes de aprobar es un número del taller que el cliente no ve como fecha.
  v_estimada := (v_entra_en_curso and new.entrega_estimada is not null)
    or (
      tg_op = 'UPDATE'
      and new.estado = 'en_curso'
      and not v_entra_en_curso
      and new.entrega_estimada is distinct from old.entrega_estimada
    );

  -- La comprometida, cada vez que cambia ella o su franja, también cuando se saca.
  v_comprometida := case
    when tg_op = 'INSERT' then new.entrega_comprometida is not null
    else (new.entrega_comprometida, new.entrega_comprometida_franja)
      is distinct from (old.entrega_comprometida, old.entrega_comprometida_franja)
  end;

  if not v_estimada and not v_comprometida then
    return null;
  end if;

  -- El origen lo marca la puerta del cliente en la transacción, y lo vuelve a vacío después del
  -- update. Cualquier otro camino es el taller.
  v_origen := coalesce(
    nullif(current_setting('maun.origen_de_la_fecha', true), '')::public.origen_de_la_fecha,
    'taller'
  );

  -- La carga del taller en ese momento: los otros trabajos en curso, y de esos los que no están listos.
  select count(*)::integer, (count(*) filter (where p.listo_el is null))::integer
  into v_en_curso, v_sin_terminar
  from public.proyectos p
  where p.household_id = new.household_id
    and p.id <> new.id
    and p.estado = 'en_curso'
    and p.deleted_at is null;

  if v_estimada then
    insert into public.cambios_de_fecha (
      household_id, proyecto_id, tipo, fecha, fecha_anterior, franja, origen, decidido_el,
      trabajos_en_curso, trabajos_sin_terminar
    ) values (
      new.household_id, new.id, 'estimada', new.entrega_estimada,
      (
        select c.fecha from public.cambios_de_fecha c
        where c.household_id = new.household_id and c.proyecto_id = new.id and c.tipo = 'estimada'
        order by c.created_at desc, c.id desc
        limit 1
      ),
      null, v_origen, private.hoy_en_el_taller(), v_en_curso, v_sin_terminar
    );
  end if;

  if v_comprometida then
    insert into public.cambios_de_fecha (
      household_id, proyecto_id, tipo, fecha, fecha_anterior, franja, origen, decidido_el,
      trabajos_en_curso, trabajos_sin_terminar
    ) values (
      new.household_id, new.id, 'comprometida', new.entrega_comprometida,
      (
        select c.fecha from public.cambios_de_fecha c
        where c.household_id = new.household_id and c.proyecto_id = new.id and c.tipo = 'comprometida'
        order by c.created_at desc, c.id desc
        limit 1
      ),
      new.entrega_comprometida_franja, v_origen, private.hoy_en_el_taller(), v_en_curso, v_sin_terminar
    );
  end if;

  return null;
end;
$$;

comment on function private.anotar_los_cambios_de_fecha() is
  'Anota en public.cambios_de_fecha la estimada cuando el trabajo entra en curso con una y cada vez que cambia con el trabajo en curso, y la comprometida cada vez que cambia ella o su franja, venga de donde venga el cambio. Una sola fila por tipo en cada update. Guarda el día en el taller, quién la fijó (maun.origen_de_la_fecha, que marca la puerta del cliente; si no, el taller) y cuántos otros trabajos había en curso y sin terminar. Es security definer porque la app no tiene grant de insert sobre esa tabla: la historia no la escribe el cliente (ADR 0071).';

revoke all on function private.anotar_los_cambios_de_fecha() from public, anon, authenticated;

create trigger anotar_los_cambios_de_fecha
  after insert or update on public.proyectos
  for each row execute function private.anotar_los_cambios_de_fecha();


-- La siembra: la estimada que ya estaba cargada es la primera de la historia ------------------------------

-- Una fila importada por cada trabajo aprobado que ya tiene estimada. No es la primera que vio el
-- cliente, que no quedó en ningún lado: es la que está hoy, y el analítico la marca como de antes. El
-- día es el de la aprobación si quedó en cambios_de_estado (existe desde el 2026-09-18), y si no el de
-- la migración. Sin conteos: la carga del taller de ese día no se puede reconstruir.
insert into public.cambios_de_fecha (household_id, proyecto_id, tipo, fecha, origen, decidido_el)
select
  p.household_id,
  p.id,
  'estimada',
  p.entrega_estimada,
  'importada',
  coalesce(
    (
      select min(c.ocurrio_el)
      from public.cambios_de_estado c
      where c.household_id = p.household_id and c.proyecto_id = p.id and c.hacia = 'en_curso'
    ),
    private.hoy_en_el_taller()
  )
from public.proyectos p
where p.deleted_at is null
  and p.estado in ('en_curso', 'entregado', 'cobrado')
  and p.entrega_estimada is not null;


-- Se dan de baja con el trabajo -------------------------------------------------------------------------

create function private.borrar_la_entrega_del_trabajo(
  p_household_id uuid,
  p_proyecto_id uuid,
  p_momento timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Solo con el trabajo ya borrado. El dueño no tiene grant para borrar una respuesta ni una fila de
  -- la historia, y esta puerta no le abre ese camino para un trabajo vivo.
  if not exists (
    select 1 from public.proyectos p
    where p.household_id = p_household_id and p.id = p_proyecto_id and p.deleted_at is not null
  ) then
    return;
  end if;

  update public.respuestas_de_entrega r
  set deleted_at = p_momento
  where r.household_id = p_household_id and r.proyecto_id = p_proyecto_id and r.deleted_at is null;

  update public.cambios_de_fecha c
  set deleted_at = p_momento
  where c.household_id = p_household_id and c.proyecto_id = p_proyecto_id and c.deleted_at is null;
end;
$$;

comment on function private.borrar_la_entrega_del_trabajo(uuid, uuid, timestamptz) is
  'Borra, con la marca del trabajo, lo que contestó el cliente sobre la entrega y la historia de las fechas de un trabajo que ya se borró. Es security definer porque el dueño no tiene grant para borrar ninguna de las dos: la llama private.borrar_hijos_de_proyecto(), y no hace nada si el trabajo está vivo (ADR 0071).';

revoke all on function private.borrar_la_entrega_del_trabajo(uuid, uuid, timestamptz) from public, anon, authenticated;
grant execute on function private.borrar_la_entrega_del_trabajo(uuid, uuid, timestamptz) to authenticated;

-- Misma firma: or replace conserva los grants. Suma las propuestas de entrega, que el dueño puede dar
-- de baja, y lo que contestó el cliente y la historia de las fechas, que no.
create or replace function private.borrar_hijos_de_proyecto()
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

  update public.archivos
  set deleted_at = new.deleted_at
  where household_id = new.household_id
    and proyecto_id = new.id
    and deleted_at is null;

  update public.opciones_de_presupuesto
  set deleted_at = new.deleted_at
  where household_id = new.household_id
    and proyecto_id = new.id
    and deleted_at is null;

  update public.necesidades
  set deleted_at = new.deleted_at
  where household_id = new.household_id
    and proyecto_id = new.id
    and deleted_at is null;

  update public.enlaces_publicos
  set deleted_at = new.deleted_at
  where household_id = new.household_id
    and proyecto_id = new.id
    and deleted_at is null;

  update public.proximos_contactos
  set deleted_at = new.deleted_at
  where household_id = new.household_id
    and proyecto_id = new.id
    and deleted_at is null;

  -- Las propuestas de entrega después del enlace, en el orden en que las bloquea el cliente que
  -- contesta: el trabajo, el enlace, la propuesta.
  update public.propuestas_de_entrega
  set deleted_at = new.deleted_at
  where household_id = new.household_id
    and proyecto_id = new.id
    and deleted_at is null;

  perform private.borrar_la_entrega_del_trabajo(new.household_id, new.id, new.deleted_at);

  -- La encuesta que se le mandó, lo que contestó y sus preguntas propias. El enlace deja de
  -- funcionar con el trabajo.
  perform private.borrar_las_opiniones_del_trabajo(new.household_id, new.id, new.deleted_at);

  return null;
end;
$$;


-- La réplica: las tres tablas viajan ----------------------------------------------------------------------

-- Misma firma: or replace conserva los grants. Una versión vieja de la app ignora las claves que no
-- conoce, así que sigue sincronizando contra la base migrada.
create or replace function public.bootstrap()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'cursor', now(),
    'households', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.households t where t.deleted_at is null
    ),
    'household_members', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.household_members t where t.deleted_at is null
    ),
    'ajustes', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.ajustes t where t.deleted_at is null
    ),
    'clientes', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.clientes t where t.deleted_at is null
    ),
    'proyectos', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.proyectos t where t.deleted_at is null
    ),
    'pagos', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.pagos t where t.deleted_at is null
    ),
    'gastos', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.gastos t where t.deleted_at is null
    ),
    'opciones_de_presupuesto', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.opciones_de_presupuesto t where t.deleted_at is null
    ),
    'necesidades', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.necesidades t where t.deleted_at is null
    ),
    'proximos_contactos', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.proximos_contactos t where t.deleted_at is null
    ),
    'movimientos', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.movimientos t where t.deleted_at is null
    ),
    'anotaciones', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.anotaciones t where t.deleted_at is null
    ),
    'archivos', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.archivos t where t.deleted_at is null
    ),
    'enlaces_publicos', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.enlaces_publicos t where t.deleted_at is null
    ),
    'preguntas', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.preguntas t where t.deleted_at is null
    ),
    'encuestas_enviadas', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.encuestas_enviadas t where t.deleted_at is null
    ),
    'respuestas', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.respuestas t where t.deleted_at is null
    ),
    'renglones_de_respuesta', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.renglones_de_respuesta t where t.deleted_at is null
    ),
    'propuestas_de_entrega', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.propuestas_de_entrega t where t.deleted_at is null
    ),
    'respuestas_de_entrega', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.respuestas_de_entrega t where t.deleted_at is null
    ),
    'cambios_de_fecha', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.cambios_de_fecha t where t.deleted_at is null
    )
  )
$$;

create or replace function public.delta(p_desde timestamptz)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_desde timestamptz;
begin
  if p_desde is null then
    raise exception 'delta() necesita un cursor: sin cursor corresponde bootstrap()'
      using errcode = '22004';
  end if;

  v_desde := p_desde - interval '5 minutes';

  return jsonb_build_object(
    'cursor', now(),
    'households', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.households t where t.updated_at >= v_desde
    ),
    'household_members', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.household_members t where t.updated_at >= v_desde
    ),
    'ajustes', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.ajustes t where t.updated_at >= v_desde
    ),
    'clientes', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.clientes t where t.updated_at >= v_desde
    ),
    'proyectos', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.proyectos t where t.updated_at >= v_desde
    ),
    'pagos', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.pagos t where t.updated_at >= v_desde
    ),
    'gastos', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.gastos t where t.updated_at >= v_desde
    ),
    'opciones_de_presupuesto', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.opciones_de_presupuesto t where t.updated_at >= v_desde
    ),
    'necesidades', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.necesidades t where t.updated_at >= v_desde
    ),
    'proximos_contactos', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.proximos_contactos t where t.updated_at >= v_desde
    ),
    'movimientos', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.movimientos t where t.updated_at >= v_desde
    ),
    'anotaciones', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.anotaciones t where t.updated_at >= v_desde
    ),
    'archivos', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.archivos t where t.updated_at >= v_desde
    ),
    'enlaces_publicos', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.enlaces_publicos t where t.updated_at >= v_desde
    ),
    'preguntas', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.preguntas t where t.updated_at >= v_desde
    ),
    'encuestas_enviadas', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.encuestas_enviadas t where t.updated_at >= v_desde
    ),
    'respuestas', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.respuestas t where t.updated_at >= v_desde
    ),
    'renglones_de_respuesta', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.renglones_de_respuesta t where t.updated_at >= v_desde
    ),
    'propuestas_de_entrega', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.propuestas_de_entrega t where t.updated_at >= v_desde
    ),
    'respuestas_de_entrega', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.respuestas_de_entrega t where t.updated_at >= v_desde
    ),
    'cambios_de_fecha', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.cambios_de_fecha t where t.updated_at >= v_desde
    )
  );
end;
$$;


-- guardar_proyecto escribe el listo, la comprometida y el tipo -----------------------------------------------

-- Misma firma, así que or replace conserva los grants. Suma cuatro claves con el patrón de la clave
-- presente: sin la clave (un bundle viejo) queda lo que había. Lo que la guarda de proyectos limpia
-- (la entrega de un trabajo en curso, el listo y la comprometida antes de aprobar) se limpia también
-- acá, antes de comparar: así el reenvío de un guardado que la guarda ya acomodó sigue siendo un
-- reenvío y no rebota con MN006.

create or replace function public.guardar_proyecto(
  p_proyecto jsonb,
  p_pagos jsonb,
  p_gastos jsonb,
  p_opciones jsonb default null,
  p_necesidades jsonb default null,
  p_proximos jsonb default null
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_p record;
  v_actual public.proyectos;
  v_fila public.proyectos;
  v_existia boolean;
  v_sin_cambios boolean;
  v_vencimiento date;
  v_visita_hecha boolean;
  v_sena_bp integer;
  v_entrega_hora time;
  v_visita_hora time;
  v_vale_hasta date;
  v_fecha_entrega date;
  v_listo date;
  v_comprometida date;
  v_franja public.franja_de_entrega;
  v_tipo text;
  v_household_id uuid;
  v_cuantas integer;
  v_aprobadas integer;
  v_monto_aprobado bigint;
  v_presupuesto bigint;
  v_entra_en_seguimiento boolean;
begin
  if p_proyecto is null or jsonb_typeof(p_proyecto) <> 'object' then
    raise exception 'El proyecto va en un objeto jsonb' using errcode = '22023';
  end if;

  if jsonb_typeof(coalesce(p_pagos, 'null'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_gastos, 'null'::jsonb)) <> 'array'
  then
    raise exception 'Los pagos y los gastos van en arrays jsonb' using errcode = '22023';
  end if;

  if p_opciones is not null and jsonb_typeof(p_opciones) <> 'array' then
    raise exception 'Las opciones de presupuesto van en un array jsonb' using errcode = '22023';
  end if;

  if p_necesidades is not null and jsonb_typeof(p_necesidades) <> 'array' then
    raise exception 'Lo que hace falta va en un array jsonb' using errcode = '22023';
  end if;

  if p_proximos is not null and jsonb_typeof(p_proximos) <> 'array' then
    raise exception 'Los próximos contactos van en un array jsonb' using errcode = '22023';
  end if;

  -- Las horas se leen como texto por la misma razón que las fechas: un <input type="time"> vacío
  -- manda "" y un cast directo cortaría la llamada entera con 22007, un rechazo definitivo sin
  -- mensaje que tapa la cola (ADR 0015).
  select * into v_p from jsonb_to_record(p_proyecto) as x (
    id uuid,
    version integer,
    cliente_id uuid,
    titulo text,
    descripcion text,
    estado public.estado_proyecto,
    presupuesto_centavos bigint,
    forma_pago public.forma_pago,
    comprobante public.comprobante,
    fecha_visita date,
    ultimo_contacto date,
    fecha_inicio date,
    entrega_estimada date,
    fecha_entrega date,
    direccion_entrega text,
    notas text,
    vencimiento_presupuesto text,
    visita_hecha boolean,
    sena_bp integer,
    entrega_hora text,
    visita_hora text,
    presupuesto_vale_hasta text,
    listo_el text,
    entrega_comprometida text,
    entrega_comprometida_franja text,
    tipo_de_proyecto text
  );

  if v_p.id is null or v_p.cliente_id is null or v_p.titulo is null or v_p.estado is null then
    raise exception 'El proyecto necesita id, cliente, título y estado' using errcode = '22004';
  end if;

  -- Una fila hija sin id o sin monto rebotaría contra un not null con un 23502 genérico, que no es
  -- un mensaje para el usuario y que tapa la cola igual que cualquier otro rechazo definitivo.
  if exists (
    select 1
    from jsonb_to_recordset(p_pagos) as r (id uuid, monto_centavos bigint, borrado boolean)
    where r.id is null
       or (not coalesce(r.borrado, false) and r.monto_centavos is null)
  ) then
    raise exception 'Cada pago necesita id y monto' using errcode = '22004';
  end if;

  -- La fecha de un pago es el día en que entró la plata, y la sabe la app. Sin ella, o con algo que
  -- no es un día, no se guarda: la base no la inventa (ADR 0063). Se lee como texto por lo mismo
  -- que las horas, y se revisa la forma antes de castear para no cortar con un 22007 sin mensaje.
  if exists (
    select 1
    from jsonb_to_recordset(p_pagos) as r (fecha text, borrado boolean)
    where not coalesce(r.borrado, false)
      and coalesce(r.fecha, '') !~ '^\d{4}-\d{2}-\d{2}$'
  ) then
    raise exception 'Cada pago necesita su fecha'
      using errcode = 'MN016',
            hint = 'Poné el día en que te pagaron.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_gastos) as r (id uuid, fecha text, monto_centavos bigint, borrado boolean)
    where r.id is null
       or (not coalesce(r.borrado, false) and (nullif(r.fecha, '') is null or r.monto_centavos is null))
  ) then
    raise exception 'Cada gasto necesita id, fecha y monto' using errcode = '22004';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_opciones, '[]'::jsonb))
      as r (id uuid, monto_centavos bigint, borrado boolean)
    where r.id is null
       or (not coalesce(r.borrado, false) and r.monto_centavos is null)
  ) then
    raise exception 'Cada opción de presupuesto necesita id y monto' using errcode = '22004';
  end if;

  -- El tipo se lee como texto y se valida contra los valores del enum: castearlo de una cortaría con
  -- un 22P02 crudo, que es definitivo y no tiene traducción. Contra el enum y no contra una lista
  -- escrita acá, para que un tipo nuevo no obligue a reescribir la función (ADR 0060).
  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_necesidades, '[]'::jsonb))
      as r (id uuid, tipo text, nombre text, borrado boolean)
    where r.id is null
       or (
         not coalesce(r.borrado, false)
         and (
           coalesce(r.tipo, '') <> all (enum_range(null::public.tipo_de_necesidad)::text[])
           or btrim(coalesce(r.nombre, '')) = ''
         )
       )
  ) then
    raise exception 'Cada material, herraje o herramienta necesita id, tipo y nombre'
      using errcode = '22004';
  end if;

  -- El próximo contacto: el día en que hay que escribirle, la etapa a la que vuelve y, si ya se hizo,
  -- el día y el resultado. Todo se lee como texto y se revisa la forma antes de castear, por lo mismo
  -- que las fechas de los pagos.
  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_proximos, '[]'::jsonb))
      as r (id uuid, fecha text, etapa_previa text, hecho_el text, resultado text, borrado boolean)
    where r.id is null
       or (
         not coalesce(r.borrado, false)
         and (
           coalesce(r.fecha, '') !~ '^\d{4}-\d{2}-\d{2}$'
           or coalesce(r.etapa_previa, '') not in (
             'contacto', 'presupuesto_estimativo', 'relevamiento', 'a_presupuestar', 'presupuesto_enviado'
           )
           or (nullif(r.hecho_el, '') is not null and r.hecho_el !~ '^\d{4}-\d{2}-\d{2}$')
           or (nullif(r.hecho_el, '') is null) <> (nullif(r.resultado, '') is null)
           or coalesce(nullif(r.resultado, ''), 'otra_fecha') not in ('reactivado', 'perdido', 'otra_fecha')
         )
       )
  ) then
    raise exception 'Cada próximo contacto necesita id, día y la etapa a la que vuelve; si ya se hizo, el día y el resultado'
      using errcode = '22004';
  end if;

  -- Primer lock: el proyecto, con for update, la misma disciplina que private.liquidar. La guarda
  -- de pagos y gastos toma for share sobre esta misma fila, así que un cobro que llega en el mismo
  -- instante se serializa con este guardado: o la liquidación espera y suma los pagos nuevos, o
  -- este guardado espera y ve el proyecto ya liquidado, y entonces la guarda lo rechaza con MN001.
  select * into v_actual from public.proyectos p where p.id = v_p.id for update;
  v_existia := found;

  v_vencimiento := case
    when p_proyecto ? 'vencimiento_presupuesto' then nullif(v_p.vencimiento_presupuesto, '')::date
    else v_actual.vencimiento_presupuesto
  end;

  v_visita_hecha := case
    when p_proyecto ? 'visita_hecha' then coalesce(v_p.visita_hecha, false)
    else coalesce(v_actual.visita_hecha, false)
  end;

  -- Como el vencimiento: un bundle viejo que no manda la clave no borra la seña propia del trabajo.
  v_sena_bp := case
    when p_proyecto ? 'sena_bp' then v_p.sena_bp
    else v_actual.sena_bp
  end;

  v_entrega_hora := case
    when p_proyecto ? 'entrega_hora' then nullif(v_p.entrega_hora, '')::time
    else v_actual.entrega_hora
  end;

  v_visita_hora := case
    when p_proyecto ? 'visita_hora' then nullif(v_p.visita_hora, '')::time
    else v_actual.visita_hora
  end;

  -- Hasta cuándo vale el presupuesto, con el mismo patrón: un bundle viejo no la manda y no la borra.
  v_vale_hasta := case
    when p_proyecto ? 'presupuesto_vale_hasta' then nullif(v_p.presupuesto_vale_hasta, '')::date
    else v_actual.presupuesto_vale_hasta
  end;

  -- El listo, la comprometida con su franja y el tipo, con el mismo patrón: un bundle viejo no los
  -- conoce y no los borra. Las fechas y la franja se leen como texto por lo mismo que las horas.
  v_listo := case
    when p_proyecto ? 'listo_el' then nullif(v_p.listo_el, '')::date
    else v_actual.listo_el
  end;

  v_comprometida := case
    when p_proyecto ? 'entrega_comprometida' then nullif(v_p.entrega_comprometida, '')::date
    else v_actual.entrega_comprometida
  end;

  v_franja := case
    when p_proyecto ? 'entrega_comprometida_franja'
      then nullif(v_p.entrega_comprometida_franja, '')::public.franja_de_entrega
    else v_actual.entrega_comprometida_franja
  end;

  v_tipo := case
    when p_proyecto ? 'tipo_de_proyecto' then nullif(btrim(v_p.tipo_de_proyecto), '')
    else v_actual.tipo_de_proyecto
  end;

  -- Lo mismo que hace private.cuidar_las_fechas_de_la_entrega() con cualquier escritura: en curso no
  -- hay entrega real, antes de aprobar no hay listo ni comprometida, y la franja no va sin su día.
  v_fecha_entrega := case when v_p.estado = 'en_curso' then null else v_p.fecha_entrega end;
  if v_p.estado in (
    'contacto', 'presupuesto_estimativo', 'relevamiento', 'a_presupuestar', 'presupuesto_enviado',
    'en_seguimiento'
  ) then
    v_listo := null;
    v_comprometida := null;
  end if;
  if v_comprometida is null then
    v_franja := null;
  end if;

  v_household_id := coalesce(v_actual.household_id, private.household_actual());

  -- Entra en seguimiento en este guardado: la etapa a la que vuelve es la que tenía el trabajo, y la
  -- decide la base, que la tiene en la mano, no lo que diga la app.
  v_entra_en_seguimiento := v_existia
    and v_p.estado = 'en_seguimiento'
    and v_actual.estado is distinct from 'en_seguimiento'
    and v_actual.estado in ('contacto', 'presupuesto_estimativo', 'relevamiento', 'a_presupuestar', 'presupuesto_enviado');

  -- El presupuesto que va a quedar, calculado ANTES de escribir el proyecto y sobre el conjunto de
  -- opciones que va a quedar: las que ya están, más las que vienen, menos las que vienen marcadas de
  -- baja. Si se escribiera después habría que corregir el proyecto con un update más, y ese update
  -- subiría la version una segunda vez: el cliente mandaría la versión vieja en el guardado siguiente
  -- y rebotaría con MN006.
  with entrantes as (
    select r.id, r.monto_centavos, coalesce(r.aprobada, false) as aprobada,
           coalesce(r.borrado, false) as borrado
    from jsonb_to_recordset(coalesce(p_opciones, '[]'::jsonb))
      as r (id uuid, monto_centavos bigint, aprobada boolean, borrado boolean)
  ),
  existentes as (
    select o.id, o.monto_centavos, o.aprobada
    from public.opciones_de_presupuesto o
    where o.household_id = v_household_id
      and o.proyecto_id = v_p.id
      and o.deleted_at is null
  ),
  quedan as (
    select coalesce(e.monto_centavos, x.monto_centavos) as monto_centavos,
           coalesce(e.aprobada, x.aprobada) as aprobada
    from existentes x
    full outer join entrantes e on e.id = x.id
    where not coalesce(e.borrado, false)
  )
  select count(*)::integer,
         count(*) filter (where aprobada)::integer,
         min(monto_centavos) filter (where aprobada)
  into v_cuantas, v_aprobadas, v_monto_aprobado
  from quedan;

  if v_aprobadas > 1 then
    raise exception 'Solo se puede tildar una opción del presupuesto'
      using errcode = 'MN009',
            hint = 'Destildá la que no va y dejá tildada la que te aprobaron.';
  end if;

  -- Con opciones, el presupuesto no se elige: sale de la aprobada, y no hay ninguna mientras el
  -- cliente no eligió. Sin opciones, es el campo que manda el usuario, como siempre.
  v_presupuesto := case
    when v_cuantas > 0 then (case when v_aprobadas > 0 then v_monto_aprobado else null end)
    else v_p.presupuesto_centavos
  end;

  if v_existia then
    if v_actual.deleted_at is not null then
      raise exception 'El proyecto está borrado' using errcode = 'MN002';
    end if;

    v_sin_cambios := (
      v_actual.cliente_id, v_actual.titulo, v_actual.descripcion, v_actual.estado,
      v_actual.presupuesto_centavos, v_actual.forma_pago, v_actual.comprobante,
      v_actual.fecha_visita, v_actual.ultimo_contacto, v_actual.fecha_inicio,
      v_actual.entrega_estimada, v_actual.fecha_entrega, v_actual.direccion_entrega, v_actual.notas,
      v_actual.vencimiento_presupuesto, v_actual.visita_hecha, v_actual.sena_bp,
      v_actual.entrega_hora, v_actual.visita_hora, v_actual.presupuesto_vale_hasta,
      v_actual.listo_el, v_actual.entrega_comprometida, v_actual.entrega_comprometida_franja,
      v_actual.tipo_de_proyecto
    ) is not distinct from (
      v_p.cliente_id, v_p.titulo, coalesce(v_p.descripcion, ''), v_p.estado,
      v_presupuesto, v_p.forma_pago, v_p.comprobante,
      v_p.fecha_visita, v_p.ultimo_contacto, v_p.fecha_inicio,
      v_p.entrega_estimada, v_fecha_entrega, coalesce(v_p.direccion_entrega, ''),
      coalesce(v_p.notas, ''), v_vencimiento, v_visita_hecha, v_sena_bp,
      v_entrega_hora, v_visita_hora, v_vale_hasta,
      v_listo, v_comprometida, v_franja, v_tipo
    );

    -- Un guardado hecho sin señal sobre una versión vieja no pisa en silencio lo que hay. La
    -- excepción es el reenvío de la cola: este mismo guardado ya se aplicó (la versión subió
    -- exactamente uno y la fila quedó igual a lo que se manda) y la respuesta se perdió. Reaplicar
    -- entonces no hace nada, porque el update de abajo y las bajas ya son no-op.
    if v_p.version is not null
      and v_actual.version <> v_p.version
      and not (v_sin_cambios and v_actual.version = v_p.version + 1)
    then
      raise exception 'El proyecto cambió desde que lo abriste'
        using errcode = 'MN006',
              detail = format('versión vista %s, versión actual %s', v_p.version, v_actual.version),
              hint = 'Abrilo de nuevo para ver lo que hay ahora y volvé a cargar lo que te falte.';
    end if;
  end if;

  -- Alta y edición se escriben por separado, no con un upsert. En un `insert ... on conflict do
  -- update`, Postgres evalúa los check de la tabla sobre la fila propuesta antes de resolver el
  -- conflicto: guardar las notas de un proyecto cobrado proponía una fila con estado cobrado y la
  -- distribución en null, y eso choca contra proyectos_liquidado_con_distribucion. El reenvío del
  -- alta cae igual en la rama de edición, porque el select de arriba ya encontró la fila.
  --
  -- La edición manda la fila entera y no solo las columnas que cambiaron, al revés que el resto de
  -- las mutaciones (ADR 0010): acá el chequeo de versión es la garantía más fuerte, porque si el
  -- servidor cambió algo el guardado se rechaza en vez de pisarlo en silencio. Los cuatro costos
  -- estimados quedan afuera a propósito: van por su propio update, como las marcas de la agenda.
  if v_existia then
    update public.proyectos set
      cliente_id = v_p.cliente_id,
      titulo = v_p.titulo,
      descripcion = coalesce(v_p.descripcion, ''),
      estado = v_p.estado,
      presupuesto_centavos = v_presupuesto,
      forma_pago = v_p.forma_pago,
      comprobante = v_p.comprobante,
      fecha_visita = v_p.fecha_visita,
      ultimo_contacto = v_p.ultimo_contacto,
      fecha_inicio = v_p.fecha_inicio,
      entrega_estimada = v_p.entrega_estimada,
      fecha_entrega = v_fecha_entrega,
      direccion_entrega = coalesce(v_p.direccion_entrega, ''),
      notas = coalesce(v_p.notas, ''),
      vencimiento_presupuesto = v_vencimiento,
      visita_hecha = v_visita_hecha,
      sena_bp = v_sena_bp,
      entrega_hora = v_entrega_hora,
      visita_hora = v_visita_hora,
      presupuesto_vale_hasta = v_vale_hasta,
      listo_el = v_listo,
      entrega_comprometida = v_comprometida,
      entrega_comprometida_franja = v_franja,
      tipo_de_proyecto = v_tipo
    where id = v_p.id
    returning * into v_fila;
  else
    begin
      insert into public.proyectos (
        id, cliente_id, titulo, descripcion, estado, presupuesto_centavos, forma_pago, comprobante,
        fecha_visita, ultimo_contacto, fecha_inicio, entrega_estimada, fecha_entrega,
        direccion_entrega, notas, vencimiento_presupuesto, visita_hecha, sena_bp,
        entrega_hora, visita_hora, presupuesto_vale_hasta, listo_el, entrega_comprometida,
        entrega_comprometida_franja, tipo_de_proyecto
      ) values (
        v_p.id, v_p.cliente_id, v_p.titulo, coalesce(v_p.descripcion, ''), v_p.estado,
        v_presupuesto, v_p.forma_pago, v_p.comprobante,
        v_p.fecha_visita, v_p.ultimo_contacto, v_p.fecha_inicio, v_p.entrega_estimada,
        v_fecha_entrega, coalesce(v_p.direccion_entrega, ''), coalesce(v_p.notas, ''),
        v_vencimiento, v_visita_hecha, v_sena_bp, v_entrega_hora, v_visita_hora, v_vale_hasta,
        v_listo, v_comprometida, v_franja, v_tipo
      )
      returning * into v_fila;
    exception
      -- El id existe pero el select de arriba no lo vio: es de otro household. Se responde lo mismo
      -- que si no existiera, que es lo que la RLS ya dice, en vez de filtrar que está. Un duplicate
      -- key crudo sería además un rechazo definitivo sin mensaje, y la cola drena de a una.
      when unique_violation then
        raise exception 'El proyecto no existe o no es tuyo' using errcode = '42501';
    end;
  end if;

  -- Los hijos van después del proyecto: la foreign key compuesta exige que el padre exista. La marca
  -- de la apertura de un pago usa el patrón de la clave presente: sin la clave (un bundle viejo)
  -- queda la que ya tenía el pago, y un pago nuevo nace en false.
  insert into public.pagos (id, proyecto_id, fecha, concepto, monto_centavos, ya_en_la_apertura)
  select r.id, v_fila.id, r.fecha::date, coalesce(r.concepto, ''), r.monto_centavos,
         case
           when e ? 'ya_en_la_apertura' then coalesce(r.ya_en_la_apertura, false)
           else coalesce(g.ya_en_la_apertura, false)
         end
  from jsonb_array_elements(p_pagos) as e
  cross join lateral jsonb_to_record(e) as r (
    id uuid, fecha text, concepto text, monto_centavos bigint, ya_en_la_apertura boolean,
    borrado boolean
  )
  left join public.pagos g on g.id = r.id
  where not coalesce(r.borrado, false)
  on conflict (id) do update set
    proyecto_id = excluded.proyecto_id,
    fecha = excluded.fecha,
    concepto = excluded.concepto,
    monto_centavos = excluded.monto_centavos,
    ya_en_la_apertura = excluded.ya_en_la_apertura;

  insert into public.gastos (id, proyecto_id, fecha, descripcion, monto_centavos)
  select r.id, v_fila.id, r.fecha::date, coalesce(r.descripcion, ''), r.monto_centavos
  from jsonb_to_recordset(p_gastos) as r (
    id uuid, fecha text, descripcion text, monto_centavos bigint, borrado boolean
  )
  where not coalesce(r.borrado, false)
  on conflict (id) do update set
    proyecto_id = excluded.proyecto_id,
    fecha = excluded.fecha,
    descripcion = excluded.descripcion,
    monto_centavos = excluded.monto_centavos;

  -- Las opciones solo se tocan si el pedido las trae: p_opciones en null es un bundle viejo, que no
  -- las conoce y no tiene por qué borrarlas.
  if p_opciones is not null then
    -- Apagar antes de escribir. El índice único parcial de la aprobada se evalúa fila por fila, y el
    -- orden dentro del upsert no está definido: sin este paso, mover la aprobación de una opción a
    -- otra dejaba dos prendidas a la vez y cortaba con 23505.
    update public.opciones_de_presupuesto
    set aprobada = false
    where household_id = v_fila.household_id
      and proyecto_id = v_fila.id
      and aprobada
      and deleted_at is null;

    insert into public.opciones_de_presupuesto (id, proyecto_id, descripcion, monto_centavos, aprobada)
    select r.id, v_fila.id, coalesce(r.descripcion, ''), r.monto_centavos, coalesce(r.aprobada, false)
    from jsonb_to_recordset(p_opciones) as r (
      id uuid, descripcion text, monto_centavos bigint, aprobada boolean, borrado boolean
    )
    where not coalesce(r.borrado, false)
    on conflict (id) do update set
      proyecto_id = excluded.proyecto_id,
      descripcion = excluded.descripcion,
      monto_centavos = excluded.monto_centavos,
      aprobada = excluded.aprobada;
  end if;

  -- Lo mismo con lo que hace falta: sin la clave no se toca. No hay índice único parcial acá, así que
  -- el upsert va de una y el orden entre filas no importa.
  if p_necesidades is not null then
    insert into public.necesidades (id, proyecto_id, tipo, nombre, cantidad, listo)
    select r.id, v_fila.id, r.tipo::public.tipo_de_necesidad, btrim(r.nombre), r.cantidad,
           coalesce(r.listo, false)
    from jsonb_to_recordset(p_necesidades) as r (
      id uuid, tipo text, nombre text, cantidad integer, listo boolean, borrado boolean
    )
    where not coalesce(r.borrado, false)
    on conflict (id) do update set
      proyecto_id = excluded.proyecto_id,
      tipo = excluded.tipo,
      nombre = excluded.nombre,
      cantidad = excluded.cantidad,
      listo = excluded.listo;
  end if;

  -- El próximo contacto, también solo si viene la clave. Primero los registrados y después los
  -- pendientes: el índice único del pendiente se evalúa fila por fila, y cerrar uno y abrir el
  -- siguiente en el mismo guardado tiene que pasar por un momento sin ninguno. La marca de importante
  -- no viaja por acá: se tilda con su propio update.
  if p_proximos is not null then
    insert into public.proximos_contactos (
      id, proyecto_id, fecha, nota, etapa_previa, hecho_el, resultado, respuesta
    )
    select r.id, v_fila.id, r.fecha::date, coalesce(r.nota, ''),
           r.etapa_previa::public.estado_proyecto, r.hecho_el::date, r.resultado,
           coalesce(r.respuesta, '')
    from jsonb_to_recordset(p_proximos) as r (
      id uuid, fecha text, nota text, etapa_previa text, hecho_el text, resultado text,
      respuesta text, borrado boolean
    )
    where not coalesce(r.borrado, false)
      and nullif(r.hecho_el, '') is not null
    on conflict (id) do update set
      proyecto_id = excluded.proyecto_id,
      fecha = excluded.fecha,
      nota = excluded.nota,
      etapa_previa = excluded.etapa_previa,
      hecho_el = excluded.hecho_el,
      resultado = excluded.resultado,
      respuesta = excluded.respuesta;

    begin
      insert into public.proximos_contactos (id, proyecto_id, fecha, nota, etapa_previa, respuesta)
      select r.id, v_fila.id, r.fecha::date, coalesce(r.nota, ''),
             case
               when v_entra_en_seguimiento then v_actual.estado
               else r.etapa_previa::public.estado_proyecto
             end,
             coalesce(r.respuesta, '')
      from jsonb_to_recordset(p_proximos) as r (
        id uuid, fecha text, nota text, etapa_previa text, hecho_el text, respuesta text,
        borrado boolean
      )
      where not coalesce(r.borrado, false)
        and nullif(r.hecho_el, '') is null
      on conflict (id) do update set
        proyecto_id = excluded.proyecto_id,
        fecha = excluded.fecha,
        nota = excluded.nota,
        etapa_previa = excluded.etapa_previa,
        respuesta = excluded.respuesta;
    exception
      -- Otro dispositivo ya dejó un contacto pendiente para este trabajo: este guardado viene de
      -- una versión vieja del seguimiento. Se contesta como cualquier otro choque de versiones.
      when unique_violation then
        raise exception 'El seguimiento cambió desde que lo abriste'
          using errcode = 'MN006',
                hint = 'Abrilo de nuevo para ver cuándo le toca, y volvé a cargar lo que te falte.';
    end;
  end if;

  -- La baja de una fila hija es la que el cliente vio y sacó del formulario, marcada en el mismo
  -- array. Nunca es "todo lo que no vino en el pedido": la version del proyecto no se mueve cuando
  -- solo cambian sus hijos, así que un guardado viejo borraría en silencio un pago cargado desde
  -- otro lado. El filtro por deleted_at deja el reenvío en no-op y conserva la primera marca.
  update public.pagos g
  set deleted_at = now()
  from jsonb_to_recordset(p_pagos) as r (id uuid, borrado boolean)
  where g.id = r.id
    and coalesce(r.borrado, false)
    and g.proyecto_id = v_fila.id
    and g.deleted_at is null;

  update public.gastos g
  set deleted_at = now()
  from jsonb_to_recordset(p_gastos) as r (id uuid, borrado boolean)
  where g.id = r.id
    and coalesce(r.borrado, false)
    and g.proyecto_id = v_fila.id
    and g.deleted_at is null;

  update public.opciones_de_presupuesto o
  set deleted_at = now()
  from jsonb_to_recordset(coalesce(p_opciones, '[]'::jsonb)) as r (id uuid, borrado boolean)
  where o.id = r.id
    and coalesce(r.borrado, false)
    and o.proyecto_id = v_fila.id
    and o.deleted_at is null;

  update public.necesidades n
  set deleted_at = now()
  from jsonb_to_recordset(coalesce(p_necesidades, '[]'::jsonb)) as r (id uuid, borrado boolean)
  where n.id = r.id
    and coalesce(r.borrado, false)
    and n.proyecto_id = v_fila.id
    and n.deleted_at is null;

  update public.proximos_contactos c
  set deleted_at = now()
  from jsonb_to_recordset(coalesce(p_proximos, '[]'::jsonb)) as r (id uuid, borrado boolean)
  where c.id = r.id
    and coalesce(r.borrado, false)
    and c.proyecto_id = v_fila.id
    and c.deleted_at is null;

  -- Vuelve el agregado entero: las filas vivas más las que este guardado dio de baja, para que el
  -- cliente las saque de su réplica sin esperar al próximo delta.
  return jsonb_build_object(
    'proyecto', to_jsonb(v_fila),
    'pagos', (
      select coalesce(jsonb_agg(to_jsonb(g)), '[]'::jsonb)
      from public.pagos g
      where g.household_id = v_fila.household_id
        and g.proyecto_id = v_fila.id
        and (
          g.deleted_at is null
          or g.id in (select (r ->> 'id')::uuid from jsonb_array_elements(p_pagos) as r)
        )
    ),
    'gastos', (
      select coalesce(jsonb_agg(to_jsonb(g)), '[]'::jsonb)
      from public.gastos g
      where g.household_id = v_fila.household_id
        and g.proyecto_id = v_fila.id
        and (
          g.deleted_at is null
          or g.id in (select (r ->> 'id')::uuid from jsonb_array_elements(p_gastos) as r)
        )
    ),
    'opciones_de_presupuesto', (
      select coalesce(jsonb_agg(to_jsonb(o)), '[]'::jsonb)
      from public.opciones_de_presupuesto o
      where o.household_id = v_fila.household_id
        and o.proyecto_id = v_fila.id
        and (
          o.deleted_at is null
          or o.id in (
            select (r ->> 'id')::uuid from jsonb_array_elements(coalesce(p_opciones, '[]'::jsonb)) as r
          )
        )
    ),
    'necesidades', (
      select coalesce(jsonb_agg(to_jsonb(n)), '[]'::jsonb)
      from public.necesidades n
      where n.household_id = v_fila.household_id
        and n.proyecto_id = v_fila.id
        and (
          n.deleted_at is null
          or n.id in (
            select (r ->> 'id')::uuid from jsonb_array_elements(coalesce(p_necesidades, '[]'::jsonb)) as r
          )
        )
    ),
    'proximos_contactos', (
      select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb)
      from public.proximos_contactos c
      where c.household_id = v_fila.household_id
        and c.proyecto_id = v_fila.id
        and (
          c.deleted_at is null
          or c.id in (
            select (r ->> 'id')::uuid from jsonb_array_elements(coalesce(p_proximos, '[]'::jsonb)) as r
          )
        )
    )
  );
end;
$$;

comment on function public.guardar_proyecto(jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) is
  'Guarda un proyecto con sus pagos, sus gastos, sus opciones de presupuesto, lo que hace falta para el trabajo y su próximo contacto en una sola transacción, idempotente por el id del proyecto. El alta es un upsert; la edición manda la version que vio el cliente y se rechaza con MN006 si la fila cambió. Las bajas de las filas hijas vienen marcadas con borrado en su propio array. Un pago sin fecha se rechaza con MN016: la fecha la manda la app (ADR 0063); la guarda de la tabla rechaza además una fecha que todavía no llegó y una marca de la apertura que no corresponde. Con opciones vivas, el presupuesto del proyecto sale de la opción aprobada y no de lo que manda el cliente. Entrar en seguimiento, cambiar la fecha y registrar el contacto viajan en p_proximos junto con el estado, y la guarda diferida exige que el trabajo en seguimiento tenga su contacto pendiente (MN019, ADR 0064); al entrar, la etapa a la que vuelve la pone la base. Hasta cuándo vale el presupuesto (presupuesto_vale_hasta), el día en que quedó listo (listo_el), la entrega comprometida con su franja y el tipo de proyecto se escriben solo si la clave viene en el pedido, como el vencimiento (ADR 0067 y 0071); con el trabajo en curso la entrega real va en null, y antes de aprobar el listo y la comprometida también. p_opciones, p_necesidades y p_proximos en null quieren decir "no toques eso", para que un bundle viejo no lo borre; lo mismo la clave ya_en_la_apertura de cada pago. Los cuatro costos estimados no los escribe esta función: van por un update de sus columnas solas.';


-- La vista del cliente: el listo y la entrega -----------------------------------------------------------------

-- Misma firma, así que or replace conserva los grants: security invoker, execute solo para
-- authenticated, y anon sigue llegando únicamente por public.vista_compartida(). Suma dos cosas, y
-- cada una declara desde qué etapa viaja (ADR 0067): fechas.listo, desde que el mueble está listo, y la
-- clave entrega, con la comprometida mientras el trabajo está en curso, y la propuesta vigente y lo
-- último que contestó el cliente solo mientras hay algo que coordinar. fechas.entrega_pautada no se
-- renombra: sigue siendo la estimada, y lo que cambia es cómo se lee (ADR 0071).
create or replace function public.vista_del_cliente(p_proyecto_id uuid)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_p public.proyectos;
  v_etapa public.estado_proyecto;
  v_aprobado boolean;
  v_propuesta public.propuestas_de_entrega;
  v_respuesta public.respuestas_de_entrega;
  v_presupuesto_mandado boolean;
  v_taller text;
  v_cliente text;
  v_ajustes public.ajustes;
  v_alias text;
  v_cbu text;
  v_link text;
  v_hay_como_transferir boolean;
  v_precio bigint;
  v_pagado bigint;
  v_sena_bp integer;
  v_instancia text;
  v_monto bigint;
  v_instancia_despues text;
  v_monto_despues bigint;
  v_formas public.forma_de_cobro[];
  v_por_transferencia boolean;
  v_siguiente jsonb;
begin
  select * into v_p from public.proyectos p where p.id = p_proyecto_id and p.deleted_at is null;

  -- Lo mismo que si no existiera. Con la RLS puesta, un trabajo de otro household no se ve, y esta
  -- respuesta no distingue «no existe» de «no es tuyo».
  if not found then
    raise exception 'El trabajo no existe o no es tuyo' using errcode = '42501';
  end if;

  -- Un trabajo dado por perdido no tiene nada que contarle al cliente, y decirle que se perdió
  -- sería contarle una decisión del taller. El link se comporta como si no sirviera.
  if v_p.estado = 'perdido' then
    raise exception 'El trabajo no existe o no es tuyo' using errcode = '42501';
  end if;

  -- El «por ahora no» es una nota del taller para acordarse de volver a escribirle, no una etapa del
  -- trabajo del cliente: el cliente sigue viendo la etapa en la que estaba, la misma que va a ver si
  -- vuelve. La saca del contacto pendiente, que la guarda al entrar.
  v_etapa := v_p.estado;
  if v_p.estado = 'en_seguimiento' then
    select c.etapa_previa into v_etapa
    from public.proximos_contactos c
    where c.household_id = v_p.household_id
      and c.proyecto_id = v_p.id
      and c.hecho_el is null
      and c.deleted_at is null;
    v_etapa := coalesce(v_etapa, 'presupuesto_enviado');
  end if;

  -- Cada dato tiene una etapa a partir de la cual es cierto. Un campo cargado antes de esa etapa (el
  -- sistema viejo le copió el inicio y la entrega a todo trabajo, aprobado o no) no es un hecho ni un
  -- acuerdo, y no sale de la base.
  v_aprobado := v_etapa in ('en_curso', 'entregado', 'cobrado');
  v_presupuesto_mandado := v_aprobado or v_etapa = 'presupuesto_enviado';

  select h.nombre into v_taller from public.households h where h.id = v_p.household_id;
  select c.nombre into v_cliente from public.clientes c where c.id = v_p.cliente_id;
  select * into v_ajustes from public.ajustes a where a.household_id = v_p.household_id;

  v_alias := nullif(v_ajustes.cobro_alias, '');
  v_cbu := nullif(v_ajustes.cobro_cbu, '');
  v_link := nullif(v_ajustes.cobro_link, '');
  v_hay_como_transferir := v_alias is not null or v_cbu is not null or v_link is not null;

  -- El presupuesto existe para el cliente desde que se le manda. Antes, lo que haya en
  -- presupuesto_centavos es un borrador, o el número de un estimativo, y no viaja.
  v_precio := case when v_presupuesto_mandado then v_p.presupuesto_centavos end;
  v_sena_bp := coalesce(v_p.sena_bp, v_ajustes.sena_bp, 5000);

  select coalesce(sum(g.monto_centavos), 0) into v_pagado
  from public.pagos g
  where g.household_id = v_p.household_id
    and g.proyecto_id = v_p.id
    and g.deleted_at is null;

  select r.instancia, r.monto_centavos into v_instancia, v_monto
  from private.pagos_por_delante(v_precio, v_pagado, v_sena_bp) as r
  where r.orden = 1;

  select r.instancia, r.monto_centavos into v_instancia_despues, v_monto_despues
  from private.pagos_por_delante(v_precio, v_pagado, v_sena_bp) as r
  where r.orden = 2;

  -- Antes de aprobar lo único que se le puede pedir es la seña: el saldo existe desde que aprueba. Si
  -- lo que ya pagó la cubre, para aprobar no le falta pagar nada.
  if not v_aprobado and v_instancia = 'saldo' then
    v_instancia := null;
    v_monto := null;
    v_instancia_despues := null;
    v_monto_despues := null;
  end if;

  -- Con todo pagado no hay ninguna instancia, así que tampoco hay formas ni datos de la cuenta.
  if v_instancia is null then
    v_formas := array[]::public.forma_de_cobro[];
  elsif v_instancia = 'sena' then
    v_formas := private.formas_de_cobro(v_p.cobro_sena, v_hay_como_transferir);
  else
    v_formas := private.formas_de_cobro(v_p.cobro_saldo, v_hay_como_transferir);
  end if;

  v_por_transferencia := 'transferencia' = any (v_formas);

  if v_instancia_despues is null then
    v_siguiente := null;
  else
    v_siguiente := jsonb_build_object(
      'instancia', v_instancia_despues,
      'formas', to_jsonb(
        case
          when v_instancia_despues = 'sena'
            then private.formas_de_cobro(v_p.cobro_sena, v_hay_como_transferir)
          else private.formas_de_cobro(v_p.cobro_saldo, v_hay_como_transferir)
        end
      ),
      'monto_centavos', v_monto_despues
    );
  end if;

  -- Lo que hay para coordinar la entrega: solo con el trabajo en curso, el mueble listo y sin entrega
  -- comprometida, la propuesta abierta si sigue vigente (un día propuesto que ya pasó no se le
  -- muestra), y lo último que el cliente le contestó.
  if v_etapa = 'en_curso' and v_p.listo_el is not null and v_p.entrega_comprometida is null then
    select * into v_propuesta
    from public.propuestas_de_entrega d
    where d.household_id = v_p.household_id
      and d.proyecto_id = v_p.id
      and d.cerrada_at is null
      and d.deleted_at is null
      and (d.fecha is null or d.fecha >= private.hoy_en_el_taller());

    if v_propuesta.id is not null then
      select * into v_respuesta
      from public.respuestas_de_entrega r
      where r.household_id = v_p.household_id
        and r.proyecto_id = v_p.id
        and r.propuesta_id = v_propuesta.id
        and r.deleted_at is null
      order by r.created_at desc, r.id desc
      limit 1;
    end if;
  end if;

  -- Los campos van enumerados uno por uno, a propósito. Si esto fuera to_jsonb(v_p) con la pantalla
  -- filtrando, el día que alguien le agregue una columna a proyectos esa columna quedaría expuesta
  -- sin que nadie lo decida: lo que el cliente ve se decide acá, no en el navegador. La suite lo
  -- controla con supabase/tests/25_vista_del_cliente.sql, que falla apenas aparece una columna
  -- nueva en proyectos o en ajustes hasta que alguien la clasifica como pública o privada.
  return jsonb_build_object(
    'taller', jsonb_build_object('nombre', v_taller),
    'cliente', jsonb_build_object('nombre', v_cliente),
    'trabajo', v_p.titulo,
    -- La dirección de la casa del cliente, desde que aprueba. Antes viaja vacía y no en null: el
    -- lector de una versión vieja de la app la exige como texto.
    'direccion', case when v_aprobado then v_p.direccion_entrega else '' end,
    'estado', v_etapa,
    'precio_centavos', v_precio,
    -- La seña en pesos: la que se le pide para arrancar mientras espera, y la acordada desde que
    -- aprueba. Sale de la misma función que el importe de «pago», así que las dos no pueden dar
    -- distinto. El porcentaje sigue sin viajar.
    'sena_centavos', private.sena_esperada(v_precio, v_sena_bp),
    -- El pago que toca ahora y, si hay otro después, cuánto es y cómo se paga. Los importes salen
    -- de lo que ya está guardado; el porcentaje de seña sigue sin viajar, que es lo que dejó
    -- abierto el ADR 0048.
    'pago', jsonb_build_object(
      'instancia', v_instancia,
      'formas', to_jsonb(v_formas),
      'monto_centavos', v_monto,
      'siguiente', v_siguiente
    ),
    -- Cómo pagarle al taller, y solo si el pago que toca se puede pagar así: los cuatro datos de
    -- la cuenta para transferir y el link de Mercado Pago para pagar desde la misma página. De
    -- ajustes no viaja nada más: ni el sueldo, ni los costos fijos, ni la meta de Cocos, ni la seña.
    'cobro', jsonb_build_object(
      'alias', case when v_por_transferencia then v_alias end,
      'cbu', case when v_por_transferencia then v_cbu end,
      'titular', case when v_por_transferencia then nullif(v_ajustes.cobro_titular, '') end,
      'cuit', case when v_por_transferencia then nullif(v_ajustes.cobro_cuit, '') end,
      'link', case when v_por_transferencia then v_link end
    ),
    'fechas', jsonb_build_object(
      'estimativo', (
        select min(c.ocurrio_el)
        from public.cambios_de_estado c
        where c.household_id = v_p.household_id
          and c.proyecto_id = v_p.id
          and c.hacia = 'presupuesto_estimativo'
      ),
      'presupuesto', (
        select min(c.ocurrio_el)
        from public.cambios_de_estado c
        where c.household_id = v_p.household_id
          and c.proyecto_id = v_p.id
          and c.hacia = 'presupuesto_enviado'
      ),
      -- La aprobación sale de su registro, no de un pago, y solo mientras el trabajo está aprobado:
      -- uno que volvió a presupuesto no se muestra aprobado.
      'aprobado', case when v_aprobado then (
        select min(c.ocurrio_el)
        from public.cambios_de_estado c
        where c.household_id = v_p.household_id
          and c.proyecto_id = v_p.id
          and c.hacia = 'en_curso'
      ) end,
      'inicio', case when v_aprobado then v_p.fecha_inicio end,
      -- La entrega estimada, desde que aprueba. La clave no se renombró: la app la lee como
      -- estimada, y no la muestra si ya pasó (ADR 0071).
      'entrega_pautada', case when v_aprobado then v_p.entrega_estimada end,
      -- El día en que se terminó de fabricar, desde que está listo.
      'listo', case when v_aprobado then v_p.listo_el end,
      'entregado', case when v_etapa in ('entregado', 'cobrado') then v_p.fecha_entrega end,
      'cobro', case when v_p.estado = 'cobrado' then v_p.fecha_cobro end,
      -- Hasta cuándo vale el presupuesto, solo mientras está mandado y sin aprobar.
      'vale_hasta', case when v_etapa = 'presupuesto_enviado' then v_p.presupuesto_vale_hasta end
    ),
    -- La visita para medir: el día acordado o en que se fue, y si ya se fue. La hora no viaja.
    'visita', jsonb_build_object(
      'dia', v_p.fecha_visita,
      'hecha', v_p.visita_hecha
    ),
    -- La entrega que se coordina con el cliente (ADR 0071). La comprometida viaja mientras el trabajo
    -- está en curso; entregado, lo que cuenta es el día en que se entregó. La propuesta y la respuesta,
    -- solo mientras hay algo que contestar. De la propuesta viaja su id, que es con lo que el cliente
    -- contesta; de la respuesta, lo que él mismo mandó.
    'entrega', jsonb_build_object(
      'comprometida', case
        when v_etapa = 'en_curso' and v_p.entrega_comprometida is not null then jsonb_build_object(
          'fecha', v_p.entrega_comprometida,
          'franja', v_p.entrega_comprometida_franja
        )
      end,
      'propuesta', case
        when v_propuesta.id is not null then jsonb_build_object(
          'id', v_propuesta.id,
          'forma', v_propuesta.forma,
          'fecha', v_propuesta.fecha,
          'franja', v_propuesta.franja
        )
      end,
      'respuesta', case
        when v_respuesta.id is not null then jsonb_build_object(
          'respuesta', v_respuesta.respuesta,
          'dias', v_respuesta.dias,
          'nota', v_respuesta.nota
        )
      end
    ),
    'pagos', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', g.id,
            'fecha', g.fecha,
            'concepto', g.concepto,
            'monto_centavos', g.monto_centavos
          )
          order by g.fecha, g.id
        ),
        '[]'::jsonb
      )
      from public.pagos g
      where g.household_id = v_p.household_id
        and g.proyecto_id = v_p.id
        and g.deleted_at is null
    ),
    'archivos', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', a.id,
            'nombre', a.nombre,
            'tipo', a.tipo,
            'ancho', a.ancho,
            'alto', a.alto,
            'fecha', a.created_at,
            -- La ruta en el bucket, que es pública y se sirve por el CDN. Sale del id, como en la
            -- app: private.ruta_del_archivo() es el único lugar donde se arma.
            'ruta', private.ruta_del_archivo(a.household_id, a.proyecto_id, a.id, a.tipo, false),
            'ruta_mini', private.ruta_del_archivo(a.household_id, a.proyecto_id, a.id, a.tipo, true)
          )
          order by a.created_at desc, a.id desc
        ),
        '[]'::jsonb
      )
      from public.archivos a
      where a.household_id = v_p.household_id
        and a.proyecto_id = v_p.id
        and a.deleted_at is null
        and a.visible_para_cliente
    )
  );
end;
$$;

comment on function public.vista_del_cliente(uuid) is
  'Lo único que un cliente puede ver de su trabajo, y cada dato recién desde la etapa en la que es cierto (ADR 0067): el presupuesto desde que se le manda; la dirección de entrega, el día de inicio, la entrega estimada (la clave entrega_pautada, que no se renombró) y el día de la aprobación desde que aprueba; el día en que el mueble quedó listo desde que lo está; el día de la entrega desde que se entrega. Antes de esas etapas no viajan, aunque estén cargados: un campo cargado no es un hecho. Devuelve cuánto vale, cuánto pagó, en qué anda, la seña en pesos, qué pago le toca ahora, cuánto es, cómo puede pagarlo y cuál viene después (antes de aprobar solo se le pide la seña), hasta cuándo vale el presupuesto mientras espera la seña, los archivos que el dueño marcó, el día que se le mandó el estimativo y el día de la visita para medir con si ya se fue. La clave entrega trae la entrega comprometida mientras el trabajo está en curso, y la propuesta de entrega vigente con lo último que contestó el cliente solo con el trabajo en curso, listo y sin comprometida (ADR 0071). Enumera los campos uno por uno y nunca devuelve la fila entera: convertirla en un select * expondría cada columna nueva de proyectos sin que nadie lo decida, costos estimados, margen y tipo de proyecto incluidos. Un trabajo en seguimiento se muestra en la etapa en la que estaba: el «por ahora no» y su próximo contacto son del taller y no viajan (ADR 0064). Del estimativo viaja el día, nunca un importe. De la visita viajan el día y la marca, no la hora. De ajustes viajan exactamente los cinco campos de cobro —los cuatro de la cuenta y el link de Mercado Pago—, y solo cuando el pago que toca AHORA se ofrece por transferencia: lo que no se muestra, no se manda. El porcentaje de seña y los días que vale un presupuesto no viajan nunca; lo que viaja son el importe y la fecha que salen de ellos. Es security invoker: desde la app la llama el dueño y la RLS decide; desde el link la llama public.vista_compartida(), que ya resolvió el token (ADR 0046, 0048, 0053, 0054, 0058, 0067 y 0071).';

