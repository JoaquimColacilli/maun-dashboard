-- Sincronización: réplica completa del household en el cliente (ADR 0010).
--
-- bootstrap() devuelve todo el household en un solo JSON: desde Buenos Aires, seis consultas de
-- PostgREST son seis round trips y esta es una. delta() devuelve lo cambiado desde un cursor,
-- incluidas las filas borradas, para que el cliente las saque de su copia.
--
-- Las dos son security invoker: no filtran por household, de eso se encarga la RLS de cada tabla.

create function public.bootstrap()
returns jsonb
language sql
stable
security invoker
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
    'movimientos', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.movimientos t where t.deleted_at is null
    )
  )
$$;

comment on function public.bootstrap() is
  'Todo el household del usuario en un JSON, sin filas borradas, más el cursor para el primer delta. Es también el reconcile completo: el cliente reemplaza su copia entera con esto.';

revoke all on function public.bootstrap() from public, anon, authenticated;
grant execute on function public.bootstrap() to authenticated;


-- La trampa de la marca de agua: una transacción que escribe antes del cursor pero commitea
-- después es invisible para el delta que fijó ese cursor, y el siguiente delta la saltearía para
-- siempre. Mitigación: el delta pide desde cinco minutos antes del cursor (el solape lo aplica la
-- base, no el cliente), y cada tanto el cliente hace un reconcile completo con bootstrap(). Las
-- transacciones de esta app duran milisegundos; cinco minutos es un margen de sobra. Las filas
-- repetidas por el solape las descarta el cliente comparando version.
create function public.delta(p_desde timestamptz)
returns jsonb
language plpgsql
stable
security invoker
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
    'movimientos', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.movimientos t where t.updated_at >= v_desde
    )
  );
end;
$$;

comment on function public.delta(timestamptz) is
  'Filas del household cambiadas desde el cursor, incluidas las borradas (deleted_at no null), más el cursor siguiente. Aplica un solape de cinco minutos.';

revoke all on function public.delta(timestamptz) from public, anon, authenticated;
grant execute on function public.delta(timestamptz) to authenticated;
