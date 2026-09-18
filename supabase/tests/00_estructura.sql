-- Invariantes del esquema que tienen que valer para toda tabla, vista y función, incluidas las que
-- se agreguen después. Si una tabla nueva llega sin RLS, sin policy o sin su índice de delta, esto
-- falla antes de que llegue a producción.

select plan(18);

select tables_are(
  'public',
  array['households', 'household_members', 'clientes', 'proyectos', 'pagos', 'gastos', 'opciones_de_presupuesto', 'necesidades', 'movimientos', 'ajustes', 'anotaciones', 'archivos'],
  'public tiene exactamente las tablas esperadas: una tabla nueva obliga a revisar esta suite'
);

select views_are('public', array['libro_mayor'], 'public tiene exactamente las vistas esperadas');

-- Las funciones que devuelven event_trigger quedan afuera de todos los chequeos de funciones: son
-- de la plataforma (public.rls_auto_enable, la de "Enable automatic RLS") y Postgres no deja
-- llamarlas si no es como event trigger, así que la API no las puede ejecutar.
select set_eq(
  $$
    select p.proname::text from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.prorettype <> 'event_trigger'::regtype
  $$,
  array[
    'bootstrap', 'delta', 'cobrar_proyecto', 'reabrir_proyecto', 'cerrar_perdido', 'reactivar_perdido', 'guardar_proyecto',
    'registrar_suscripcion', 'dar_de_baja_suscripcion', 'estado_de_mis_avisos', 'guardar_preferencias_de_avisos',
    'suscripciones_para_probar', 'anotar_aviso', 'borrar_suscripcion_vencida', 'avisos_por_mandar'
  ],
  'public expone exactamente las funciones esperadas'
);

select is_empty(
  $$
    select c.relname
    from pg_class c
    where c.relnamespace = 'public'::regnamespace
      and c.relkind in ('r', 'p')
      and not c.relrowsecurity
  $$,
  'ninguna tabla de public sin RLS'
);

select is_empty(
  $$
    select c.relname
    from pg_class c
    where c.relnamespace = 'public'::regnamespace
      and c.relkind in ('r', 'p')
      and not exists (select 1 from pg_policy p where p.polrelid = c.oid)
  $$,
  'toda tabla de public tiene al menos una policy'
);

select is_empty(
  $$
    select tablename || '.' || policyname
    from pg_policies
    where schemaname = 'public'
      and roles <> array['authenticated']::name[]
  $$,
  'toda policy de public nombra solo a authenticated en su cláusula to'
);

