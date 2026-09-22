-- Las opiniones de los clientes (ADR 0057).
--
-- Cuando un trabajo se entrega, el dueño le manda al cliente un enlace con una encuesta y después
-- lee lo que contestó. Es la primera vez que alguien de afuera escribe en esta base: la vista del
-- cliente solo lee, la encuesta guarda. Todo lo de esta migración se ordena alrededor de eso.
--
-- Cinco piezas, todas aditivas. Ninguna fila existente cambia de valor: se crean tablas nuevas, se
-- les siembran las preguntas de fábrica a los talleres que ya están (filas nuevas en una tabla
-- nueva), y public.ajustes suma una columna con default vacío, que el alter no reescribe.
--
-- 1. public.preguntas: cada fila es una pregunta tal como se pregunta, con su texto, su tipo y sus
--    opciones. Una pregunta de la encuesta base que cambia de sentido es una fila nueva de la
--    misma serie; la que solo se redactó mejor es la misma fila con otro texto. Las propias de un
--    trabajo viven en la misma tabla, con el trabajo puesto.
-- 2. public.encuestas_enviadas: lo que se le mandó a cada trabajo. El enlace, cuándo se mandó,
--    cuándo se recordó, si se dio de baja, y la foto de las preguntas base tal como estaban al
--    mandarlo. La foto la saca un trigger, no el dueño.
-- 3. public.respuestas y public.renglones_de_respuesta: una respuesta por enlace, con un renglón por
--    pregunta contestada. Lo que dice un renglón no puede contradecir al tipo de su pregunta: lo
--    garantizan una foreign key compuesta y un check, no una función.
-- 4. public.encuesta_compartida(text) y public.contestar_encuesta(text, jsonb): las dos únicas
--    puertas nuevas del rol anónimo. La primera devuelve la encuesta de un enlace, la segunda guarda
--    la respuesta, y ninguna toca otra cosa.
-- 5. public.ajustes.resena_link: el enlace de Google para dejar una reseña, que la encuesta ofrece
--    al final a todos los que contestan.


-- Tipos ------------------------------------------------------------------------------------------

create type public.tipo_de_pregunta as enum ('escala5', 'sitalvezno', 'una', 'varias', 'texto');

comment on type public.tipo_de_pregunta is
  'Cómo se contesta una pregunta, y no hay otra forma: escala de cinco caritas, sí / tal vez / no, una opción entre varias, varias opciones, o texto libre. Son los tipos del diseño y ninguno más (ADR 0057).';

create type public.escala_de_pregunta as enum ('conformidad', 'tiempos', 'trato');

comment on type public.escala_de_pregunta is
  'Qué palabras lleva cada una de las cinco caritas de una pregunta de escala: conformidad (de «Nada conforme» a «Muy conforme»), tiempos (de «Llegó muy tarde» a «Llegó antes de lo pautado») o trato (de «Costaba mucho» a «Muy fácil»). Las palabras viven en @maun/domain; acá se guarda cuál juego lleva la pregunta.';


-- Las opciones de una pregunta de opciones -------------------------------------------------------

create function private.opciones_de_pregunta_validas(p_opciones text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    array_ndims(p_opciones) = 1
    and cardinality(p_opciones) between 2 and 8
    and (
      select bool_and(o is not null and btrim(o) <> '' and char_length(o) <= 120)
      from unnest(p_opciones) as o
    )
    and (select count(distinct o) = count(*) from unnest(p_opciones) as o),
    false
  )
$$;

comment on function private.opciones_de_pregunta_validas(text[]) is
  'Las opciones de una pregunta de una o de varias opciones: entre dos y ocho, ninguna vacía ni repetida, de hasta 120 caracteres.';

-- La evalúa el check de preguntas, que corre con los permisos de quien escribe la fila.
revoke all on function private.opciones_de_pregunta_validas(text[]) from public, anon, authenticated;
grant execute on function private.opciones_de_pregunta_validas(text[]) to authenticated;


create function private.opciones_elegidas_validas(p_elegidas smallint[], p_cantidad smallint)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    array_ndims(p_elegidas) = 1
    and cardinality(p_elegidas) >= 1
    and (
      select bool_and(e is not null and e >= 0 and e < p_cantidad)
      from unnest(p_elegidas) as e
    )
    and (select count(distinct e) = count(*) from unnest(p_elegidas) as e),
    false
  )
$$;

comment on function private.opciones_elegidas_validas(smallint[], smallint) is
  'Lo que eligió el cliente en una pregunta de varias opciones: al menos una, ninguna repetida, y cada una adentro de las opciones que tenía la pregunta.';

revoke all on function private.opciones_elegidas_validas(smallint[], smallint) from public, anon, authenticated;


-- Las preguntas ----------------------------------------------------------------------------------

create table public.preguntas (
  id uuid primary key default private.uuidv7(),
  household_id uuid not null default private.household_actual()
    references public.households (id) on delete cascade,
  serie uuid not null,
  numero integer not null default 1,
  proyecto_id uuid,
  titular boolean not null default false,
  orden integer not null default 0,
  texto text not null,
  tipo public.tipo_de_pregunta not null,
  escala public.escala_de_pregunta,
  obligatoria boolean not null default false,
  opciones text[],
  cantidad_de_opciones smallint not null default 0,
  archivada_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,

  -- Compuesta, como la de pagos y archivos: una pregunta propia no cuelga de un trabajo de otro
  -- household. Con proyecto_id null (la encuesta base) no se evalúa.
  constraint preguntas_proyecto_fk foreign key (household_id, proyecto_id)
    references public.proyectos (household_id, id),
  -- Una versión por número dentro de la serie. El trigger rechaza antes, con su código, la versión
  -- que llega vieja; esto es la red de abajo.
  constraint preguntas_serie_numero unique (household_id, serie, numero),
  -- Lo que referencia un renglón de respuesta: la pregunta, su tipo y cuántas opciones tiene. Así
  -- el renglón no puede decir que contestó otro tipo ni elegir una opción que no existe.
  constraint preguntas_forma unique (household_id, id, tipo, cantidad_de_opciones),
  constraint preguntas_texto_valido check (btrim(texto) <> '' and char_length(texto) <= 300),
  constraint preguntas_numero_valido check (numero >= 1),
  -- La primera versión es su propia serie; las que siguen no.
  constraint preguntas_primera_version check ((numero = 1) = (serie = id)),
  constraint preguntas_escala_segun_tipo check ((tipo = 'escala5') = (escala is not null)),
  constraint preguntas_opciones_segun_tipo check (
    coalesce(
      case
        when tipo in ('una', 'varias') then private.opciones_de_pregunta_validas(opciones)
        else opciones is null
      end,
      false
    )
  ),
  constraint preguntas_cantidad_de_opciones check (
    cantidad_de_opciones = coalesce(cardinality(opciones), 0)
  ),
  -- Una pregunta propia no tiene versiones, no es la del titular, no se archiva y no es
  -- obligatoria: se puede sumar después de mandar el enlace, y una obligatoria nueva le rompería
  -- el envío a un cliente que ya la tenía abierta.
  constraint preguntas_propias check (
    proyecto_id is null or (numero = 1 and not titular and not obligatoria and archivada_at is null)
  )
);

