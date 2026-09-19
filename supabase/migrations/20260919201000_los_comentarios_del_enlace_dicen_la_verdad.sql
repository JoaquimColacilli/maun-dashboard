-- Los comentarios del enlace dicen la verdad (ADR 0052).
--
-- Solo metadata: no toca ni una fila, ni un permiso, ni una función.
--
-- La migración anterior agregó la columna con su comment, pero dejó en pie dos textos que decían lo
-- contrario y que viven en la base de producción, no en el repo: el de la tabla y el de
-- public.vista_compartida(). Los dos afirmaban que el token en claro no estaba en la base. Un
-- \d+ enlaces_publicos, o alguien mirando qué tan sensible es un volcado, leía la propiedad vieja y
-- sacaba la conclusión exactamente al revés.

comment on table public.enlaces_publicos is
  'El link sin sesión de un trabajo. Guarda las dos cosas: token_hash, que es con lo que public.vista_compartida() resuelve el token que llega por la URL, y token, el token en claro, para que el dueño vea la dirección desde cualquiera de sus aparatos y no tenga que crear otro (ADR 0052). La consecuencia, escrita para que nadie la deduzca al revés: un volcado de esta tabla contiene enlaces que funcionan, y hay que tratarlo como tal. El rol anónimo no tiene ningún grant acá y ninguna función security definer devuelve la columna token.';

comment on function public.vista_compartida(text) is
  'La puerta del link: resuelve el token contra token_hash, cuenta la visita y devuelve exactamente lo mismo que public.vista_del_cliente(). Es security definer porque quien la llama es el rol anónimo, que no puede leer ninguna de las tablas que ella toca. Un token inválido, uno dado de baja, uno de un trabajo borrado y uno de un trabajo perdido contestan los cuatro lo mismo, MN010, sin decir si el trabajo existe ni el nombre de nadie (ADR 0046). No devuelve la columna token: el cliente llega con su token en la mano y no necesita que se lo contesten (ADR 0052).';
