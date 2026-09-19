-- El enlace se guarda entero, no solo su huella (ADR 0052).
--
-- Aditiva. La columna nace null en toda fila existente y ningún valor cambia.
--
-- Hasta acá public.enlaces_publicos guardaba solamente el sha256 del token, y la dirección del
-- enlace vivía en el localStorage del aparato donde se había creado. Eso dejaba al dueño sin el
-- enlace en el teléfono cuando lo había creado en la computadora, y su única salida era crear otro,
-- que le rompe al cliente el que ya tenía. Ahora el token viaja en la fila, que es lo único que
-- alcanza para que la réplica se lo lleve a todos sus aparatos.
--
-- Lo que se pierde está medido en el ADR: un volcado de la base pasa a contener enlaces que
-- funcionan. Lo que se gana es que el enlace exista donde el dueño está parado.
--
-- token_hash NO se va: sigue siendo la clave con la que public.vista_compartida() resuelve el
-- token, sigue teniendo su índice único, y el rol anónimo sigue sin poder leer esta tabla.

alter table public.enlaces_publicos
  add column token text,
  add constraint enlaces_publicos_token_formato
    check (token is null or token ~ '^[A-Za-z0-9_-]{16,128}$'),
  add constraint enlaces_publicos_token_coincide
    check (token is null or encode(sha256(convert_to(token, 'UTF8')), 'hex') = token_hash);

comment on column public.enlaces_publicos.token is
  'El token del enlace en claro, o null en los enlaces creados antes de que esto existiera. Viaja en la réplica para que el dueño vea la dirección desde cualquiera de sus aparatos y no tenga que crear otro, que le rompería al cliente el que ya tiene. El check enlaces_publicos_token_coincide obliga a que su sha256 sea token_hash: acá no se puede guardar un token que no sea el de esta fila. El rol anónimo no tiene ningún grant sobre esta tabla y ninguna función security definer devuelve esta columna (ADR 0052).';

-- Insert para el enlace que se crea, update para rellenar el de los que ya existían desde el
-- aparato que todavía lo tiene guardado. Columna por columna, como el resto de la tabla.
grant insert (token) on table public.enlaces_publicos to authenticated;
grant update (token) on table public.enlaces_publicos to authenticated;