comment on table public.preguntas is
  'Las preguntas que se le hacen al cliente cuando termina un trabajo. Cada fila es una pregunta tal como se pregunta. La encuesta base del taller son las filas sin trabajo, la versión más nueva de cada serie, sin archivar, en su orden. Las propias de un trabajo tienen el trabajo puesto y se suman solo a esa encuesta (ADR 0057).';
comment on column public.preguntas.household_id is 'Default: el household del usuario de la sesión. El cliente de la app no lo manda.';
comment on column public.preguntas.serie is
  'La pregunta a lo largo de sus versiones. La primera versión tiene serie = id. Cambiarle el sentido a una pregunta con respuestas es una fila nueva de la misma serie, con numero + 1: las respuestas viejas siguen colgando de la versión que se contestó, no de la actual.';
comment on column public.preguntas.numero is 'La versión dentro de la serie, desde 1. La vigente es la de número más alto.';
comment on column public.preguntas.proyecto_id is 'Null: es de la encuesta base. Con valor: es una pregunta propia de ese trabajo, que nunca entra en el promedio general.';
comment on column public.preguntas.titular is
  'La pregunta cuyo promedio es «qué tan conformes quedaron», el número de arriba de Resultados. Viene sembrada en «¿Qué tan conforme quedaste?» y cada versión nueva la hereda de la anterior.';
comment on column public.preguntas.orden is 'El lugar en la encuesta. Lo que vale es el de la versión vigente.';
comment on column public.preguntas.escala is 'Solo en las de escala: qué palabras lleva cada carita.';
comment on column public.preguntas.opciones is 'Solo en las de una o varias opciones: el texto de cada opción, en su orden. Lo que se guarda como respuesta es la posición.';
comment on column public.preguntas.cantidad_de_opciones is
  'Cuántas opciones tiene. La calcula el trigger desde opciones y el check lo ata; existe para que la foreign key de los renglones pueda exigir que la opción elegida exista.';
comment on column public.preguntas.archivada_at is
  'Cuándo se dejó de preguntar. Archivar no borra: la pregunta sale de la encuesta y lo que ya contestaron queda. Null es que se sigue preguntando.';
comment on column public.preguntas.deleted_at is 'Borrado lógico. Lo usan la pregunta propia que el dueño saca antes de que el cliente conteste, la pregunta de la encuesta base que nadie llegó a ver (el trigger no deja borrar otra) y el borrado de un trabajo, que se lleva las suyas.';

create index preguntas_household_actualizado on public.preguntas (household_id, updated_at);
create index preguntas_household_proyecto on public.preguntas (household_id, proyecto_id);

create trigger metadatos
  before insert or update on public.preguntas
  for each row execute function private.mantener_metadatos();


-- Lo que se le mandó a cada trabajo ---------------------------------------------------------------

create table public.encuestas_enviadas (
  id uuid primary key default private.uuidv7(),
  household_id uuid not null default private.household_actual()
    references public.households (id) on delete cascade,
  proyecto_id uuid not null,
  token_hash text not null,
  token text not null,
  preguntas jsonb not null default '[]'::jsonb,
  enviada_at timestamptz not null default now(),
  recordada_at timestamptz,
  revocada_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,

  constraint encuestas_enviadas_household_id_key unique (household_id, id),
  constraint encuestas_enviadas_proyecto_fk foreign key (household_id, proyecto_id)
    references public.proyectos (household_id, id),
  constraint encuestas_enviadas_hash_valido check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint encuestas_enviadas_token_formato check (token ~ '^[A-Za-z0-9_-]{16,128}$'),
  -- Como en los enlaces de la vista del cliente (ADR 0052): en esta columna no se puede guardar un
  -- token que no sea el de esta fila.
  constraint encuestas_enviadas_token_coincide check (
    encode(sha256(convert_to(token, 'UTF8')), 'hex') = token_hash
  ),
  constraint encuestas_enviadas_foto_es_una_lista check (jsonb_typeof(preguntas) = 'array')
);

comment on table public.encuestas_enviadas is
  'La encuesta que se le mandó a un trabajo: su enlace, cuándo se mandó, cuándo se recordó, si se dio de baja, y la foto de las preguntas base tal como estaban al mandarla. El cliente contesta lo que se le preguntó aunque el dueño edite la encuesta al otro día. Un solo enlace vivo por trabajo, y ninguno sin trabajo (ADR 0057).';
comment on column public.encuestas_enviadas.household_id is 'Default: el household del usuario de la sesión. El cliente de la app no lo manda.';
comment on column public.encuestas_enviadas.token_hash is 'sha256 del token en hexadecimal: con esto resuelven el enlace las dos funciones públicas.';
comment on column public.encuestas_enviadas.token is
  'El token en claro, para que el dueño vea la dirección desde cualquiera de sus aparatos. Es la misma decisión que los enlaces de la vista del cliente (ADR 0052), y el check encuestas_enviadas_token_coincide ata su sha256 a token_hash. El rol anónimo no tiene ningún grant sobre esta tabla.';
comment on column public.encuestas_enviadas.preguntas is
  'La foto de la encuesta base al mandarla: id, texto, tipo, escala, obligatoria y opciones de cada pregunta, en su orden. La saca el trigger private.armar_la_encuesta() de las preguntas vigentes; el dueño no tiene grant sobre esta columna. Las preguntas propias del trabajo no están acá: se leen vivas hasta que el cliente contesta, y desde ahí no se tocan.';
comment on column public.encuestas_enviadas.enviada_at is 'Cuándo se mandó. La pone el trigger: es el momento en que se creó el enlace.';
comment on column public.encuestas_enviadas.recordada_at is
  'Cuándo se le recordó al cliente, o null. Un solo recordatorio: el trigger conserva la primera marca y no deja borrarla.';
comment on column public.encuestas_enviadas.revocada_at is
  'Cuándo se dio de baja. Null es vivo. Una encuesta dada de baja no revive: el trigger conserva la primera marca.';
comment on column public.encuestas_enviadas.deleted_at is 'Borrado lógico. Borrar el trabajo se la lleva.';

create unique index encuestas_enviadas_token on public.encuestas_enviadas (token_hash);
create index encuestas_enviadas_household_actualizado on public.encuestas_enviadas (household_id, updated_at);
create index encuestas_enviadas_household_proyecto on public.encuestas_enviadas (household_id, proyecto_id);

-- Un solo enlace vivo por trabajo. Generar otro da de baja el anterior en su propia sentencia,
-- antes de insertar, por lo que enseñó el ADR 0043 sobre los índices únicos parciales.
create unique index encuestas_enviadas_una_viva_por_trabajo
  on public.encuestas_enviadas (household_id, proyecto_id)
  where revocada_at is null and deleted_at is null;

create trigger metadatos
  before insert or update on public.encuestas_enviadas
  for each row execute function private.mantener_metadatos();


-- Las respuestas ---------------------------------------------------------------------------------

create table public.respuestas (
  id uuid primary key default private.uuidv7(),
  household_id uuid not null references public.households (id) on delete cascade,
  encuesta_id uuid not null,
  contestada_at timestamptz not null default now(),
  leida_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,

  constraint respuestas_household_id_key unique (household_id, id),
  constraint respuestas_encuesta_fk foreign key (household_id, encuesta_id)
    references public.encuestas_enviadas (household_id, id),
  -- Una sola respuesta por enlace, contando las borradas: un segundo envío no pisa nada.
  constraint respuestas_una_por_encuesta unique (household_id, encuesta_id)
);

