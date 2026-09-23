-- La app abierta se entera sola de que algo cambió en su taller (ADR 0065).
--
-- Cada transacción que escribe en una tabla del delta manda un aviso por Realtime Broadcast al canal
-- privado de su taller, cambios:<household_id>: uno por transacción y por taller, aunque toque cien
-- filas. El aviso no lleva datos. La app que lo recibe pide el delta, que lee con la RLS de siempre, y
-- el delta sigue siendo el único camino por el que entran filas a la réplica.
--
-- Quién puede escuchar un canal lo decide una política sobre realtime.messages: solo authenticated, y
-- solo el canal de un taller del que es miembro. anon no recibe nada nuevo.
--
-- Es aditiva: agrega funciones, triggers y una política. No toca filas.

create function private.mandar_el_aviso_de_cambios(p_household uuid)
returns void
language sql
set search_path = ''
as $$
  select realtime.send('{}'::jsonb, 'cambios', 'cambios:' || p_household::text, true)
$$;

comment on function private.mandar_el_aviso_de_cambios(uuid) is
  'Manda el aviso de cambios al canal privado del taller, cambios:<household_id>, con el evento cambios y un payload vacío (realtime.send le agrega solo un id). Gemela de TEMA_DE_LOS_CAMBIOS y EVENTO_DE_LOS_CAMBIOS de @maun/db. realtime.send no corta la transacción si falla: la escritura del usuario vale aunque el aviso no salga.';

revoke all on function private.mandar_el_aviso_de_cambios(uuid) from public, anon, authenticated;

create function private.avisar_los_cambios()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_household uuid;
  v_avisados text;
begin
  v_household := (
    to_jsonb(case when tg_op = 'DELETE' then old else new end) ->> tg_argv[0]
  )::uuid;
  if v_household is null then
    return null;
  end if;

  v_avisados := coalesce(current_setting('maun.cambios_avisados', true), '');
  if position(v_household::text in v_avisados) > 0 then
    return null;
  end if;
  perform set_config('maun.cambios_avisados', v_avisados || v_household::text || ',', true);

  perform private.mandar_el_aviso_de_cambios(v_household);
  return null;
end;
$$;

comment on function private.avisar_los_cambios() is
  'Trigger de cada tabla del delta: la primera escritura de la transacción en un taller le manda el aviso de cambios, y las demás lo saltean (la marca maun.cambios_avisados vive lo que la transacción). El aviso no lleva datos a propósito: Broadcast autoriza por canal, no por fila, así que cualquier fila en el payload pasaría por al lado de la RLS de su tabla, quedaría guardada en realtime.messages y armaría un segundo camino de entrada a la réplica. Con el aviso vacío, lo único que sabe quien escucha es que algo cambió, y lo que cambió lo trae el delta. Security definer porque escribe en realtime.messages, que no le da insert a authenticated ni a anon. El argumento es la columna del taller: household_id, o id en households.';

revoke all on function private.avisar_los_cambios() from public, anon, authenticated;

create trigger avisar_los_cambios after insert or update or delete on public.households
  for each row execute function private.avisar_los_cambios('id');
create trigger avisar_los_cambios after insert or update or delete on public.household_members
  for each row execute function private.avisar_los_cambios('household_id');
create trigger avisar_los_cambios after insert or update or delete on public.ajustes
  for each row execute function private.avisar_los_cambios('household_id');
create trigger avisar_los_cambios after insert or update or delete on public.clientes
  for each row execute function private.avisar_los_cambios('household_id');
create trigger avisar_los_cambios after insert or update or delete on public.proyectos
  for each row execute function private.avisar_los_cambios('household_id');
create trigger avisar_los_cambios after insert or update or delete on public.pagos
  for each row execute function private.avisar_los_cambios('household_id');
create trigger avisar_los_cambios after insert or update or delete on public.gastos
  for each row execute function private.avisar_los_cambios('household_id');
create trigger avisar_los_cambios after insert or update or delete on public.opciones_de_presupuesto
  for each row execute function private.avisar_los_cambios('household_id');
create trigger avisar_los_cambios after insert or update or delete on public.necesidades
  for each row execute function private.avisar_los_cambios('household_id');
create trigger avisar_los_cambios after insert or update or delete on public.proximos_contactos
  for each row execute function private.avisar_los_cambios('household_id');
create trigger avisar_los_cambios after insert or update or delete on public.movimientos
  for each row execute function private.avisar_los_cambios('household_id');
create trigger avisar_los_cambios after insert or update or delete on public.anotaciones
  for each row execute function private.avisar_los_cambios('household_id');
create trigger avisar_los_cambios after insert or update or delete on public.archivos
  for each row execute function private.avisar_los_cambios('household_id');
create trigger avisar_los_cambios after insert or update or delete on public.enlaces_publicos
  for each row execute function private.avisar_los_cambios('household_id');
create trigger avisar_los_cambios after insert or update or delete on public.preguntas
  for each row execute function private.avisar_los_cambios('household_id');
create trigger avisar_los_cambios after insert or update or delete on public.encuestas_enviadas
  for each row execute function private.avisar_los_cambios('household_id');
create trigger avisar_los_cambios after insert or update or delete on public.respuestas
  for each row execute function private.avisar_los_cambios('household_id');
create trigger avisar_los_cambios after insert or update or delete on public.renglones_de_respuesta
  for each row execute function private.avisar_los_cambios('household_id');

create function private.es_el_canal_de_mi_taller(p_tema text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(p_tema, '') in (
    select 'cambios:' || h::text from private.user_household_ids() as h
  )
$$;

comment on function private.es_el_canal_de_mi_taller(text) is
  'Si el canal de Realtime que se quiere escuchar es cambios:<household_id> de un taller del que el usuario es miembro. La usa la política de lectura de realtime.messages, que corre con el rol y los claims de quien se conecta.';

revoke all on function private.es_el_canal_de_mi_taller(text) from public, anon, authenticated;
grant execute on function private.es_el_canal_de_mi_taller(text) to authenticated;

create policy cambios_del_taller_escucha on realtime.messages
  as permissive
  for select
  to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and private.es_el_canal_de_mi_taller((select realtime.topic()))
  );

comment on policy cambios_del_taller_escucha on realtime.messages is
  'Solo el dueño escucha el canal de cambios de su taller. Es la única autorización del canal, y alcanza porque el aviso no lleva datos: quien lo recibe sabe que algo cambió y pide el delta, que vuelve a pasar por la RLS de cada tabla. anon no tiene política, así que no se suscribe a ningún canal privado.';
