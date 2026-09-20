-- El cuerpo de private.formas_de_cobro(), con los finales de línea de siempre (ADR 0053).
--
-- No cambia ni una letra de lo que hace la función: la vuelve a crear igual. Lo que arregla es que
-- el archivo de la migración 20260919210000 se guardó con finales de línea de Windows, y Postgres
-- guarda el cuerpo de una función tal cual se lo mandan. El resultado era una base que decía CRLF
-- donde supabase/esquema.sql decía LF, y tests/esquema.test.ts fallando en cada clon del repo.
--
-- La lección, que va al ADR: el cuerpo de una función es texto literal en la base. Un archivo de
-- migración con CRLF deja CRLF adentro de pg_proc.prosrc.

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