comment on table public.respuestas is
  'Lo que contestó un cliente: una por encuesta enviada, y nunca otra. La escribe public.contestar_encuesta(), que corre elevada; el dueño no tiene grant de insert y lo único que escribe es leida_at (ADR 0057).';
comment on column public.respuestas.household_id is 'Sin default: la fila la escribe la función pública, que no tiene sesión, y pone el household de la encuesta.';
comment on column public.respuestas.contestada_at is 'Cuándo contestó. La pone la base.';
comment on column public.respuestas.leida_at is 'Cuándo la leyó el dueño, o null si todavía no. Es del dueño y se escribe por la cola como cualquier otra cosa suya.';
comment on column public.respuestas.deleted_at is 'Borrado lógico. Solo lo pone el borrado del trabajo.';

create index respuestas_household_actualizado on public.respuestas (household_id, updated_at);

create trigger metadatos
  before insert or update on public.respuestas
  for each row execute function private.mantener_metadatos();


create table public.renglones_de_respuesta (
  id uuid primary key default private.uuidv7(),
  household_id uuid not null references public.households (id) on delete cascade,
  respuesta_id uuid not null,
  pregunta_id uuid not null,
  tipo public.tipo_de_pregunta not null,
  cantidad_de_opciones smallint not null,
  pregunta_texto text not null,
  valor_numero smallint,
  valor_opciones smallint[],
  valor_texto text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,

  constraint renglones_de_respuesta_respuesta_fk foreign key (household_id, respuesta_id)
    references public.respuestas (household_id, id),
  -- El tipo y la cantidad de opciones tienen que ser los de la pregunta contestada: el renglón no
  -- puede decir que contestó una escala si la pregunta era de texto.
  constraint renglones_de_respuesta_pregunta_fk foreign key (household_id, pregunta_id, tipo, cantidad_de_opciones)
    references public.preguntas (household_id, id, tipo, cantidad_de_opciones),
  constraint renglones_de_respuesta_una_por_pregunta unique (respuesta_id, pregunta_id),
  -- Lo que se guarda no puede contradecir al tipo. La escala va de 1 a 5; sí / tal vez / no de 1
  -- a 3, con 3 el sí; una opción es la posición de la elegida; varias, las posiciones sin repetir;
  -- el texto, sin blancos de más y con tope de 2000 caracteres. El tope es el mismo que valida
  -- @maun/domain, y el comparador lo ata.
  constraint renglones_de_respuesta_valor_segun_tipo check (
    coalesce(
      case tipo
        when 'escala5' then
          valor_numero between 1 and 5 and valor_opciones is null and valor_texto is null
        when 'sitalvezno' then
          valor_numero between 1 and 3 and valor_opciones is null and valor_texto is null
        when 'una' then
          valor_numero >= 0 and valor_numero < cantidad_de_opciones
          and valor_opciones is null and valor_texto is null
        when 'varias' then
          valor_numero is null and valor_texto is null
          and private.opciones_elegidas_validas(valor_opciones, cantidad_de_opciones)
        when 'texto' then
          valor_numero is null and valor_opciones is null
          and valor_texto ~ '[^ \t\n\r\f\v]' and char_length(valor_texto) <= 2000
      end,
      false
    )
  )
);

comment on table public.renglones_de_respuesta is
  'Un renglón por pregunta contestada: a qué pregunta, con qué valor. La pregunta es la versión exacta que se contestó, así que cambiarle el sentido después no la mueve. Los escribe public.contestar_encuesta(); el dueño solo los lee.';
comment on column public.renglones_de_respuesta.household_id is 'Sin default: la fila la escribe la función pública.';
comment on column public.renglones_de_respuesta.tipo is 'El tipo de la pregunta contestada. La foreign key lo ata al de la pregunta.';
comment on column public.renglones_de_respuesta.cantidad_de_opciones is 'Cuántas opciones tenía la pregunta. La foreign key lo ata al de la pregunta y el check no deja elegir una que no existe.';
comment on column public.renglones_de_respuesta.pregunta_texto is 'El texto tal como se preguntó. Si después se redacta mejor, la respuesta sigue diciendo lo que el cliente leyó.';
comment on column public.renglones_de_respuesta.valor_numero is 'Escala: de 1 a 5. Sí / tal vez / no: 3 es sí, 2 tal vez, 1 no. Una opción: la posición de la elegida, desde 0.';
comment on column public.renglones_de_respuesta.valor_opciones is 'Varias opciones: las posiciones elegidas, desde 0, sin repetir.';
comment on column public.renglones_de_respuesta.valor_texto is 'Texto libre, sin blancos al principio ni al final, hasta 2000 caracteres.';

create index renglones_de_respuesta_household_actualizado on public.renglones_de_respuesta (household_id, updated_at);
create index renglones_de_respuesta_household_respuesta on public.renglones_de_respuesta (household_id, respuesta_id);
create index renglones_de_respuesta_household_pregunta
  on public.renglones_de_respuesta (household_id, pregunta_id, tipo, cantidad_de_opciones);

create trigger metadatos
  before insert or update on public.renglones_de_respuesta
  for each row execute function private.mantener_metadatos();


-- Las reglas de las preguntas ---------------------------------------------------------------------

