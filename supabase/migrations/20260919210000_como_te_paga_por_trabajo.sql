-- Cómo te paga: la forma de cobro por trabajo y por instancia de pago (ADR 0053).
--
-- Todo aditivo. Ninguna fila existente cambia de valor: las dos columnas nacen en null y los dos
-- check que las acompañan dejan pasar el null, que es «este trabajo no lo configuró» y vale el
-- valor por defecto que calcula private.formas_de_cobro().
--
-- Cuatro cosas:
--  1. public.forma_de_cobro, el enum con las dos formas que este taller usa de verdad.
--  2. public.proyectos.cobro_sena y .cobro_saldo: qué formas se ofrecen en cada instancia de pago.
--  3. private.formas_de_cobro() y private.pago_que_toca(), las dos reglas que la vista pública
--     necesita para decidir qué mostrarle al cliente. pago_que_toca() es la gemela en SQL de
--     pagoQueToca() de @maun/domain, y scripts/comparacion.ts las compara caso por caso.
--  4. public.vista_del_cliente() devuelve el pago que toca con sus formas y su importe, y deja de
--     mandar los datos de la cuenta cuando ese pago no se ofrece por transferencia.


-- El enum -----------------------------------------------------------------------------------------------

create type public.forma_de_cobro as enum ('transferencia', 'efectivo');

comment on type public.forma_de_cobro is
  'Cómo le paga el cliente al taller una instancia de pago concreta. Transferencia es el cliente entrando a su banco o a su billetera y mandando plata al alias del taller: la arranca él y no tiene costo. Efectivo es en mano. No hay una tercera: cobrar con un link de pago o con un QR de cobro de Mercado Pago le cuesta comisión al taller y este PR no los usa (ADR 0051 y 0053).';


-- Las dos columnas --------------------------------------------------------------------------------------

alter table public.proyectos
  add column cobro_sena public.forma_de_cobro[],
  add column cobro_saldo public.forma_de_cobro[];

-- El check enumera las tres combinaciones legales en vez de contar elementos. Así prohíbe de una el
-- arreglo vacío (un pago sin ninguna forma), los repetidos, el orden al revés y un null adentro del
-- arreglo. Va envuelto en coalesce porque comparar un arreglo con un null adentro da null, y un
-- check que evalúa a null pasa: sin el coalesce, '{null}' entraría.
alter table public.proyectos
  add constraint proyectos_cobro_sena_valido check (
    coalesce(
      cobro_sena is null or cobro_sena in (
        array['transferencia']::public.forma_de_cobro[],
        array['efectivo']::public.forma_de_cobro[],
        array['transferencia', 'efectivo']::public.forma_de_cobro[]
      ),
      false
    )
  ),
  add constraint proyectos_cobro_saldo_valido check (
    coalesce(
      cobro_saldo is null or cobro_saldo in (
        array['transferencia']::public.forma_de_cobro[],
        array['efectivo']::public.forma_de_cobro[],
        array['transferencia', 'efectivo']::public.forma_de_cobro[]
      ),
      false
    )
  );

comment on column public.proyectos.cobro_sena is
  'Cómo se puede pagar la seña de este trabajo, o null si el dueño no lo tocó. Null no es vacío: es «vale el valor por defecto», que private.formas_de_cobro() calcula según si el taller tiene datos para transferir cargados. El check acepta exactamente tres valores, así que un pago nunca queda sin ninguna forma (ADR 0053).';
comment on column public.proyectos.cobro_saldo is
  'Lo mismo para el saldo. Son dos columnas y no una porque el dueño pide la seña por transferencia y cobra el saldo en efectivo cuando termina de instalar, que es el caso que motivó esto (ADR 0053).';

-- Solo update, como los costos estimados y las marcas de la agenda: guardar_proyecto no las escribe,
-- así que guardar el agregado no pisa lo que se configuró en la pantalla de compartir, ni al revés
-- (ADR 0045 para el mismo reparto).
grant update (cobro_sena, cobro_saldo) on table public.proyectos to authenticated;


-- La regla del valor por defecto ---------------------------------------------------------------------

-- Las dos las llama public.vista_del_cliente(), que es security invoker: sin el grant a
-- authenticated, el dueño no puede abrir la vista desde su propia app. Ninguna toca una tabla:
-- reciben números y devuelven números (lo mismo que private.ruta_del_archivo, ADR 0046).

