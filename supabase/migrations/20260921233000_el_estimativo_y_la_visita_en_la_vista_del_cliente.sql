-- El estimativo y la visita para medir en la vista del cliente (ADR 0058).
--
-- Aditiva. Reemplaza la función de la lista blanca y cambia dos comentarios de columna: no toca
-- ninguna tabla ni ninguna fila. Mismo nombre y misma firma, así que or replace conserva los
-- grants: authenticated la ejecuta y anon no. La puerta del link sigue siendo
-- public.vista_compartida(), que no cambia y devuelve lo mismo que esta.
--
-- Tres cambios, y ninguno agrega una columna:
--
-- 1. La fecha del estimativo: el primer día que el trabajo entró a «Estimativo enviado», leída de
--    public.cambios_de_estado igual que la del presupuesto y la de la aprobación. Viaja el día, no
--    un importe: el estimativo no guarda monto (ADR 0038).
-- 2. La visita para medir: el día (fecha_visita) y si ya se fue (visita_hecha), tal como están. Qué
--    ve el cliente con eso, si el casillero en blanco, tildado o ninguno, lo decide
--    vistaDelCliente() de @maun/domain, que es el único lugar donde una etapa se traduce a lo que ve
--    el cliente. La hora de la visita no viaja.
-- 3. En la etapa del estimativo el precio no viaja. presupuesto_centavos es el del presupuesto, y un
--    trabajo que volvió de «Presupuesto enviado» a estimativo lo conserva: mandarlo sería ponerle al
--    lado de «Te pasamos un número estimado» un número que no es ese. Sin precio, los pagos que
--    vienen salen sin importe, como en cualquier trabajo sin presupuesto.


-- La lista blanca ---------------------------------------------------------------------------------

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
  v_link text;
  v_hay_como_transferir boolean;
  v_precio bigint;
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
  v_link := nullif(v_ajustes.cobro_link, '');
  v_hay_como_transferir := v_alias is not null or v_cbu is not null or v_link is not null;

  -- Con el estimativo como etapa actual, el número que se le pasó es aproximado y no está guardado:
  -- lo que haya en presupuesto_centavos es otro número, y no viaja.
  v_precio := case
    when v_p.estado = 'presupuesto_estimativo' then null
    else v_p.presupuesto_centavos
  end;

  select coalesce(sum(g.monto_centavos), 0) into v_pagado
  from public.pagos g
  where g.household_id = v_p.household_id
    and g.proyecto_id = v_p.id
    and g.deleted_at is null;

  select * into v_ahora from private.pagos_por_delante(
    v_precio,
    v_pagado,
    coalesce(v_p.sena_bp, v_ajustes.sena_bp, 5000)
  ) where orden = 1;

  select * into v_despues from private.pagos_por_delante(
    v_precio,
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
    'precio_centavos', v_precio,
    -- El pago que toca ahora y, si hay otro después, cuánto es y cómo se paga. Los importes salen
    -- de lo que ya está guardado; el porcentaje de seña sigue sin viajar, que es lo que dejó
    -- abierto el ADR 0048.
    'pago', jsonb_build_object(
      'instancia', v_ahora.instancia,
      'formas', to_jsonb(v_formas),
      'monto_centavos', v_ahora.monto_centavos,
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
    -- La visita para medir: el día acordado o en que se fue, y si ya se fue. La hora no viaja.
    'visita', jsonb_build_object(
      'dia', v_p.fecha_visita,
      'hecha', v_p.visita_hecha
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
  'Lo único que un cliente puede ver de su trabajo: cuánto vale, cuánto pagó, en qué anda, la dirección de entrega, los archivos que el dueño marcó, qué pago le toca ahora, cuánto es, cómo puede pagarlo y cuál viene después, el día que se le mandó el estimativo y el día de la visita para medir con si ya se fue. Enumera los campos uno por uno y nunca devuelve la fila entera: convertirla en un select * expondría cada columna nueva de proyectos sin que nadie lo decida, costos estimados y margen incluidos. Del estimativo viaja el día, nunca un importe, y mientras el trabajo está en esa etapa tampoco viaja el precio. De la visita viajan el día y la marca, no la hora. De ajustes viajan exactamente los cinco campos de cobro —los cuatro de la cuenta y el link de Mercado Pago—, y solo cuando el pago que toca AHORA se ofrece por transferencia: lo que no se muestra, no se manda. El porcentaje de seña no viaja nunca; lo que viaja son los importes que salen de él. Es security invoker: desde la app la llama el dueño y la RLS decide; desde el link la llama public.vista_compartida(), que ya resolvió el token (ADR 0046, 0048, 0053, 0054 y 0058).';


-- Las dos columnas de la visita dicen que viajan -------------------------------------------------

comment on column public.proyectos.fecha_visita is
  'Visita de relevamiento, en la etapa de seguimiento. Viaja a la vista del cliente: es el día que dice el casillero del relevamiento. La hora, visita_hora, no viaja (ADR 0058).';

comment on column public.proyectos.visita_hecha is
  'La visita de relevamiento ya pasó. Lo anota «Ya fui a relevar» y se corrige desde la hoja del contacto; mover la visita a un día que todavía no llegó lo apaga. No sale de la etapa: cambiar de etapa, aprobar o perder el contacto no lo toca, y la agenda muestra la visita tachada en su día (ADR 0042). Viaja a la vista del cliente: es lo que tilda el casillero del relevamiento (ADR 0058).';