create function private.cuidar_la_pregunta()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_ultima integer;
begin
  new.cantidad_de_opciones := coalesce(cardinality(new.opciones), 0);

  if tg_op = 'INSERT' then
    -- El alta que manda la cola es un upsert, y este trigger corre antes de saber si hay conflicto.
    -- Si la fila ya existe, el insert termina en un update y las reglas se aplican ahí.
    if exists (select 1 from public.preguntas p where p.id = new.id) then
      return new;
    end if;

    if new.numero > 1 then
      -- Una versión nueva parte la serie desde la vigente, y solo desde ella: dos aparatos que
      -- versionan la misma pregunta sin señal no pueden dejar dos «versión 2».
      select max(p.numero) into v_ultima
      from public.preguntas p
      where p.household_id = new.household_id and p.serie = new.serie;

      if v_ultima is distinct from new.numero - 1 then
        raise exception 'La pregunta cambió desde otro lado'
          using errcode = 'MN014',
                hint = 'Ya hay una versión más nueva de esta pregunta. Volvé a abrir Preguntas y cambiala ahí.';
      end if;

      -- La marca de titular la hereda de la versión anterior. El dueño no tiene grant sobre ella.
      select p.titular into new.titular
      from public.preguntas p
      where p.household_id = new.household_id and p.serie = new.serie and p.numero = new.numero - 1;
    end if;
  else
    -- El reenvío idéntico de una mutación que ya se aplicó pasa sin mirar nada más.
    if private.es_reenvio(to_jsonb(old), to_jsonb(new)) then
      return new;
    end if;

    if new.serie is distinct from old.serie
      or new.numero is distinct from old.numero
      or new.proyecto_id is distinct from old.proyecto_id
      or new.titular is distinct from old.titular then
      raise exception 'La serie, el número, el trabajo y la marca de titular de una pregunta no cambian'
        using errcode = 'MN004';
    end if;

    -- De la encuesta base se borra solamente la pregunta que nadie vio: sin otra versión, sin estar
    -- en la foto de una encuesta viva y sin respuestas. Todas las demás se archivan, y lo que
    -- contestaron queda. La del número de arriba de Resultados no se borra nunca.
    if old.proyecto_id is null and old.deleted_at is null and new.deleted_at is not null
      and (
        old.titular
        or old.numero > 1
        or exists (
          select 1 from public.preguntas p
          where p.household_id = old.household_id and p.serie = old.serie and p.id <> old.id
        )
        or exists (
          select 1 from public.encuestas_enviadas e
          where e.household_id = old.household_id
            and e.deleted_at is null
            and e.preguntas @> jsonb_build_array(jsonb_build_object('id', old.id))
        )
        or exists (
          select 1 from public.renglones_de_respuesta g
          where g.household_id = old.household_id and g.pregunta_id = old.id and g.deleted_at is null
        )
      ) then
      raise exception 'Esa pregunta no se borra: se deja de preguntar'
        using errcode = 'MN004',
              hint = 'Archivala: sale de la encuesta y lo que ya contestaron queda.';
    end if;

    -- Solo se toca la versión vigente. Una edición que llega después de que otro aparato partió la
    -- serie estaría cambiando una pregunta que ya no se hace.
    select max(p.numero) into v_ultima
    from public.preguntas p
    where p.household_id = old.household_id and p.serie = old.serie;

    if v_ultima > old.numero then
      raise exception 'La pregunta cambió desde otro lado'
        using errcode = 'MN014',
              hint = 'Ya hay una versión más nueva de esta pregunta. Volvé a abrir Preguntas y cambiala ahí.';
    end if;

    -- Cómo se contesta una pregunta que ya salió no cambia: el cliente que la tiene abierta
    -- contesta lo que recibió, y su respuesta tiene que poder leerse igual. Salió si está en la
    -- foto de alguna encuesta, si alguien la contestó o, siendo propia, si su trabajo tiene un
    -- enlace vivo. El texto sí se corrige en el lugar: eso es «solo la redacté mejor».
    if (new.tipo, new.escala, new.opciones) is distinct from (old.tipo, old.escala, old.opciones)
      and (
        exists (
          select 1 from public.encuestas_enviadas e
          where e.household_id = old.household_id
            and e.deleted_at is null
            and (
              e.preguntas @> jsonb_build_array(jsonb_build_object('id', old.id))
              or (old.proyecto_id is not null and e.proyecto_id = old.proyecto_id and e.revocada_at is null)
            )
        )
        or exists (
          select 1 from public.renglones_de_respuesta g
          where g.household_id = old.household_id and g.pregunta_id = old.id
        )
      ) then
      raise exception 'Esa pregunta ya salió en una encuesta: cómo se contesta no cambia'
        using errcode = 'MN013',
              hint = 'Guardala como pregunta nueva: lo que ya contestaron queda aparte, con su texto.';
    end if;
  end if;

  -- Un trabajo borrado no suma preguntas: sus hijos solo pueden quedar borrados, como los pagos.
  if new.proyecto_id is not null
    and new.deleted_at is null
    and exists (
      select 1 from public.proyectos p
      where p.household_id = new.household_id and p.id = new.proyecto_id and p.deleted_at is not null
    ) then
    raise exception 'El proyecto está borrado' using errcode = 'MN002';
  end if;

  -- Las preguntas propias de un trabajo cuyo cliente ya contestó quedan como están, salvo que el
  -- trabajo se esté borrando, que se las lleva.
  if new.proyecto_id is not null
    and exists (
      select 1
      from public.respuestas r
      join public.encuestas_enviadas e on e.household_id = r.household_id and e.id = r.encuesta_id
      where e.household_id = new.household_id and e.proyecto_id = new.proyecto_id
    )
    and not exists (
      select 1 from public.proyectos p
      where p.household_id = new.household_id and p.id = new.proyecto_id and p.deleted_at is not null
    ) then
    raise exception 'Ese cliente ya contestó: sus preguntas quedan como están'
      using errcode = 'MN012',
            hint = 'Para preguntarle algo más, escribile.';
  end if;

  return new;
end;
$$;

comment on function private.cuidar_la_pregunta() is
  'Trigger de preguntas: calcula cuántas opciones tiene, deja cambiar solo la versión vigente de una serie, no deja cambiar cómo se contesta una pregunta que ya salió en una encuesta, arma las versiones nuevas desde la vigente y congela las propias de un trabajo cuyo cliente ya contestó (ADR 0057).';

revoke all on function private.cuidar_la_pregunta() from public, anon, authenticated;

create trigger cuidar_la_pregunta
  before insert or update on public.preguntas
  for each row execute function private.cuidar_la_pregunta();


-- Mandar una encuesta ----------------------------------------------------------------------------

create function private.armar_la_encuesta()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_estado public.estado_proyecto;
  v_borrado timestamptz;
  v_preguntas jsonb;
begin
  select p.estado, p.deleted_at into v_estado, v_borrado
  from public.proyectos p
  where p.household_id = new.household_id and p.id = new.proyecto_id;

  -- Un trabajo que no es de este household lo rechaza la foreign key compuesta, que corre después.
  if not found then
    return new;
  end if;

  if v_borrado is not null then
    raise exception 'El proyecto está borrado' using errcode = 'MN002';
  end if;

  -- El momento es cuando se entrega: antes no hay nada que opinar.
  if v_estado not in ('entregado', 'cobrado') then
    raise exception 'La opinión se le pide al cliente cuando el trabajo está entregado'
      using errcode = 'MN015',
            hint = 'Marcá el trabajo como entregado y pedísela desde ahí.';
  end if;

  if exists (
    select 1
    from public.respuestas r
    join public.encuestas_enviadas e on e.household_id = r.household_id and e.id = r.encuesta_id
    where e.household_id = new.household_id and e.proyecto_id = new.proyecto_id
  ) then
    raise exception 'Ese cliente ya contestó' using errcode = 'MN012';
  end if;

  -- La foto: las preguntas base vigentes, sin las archivadas, en su orden. De cada una va lo que
  -- el cliente necesita para contestarla y nada más.
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'texto', p.texto,
        'tipo', p.tipo,
        'escala', p.escala,
        'obligatoria', p.obligatoria,
        'opciones', to_jsonb(p.opciones),
        'propia', false
      )
      order by p.orden, p.serie
    ),
    '[]'::jsonb
  ) into v_preguntas
  from public.preguntas p
  where p.household_id = new.household_id
    and p.proyecto_id is null
    and p.deleted_at is null
    and p.archivada_at is null
    and p.numero = (
      select max(q.numero) from public.preguntas q
      where q.household_id = p.household_id and q.serie = p.serie and q.deleted_at is null
    );

  if jsonb_array_length(v_preguntas) = 0 then
    raise exception 'La encuesta no tiene preguntas'
      using errcode = 'MN015',
            hint = 'Volvé a preguntar al menos una en Opiniones › Preguntas.';
  end if;

  new.preguntas := v_preguntas;
  new.enviada_at := now();
  new.recordada_at := null;
  new.revocada_at := null;
  return new;
end;
$$;

comment on function private.armar_la_encuesta() is
  'Trigger del alta de una encuesta enviada: exige que el trabajo esté entregado o cobrado y que su cliente no haya contestado ya, y le saca la foto a la encuesta base vigente. Lo que el dueño manda es el id, el trabajo y el enlace; la foto, la fecha y los estados los pone la base.';

