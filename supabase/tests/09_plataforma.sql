-- Lo que la plataforma instaló y cómo quedó: rls_auto_enable ya no es ejecutable por la API, y el
-- event trigger que la usa sigue activando RLS en cada tabla nueva de public.

select plan(3);

select ok(
  not has_function_privilege('anon', 'public.rls_auto_enable()', 'EXECUTE'),
  'anon no ejecuta rls_auto_enable'
);

select ok(
  not has_function_privilege('authenticated', 'public.rls_auto_enable()', 'EXECUTE'),
  'authenticated no ejecuta rls_auto_enable'
);

create table public.prueba_rls_automatica (id integer);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.prueba_rls_automatica'::regclass),
  'el event trigger sigue activando RLS en una tabla nueva de public'
);

select * from finish();
