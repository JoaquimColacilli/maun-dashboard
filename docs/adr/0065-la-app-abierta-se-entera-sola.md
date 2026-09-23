# 0065. La app abierta se entera sola: un aviso vacío por Realtime y el delta de siempre

- Estado: aceptada
- Fecha: 2026-09-23
- Completa al [0010](0010-sincronizacion-replica-completa.md): la réplica se sigue armando con
  `bootstrap()` y `delta()`, y nada más entra por otro lado. Cambia cuándo se pide el delta. El
  [0057](0057-las-opiniones-de-los-clientes.md) (las opiniones) se beneficia sin cambios.

## Contexto

Una opinión que contesta el cliente tardaba «como un minuto» en aparecer en la app abierta.

**Medido antes de tocar nada** (e2e contra la base real, build de producción, Chromium; la medición
queda en `la-opinion-llega-sola.spec.ts`, que en su primer commit está marcado como falla esperada):

- Con la app a la vista, sin tocarla, **la opinión no apareció en 90 segundos**. El único pedido de delta
  fue el de la carga, 2,9 s antes de contestar; después, ninguno.
- Saliendo y volviendo cada unos 7 segundos, ocho vueltas entre los 4,6 y los 54,8 s no pidieron nada.
  La vuelta de los 62 s, **64 s después de la carga de la réplica**, pidió el delta, y la opinión
  apareció a los 62,8 s de contestada.

**La causa** es la cadencia del pull, no el delta ni la base. La réplica tenía `staleTime` de 60 s, y
TanStack solo vuelve a pedir al volver a la pestaña lo que ya está viejo. Con la app a la vista, nada
pedía nada: sin intervalo, sin Realtime, sin push. Además, cada guardado local reinicia ese reloj
(`setQueriesData` pone `dataUpdatedAt` en ahora), así que el minuto se contaba desde la última
escritura, como tocar «Pedírsela por WhatsApp». Las opiniones bajan por la réplica, no por una consulta
aparte, y la base las devolvía en el primer delta que se pidiera.

## Decisión

**Un timbre, no un dato.** Cada transacción que escribe en una tabla del delta manda, desde un trigger,
un aviso por Realtime Broadcast al canal privado de su taller, `cambios:<household_id>`, con el evento
`cambios` y el payload vacío (`realtime.send` le agrega un id). Es uno por transacción y por taller: la
primera escritura lo manda y deja una marca local a la transacción (`maun.cambios_avisados`). La app,
mientras está a la vista, escucha ese canal y ante un aviso pide el delta. Es el «poke» de Replicache:
los datos siguen bajando por el pull, con su RLS.

**Por qué el aviso no lleva datos.** Broadcast autoriza por canal, no por fila: una fila en el payload
pasaría por al lado de la RLS de su tabla, quedaría guardada en `realtime.messages` y sería un segundo
camino de entrada a la réplica. Vacío, quien escucha solo sabe que algo cambió.

**Quién escucha.** Una política de lectura sobre `realtime.messages`, solo `to authenticated`: el canal
tiene que ser `cambios:` más un taller del usuario, con el mismo `private.user_household_ids()` de las
otras políticas, y solo para broadcast. El trigger es `security definer` porque escribe en
`realtime.messages`, donde ni authenticated ni anon tienen insert. anon no recibe ningún permiso nuevo.

**La app** (`useCambiosEnVivo`, montado donde vive la réplica):

- Mientras está a la vista, escucha. Al ocultarse deja el canal, y el cliente cierra el socket.
- Al conectarse o reconectarse, al volver a estar a la vista y al volver la señal pide el delta sin
  esperar ningún aviso, por lo que haya pasado mientras no escuchaba.
- Entre dos pedidos pasan por lo menos 5 s (`MINIMO_ENTRE_PEDIDOS_MS`). Lo que llega en el medio se
  junta en un pedido al cumplirse el plazo, y un aviso que llega mientras se trae vuelve a traer al
  terminar: no se pierde ninguno.
- La réplica apaga `refetchOnWindowFocus` y `refetchOnReconnect`, que dependían del `staleTime`.
- Sin canal no se rompe nada: la vuelta a la app sigue pidiendo el delta.

**El token.** supabase-js 2.116 le pasa a Realtime el token de la sesión y, con cada renovación
(`TOKEN_REFRESHED`), llama a `realtime.setAuth`, que se lo manda a los canales abiertos. No hizo falta
código propio; está probado (abajo).

## Lo que se midió después

- Con la app a la vista: la respuesta se confirmó a los 210 ms, el aviso llegó a los 213 ms, el delta
  salió a los 214 ms y la opinión estaba en pantalla a los **470 ms**.
- Dos sesiones de la misma cuenta, en la compu: lo que se anota en una apareció en la otra a los 220,
  212 y 833 ms de que la base confirmara la anotación, en tres vueltas. El e2e de las dos sesiones pide
  menos de 10 s.
- El aviso sale solo cuando la transacción confirma. La documentación de Supabase no lo dice, así que
  se probó contra producción: una escritura que espera 3 s y hace rollback no avisó nada; la misma con
  commit avisó 38 ms después del commit, no al escribir.
- Realtime, en vivo: el dueño se une a su canal (`ok`); anon, «Unauthorized: You do not have
  permissions to read from this Channel topic»; el dueño pidiendo el canal de otro taller, lo mismo.
- Los permisos de anon, antes y después de la migración: idénticos (29 de tabla, 216 de columna, 38
  funciones, 3 de esquema y 2 políticas).
- El bundle: el cliente de Realtime ya venía en el chunk `vendor` sin usarse (supabase-js lo crea
  siempre). El arreglo suma 1.416 bytes, 520 comprimidos, sobre 1,49 MB.

## Alternativas descartadas

- **Un intervalo fijo** con la app a la vista. Pide aunque no haya nada, y aun así tarda lo que dure el
  intervalo.
- **Bajar el `staleTime` a cero.** Arregla la vuelta a la pestaña, pero con la app a la vista sigue sin
  pedir nada.
- **Postgres Changes** en vez de Broadcast. Manda las filas por el canal, que es justo lo que no se
  quiere, y exige publicar las tablas.
- **Mandar las filas en el aviso.** Ver arriba: un segundo camino de datos sin RLS por fila.

## Consecuencias

- Una tabla nueva del delta lleva el trigger `avisar_los_cambios`; `31_el_aviso_de_cambios.sql` falla
  si falta.
- Hay que apagar «Allow public access» en la configuración de Realtime, para que no se acepten canales
  públicos. La app no usa ninguno.
- Plan Free: 200 conexiones simultáneas y 100 mensajes por segundo (página de límites de Realtime de
  Supabase). Un taller con dos dispositivos y un aviso por transacción queda muy lejos.

## Fuentes

- TanStack Query, «Window Focus Refetching»: al volver solo se pide lo viejo, y el `focusManager`
  escucha `visibilitychange`. Verificado en `@tanstack/query-core` 5.102.8 (`focusManager.ts`,
  `query.ts`).
- Replicache, «Poke»: «A Replicache poke carries no data – it's only a hint telling the client to pull
  soon».
- Supabase, «Broadcast» (`realtime.send(payload, event, topic, private)` desde la base) y «Realtime
  Authorization» (políticas sobre `realtime.messages` con `realtime.topic()`, `private: true` en el
  cliente, y «Allow public access» en Realtime Settings). La definición de `realtime.send` se leyó en
  producción: si falla, avisa con un warning y no corta la transacción.
- supabase-js 2.116.0, `SupabaseClient.ts`: `accessToken` y `_handleTokenChanged` → `realtime.setAuth`.