revoke all on function private.armar_la_encuesta() from public, anon, authenticated;

create trigger armar_la_encuesta
  before insert on public.encuestas_enviadas
  for each row execute function private.armar_la_encuesta();


create function private.cuidar_la_encuesta()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Un solo recordatorio: la primera marca queda. Dos es molestar a un cliente que ya pagó.
  new.recordada_at := coalesce(old.recordada_at, new.recordada_at);
  -- Lo dado de baja no revive.
  new.revocada_at := coalesce(old.revocada_at, new.revocada_at);
  return new;
end;
$$;

comment on function private.cuidar_la_encuesta() is
  'Trigger de encuestas_enviadas: el recordatorio y la baja se escriben una sola vez. Un reenvío con la misma marca no cambia nada, y uno con otra marca conserva la primera.';

revoke all on function private.cuidar_la_encuesta() from public, anon, authenticated;

create trigger cuidar_la_encuesta
  before update on public.encuestas_enviadas
  for each row execute function private.cuidar_la_encuesta();


-- RLS y grants ------------------------------------------------------------------------------------

alter table public.preguntas enable row level security;
alter table public.encuestas_enviadas enable row level security;
alter table public.respuestas enable row level security;
alter table public.renglones_de_respuesta enable row level security;

revoke all on table public.preguntas from anon, authenticated;
revoke all on table public.encuestas_enviadas from anon, authenticated;
revoke all on table public.respuestas from anon, authenticated;
revoke all on table public.renglones_de_respuesta from anon, authenticated;

-- Las preguntas: el alta es un upsert de la fila completa, así que el update cubre las mismas
-- columnas. La serie, el número y el trabajo no cambian: lo impide el trigger. La marca de titular
-- no la escribe el dueño: viene sembrada y cada versión la hereda.
grant select on table public.preguntas to authenticated;
grant insert (
  id, serie, numero, proyecto_id, orden, texto, tipo, escala, obligatoria, opciones, archivada_at,
  deleted_at
) on table public.preguntas to authenticated;
grant update (
  id, serie, numero, proyecto_id, orden, texto, tipo, escala, obligatoria, opciones, archivada_at,
  deleted_at
) on table public.preguntas to authenticated;

-- Mandar: el id, el trabajo y el enlace. La foto, la fecha y los estados los pone el trigger.
-- Después, lo único que el dueño escribe es el recordatorio y la baja.
grant select on table public.encuestas_enviadas to authenticated;
grant insert (id, proyecto_id, token_hash, token) on table public.encuestas_enviadas to authenticated;
grant update (recordada_at, revocada_at) on table public.encuestas_enviadas to authenticated;

-- Las respuestas las escribe la función pública. El dueño las lee y marca que las leyó.
grant select on table public.respuestas to authenticated;
grant update (leida_at) on table public.respuestas to authenticated;

grant select on table public.renglones_de_respuesta to authenticated;

create policy preguntas_lectura on public.preguntas
  for select to authenticated
  using (household_id = any (array(select private.user_household_ids())));

create policy preguntas_alta on public.preguntas
  for insert to authenticated
  with check (household_id = any (array(select private.user_household_ids())));

create policy preguntas_edicion on public.preguntas
  for update to authenticated
  using (household_id = any (array(select private.user_household_ids())))
  with check (household_id = any (array(select private.user_household_ids())));

create policy encuestas_enviadas_lectura on public.encuestas_enviadas
  for select to authenticated
  using (household_id = any (array(select private.user_household_ids())));

create policy encuestas_enviadas_alta on public.encuestas_enviadas
  for insert to authenticated
  with check (household_id = any (array(select private.user_household_ids())));

create policy encuestas_enviadas_edicion on public.encuestas_enviadas
  for update to authenticated
  using (household_id = any (array(select private.user_household_ids())))
  with check (household_id = any (array(select private.user_household_ids())));

create policy respuestas_lectura on public.respuestas
  for select to authenticated
  using (household_id = any (array(select private.user_household_ids())));

create policy respuestas_edicion on public.respuestas
  for update to authenticated
  using (household_id = any (array(select private.user_household_ids())))
  with check (household_id = any (array(select private.user_household_ids())));

create policy renglones_de_respuesta_lectura on public.renglones_de_respuesta
  for select to authenticated
  using (household_id = any (array(select private.user_household_ids())));


-- La encuesta base se crea con el taller ----------------------------------------------------------

