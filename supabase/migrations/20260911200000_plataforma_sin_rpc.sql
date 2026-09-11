-- public.rls_auto_enable() es la función del event trigger de "Enable automatic RLS": la instaló la
-- plataforma, es security definer y quedó ejecutable por anon y authenticated. Por RPC no hace nada
-- útil (devuelve event_trigger, y Postgres corta con 400), pero el advisor la marca con dos WARN.
-- Preferimos el advisor limpio: el día que aparezca un warning de verdad, se nota.
--
-- Las migraciones corren como postgres, dueño de la función, así que el event trigger sigue
-- activando RLS en cada tabla nueva de public (lo prueba 09_plataforma.sql).
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