create or replace function private.formas_de_cobro(
  p_guardado public.forma_de_cobro[],
  p_hay_como_transferir boolean
)
returns public.forma_de_cobro[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    p_guardado,
    case
      when p_hay_como_transferir then array['transferencia', 'efectivo']::public.forma_de_cobro[]
      else array['efectivo']::public.forma_de_cobro[]
    end
  );
$$;

revoke all on function private.formas_de_cobro(public.forma_de_cobro[], boolean)
  from public, anon, authenticated;
grant execute on function private.formas_de_cobro(public.forma_de_cobro[], boolean) to authenticated;

comment on function private.formas_de_cobro(public.forma_de_cobro[], boolean) is
  'Las formas que valen para una instancia de pago: lo que el dueño guardó, o el valor por defecto. Por defecto son las dos, salvo que el taller no tenga ni alias ni CBU cargados en Ajustes, y entonces solo efectivo: ofrecer transferencia sin adónde transferir sería mandarle al cliente una pantalla vacía. Tiene gemela en TypeScript (formasDeCobro, en @maun/domain), que es la que usa la pantalla del dueño; las dos se comparan en scripts/comparacion.ts (ADR 0053).';


-- Qué pago toca ahora -----------------------------------------------------------------------------------

create or replace function private.pago_que_toca(
  p_precio_centavos bigint,
  p_pagado_centavos bigint,
  p_sena_bp integer,
  out instancia text,
  out monto_centavos bigint
)
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_sena bigint;
begin
  instancia := null;
  monto_centavos := null;

  -- Sin presupuesto no hay importe que calcular, pero lo que sigue es la seña igual: es lo primero
  -- que el cliente paga y es lo que la pantalla le anticipa.
  if p_precio_centavos is null then
    instancia := 'sena';
    return;
  end if;

  if p_pagado_centavos >= p_precio_centavos then
    return;
  end if;

  -- La misma cuenta que aplicarPorcentaje() de @maun/domain y que el diezmo de private.cascada():
  -- medio punto para redondear y división entera, que con importes no negativos es piso.
  v_sena := (p_precio_centavos * p_sena_bp + 5000) / 10000;

  if p_pagado_centavos < v_sena then
    instancia := 'sena';
    monto_centavos := v_sena - p_pagado_centavos;
    return;
  end if;

  instancia := 'saldo';
  monto_centavos := p_precio_centavos - p_pagado_centavos;
end;
$$;

revoke all on function private.pago_que_toca(bigint, bigint, integer)
  from public, anon, authenticated;
grant execute on function private.pago_que_toca(bigint, bigint, integer) to authenticated;

comment on function private.pago_que_toca(bigint, bigint, integer) is
  'Qué le toca pagar al cliente ahora y cuánto: la seña mientras no esté cubierta, después el saldo, y nada cuando ya pagó todo (instancia en null). El importe es lo que falta de esa instancia, no el total. Sin presupuesto la instancia es la seña y el importe es null, porque el porcentaje de seña es política comercial del taller y no viaja: lo que viaja es el peso que el cliente tiene que transferir. Es la gemela en SQL de pagoQueToca() de @maun/domain y scripts/comparacion.ts las compara caso por caso (ADR 0053).';


-- La lista blanca: el pago que toca, y la cuenta solo si ese pago se transfiere ------------------------