-- Se abre con la encuesta ya escrita, no con un editor vacío. Los textos son los del diseño.
create function private.sembrar_la_encuesta(p_household_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_fila record;
  v_id uuid;
begin
  if exists (
    select 1 from public.preguntas p
    where p.household_id = p_household_id and p.proyecto_id is null
  ) then
    return;
  end if;

  for v_fila in
    select *
    from (
      values
        (10, '¿Qué tan conforme quedaste con el mueble?', 'escala5', 'conformidad', true, true),
        (20, '¿Y con los tiempos de entrega?', 'escala5', 'tiempos', true, false),
        (30, '¿Cómo fue hablar con el taller mientras duró el trabajo?', 'escala5', 'trato', false, false),
        (40, '¿Se lo recomendarías a alguien?', 'sitalvezno', null, true, false),
        (50, '¿Qué podríamos hacer mejor?', 'texto', null, false, false)
    ) as t (orden, texto, tipo, escala, obligatoria, titular)
  loop
    v_id := private.uuidv7();
    insert into public.preguntas (
      id, household_id, serie, numero, titular, orden, texto, tipo, escala, obligatoria
    ) values (
      v_id, p_household_id, v_id, 1, v_fila.titular, v_fila.orden, v_fila.texto,
      v_fila.tipo::public.tipo_de_pregunta, v_fila.escala::public.escala_de_pregunta,
      v_fila.obligatoria
    );
  end loop;
end;
$$;

comment on function private.sembrar_la_encuesta(uuid) is
  'Le escribe al taller la encuesta base de fábrica, si no tiene ninguna: cinco preguntas, la primera la del titular. La llama private.crear_household() con cada taller nuevo. Solo la ejecuta el dueño de la base.';

revoke all on function private.sembrar_la_encuesta(uuid) from public, anon, authenticated;

-- Mismo nombre y misma firma: or replace conserva que nadie de la API la puede ejecutar. Lo único
-- nuevo es la última llamada. Un error acá rompe todos los registros, no uno, y por eso lo que
-- escribe son constantes (ADR 0012).
create or replace function private.crear_household(p_nombre text, p_user_id uuid)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_household uuid;
begin
  insert into public.households (nombre) values (p_nombre) returning id into v_household;

  if p_user_id is not null then
    insert into public.household_members (household_id, user_id, rol)
    values (v_household, p_user_id, 'titular');
  end if;

  insert into public.ajustes (household_id) values (v_household);

  perform private.sembrar_la_encuesta(v_household);

  return v_household;
end;
$$;

comment on function private.crear_household(text, uuid) is
  'Crea un household con sus ajustes y su encuesta base y, si se pasa un usuario, lo suma como titular. Solo la ejecuta el dueño de la base.';

-- Los talleres que ya existen reciben la misma encuesta. Son filas nuevas de una tabla nueva:
-- ninguna fila existente cambia.
select private.sembrar_la_encuesta(h.id)
from public.households h
where h.deleted_at is null;


-- Borrar un trabajo se lleva sus opiniones ----------------------------------------------------------

create function private.borrar_las_opiniones_del_trabajo(
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
  -- Solo con el trabajo ya borrado. El dueño no tiene grant para borrar una respuesta ni un
  -- renglón, y esta puerta no le abre ese camino para un trabajo vivo.
  if not exists (
    select 1 from public.proyectos p
    where p.household_id = p_household_id and p.id = p_proyecto_id and p.deleted_at is not null
  ) then
    return;
  end if;

  -- La encuesta primero: si un cliente está guardando su respuesta, este update la espera, y los
  -- dos que siguen ya ven lo que guardó.
  update public.encuestas_enviadas e
  set deleted_at = p_momento
  where e.household_id = p_household_id and e.proyecto_id = p_proyecto_id and e.deleted_at is null;

  update public.respuestas r
  set deleted_at = p_momento
  where r.household_id = p_household_id
    and r.deleted_at is null
    and r.encuesta_id in (
      select e.id from public.encuestas_enviadas e
      where e.household_id = p_household_id and e.proyecto_id = p_proyecto_id
    );

  update public.renglones_de_respuesta g
  set deleted_at = p_momento
  where g.household_id = p_household_id
    and g.deleted_at is null
    and g.respuesta_id in (
      select r.id
      from public.respuestas r
      join public.encuestas_enviadas e on e.household_id = r.household_id and e.id = r.encuesta_id
      where e.household_id = p_household_id and e.proyecto_id = p_proyecto_id
    );

  update public.preguntas p
  set deleted_at = p_momento
  where p.household_id = p_household_id and p.proyecto_id = p_proyecto_id and p.deleted_at is null;
end;
$$;

comment on function private.borrar_las_opiniones_del_trabajo(uuid, uuid, timestamptz) is
  'Borra, con la marca del trabajo, lo que se le preguntó y lo que contestó el cliente de un trabajo que ya se borró. Es security definer porque el dueño no tiene grant para borrar respuestas: la llama private.borrar_hijos_de_proyecto(), y no hace nada si el trabajo está vivo.';

revoke all on function private.borrar_las_opiniones_del_trabajo(uuid, uuid, timestamptz)
  from public, anon, authenticated;
-- La llama el trigger del borrado de un trabajo, que corre con los permisos del dueño.
grant execute on function private.borrar_las_opiniones_del_trabajo(uuid, uuid, timestamptz)
  to authenticated;

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

  -- Lo que agrega esta migración: la encuesta que se le mandó, lo que contestó y sus preguntas
  -- propias. El enlace deja de funcionar con el trabajo.
  perform private.borrar_las_opiniones_del_trabajo(new.household_id, new.id, new.deleted_at);

  return null;
end;
$$;


-- El pedido de reseña -------------------------------------------------------------------------------

alter table public.ajustes
  add column resena_link text not null default ''
    constraint ajustes_resena_link_formato
      check (
        resena_link = ''
        or (
          char_length(resena_link) <= 300
          and resena_link ~ '^https://(g\.page|search\.google\.com|maps\.google\.com|www\.google\.com|google\.com|maps\.app\.goo\.gl|g\.co)/[^[:space:]]*$'
        )
      );

comment on column public.ajustes.resena_link is
  'El enlace del taller para dejarle una reseña en Google, o vacío. Lo pega el dueño, lo saca de su Perfil de Negocio. La encuesta se lo ofrece al final a todos los que contestan, contesten lo que contesten: filtrar a quién se le pide según lo que opinó está prohibido por las políticas de Google (ADR 0057). El check acota el host a Google porque este texto se vuelve un enlace en una página pública.';

-- Solo update, sin insert: la fila de ajustes la crea private.crear_household() con el taller.
grant update (resena_link) on table public.ajustes to authenticated;


-- Las preguntas de un enlace -------------------------------------------------------------------------

create function private.preguntas_de_la_encuesta(p_encuesta public.encuestas_enviadas)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select p_encuesta.preguntas || coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'texto', p.texto,
          'tipo', p.tipo,
          'escala', p.escala,
          'obligatoria', p.obligatoria,
          'opciones', to_jsonb(p.opciones),
          'propia', true
        )
        order by p.orden, p.id
      )
      from public.preguntas p
      where p.household_id = p_encuesta.household_id
        and p.proyecto_id = p_encuesta.proyecto_id
        and p.deleted_at is null
    ),
    '[]'::jsonb
  )
$$;

comment on function private.preguntas_de_la_encuesta(public.encuestas_enviadas) is
  'Lo que se le pregunta a un enlace: la foto de la encuesta base que se tomó al mandarlo, más las preguntas propias de su trabajo. Es la misma lista la que ve el cliente y la que valida el guardado.';

revoke all on function private.preguntas_de_la_encuesta(public.encuestas_enviadas)
  from public, anon, authenticated;


-- Qué se acepta como respuesta ----------------------------------------------------------------------