select is_empty(
  $$
    select c.relname
    from pg_class c
    where c.relnamespace = 'public'::regnamespace
      and c.relkind in ('r', 'p', 'v', 'm')
      and (
        has_table_privilege('anon', c.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
        or has_any_column_privilege('anon', c.oid, 'SELECT, INSERT, UPDATE, REFERENCES')
      )
  $$,
  'anon no tiene ningún privilegio sobre tablas ni vistas de public'
);

select is_empty(
  $$
    select c.relname
    from pg_class c
    where c.relnamespace = 'public'::regnamespace
      and c.relkind in ('r', 'p', 'v', 'm')
      and has_table_privilege('authenticated', c.oid, 'DELETE, TRUNCATE, REFERENCES, TRIGGER')
  $$,
  'authenticated no borra físicamente ni trunca: los borrados son lógicos'
);

select is_empty(
  $$
    select p.oid::regprocedure::text
    from pg_proc p
    where p.pronamespace in ('public'::regnamespace, 'private'::regnamespace)
      and has_function_privilege('anon', p.oid, 'EXECUTE')
  $$,
  'anon no ejecuta ninguna función de public ni de private, tampoco las de la plataforma'
);

select is_empty(
  $$
    select p.oid::regprocedure::text
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.prorettype <> 'event_trigger'::regtype
      and p.prosecdef
  $$,
  'ninguna función expuesta por la API es security definer'
);

select is_empty(
  $$
    select p.oid::regprocedure::text
    from pg_proc p
    where p.pronamespace in ('public'::regnamespace, 'private'::regnamespace)
      and not exists (select 1 from unnest(p.proconfig) as c (valor) where c.valor like 'search_path=%')
  $$,
  'toda función de public y private fija su search_path'
);

select is_empty(
  $$
    select c.relname
    from pg_class c
    where c.relnamespace = 'public'::regnamespace
      and c.relkind = 'v'
      and not coalesce(c.reloptions @> array['security_invoker=true'], false)
  $$,
  'toda vista de public es security_invoker'
);

select is_empty(
  $$
    select c.relname || '.' || col.nombre
    from pg_class c
    cross join unnest(array['id', 'created_at', 'updated_at', 'deleted_at', 'version']) as col (nombre)
    where c.relnamespace = 'public'::regnamespace
      and c.relkind = 'r'
      and not exists (
        select 1 from pg_attribute a
        where a.attrelid = c.oid and a.attname = col.nombre and not a.attisdropped
      )
  $$,
  'toda tabla tiene id, created_at, updated_at, deleted_at y version'
);

select is_empty(
  $$
    select c.relname
    from pg_class c
    where c.relnamespace = 'public'::regnamespace
      and c.relkind = 'r'
      and c.relname <> 'households'
      and not exists (
        select 1 from pg_attribute a
        where a.attrelid = c.oid and a.attname = 'household_id' and a.attnotnull and not a.attisdropped
      )
  $$,
  'toda tabla salvo households lleva household_id no null, también las hijas'
);

select is_empty(
  $$
    select c.relname
    from pg_class c
    where c.relnamespace = 'public'::regnamespace
      and c.relkind = 'r'
      and not exists (
        select 1 from pg_trigger t
        where t.tgrelid = c.oid and t.tgfoid = 'private.mantener_metadatos()'::regprocedure
      )
  $$,
  'toda tabla corre private.mantener_metadatos()'
);

-- Toda foreign key tiene un índice no parcial que empieza por sus columnas: sin él, cada
-- chequeo de la key y cada borrado en cascada es un scan secuencial.
select is_empty(
  $$
    select con.conrelid::regclass::text || ' ' || con.conname
    from pg_constraint con
    where con.contype = 'f'
      and con.connamespace = 'public'::regnamespace
      and not exists (
        select 1
        from pg_index i
        where i.indrelid = con.conrelid
          and i.indpred is null
          and (
            select array_agg(k.attnum order by k.attnum)
            from unnest(i.indkey::int2[]) with ordinality as k (attnum, posicion)
            where k.posicion <= cardinality(con.conkey)
          ) = (select array_agg(k order by k) from unnest(con.conkey) as k)
      )
  $$,
  'toda foreign key tiene un índice que empieza por sus columnas'
);

-- El acceso de public.delta(): household_id y rango de updated_at. households y ajustes quedan
-- afuera a propósito: tienen una fila por household y las cubre su clave única.
select is_empty(
  $$
    select c.relname
    from pg_class c
    where c.relnamespace = 'public'::regnamespace
      and c.relkind = 'r'
      and c.relname not in ('households', 'ajustes')
      and not exists (
        select 1
        from pg_index i
        where i.indrelid = c.oid
          and i.indpred is null
          and i.indnatts >= 2
          and i.indkey[0] = (select a.attnum from pg_attribute a where a.attrelid = c.oid and a.attname = 'household_id')
          and i.indkey[1] = (select a.attnum from pg_attribute a where a.attrelid = c.oid and a.attname = 'updated_at')
      )
  $$,
  'toda tabla sincronizable tiene el índice (household_id, updated_at) del delta'
);

-- db push entra con un rol de login temporal del CLI. Si algo quedara a su nombre, las funciones
-- security definer correrían con sus permisos y no con los del dueño de las tablas.
select is_empty(
  $$
    select c.relname::text from pg_class c
    where c.relnamespace in ('public'::regnamespace, 'private'::regnamespace)
      and c.relkind in ('r', 'p', 'v', 'm', 'S', 'i')
      and c.relowner <> 'postgres'::regrole
    union all
    select p.oid::regprocedure::text from pg_proc p
    where p.pronamespace in ('public'::regnamespace, 'private'::regnamespace)
      and p.proowner <> 'postgres'::regrole
  $$,
  'todo lo de public y private es del rol postgres'
);

select * from finish();
