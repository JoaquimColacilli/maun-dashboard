-- Los datos para transferir y el título del enlace (ADR 0048 y 0049).
--
-- Dos cosas, las dos aditivas. Ninguna fila existente cambia de valor.
--
-- 1. Cuatro columnas nuevas en public.ajustes con los datos para que el cliente transfiera: alias,
--    CBU o CVU, titular y CUIT. Todas de texto, con default vacío, así el alter no reescribe la
--    fila que ya está. Son lo único que se suma a lo que el cliente ve desde el PR de la vista, y
--    por eso viajan enumeradas en la lista blanca, como todo lo demás.
-- 2. public.titulo_compartido(text): la función mínima que alimenta la vista previa del enlace en
--    WhatsApp. Devuelve el título del trabajo y el nombre del taller, y nada más.


-- Los datos para transferir --------------------------------------------------------------------------

alter table public.ajustes
  add column cobro_alias text not null default ''
    constraint ajustes_cobro_alias_formato
      check (cobro_alias = '' or cobro_alias ~ '^[A-Za-z0-9.-]{6,20}$'),
  add column cobro_cbu text not null default ''
    constraint ajustes_cobro_cbu_formato
      check (cobro_cbu = '' or cobro_cbu ~ '^[0-9]{22}$'),
  add column cobro_titular text not null default ''
    constraint ajustes_cobro_titular_largo
      check (char_length(cobro_titular) <= 200),
  add column cobro_cuit text not null default ''
    constraint ajustes_cobro_cuit_formato
      check (cobro_cuit = '' or cobro_cuit ~ '^[0-9]{2}-[0-9]{8}-[0-9]$');

comment on column public.ajustes.cobro_alias is
  'El alias del taller para recibir transferencias, o vacío. El check es el del BCRA: 6 a 20 caracteres, letras, números, punto y guion medio (t.o. SNP, Com. "A" 8114). Los dígitos verificadores no aplican a un alias, y la unicidad la resuelve la cámara, no esta base (ADR 0048).';
comment on column public.ajustes.cobro_cbu is
  'El CBU o el CVU del taller, 22 dígitos sin espacios ni guiones, o vacío. Se guarda limpio y se muestra agrupado. El check controla la forma; los dos dígitos verificadores los revisa el dominio, que es donde el dueño ve el aviso antes de guardar (ADR 0048).';
comment on column public.ajustes.cobro_titular is
  'A nombre de quién está la cuenta, o vacío. Está para que el cliente confirme contra lo que le muestra su banco antes de transferir.';
comment on column public.ajustes.cobro_cuit is
  'El CUIT del titular con guiones (NN-NNNNNNNN-N), o vacío. Mismo formato que public.clientes.cuit; el dígito verificador lo revisa la app.';

-- Solo update, sin insert: la fila de ajustes la crea private.crear_household() con el taller, y el
-- cliente nunca la inserta.
grant update (
  cobro_alias, cobro_cbu, cobro_titular, cobro_cuit
) on table public.ajustes to authenticated;


-- La lista blanca ahora incluye los datos para transferir ------------------------------------------------

-- Mismo nombre y misma firma, así que or replace conserva los grants: sigue siendo security invoker,
-- sigue sin grant para anon y sigue ejecutable solo por authenticated. Lo único que cambia es la
-- clave «cobro», con los cuatro campos que el dueño carga en Ajustes. Van con nullif para que un
-- dato vacío no viaje como cadena vacía: lo que no cargó, no existe para el cliente.
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
    -- Lo único que se suma a lo que el cliente veía: cómo transferirle al taller. De ajustes no
    -- viaja nada más: ni el sueldo, ni los costos fijos, ni la meta de Cocos, ni la seña.
    'cobro', jsonb_build_object(
      'alias', nullif(v_ajustes.cobro_alias, ''),
      'cbu', nullif(v_ajustes.cobro_cbu, ''),
      'titular', nullif(v_ajustes.cobro_titular, ''),
      'cuit', nullif(v_ajustes.cobro_cuit, '')
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
  'Lo único que un cliente puede ver de su trabajo: cuánto vale, cuánto pagó, en qué anda, la dirección de entrega, los archivos que el dueño marcó y los datos para transferirle al taller. Enumera los campos uno por uno y nunca devuelve la fila entera: convertirla en un select * expondría cada columna nueva de proyectos sin que nadie lo decida, costos estimados y margen incluidos. De ajustes viajan exactamente los cuatro campos de cobro y ninguno más. Es security invoker: desde la app la llama el dueño y la RLS decide; desde el link la llama public.vista_compartida(), que ya resolvió el token (ADR 0046 y 0048).';


-- El título, para la vista previa del enlace ------------------------------------------------------------------

create function public.titulo_compartido(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_enlace public.enlaces_publicos;
  v_p public.proyectos;
  v_taller text;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{16,128}$' then
    return null;
  end if;

  select * into v_enlace
  from public.enlaces_publicos e
  where e.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
    and e.revocado_at is null
    and e.deleted_at is null;

  if not found then
    return null;
  end if;

  select * into v_p
  from public.proyectos p
  where p.id = v_enlace.proyecto_id
    and p.deleted_at is null
    and p.estado <> 'perdido';

  if not found then
    return null;
  end if;

  select h.nombre into v_taller from public.households h where h.id = v_p.household_id;

  return jsonb_build_object('trabajo', v_p.titulo, 'taller', v_taller);
end;
$$;

comment on function public.titulo_compartido(text) is
  'Devuelve solamente el título del trabajo y el nombre del taller, y no llama a public.vista_del_cliente(). Tiene que ser así por dos motivos. El primero es qué pide quien la llama: la vista previa que arma WhatsApp cuando se pega el enlace queda guardada en el chat, así que ahí no puede ir ni un importe, ni la etapa, ni el nombre ni la dirección del cliente, que son justamente las cosas que sí devuelve la vista. El segundo es quién la llama: la pide un rastreador, no una persona, y la vista cuenta cada lectura como una visita del cliente (public.vista_compartida incrementa visitas). Si la vista previa usara esa puerta, el contador que el dueño mira en la pantalla de compartir contaría robots. Es stable a propósito: no escribe nada. Un token inválido, uno dado de baja, uno inexistente y un trabajo perdido devuelven null, los cuatro iguales (ADR 0049).';

revoke all on function public.titulo_compartido(text) from public, anon, authenticated;
grant execute on function public.titulo_compartido(text) to anon, authenticated;