create function private.validar_respuesta(p_preguntas jsonb, p_respuesta jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_renglon jsonb;
  v_pregunta jsonb;
  v_valor jsonb;
  v_id text;
  v_tipo text;
  v_cantidad integer;
  v_numero numeric;
  v_elegidas numeric[];
  v_texto text;
  v_vistas text[] := array[]::text[];
  v_obligatoria jsonb;
begin
  if p_respuesta is null or jsonb_typeof(p_respuesta) is distinct from 'object' then
    return 'forma';
  end if;
  if (select array_agg(k order by k) from jsonb_object_keys(p_respuesta) as k)
    is distinct from array['id', 'renglones'] then
    return 'forma';
  end if;
  if jsonb_typeof(p_respuesta -> 'id') is distinct from 'string'
    or (p_respuesta ->> 'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return 'forma';
  end if;
  if jsonb_typeof(p_respuesta -> 'renglones') is distinct from 'array' then
    return 'forma';
  end if;

  for v_renglon in select r from jsonb_array_elements(p_respuesta -> 'renglones') as r loop
    if jsonb_typeof(v_renglon) is distinct from 'object'
      or (select array_agg(k order by k) from jsonb_object_keys(v_renglon) as k)
        is distinct from array['pregunta', 'valor']
      or jsonb_typeof(v_renglon -> 'pregunta') is distinct from 'string' then
      return 'forma';
    end if;

    v_id := v_renglon ->> 'pregunta';
    select p into v_pregunta
    from jsonb_array_elements(p_preguntas) as p
    where p ->> 'id' = v_id
    limit 1;
    if not found then
      return 'ajena';
    end if;
    if v_id = any (v_vistas) then
      return 'repetida';
    end if;
    v_vistas := v_vistas || v_id;

    v_valor := v_renglon -> 'valor';
    v_tipo := v_pregunta ->> 'tipo';
    v_cantidad := case
      when jsonb_typeof(v_pregunta -> 'opciones') = 'array' then jsonb_array_length(v_pregunta -> 'opciones')
      else 0
    end;

    if v_tipo in ('escala5', 'sitalvezno', 'una') then
      if jsonb_typeof(v_valor) is distinct from 'number' then
        return 'tipo';
      end if;
      v_numero := v_valor::numeric;
      if v_numero <> trunc(v_numero) then
        return 'tipo';
      end if;
      if (v_tipo = 'escala5' and v_numero not between 1 and 5)
        or (v_tipo = 'sitalvezno' and v_numero not between 1 and 3)
        or (v_tipo = 'una' and (v_numero < 0 or v_numero >= v_cantidad)) then
        return 'rango';
      end if;
    elsif v_tipo = 'varias' then
      if jsonb_typeof(v_valor) is distinct from 'array' then
        return 'tipo';
      end if;
      if exists (
        select 1 from jsonb_array_elements(v_valor) as e
        where case
          when jsonb_typeof(e) = 'number' then e::numeric <> trunc(e::numeric)
          else true
        end
      ) then
        return 'tipo';
      end if;
      select coalesce(array_agg(e::numeric), array[]::numeric[]) into v_elegidas
      from jsonb_array_elements(v_valor) as e;
      if cardinality(v_elegidas) = 0 then
        return 'vacio';
      end if;
      if exists (select 1 from unnest(v_elegidas) as x where x < 0 or x >= v_cantidad)
        or (select count(distinct x) from unnest(v_elegidas) as x) <> cardinality(v_elegidas) then
        return 'rango';
      end if;
    elsif v_tipo = 'texto' then
      if jsonb_typeof(v_valor) is distinct from 'string' then
        return 'tipo';
      end if;
      v_texto := v_valor #>> '{}';
      if v_texto !~ '[^ \t\n\r\f\v]' then
        return 'vacio';
      end if;
      if char_length(regexp_replace(v_texto, '^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$', '', 'g')) > 2000 then
        return 'largo';
      end if;
    else
      return 'ajena';
    end if;
  end loop;

  for v_obligatoria in
    select p from jsonb_array_elements(p_preguntas) as p
    where (p -> 'obligatoria') = 'true'::jsonb
  loop
    if not ((v_obligatoria ->> 'id') = any (v_vistas)) then
      return 'obligatoria';
    end if;
  end loop;

  return null;
end;
$$;

comment on function private.validar_respuesta(jsonb, jsonb) is
  'Si una respuesta sirve para una lista de preguntas, y si no, por qué: forma (no es {id, renglones} con renglones {pregunta, valor}), ajena (contesta una pregunta que no es de la lista), repetida, tipo (el valor no es del tipo que pide la pregunta), rango (fuera de la escala o de las opciones), vacio, largo (texto de más de 2000 caracteres) u obligatoria (falta una). Devuelve null si sirve. El orden de las revisiones es parte de la regla: es gemela de validarRespuesta de @maun/domain y el comparador las ata caso por caso.';

revoke all on function private.validar_respuesta(jsonb, jsonb) from public, anon, authenticated;


create function private.motivo_del_rechazo(p_motivo text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_motivo
    when 'forma' then 'La respuesta no tiene la forma que espera la encuesta'
    when 'ajena' then 'Vino una respuesta a una pregunta que no es de esta encuesta'
    when 'repetida' then 'Vino dos veces la respuesta a la misma pregunta'
    when 'tipo' then 'Una respuesta no es del tipo que pide su pregunta'
    when 'rango' then 'Una respuesta está fuera de las opciones de su pregunta'
    when 'vacio' then 'Vino una respuesta vacía'
    when 'largo' then 'Un texto pasa de los 2000 caracteres que acepta la encuesta'
    when 'obligatoria' then 'Falta contestar una pregunta obligatoria'
    else 'La respuesta no sirve para esta encuesta'
  end
$$;

comment on function private.motivo_del_rechazo(text) is 'El mensaje de cada motivo de private.validar_respuesta().';

revoke all on function private.motivo_del_rechazo(text) from public, anon, authenticated;


-- Las dos puertas del rol anónimo ---------------------------------------------------------------------

create function public.encuesta_compartida(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_encuesta public.encuestas_enviadas;
  v_proyecto public.proyectos;
  v_respuesta public.respuestas;
begin
  -- Un token que no tiene la forma de un token no llega ni a consultarse.
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{16,128}$' then
    raise exception 'Este link no funciona' using errcode = 'MN010';
  end if;

  select * into v_encuesta
  from public.encuestas_enviadas e
  where e.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
    and e.revocada_at is null
    and e.deleted_at is null;

  -- Inexistente, dado de baja, de un trabajo borrado o de uno perdido contestan exactamente lo
  -- mismo, y lo mismo que la vista del cliente: el que tiene el enlace no se entera de nada.
  if not found then
    raise exception 'Este link no funciona' using errcode = 'MN010';
  end if;

  select * into v_proyecto
  from public.proyectos p
  where p.household_id = v_encuesta.household_id
    and p.id = v_encuesta.proyecto_id
    and p.deleted_at is null
    and p.estado <> 'perdido';

  if not found then
    raise exception 'Este link no funciona' using errcode = 'MN010';
  end if;

  select * into v_respuesta
  from public.respuestas r
  where r.household_id = v_encuesta.household_id
    and r.encuesta_id = v_encuesta.id
    and r.deleted_at is null;

  -- Los campos van enumerados uno por uno, también los de cada pregunta: lo que el cliente ve se
  -- decide acá. supabase/tests/27_encuesta_publica.sql falla apenas aparece una columna nueva en
  -- cualquiera de las tablas que esta función lee, hasta que alguien decide si viaja.
  return jsonb_build_object(
    'taller', (select h.nombre from public.households h where h.id = v_encuesta.household_id),
    -- Del cliente, solo la primera palabra del nombre: la encuesta le dice «Gracias, Marcela».
    'cliente', (
      select nullif(split_part(btrim(c.nombre), ' ', 1), '') from public.clientes c
      where c.household_id = v_proyecto.household_id and c.id = v_proyecto.cliente_id
    ),
    'trabajo', v_proyecto.titulo,
    'resena', (
      select nullif(a.resena_link, '') from public.ajustes a
      where a.household_id = v_encuesta.household_id
    ),
    'preguntas', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', p -> 'id',
            'texto', p -> 'texto',
            'tipo', p -> 'tipo',
            'escala', p -> 'escala',
            'obligatoria', p -> 'obligatoria',
            'opciones', p -> 'opciones',
            'propia', p -> 'propia'
          )
          order by t.orden
        ),
        '[]'::jsonb
      )
      from jsonb_array_elements(private.preguntas_de_la_encuesta(v_encuesta)) with ordinality as t (p, orden)
    ),
    'contestada', case
      when v_respuesta.id is null then null
      else jsonb_build_object(
        'fecha', (v_respuesta.contestada_at at time zone 'America/Argentina/Buenos_Aires')::date,
        'renglones', (
          select coalesce(
            jsonb_agg(
              jsonb_build_object(
                'pregunta', g.pregunta_id,
                'valor', case g.tipo
                  when 'varias' then to_jsonb(g.valor_opciones)
                  when 'texto' then to_jsonb(g.valor_texto)
                  else to_jsonb(g.valor_numero)
                end
              )
              order by g.id
            ),
            '[]'::jsonb
          )
          from public.renglones_de_respuesta g
          where g.household_id = v_respuesta.household_id
            and g.respuesta_id = v_respuesta.id
            and g.deleted_at is null
        )
      )
    end
  );
end;
$$;

