-- Cuánto es cada pago, no solo cómo se paga (ADR 0053).
--
-- No toca ninguna tabla: solo cambia dos funciones. Ninguna fila existente se lee ni se escribe.
--
-- La página del cliente pasa a mostrar, arriba de la forma de pago, cuánto es ese pago. Para eso
-- necesita dos importes y no uno: el que le toca ahora y, si después viene otro, cuánto es ese
-- otro. Los dos salen de los montos que ya están guardados —el presupuesto, los pagos y el
-- porcentaje de seña—: no se agrega ni una columna.
--
-- private.pago_que_toca() se reemplaza por private.pagos_por_delante(), que devuelve los dos en
-- orden en vez de solo el primero. Es la gemela en SQL de pagosPorDelante() de @maun/domain, y
-- scripts/comparacion.ts las compara caso por caso. Cambia la lista de argumentos de salida, así
-- que va con drop y create, no con or replace, y el revoke y el grant se repiten.


-- Los pagos que le faltan al cliente, en orden ---------------------------------------------------------

drop function private.pago_que_toca(bigint, bigint, integer);

create function private.pagos_por_delante(
  p_precio_centavos bigint,
  p_pagado_centavos bigint,
  p_sena_bp integer
)
returns table (orden integer, instancia text, monto_centavos bigint)
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_falta bigint;
  v_sena bigint;
  v_despues bigint;
begin
  -- Sin presupuesto no hay importe que calcular, pero el camino se conoce igual: primero la seña y
  -- después el saldo. La pantalla los anticipa sin número.
  if p_precio_centavos is null then
    return query values (1, 'sena', null::bigint), (2, 'saldo', null::bigint);
    return;
  end if;

  v_falta := p_precio_centavos - p_pagado_centavos;
  if v_falta <= 0 then
    return;
  end if;

  -- La misma cuenta que aplicarPorcentaje() de @maun/domain y que el diezmo de private.cascada():
  -- medio punto para redondear y división entera, que con importes no negativos es piso.
  v_sena := (p_precio_centavos * p_sena_bp + 5000) / 10000;

  if p_pagado_centavos >= v_sena then
    return query values (1, 'saldo', v_falta);
    return;
  end if;

  -- Lo que queda después de cubrir la seña no es «lo que falta menos la seña que falta»: es el
  -- presupuesto menos la seña entera. Con parte de la seña ya cobrada las dos cuentas no dan lo
  -- mismo, y la que el cliente va a tener que pagar es esta.
  v_despues := p_precio_centavos - v_sena;
  if v_despues <= 0 then
    return query values (1, 'sena', v_sena - p_pagado_centavos);
    return;
  end if;

  return query values (1, 'sena', v_sena - p_pagado_centavos), (2, 'saldo', v_despues);
end;
$$;

revoke all on function private.pagos_por_delante(bigint, bigint, integer)
  from public, anon, authenticated;
grant execute on function private.pagos_por_delante(bigint, bigint, integer) to authenticated;

comment on function private.pagos_por_delante(bigint, bigint, integer) is
  'Los pagos que le faltan al cliente, en el orden en que los va a hacer: la seña mientras no esté cubierta y después el saldo, o nada cuando ya pagó todo. El importe de la seña es lo que falta de ella, con todo lo cobrado hasta hoy ya descontado —la visita incluida, que entra como un pago más—; el del saldo es el presupuesto menos la seña entera, que es lo que va a quedar cuando la termine de pagar. Sin presupuesto devuelve los dos sin importe: el porcentaje de seña es política comercial del taller y no viaja. Es la gemela en SQL de pagosPorDelante() de @maun/domain y scripts/comparacion.ts las compara caso por caso (ADR 0053).';


-- La lista blanca: el pago de ahora y el que sigue ------------------------------------------------------

-- Mismo nombre y misma firma, así que or replace conserva los grants. Lo que cambia es la clave
-- «pago», que ahora lleva adentro «siguiente» con la instancia que viene después, sus formas y su
-- importe. La cuenta para transferir sigue viajando solo si el pago de AHORA se ofrece por
-- transferencia: el de después dice cómo se va a pagar, no adónde.
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
  v_ahora record;
  v_despues record;
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

  select * into v_ahora from private.pagos_por_delante(
    v_p.presupuesto_centavos,
    v_pagado,
    coalesce(v_p.sena_bp, v_ajustes.sena_bp, 5000)
  ) where orden = 1;

  select * into v_despues from private.pagos_por_delante(
    v_p.presupuesto_centavos,
    v_pagado,
    coalesce(v_p.sena_bp, v_ajustes.sena_bp, 5000)
  ) where orden = 2;

  -- Con todo pagado no hay ninguna instancia, así que tampoco hay formas ni datos de la cuenta.
  if v_ahora.instancia is null then
    v_formas := array[]::public.forma_de_cobro[];
  elsif v_ahora.instancia = 'sena' then
    v_formas := private.formas_de_cobro(v_p.cobro_sena, v_hay_como_transferir);
  else
    v_formas := private.formas_de_cobro(v_p.cobro_saldo, v_hay_como_transferir);
  end if;

  v_por_transferencia := 'transferencia' = any (v_formas);

  if v_despues.instancia is null then
    v_siguiente := null;
  else
    v_siguiente := jsonb_build_object(
      'instancia', v_despues.instancia,
      'formas', to_jsonb(
        case
          when v_despues.instancia = 'sena'
            then private.formas_de_cobro(v_p.cobro_sena, v_hay_como_transferir)
          else private.formas_de_cobro(v_p.cobro_saldo, v_hay_como_transferir)
        end
      ),
      'monto_centavos', v_despues.monto_centavos
    );
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
    'direccion', v_p.direccion_entrega,
    'estado', v_p.estado,
    'precio_centavos', v_p.presupuesto_centavos,
    -- El pago que toca ahora y, si hay otro después, cuánto es y cómo se paga. Los importes salen
    -- de lo que ya está guardado; el porcentaje de seña sigue sin viajar, que es lo que dejó
    -- abierto el ADR 0048.
    'pago', jsonb_build_object(
      'instancia', v_ahora.instancia,
      'formas', to_jsonb(v_formas),
      'monto_centavos', v_ahora.monto_centavos,
      'siguiente', v_siguiente
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
  'Lo único que un cliente puede ver de su trabajo: cuánto vale, cuánto pagó, en qué anda, la dirección de entrega, los archivos que el dueño marcó, qué pago le toca ahora, cuánto es, cómo puede pagarlo y cuál viene después. Enumera los campos uno por uno y nunca devuelve la fila entera: convertirla en un select * expondría cada columna nueva de proyectos sin que nadie lo decida, costos estimados y margen incluidos. De ajustes viajan exactamente los cuatro campos de cobro, y solo cuando el pago que toca AHORA se ofrece por transferencia: lo que no se muestra, no se manda. El porcentaje de seña no viaja nunca; lo que viaja son los importes que salen de él. Es security invoker: desde la app la llama el dueño y la RLS decide; desde el link la llama public.vista_compartida(), que ya resolvió el token (ADR 0046, 0048 y 0053).';
