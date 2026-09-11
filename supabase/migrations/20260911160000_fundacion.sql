-- Fundación: el schema privado, el generador de UUIDv7, los enums del negocio y el
-- trigger de metadatos que comparten todas las tablas.

create schema private;

comment on schema private is
  'Helpers de RLS, triggers y funciones internas. La Data API no expone este schema: nada de acá se llama por RPC.';

revoke all on schema private from public;
-- authenticated necesita usage para que las policies y los defaults puedan llamar a los helpers.
grant usage on schema private to authenticated;


-- UUIDv7 ---------------------------------------------------------------------------------------

-- Postgres 17 no trae uuidv7() (llega en 18). El camino normal es que el id lo genere el cliente
-- al guardar; este default es la red de seguridad para inserts que no lo traen.
create function private.uuidv7()
returns uuid
language sql
volatile
parallel safe
set search_path = ''
as $$
  -- 48 bits de milisegundos Unix sobre los 128 bits aleatorios de gen_random_uuid(). Los bits 52
  -- y 53 pasan la versión de 4 (0100) a 7 (0111); los de variante ya vienen en 10.
  select encode(
    set_bit(
      set_bit(
        overlay(
          uuid_send(gen_random_uuid())
          placing substring(int8send(floor(extract(epoch from clock_timestamp()) * 1000)::bigint) from 3)
          from 1 for 6
        ),
        52, 1
      ),
      53, 1
    ),
    'hex'
  )::uuid
$$;

comment on function private.uuidv7() is
  'UUID versión 7 (RFC 9562): ordenado por tiempo, así los inserts caen al final del índice. Default de las columnas id.';

revoke all on function private.uuidv7() from public;
grant execute on function private.uuidv7() to authenticated;


-- Enums ----------------------------------------------------------------------------------------

create type public.rol_household as enum ('titular', 'miembro');
comment on type public.rol_household is 'Rol de un usuario dentro de su household.';

create type public.estado_proyecto as enum (
  'contacto',
  'relevamiento',
  'a_presupuestar',
  'presupuesto_enviado',
  'perdido',
  'en_curso',
  'entregado',
  'cobrado'
);
comment on type public.estado_proyecto is
  'Lead y proyecto son el mismo registro: los primeros cinco estados son de seguimiento, los últimos tres de obra. Las transiciones válidas viven en @maun/domain.';

create type public.forma_pago as enum ('efectivo', 'transferencia', 'cuotas', 'mixto');
comment on type public.forma_pago is 'Forma de pago acordada con el cliente para el proyecto.';

create type public.comprobante as enum ('factura_a', 'factura_b', 'factura_c', 'remito', 'sin_comprobante');
comment on type public.comprobante is 'Comprobante a emitir al cliente.';

create type public.condicion_fiscal as enum ('consumidor_final', 'monotributo', 'responsable_inscripto', 'exento');
comment on type public.condicion_fiscal is 'Condición frente al IVA del cliente.';

create type public.origen_contacto as enum ('referido', 'redes', 'volvio', 'cartel', 'otro');
comment on type public.origen_contacto is 'Cómo llegó el cliente al taller. El detalle libre va en clientes.origen_detalle.';

create type public.tesoro as enum ('hogar', 'maun', 'diezmo', 'cocos');
comment on type public.tesoro is
  'Las cuatro cajas: hogar (la familia), maun (el taller), diezmo (lo apartado para el diezmo) y cocos (el ahorro invertido).';

create type public.tipo_movimiento as enum (
  'ingreso',
  'gasto',
  'transferencia',
  'pago_diezmo',
  'aporte_cocos',
  'ajuste'
);
comment on type public.tipo_movimiento is
  'Tipo de un movimiento cargado a mano. Cada tipo fija qué lados (origen, destino) lleva: ver el check movimientos_forma_segun_tipo.';


-- Metadatos de fila ------------------------------------------------------------------------------

-- Mantiene updated_at y version, y protege id y household_id. Corre en toda tabla de public.
create function private.mantener_metadatos()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.updated_at := clock_timestamp();
    new.version := 1;
    return new;
  end if;

  if new.id is distinct from old.id then
    raise exception 'El id de una fila no se puede cambiar (tabla %)', tg_table_name
      using errcode = 'MN004';
  end if;

  if (to_jsonb(new) -> 'household_id') is distinct from (to_jsonb(old) -> 'household_id') then
    raise exception 'Una fila no se puede mover de household (tabla %)', tg_table_name
      using errcode = 'MN004';
  end if;

  new.created_at := old.created_at;
  new.updated_at := old.updated_at;
  new.version := old.version;

  -- Borrar lo que ya está borrado no cambia la marca: una baja reenviada, o hecha también desde el
  -- otro dispositivo, conserva la primera y cae en el no-op de abajo.
  if old.deleted_at is not null and new.deleted_at is not null then
    new.deleted_at := old.deleted_at;
  end if;

  -- Un update que no cambia nada (la cola de salida reenviando una mutación ya aplicada) no toca
  -- updated_at ni version: así drenar la cola dos veces no genera deltas ni conflictos falsos.
  if new is not distinct from old then
    return new;
  end if;

  -- clock_timestamp() y no now(): la marca queda lo más cerca posible del commit, lo que achica
  -- la ventana de la trampa de la marca de agua (ver public.delta).
  new.updated_at := clock_timestamp();
  new.version := old.version + 1;
  return new;
end;
$$;

comment on function private.mantener_metadatos() is
  'Trigger BEFORE INSERT OR UPDATE de toda tabla: updated_at y version los pone la base, nunca el cliente; id y household_id son inmutables; un update sin cambios es un no-op.';

revoke all on function private.mantener_metadatos() from public;


-- Devuelve true si el update no cambia nada fuera de los metadatos. Lo usan los triggers que
-- validan reglas de negocio para dejar pasar el reenvío idéntico de una mutación ya aplicada.
create function private.es_reenvio(p_old jsonb, p_new jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select (p_old - array['created_at', 'updated_at', 'version']) = (p_new - array['created_at', 'updated_at', 'version'])
$$;

revoke all on function private.es_reenvio(jsonb, jsonb) from public;
grant execute on function private.es_reenvio(jsonb, jsonb) to authenticated;