comment on function public.encuesta_compartida(text) is
  'La encuesta de un enlace, para el cliente que lo abre sin sesión. Es una de las dos únicas funciones que el rol anónimo puede ejecutar. PUEDE: resolver el token contra su sha256 y devolver el nombre del taller, la primera palabra del nombre del cliente, el título del trabajo, el enlace de reseña del taller, las preguntas de ese enlace (la foto que se tomó al mandarlo más las propias del trabajo, cada una con id, texto, tipo, escala, obligatoria, opciones y si es propia) y, si ya contestó, qué contestó y cuándo. NO PUEDE: devolver un importe, un pago, la etapa, la dirección, el teléfono ni ningún otro dato del cliente o del trabajo; devolver nada de otro trabajo ni de otro taller; escribir nada, ni siquiera una visita (es stable, y por eso la usa también la vista previa del enlace). Un enlace inválido, dado de baja, de un trabajo borrado o perdido contestan lo mismo, MN010, sin decir si existió (ADR 0057).';

revoke all on function public.encuesta_compartida(text) from public, anon, authenticated;
grant execute on function public.encuesta_compartida(text) to anon;


create function public.contestar_encuesta(p_token text, p_respuesta jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_encuesta public.encuestas_enviadas;
  v_preguntas jsonb;
  v_motivo text;
  v_existente uuid;
  v_id uuid;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{16,128}$' then
    raise exception 'Este link no funciona' using errcode = 'MN010';
  end if;

  -- Bloqueada mientras se guarda: dar de baja el enlace, borrar el trabajo o mandar otra encuesta
  -- esperan a que termine, y si llegaron antes, esta vuelve a mirar la fila y ya no sirve. Sin
  -- eso, un cliente que contesta en el mismo segundo en que el dueño genera otro enlace dejaría
  -- dos respuestas para el mismo trabajo.
  select * into v_encuesta
  from public.encuestas_enviadas e
  where e.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
    and e.revocada_at is null
    and e.deleted_at is null
  for share;

  if not found then
    raise exception 'Este link no funciona' using errcode = 'MN010';
  end if;

  if not exists (
    select 1 from public.proyectos p
    where p.household_id = v_encuesta.household_id
      and p.id = v_encuesta.proyecto_id
      and p.deleted_at is null
      and p.estado <> 'perdido'
  ) then
    raise exception 'Este link no funciona' using errcode = 'MN010';
  end if;

  -- Ya contestada: no se pisa nada. Si es el mismo envío que vuelve (la respuesta del primero se
  -- perdió en la red), se le contesta que quedó guardada; si es otro, que ya estaba.
  select r.id into v_existente
  from public.respuestas r
  where r.household_id = v_encuesta.household_id and r.encuesta_id = v_encuesta.id;

  if found then
    return jsonb_build_object(
      'estado',
      case when v_existente::text = lower(p_respuesta ->> 'id') then 'guardada' else 'ya_contestada' end
    );
  end if;

  -- Todo se valida acá, del lado de la base, y antes de escribir una sola fila: lo que no cumple
  -- se rechaza entero. El tope de tamaño deja pasar once textos de 2000 caracteres de cuatro bytes.
  if pg_column_size(p_respuesta) > 262144 then
    raise exception '%', private.motivo_del_rechazo('forma') using errcode = 'MN011', detail = 'forma';
  end if;

  v_preguntas := private.preguntas_de_la_encuesta(v_encuesta);
  v_motivo := private.validar_respuesta(v_preguntas, p_respuesta);

  if v_motivo is not null then
    raise exception '%', private.motivo_del_rechazo(v_motivo) using errcode = 'MN011', detail = v_motivo;
  end if;

  v_id := (p_respuesta ->> 'id')::uuid;

  -- Dos envíos a la vez del mismo enlace: el segundo espera en el índice único al primero, y si el
  -- primero se guarda, el segundo termina acá y contesta lo mismo que si hubiera llegado después.
  begin
    insert into public.respuestas (id, household_id, encuesta_id)
    values (v_id, v_encuesta.household_id, v_encuesta.id);
  exception
    when unique_violation then
      select r.id into v_existente
      from public.respuestas r
      where r.household_id = v_encuesta.household_id and r.encuesta_id = v_encuesta.id;

      if not found then
        raise;
      end if;

      return jsonb_build_object(
        'estado', case when v_existente = v_id then 'guardada' else 'ya_contestada' end
      );
  end;

  insert into public.renglones_de_respuesta (
    household_id, respuesta_id, pregunta_id, tipo, cantidad_de_opciones, pregunta_texto,
    valor_numero, valor_opciones, valor_texto
  )
  select
    v_encuesta.household_id,
    v_id,
    (t.r ->> 'pregunta')::uuid,
    (p ->> 'tipo')::public.tipo_de_pregunta,
    case when jsonb_typeof(p -> 'opciones') = 'array' then jsonb_array_length(p -> 'opciones') else 0 end,
    p ->> 'texto',
    case when p ->> 'tipo' in ('escala5', 'sitalvezno', 'una') then (t.r -> 'valor')::numeric::smallint end,
    case
      when p ->> 'tipo' = 'varias' then (
        select array_agg(e::numeric::smallint order by e::numeric)
        from jsonb_array_elements(t.r -> 'valor') as e
      )
    end,
    case
      when p ->> 'tipo' = 'texto'
        then regexp_replace(t.r ->> 'valor', '^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$', '', 'g')
    end
  from jsonb_array_elements(p_respuesta -> 'renglones') with ordinality as t (r, orden)
  join jsonb_array_elements(v_preguntas) as p on p ->> 'id' = t.r ->> 'pregunta';

  return jsonb_build_object('estado', 'guardada');
end;
$$;

comment on function public.contestar_encuesta(text, jsonb) is
  'Guarda lo que contestó el cliente que abrió un enlace, sin sesión. Es una de las dos únicas funciones que el rol anónimo puede ejecutar. PUEDE: insertar una respuesta y sus renglones para la encuesta de ese enlace, una sola vez. NO PUEDE: actualizar ni borrar nada; escribir en otra tabla; contestar dos veces (la segunda contesta ya_contestada y no pisa la primera); contestar una pregunta que no sea de ese enlace; devolver datos, ni de este trabajo ni de otro: devuelve solo {estado}. Antes de escribir valida del lado de la base que el enlace exista y esté vivo, que cada renglón conteste una pregunta de ese enlace con el tipo y el rango que pide, que no venga una pregunta dos veces ni una de más, que estén las obligatorias y que ningún texto pase de 2000 caracteres. Lo que no cumple se rechaza entero con MN011 y no se guarda media respuesta (ADR 0057).';

revoke all on function public.contestar_encuesta(text, jsonb) from public, anon, authenticated;
grant execute on function public.contestar_encuesta(text, jsonb) to anon;


-- La réplica trae las opiniones ------------------------------------------------------------------------

-- Cuatro claves más en el mismo JSON. Un bundle viejo lee solo las tablas que conoce y las ignora.
create or replace function public.bootstrap()
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
    'opciones_de_presupuesto', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.opciones_de_presupuesto t where t.deleted_at is null
    ),
    'necesidades', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.necesidades t where t.deleted_at is null
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
    )
  )
$$;

create or replace function public.delta(p_desde timestamptz)
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
    'opciones_de_presupuesto', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.opciones_de_presupuesto t where t.updated_at >= v_desde
    ),
    'necesidades', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.necesidades t where t.updated_at >= v_desde
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
    )
  );
end;
$$;