-- Mismo nombre y misma firma, así que or replace conserva los grants: sigue siendo security invoker y
-- sigue sin grant para anon. Dos cosas nuevas:
--   - la clave «pago», con la instancia que toca, sus formas y su importe;
--   - «cobro» viaja en null cuando ese pago no se ofrece por transferencia. Lo que no se muestra, no
--     se manda: la clave queda, para que la forma de la respuesta no dependa de la configuración,
--     pero los cuatro datos de la cuenta no salen de la base.
create or replace function public.vista_del_cliente(p_proyecto_id uuid)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_p public.proyectos;
  v_taller text;
  v_cliente text;
  v_ajustes public.ajustes;
  v_alias text;
  v_cbu text;
  v_hay_como_transferir boolean;
  v_pagado bigint;
  v_pago record;
  v_formas public.forma_de_cobro[];
  v_por_transferencia boolean;
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

  select h.nombre into v_taller from public.households h where h.id = v_p.household_id;
  select c.nombre into v_cliente from public.clientes c where c.id = v_p.cliente_id;
  select * into v_ajustes from public.ajustes a where a.household_id = v_p.household_id;

  v_alias := nullif(v_ajustes.cobro_alias, '');
  v_cbu := nullif(v_ajustes.cobro_cbu, '');
  v_hay_como_transferir := v_alias is not null or v_cbu is not null;

  select coalesce(sum(g.monto_centavos), 0) into v_pagado
  from public.pagos g
  where g.household_id = v_p.household_id
    and g.proyecto_id = v_p.id
    and g.deleted_at is null;

  select * into v_pago from private.pago_que_toca(
    v_p.presupuesto_centavos,
    v_pagado,
    coalesce(v_p.sena_bp, v_ajustes.sena_bp, 5000)
  );

  -- Con todo pagado no hay ninguna instancia, así que tampoco hay formas ni datos de la cuenta.
  if v_pago.instancia is null then
    v_formas := array[]::public.forma_de_cobro[];
  elsif v_pago.instancia = 'sena' then
    v_formas := private.formas_de_cobro(v_p.cobro_sena, v_hay_como_transferir);
  else
    v_formas := private.formas_de_cobro(v_p.cobro_saldo, v_hay_como_transferir);
  end if;

  v_por_transferencia := 'transferencia' = any (v_formas);

  -- Los campos van enumerados uno por uno, a propósito. Si esto fuera to_jsonb(v_p) con la pantalla
  -- filtrando, el día que alguien le agregue una columna a proyectos esa columna quedaría expuesta
  -- sin que nadie lo decida: lo que el cliente ve se decide acá, no en el navegador. La suite lo
  -- controla con supabase/tests/25_vista_del_cliente.sql, que falla apenas aparece una columna
  -- nueva en proyectos o en ajustes hasta que alguien la clasifica como pública o privada.
  return jsonb_build_object(
    'taller', jsonb_build_object('nombre', v_taller),
    'cliente', jsonb_build_object('nombre', v_cliente),
    'trabajo', v_p.titulo,
    'direccion', v_p.direccion_entrega,
    'estado', v_p.estado,
    'precio_centavos', v_p.presupuesto_centavos,
    -- El pago que toca ahora. El importe es el peso que el cliente tiene que mandar; el porcentaje
    -- de seña sigue sin viajar, que es lo que dejó abierto el ADR 0048.
    'pago', jsonb_build_object(
      'instancia', v_pago.instancia,
      'formas', to_jsonb(v_formas),
      'monto_centavos', v_pago.monto_centavos
    ),
    -- Cómo transferirle al taller, y solo si el pago que toca se puede pagar así. De ajustes no
    -- viaja nada más: ni el sueldo, ni los costos fijos, ni la meta de Cocos, ni la seña.
    'cobro', jsonb_build_object(
      'alias', case when v_por_transferencia then v_alias end,
      'cbu', case when v_por_transferencia then v_cbu end,
      'titular', case when v_por_transferencia then nullif(v_ajustes.cobro_titular, '') end,
      'cuit', case when v_por_transferencia then nullif(v_ajustes.cobro_cuit, '') end
    ),
    'fechas', jsonb_build_object(
      'presupuesto', (
        select min(c.ocurrio_el)
        from public.cambios_de_estado c
        where c.household_id = v_p.household_id
          and c.proyecto_id = v_p.id
          and c.hacia = 'presupuesto_enviado'
      ),
      'aprobado', (
        select min(c.ocurrio_el)
        from public.cambios_de_estado c
        where c.household_id = v_p.household_id
          and c.proyecto_id = v_p.id
          and c.hacia = 'en_curso'
      ),
      'inicio', v_p.fecha_inicio,
      'entrega_pautada', v_p.entrega_estimada,
      'entregado', v_p.fecha_entrega,
      'cobro', case when v_p.estado = 'cobrado' then v_p.fecha_cobro end
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
  'Lo único que un cliente puede ver de su trabajo: cuánto vale, cuánto pagó, en qué anda, la dirección de entrega, los archivos que el dueño marcó, qué pago le toca ahora y cómo puede pagarlo. Enumera los campos uno por uno y nunca devuelve la fila entera: convertirla en un select * expondría cada columna nueva de proyectos sin que nadie lo decida, costos estimados y margen incluidos. De ajustes viajan exactamente los cuatro campos de cobro, y solo cuando el pago que toca se ofrece por transferencia: lo que no se muestra, no se manda. El porcentaje de seña no viaja nunca; lo que viaja es el importe que falta. Es security invoker: desde la app la llama el dueño y la RLS decide; desde el link la llama public.vista_compartida(), que ya resolvió el token (ADR 0046, 0048 y 0053).';
