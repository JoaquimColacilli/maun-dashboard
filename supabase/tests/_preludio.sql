-- Preludio de la suite: el runner (packages/db) lo ejecuta antes de cada archivo de test, dentro
-- de la misma transacción. Todo lo que crea (pgTAP, el schema tests, los usuarios de prueba)
-- desaparece con el rollback que cierra cada archivo. Los archivos que empiezan con _ no son tests.

create extension if not exists pgtap with schema extensions;

create schema tests;
grant usage on schema tests to anon, authenticated;

-- Un usuario de Auth mínimo. Solo existe dentro de la transacción del test.
--
-- Nace sin confirmar, que es como nace un registro real y, sobre todo, es lo que deja que el test
-- arme el household que quiere con private.crear_household(): confirmar el mail dispara el trigger
-- que le crea el suyo (ver 12_alta_de_cuenta.sql).
create function tests.crear_usuario(p_email text, p_confirmado boolean default false)
returns uuid
language plpgsql
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values (
    v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p_email, '',
    case when p_confirmado then now() end,
    '{"provider": "email", "providers": ["email"]}', '{}', now(), now()
  );
  return v_id;
end;
$$;

create function tests.confirmar_mail(p_user_id uuid)
returns void
language sql
as $$
  update auth.users set email_confirmed_at = now() where id = p_user_id
$$;

-- Lo mismo que hace PostgREST con un JWT válido: rol authenticated y los claims en el setting.
create function tests.entrar_como(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

create function tests.entrar_como_anon()
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', '{"role": "anon"}', true);
  perform set_config('role', 'anon', true);
end;
$$;

-- Vuelve al rol de la conexión (el dueño de la base), para sembrar datos salteando RLS y grants.
create function tests.salir()
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

create function tests.id(p_clave text)
returns uuid
language sql
stable
as $$
  select current_setting('tests.' || p_clave)::uuid
$$;

create function tests.guardar(p_clave text, p_id uuid)
returns uuid
language sql
as $$
  select set_config('tests.' || p_clave, p_id::text, true)::uuid
$$;

-- El plan de una consulta como texto, corrido con el rol y los claims del momento: la RLS entra.
create function tests.plan_de(p_sql text)
returns text
language plpgsql
as $$
declare
  v_linea text;
  v_plan text := '';
begin
  for v_linea in execute 'explain ' || p_sql loop
    v_plan := v_plan || v_linea || E'\n';
  end loop;
  return v_plan;
end;
$$;

-- El hint de un rechazo: la guarda le dice al usuario cómo seguir, y eso también se prueba.
create function tests.hint_de(p_sql text)
returns text
language plpgsql
as $$
declare
  v_hint text;
begin
  execute p_sql;
  return null;
exception
  when others then
    get stacked diagnostics v_hint = pg_exception_hint;
    return v_hint;
end;
$$;

-- Los tests cambian de rol: que los helpers anden aunque el proyecto haya tocado el execute por
-- defecto de public.
grant execute on all functions in schema tests to anon, authenticated;
