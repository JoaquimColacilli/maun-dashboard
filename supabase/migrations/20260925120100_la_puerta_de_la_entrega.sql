-- La puerta de la entrega (ADR 0071).
--
-- El dueño le pide al cliente el día de la entrega de un mueble listo, y el cliente contesta desde su
-- página: acepta el día que le propusieron o manda los días y franjas que le quedan bien. Es la
-- segunda vez que alguien sin sesión escribe en la base, y lo hace por una sola puerta nueva, con las
-- mismas reglas que la encuesta (ADR 0057): public.responder_la_entrega(), security definer, que valida
-- todo del lado de la base antes de escribir y devuelve solo {estado}. anon pasa a ejecutar cinco
-- funciones.
--
-- El dueño propone por public.proponer_la_entrega(), security invoker, que cierra la propuesta
-- abierta y abre la nueva en una transacción.
--
-- Aditiva: cuatro funciones nuevas. Ninguna fila cambia.


-- La validación de la respuesta, gemela de validarRespuestaDeEntrega -----------------------------------------

create function private.es_dia_de_la_entrega(p_texto text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_texto ~ '^2[0-9]{3}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'
    and pg_input_is_valid(p_texto, 'date')
$$;

comment on function private.es_dia_de_la_entrega(text) is
  'Si un texto es un día AAAA-MM-DD que existe, de este milenio: el 30 de febrero no. Lo usa private.validar_respuesta_de_entrega() antes de leerlo como fecha, y tiene su gemela en @maun/domain (esDiaDeLaEntrega).';

revoke all on function private.es_dia_de_la_entrega(text) from public, anon, authenticated;

create function private.validar_respuesta_de_entrega(
  p_respuesta jsonb,
  p_forma public.forma_de_coordinar,
  p_hoy date
)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_respuesta text;
  v_dias jsonb;
  v_nota text;
  v_dia jsonb;
  v_franjas jsonb;
  v_fecha date;
  v_vistas date[] := array[]::date[];
  v_distancia integer;
begin
  -- La forma: {id, propuesta_id, respuesta, dias, nota}, y cada día {fecha, franjas}.
  if p_respuesta is null or jsonb_typeof(p_respuesta) is distinct from 'object' then
    return 'forma';
  end if;
  if (select array_agg(k order by k) from jsonb_object_keys(p_respuesta) as k)
    is distinct from array['dias', 'id', 'nota', 'propuesta_id', 'respuesta'] then
    return 'forma';
  end if;
  if jsonb_typeof(p_respuesta -> 'id') is distinct from 'string'
    or (p_respuesta ->> 'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return 'forma';
  end if;
  if jsonb_typeof(p_respuesta -> 'propuesta_id') is distinct from 'string'
    or (p_respuesta ->> 'propuesta_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return 'forma';
  end if;
  if jsonb_typeof(p_respuesta -> 'respuesta') is distinct from 'string'
    or (p_respuesta ->> 'respuesta') not in ('me_queda_bien', 'mis_dias') then
    return 'forma';
  end if;
  if jsonb_typeof(p_respuesta -> 'dias') is distinct from 'array'
    or jsonb_typeof(p_respuesta -> 'nota') is distinct from 'string' then
    return 'forma';
  end if;

  v_respuesta := p_respuesta ->> 'respuesta';
  v_dias := p_respuesta -> 'dias';
  v_nota := p_respuesta ->> 'nota';

  for v_dia in select d from jsonb_array_elements(v_dias) as d loop
    if jsonb_typeof(v_dia) is distinct from 'object' then
      return 'forma';
    end if;
    if (select array_agg(k order by k) from jsonb_object_keys(v_dia) as k)
      is distinct from array['fecha', 'franjas'] then
      return 'forma';
    end if;
    if jsonb_typeof(v_dia -> 'fecha') is distinct from 'string'
      or not private.es_dia_de_la_entrega(v_dia ->> 'fecha')
      or jsonb_typeof(v_dia -> 'franjas') is distinct from 'array' then
      return 'forma';
    end if;
    if exists (
      select 1 from jsonb_array_elements(v_dia -> 'franjas') as f
      where jsonb_typeof(f) is distinct from 'string'
    ) then
      return 'forma';
    end if;
  end loop;

  -- Aceptar el día propuesto no lleva días ni nota: el día es el de la propuesta.
  if v_respuesta = 'me_queda_bien'
    and (jsonb_array_length(v_dias) > 0 or v_nota ~ '[^ \t\n\r\f\v]') then
    return 'forma';
  end if;

  if v_respuesta = 'me_queda_bien' then
    return case when p_forma = 'un_dia' then null else 'propuesta' end;
  end if;

  if jsonb_array_length(v_dias) = 0 and v_nota !~ '[^ \t\n\r\f\v]' then
    return 'vacia';
  end if;

  if jsonb_array_length(v_dias) > 10 then
    return 'demasiados';
  end if;

  for v_dia in select d from jsonb_array_elements(v_dias) as d loop
    v_fecha := (v_dia ->> 'fecha')::date;
    if v_fecha = any (v_vistas) then
      return 'repetido';
    end if;
    v_vistas := v_vistas || v_fecha;

    -- De pasado mañana a dentro de 30 días, en la hora del taller.
    v_distancia := v_fecha - p_hoy;
    if v_distancia < 2 or v_distancia > 30 then
      return 'fuera';
    end if;

    if extract(isodow from v_fecha) = 7 then
      return 'domingo';
    end if;

    v_franjas := v_dia -> 'franjas';
    if jsonb_array_length(v_franjas) not between 1 and 2
      or exists (
        select 1 from jsonb_array_elements_text(v_franjas) as f where f not in ('manana', 'tarde')
      )
      or (select count(distinct f) from jsonb_array_elements_text(v_franjas) as f)
        <> jsonb_array_length(v_franjas) then
      return 'franja';
    end if;
  end loop;

  if char_length(regexp_replace(v_nota, '^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$', '', 'g')) > 500 then
    return 'largo';
  end if;

  return null;
end;
$$;

comment on function private.validar_respuesta_de_entrega(jsonb, public.forma_de_coordinar, date) is
  'Si una respuesta a una propuesta de entrega sirve, y si no, por qué: forma (no es {id, propuesta_id, respuesta, dias, nota} con días {fecha, franjas}, o acepta el día con días o nota), propuesta (acepta un día cuando el taller le pidió los suyos), vacia (ni un día ni una nota), demasiados (más de diez días), repetido, fuera (un día antes de pasado mañana o después de dentro de 30, contados desde p_hoy), domingo, franja (sin la mañana o la tarde bien marcadas) o largo (nota de más de 500 caracteres). Devuelve null si sirve. El orden de las revisiones es parte de la regla: es gemela de validarRespuestaDeEntrega de @maun/domain y el comparador las ata caso por caso (ADR 0071).';

revoke all on function private.validar_respuesta_de_entrega(jsonb, public.forma_de_coordinar, date)
  from public, anon, authenticated;

create function private.motivo_de_la_entrega(p_motivo text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_motivo
    when 'forma' then 'La respuesta no tiene la forma que espera la página'
    when 'propuesta' then 'Ese día no se puede aceptar: el taller te pidió tus días'
    when 'vacia' then 'Falta al menos un día, o una nota con cuándo te queda bien'
    when 'demasiados' then 'Son más de diez días'
    when 'repetido' then 'Vino dos veces el mismo día'
    when 'fuera' then 'Un día está fuera de los que se pueden elegir'
    when 'domingo' then 'Los domingos no se entrega'
    when 'franja' then 'Un día no tiene bien marcada la mañana o la tarde'
    when 'largo' then 'La nota pasa de los 500 caracteres'
    when 'tope' then 'Ya contestaste demasiadas veces a este pedido'
    else 'La respuesta no sirve para este pedido'
  end
$$;

comment on function private.motivo_de_la_entrega(text) is 'El mensaje de cada motivo con que public.responder_la_entrega() rechaza una respuesta (MN020).';

revoke all on function private.motivo_de_la_entrega(text) from public, anon, authenticated;


-- Lo que propone el dueño ---------------------------------------------------------------------------------

create function public.proponer_la_entrega(p_proyecto_id uuid, p_propuesta jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_proyecto public.proyectos;
  v_id uuid;
  v_existente public.propuestas_de_entrega;
  v_cerradas jsonb;
  v_nueva public.propuestas_de_entrega;
begin
  if p_propuesta is not null and jsonb_typeof(p_propuesta) <> 'object' then
    raise exception 'La propuesta va en un objeto jsonb' using errcode = '22023';
  end if;

  -- El trabajo primero, con for update: es el orden de la baja de un trabajo y el de la puerta del
  -- cliente, así una respuesta que se está guardando y una propuesta nueva se esperan y no se trancan.
  select * into v_proyecto from public.proyectos p where p.id = p_proyecto_id for update;

  if not found then
    raise exception 'El proyecto no existe o no es tuyo' using errcode = '42501';
  end if;

  -- El reenvío de la misma propuesta (la respuesta del primero se perdió en la red) contesta lo que hay
  -- y no toca nada.
  if p_propuesta is not null then
    v_id := (p_propuesta ->> 'id')::uuid;
    select * into v_existente from public.propuestas_de_entrega d where d.id = v_id;
    if found then
      return jsonb_build_object('propuestas', jsonb_build_array(to_jsonb(v_existente)));
    end if;
  end if;

  -- Cerrar antes de abrir, en su propia sentencia: el índice único parcial de la abierta se evalúa
  -- fila por fila (ADR 0043).
  with cerradas as (
    update public.propuestas_de_entrega d
    set cerrada_at = now()
    where d.household_id = v_proyecto.household_id
      and d.proyecto_id = v_proyecto.id
      and d.cerrada_at is null
      and d.deleted_at is null
    returning d.*
  )
  select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) into v_cerradas from cerradas c;

  if p_propuesta is null then
    return jsonb_build_object('propuestas', v_cerradas);
  end if;

  insert into public.propuestas_de_entrega (id, proyecto_id, forma, fecha, franja)
  values (
    v_id,
    v_proyecto.id,
    (p_propuesta ->> 'forma')::public.forma_de_coordinar,
    nullif(p_propuesta ->> 'fecha', '')::date,
    nullif(p_propuesta ->> 'franja', '')::public.franja_de_entrega
  )
  returning * into v_nueva;

  return jsonb_build_object('propuestas', v_cerradas || jsonb_build_array(to_jsonb(v_nueva)));
end;
$$;

comment on function public.proponer_la_entrega(uuid, jsonb) is
  'Le pide al cliente el día de la entrega de un trabajo en curso y listo: p_propuesta es {id, forma, fecha, franja}, con forma un_dia (el día propuesto, desde mañana, con franja opcional) o sus_dias (sin día). Cierra la propuesta abierta y abre la nueva en una transacción; con p_propuesta en null solo cierra. La guarda de la tabla rechaza con MN021 un trabajo que no está listo, una entrega ya comprometida o un día que no es desde mañana. Idempotente por el id: el reenvío contesta la que ya está. Devuelve las filas que tocó, para que la app las aplique a su réplica sin esperar el delta. Es security invoker y necesita señal: una propuesta que no está en la base no la ve el cliente (ADR 0071).';

revoke all on function public.proponer_la_entrega(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.proponer_la_entrega(uuid, jsonb) to authenticated;


-- La puerta del cliente -------------------------------------------------------------------------------------

create function public.responder_la_entrega(p_token text, p_respuesta jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enlace public.enlaces_publicos;
  v_proyecto public.proyectos;
  v_propuesta public.propuestas_de_entrega;
  v_hoy date := private.hoy_en_el_taller();
  v_uuid constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  v_id uuid;
  v_propuesta_id uuid;
  v_motivo text;
  v_cuantas integer;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{16,128}$' then
    raise exception 'Este link no funciona' using errcode = 'MN010';
  end if;

  -- El enlace, sin bloquearlo: solo para saber de qué trabajo es.
  select * into v_enlace
  from public.enlaces_publicos e
  where e.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
    and e.revocado_at is null
    and e.deleted_at is null;

  if not found then
    raise exception 'Este link no funciona' using errcode = 'MN010';
  end if;

  -- Después, en el orden de la baja de un trabajo, que empieza por el trabajo y sigue por sus hijas: el
  -- trabajo con for update (dos respuestas a la vez, o una propuesta nueva del dueño, se esperan acá),
  -- el enlace con for share, que se vuelve a mirar por si lo dieron de baja mientras tanto, y la
  -- propuesta.
  select * into v_proyecto
  from public.proyectos p
  where p.household_id = v_enlace.household_id and p.id = v_enlace.proyecto_id
  for update;

  if not found or v_proyecto.deleted_at is not null or v_proyecto.estado = 'perdido' then
    raise exception 'Este link no funciona' using errcode = 'MN010';
  end if;

  perform 1
  from public.enlaces_publicos e
  where e.id = v_enlace.id and e.revocado_at is null and e.deleted_at is null
  for share;

  if not found then
    raise exception 'Este link no funciona' using errcode = 'MN010';
  end if;

  -- El tope de tamaño deja pasar diez días con sus dos franjas y una nota de 500 caracteres de cuatro
  -- bytes, con aire.
  if pg_column_size(p_respuesta) > 16384
    or jsonb_typeof(p_respuesta) is distinct from 'object'
    or jsonb_typeof(p_respuesta -> 'id') is distinct from 'string'
    or jsonb_typeof(p_respuesta -> 'propuesta_id') is distinct from 'string'
    or (p_respuesta ->> 'id') !~* v_uuid
    or (p_respuesta ->> 'propuesta_id') !~* v_uuid then
    raise exception '%', private.motivo_de_la_entrega('forma') using errcode = 'MN020', detail = 'forma';
  end if;

  v_id := (p_respuesta ->> 'id')::uuid;
  v_propuesta_id := (p_respuesta ->> 'propuesta_id')::uuid;

  -- El mismo envío que vuelve porque la respuesta del primero se perdió en la red: ya está guardado.
  if exists (
    select 1 from public.respuestas_de_entrega r
    where r.household_id = v_proyecto.household_id and r.id = v_id and r.propuesta_id = v_propuesta_id
  ) then
    return jsonb_build_object('estado', 'guardada');
  end if;

  -- Con la entrega ya comprometida no hay nada que contestar: la página vuelve a leer y lo muestra.
  if v_proyecto.entrega_comprometida is not null then
    return jsonb_build_object('estado', 'ya_confirmada');
  end if;

  select * into v_propuesta
  from public.propuestas_de_entrega d
  where d.household_id = v_proyecto.household_id
    and d.proyecto_id = v_proyecto.id
    and d.cerrada_at is null
    and d.deleted_at is null
  for update;

  -- Le contesta a otra cosa que la que está abierta, o a un día que ya pasó: el taller cambió lo que
  -- le pedía y la página vuelve a leer.
  if not found
    or v_propuesta.id <> v_propuesta_id
    or (v_propuesta.fecha is not null and v_propuesta.fecha < v_hoy)
    or v_proyecto.estado <> 'en_curso'
    or v_proyecto.listo_el is null then
    return jsonb_build_object('estado', 'cambio');
  end if;

  -- Todo se valida acá, del lado de la base, y antes de escribir: lo que no cumple se rechaza entero.
  v_motivo := private.validar_respuesta_de_entrega(p_respuesta, v_propuesta.forma, v_hoy);

  if v_motivo is not null then
    raise exception '%', private.motivo_de_la_entrega(v_motivo) using errcode = 'MN020', detail = v_motivo;
  end if;

  -- Puede cambiar sus días, pero no sin fin.
  select count(*)::integer into v_cuantas
  from public.respuestas_de_entrega r
  where r.household_id = v_proyecto.household_id and r.propuesta_id = v_propuesta.id;

  if v_cuantas >= 20 then
    raise exception '%', private.motivo_de_la_entrega('tope') using errcode = 'MN020', detail = 'tope';
  end if;

  -- Los días se guardan en orden y cada franja una vez, la mañana antes que la tarde; la nota, sin los
  -- blancos de las puntas.
  begin
    insert into public.respuestas_de_entrega (id, household_id, proyecto_id, propuesta_id, respuesta, dias, nota)
    values (
      v_id,
      v_proyecto.household_id,
      v_proyecto.id,
      v_propuesta.id,
      (p_respuesta ->> 'respuesta')::public.respuesta_de_entrega,
      (
        select coalesce(
          jsonb_agg(
            jsonb_build_object(
              'fecha', d ->> 'fecha',
              'franjas', (
                select jsonb_agg(f order by case f when 'manana' then 1 else 2 end)
                from jsonb_array_elements_text(d -> 'franjas') as f
              )
            )
            order by d ->> 'fecha'
          ),
          '[]'::jsonb
        )
        from jsonb_array_elements(p_respuesta -> 'dias') as d
      ),
      regexp_replace(p_respuesta ->> 'nota', '^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$', '', 'g')
    );
  exception
    -- El id ya es de otra respuesta, de otra propuesta u otro taller: no es un reenvío de esta.
    when unique_violation then
      raise exception '%', private.motivo_de_la_entrega('forma') using errcode = 'MN020', detail = 'forma';
  end;

  -- Aceptar el día propuesto lo compromete: proponerlo ya era confirmar que se puede. El update toca
  -- solo esas dos columnas, marca que lo fijó el cliente para la historia y vuelve la marca a vacío.
  -- Sube la versión del trabajo, así que un guardado del dueño que esperaba en la cola con la versión
  -- de antes rebota con MN006 y le pide abrirlo de nuevo.
  if p_respuesta ->> 'respuesta' = 'me_queda_bien' then
    perform set_config('maun.origen_de_la_fecha', 'cliente', true);
    update public.proyectos
    set entrega_comprometida = v_propuesta.fecha,
        entrega_comprometida_franja = v_propuesta.franja
    where id = v_proyecto.id;
    perform set_config('maun.origen_de_la_fecha', '', true);
  end if;

  -- Las guardas diferidas de proyectos (presupuesto_aprobado) saltan con cualquier update y no son
  -- security definer: al commit correrían como anon, que no puede leer proyectos, y cortarían con
  -- 42501. Se corren acá, todavía como dueño de la función. Después se devuelven a diferidas, que es
  -- como nacen todas las de la base: la transacción queda como estaba.
  set constraints all immediate;
  set constraints all deferred;

  return jsonb_build_object('estado', 'guardada');
end;
$$;

comment on function public.responder_la_entrega(text, jsonb) is
  'Guarda lo que contestó sobre la entrega el cliente que abrió el enlace de su trabajo, sin sesión. Es una de las cinco funciones que el rol anónimo puede ejecutar. PUEDE: insertar una respuesta a la propuesta de entrega abierta de ese trabajo; y si acepta el día propuesto (me_queda_bien), fijar la entrega comprometida con el día y la franja de la propuesta, que es lo único que actualiza. NO PUEDE: tocar otra columna ni otro trabajo; borrar nada; contestar una propuesta cerrada, de otro trabajo o de un día que ya pasó (contesta cambio); contestar con la entrega ya comprometida (contesta ya_confirmada); contestar más de 20 veces a una propuesta; devolver datos: devuelve solo {estado}. Antes de escribir valida que el enlace y el trabajo estén vivos (MN010 igual para todo lo que no sirve, como la vista) y que la respuesta tenga la forma, los días (de pasado mañana a dentro de 30 días, sin domingos, cada uno con la mañana, la tarde o las dos) y la nota (hasta 500) que corresponden (private.validar_respuesta_de_entrega); lo que no cumple se rechaza entero con MN020 y el motivo en el detail. El mismo id otra vez contesta guardada y no duplica. Bloquea el trabajo, el enlace y la propuesta en el orden de la baja de un trabajo. Aceptar el día sube la versión del trabajo, así que un guardado del dueño que esperaba en la cola rebota con MN006. Corre las guardas diferidas con set constraints all immediate antes de volver, porque al commit correrían como anon (ADR 0071).';

revoke all on function public.responder_la_entrega(text, jsonb) from public, anon, authenticated;
grant execute on function public.responder_la_entrega(text, jsonb) to anon;
