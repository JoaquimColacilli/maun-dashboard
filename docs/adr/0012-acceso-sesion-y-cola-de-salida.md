# 0012. Acceso: mail y contraseña, sesión verificada sin red y cola de salida ordenada

Estado: aceptada, 2026-09-11. Es lo que se construyó en la fase 2C.

## Contexto

El acceso es lo primero que ve el usuario y lo primero de la app real. El taller tiene mala señal, la usa una persona (el hermano del dueño) y los datos viven detrás de RLS por household (ADR 0004). Dos cosas cambiaron respecto del brief de la fase 2: el registro público queda **abierto** y la confirmación de mail **activada**. El mail sale por el servicio integrado de Supabase, sin SMTP propio.

Lo verificado contra el proyecto real el 2026-09-11, con la API de administración y el endpoint de JWKS, no de memoria:

- `site_url = https://maun-dashboard.netlify.app`, y la lista de redirecciones permitidas es `http://localhost:5173/**`, `https://maun-dashboard.netlify.app/**` y `https://*--maun-dashboard.netlify.app/**`. Los comodines cubren cualquier ruta, así que las rutas de esta fase entran sin tocar nada.
- `disable_signup = false` (registro abierto), `mailer_autoconfirm = false` (confirmación activada), `rate_limit_email_sent = 2` por hora, sin SMTP propio.
- El JWKS del proyecto devuelve una clave **ES256**: las firmas son asimétricas y el JWT se puede verificar en el navegador.

## Decisión

**Mail y contraseña, no enlace mágico.** Un enlace por mail obliga a tener red y a abrir el correo justo cuando el taller no tiene señal, y encima el proyecto manda dos mails por hora. Con contraseña, la sesión queda persistida y el usuario entra sin red. El diseño (`design-reference/Login.dc.html`) está dibujado para enlace mágico: se portó el layout y la marca, y se cambió el texto.

**Registro abierto, household cerrado.** Cualquiera puede crearse una cuenta, pero nadie se crea un taller: `private.crear_household` no tiene grant para ningún rol (ADR 0004). Una cuenta sin household no ve un tablero vacío ni una pantalla rota: ve **"Todavía sin acceso"**, con su mail, un botón para reintentar y uno para salir. El acceso lo da hoy quien administra la base:

```sh
pnpm --filter @maun/db db:household --email <mail> --nombre "<taller>"
pnpm --filter @maun/db db:household --listar
```

Ese script es el punto de extensión de las invitaciones: cuando existan, lo que cambia es quién dispara el alta de `household_members`, no el resto. No se construyen ahora.

**PKCE, no implicit.** El enlace del correo trae un `code` que solo sirve en el navegador que lo pidió, porque el verifier quedó ahí. El costo es real: un enlace abierto en otro dispositivo no entra. La app lo dice con esas palabras y ofrece pedir otro. La alternativa, el flujo implicit, manda el access token en el fragmento de la URL y lo deja en el historial.

- El enlace de confirmación cae en `/acceso`; el de recuperación, en `/acceso/nueva-contrasena`.
- `/acceso/nueva-contrasena` no está detrás de la guarda de sesión a propósito: si el enlace no sirve, la pantalla lo explica en vez de rebotar al login sin decir nada. Distingue el enlace inválido de la falta de señal, porque son cosas distintas y el remedio también.
- **Tener la sesión abierta no alcanza para cambiar la contraseña.** El proyecto no pide la contraseña anterior (`secure_password_change` está apagado), así que esa pantalla exige que la sesión venga del evento de recuperación: si no, cualquiera con el dispositivo desbloqueado la cambiaría y dejaría al dueño afuera.

**La sesión se valida sin red.** `getClaims()` verifica el JWT localmente contra el JWKS (claves asimétricas, verificado arriba). Si falla por falta de red antes de tener el JWKS cacheado, se cae a `getSession()`, que es una lectura local **sin verificar**: alcanza para elegir qué pantalla mostrar, porque el que valida de verdad es Postgres en cada consulta. `getUser()` no se usa en el camino crítico: es un round trip antes de poder decidir (ADR 0009).

Hay un tercer escalón, y es el que sostiene el offline-first: el access token dura una hora, así que abrir la app a la mañana en el taller significa token vencido. Ahí `getSession()` tampoco puede refrescar y devuelve sesión nula. Mandar al usuario al login sería encerrarlo afuera de sus propios datos con un formulario que sin red no se puede enviar: en ese caso se lee la sesión guardada para saber quién es y mostrarle su copia local. Es una sesión **sin verificar**, y está bien que lo sea: la única barrera real es Postgres, que revalida el token en cada consulta.

`onAuthStateChange` se suscribe una sola vez para toda la app (un store con `useSyncExternalStore`, no un hook por componente) y su callback no llama a Supabase: solo escribe estado. Llamar a la API de auth adentro del callback cuelga las llamadas siguientes.

**Guardas en tres niveles**, porque son tres preguntas distintas:

| Guarda          | Pregunta                       | Si no                  |
| --------------- | ------------------------------ | ---------------------- |
| `RutaPublica`   | ¿Ya hay sesión?                | Deja pasar al login.   |
| `RutaConSesion` | ¿Hay sesión?                   | Manda a `/acceso`.     |
| `RutaConAcceso` | ¿La réplica trae un household? | Manda a `/sin-acceso`. |

**Un error al sincronizar no es falta de acceso.** Si la réplica no se pudo traer y no hay nada guardado, no se sabe si el usuario tiene taller: se muestra un error con reintentar y cerrar sesión. Decir "no tenés acceso" ahí sería mentir.

**La cola de salida es la de TanStack, con `scope`.** Verificado leyendo query-core 5.102.8: `resumePausedMutations()` arranca todas las mutaciones pausadas con `Promise.all`, es decir **en paralelo**. El orden lo da `scope: { id: 'salida' }`: `canRun` deja correr solo a la primera pendiente del scope y `runNext` sigue con la que viene, y `dehydrateMutation` **persiste el scope**, así que el orden sobrevive a cerrar la app. Sin eso, dos liquidaciones del mismo mes hechas sin señal se pisan y la segunda rebota con `MN006` (ADR 0010 y 0011).

- Está probado con IndexedDB de verdad en `apps/web/src/shared/lib/cache/cola.test.ts`: dos mutaciones sin red quedan en pausa, se persisten, se restauran en un cliente nuevo **que no registra el scope** y terminan en orden. Que el cliente que restaura no lo registre es el punto: si el orden se sostiene es porque el scope viajó con la mutación.
- **Se persiste toda mutación pendiente, no solo la pausada.** El default de TanStack guarda únicamente lo pausado, y `isPaused` se decide una sola vez, al arrancar: con señal mala `navigator.onLine` dice que hay red, así que la mutación sale, reintenta, y no se persiste, mientras su fila optimista sí. Cerrar la app en esos segundos perdía el movimiento y dejaba la fila fantasma. Al restaurar, las que quedaron a mitad de envío se continúan **antes** de reanudar las pausadas: comparten scope, así que si no, taparían la cola.
- Cada mutación se aplica optimista a la réplica del cache (`aplicarFilaLocal`) y, si la base la rechaza, se saca (`quitarFilaLocal`).
- **Solo se reintenta lo que no llegó a la base o puede pasar solo.** Un rechazo de negocio (`MNxxx`, `42501`) o cualquier SQLSTATE definitivo (una violación de check, por ejemplo) no se reintenta: nunca va a andar, y como la cola drena de a una, reintentarlo tapa todo lo que viene atrás. Se reintentan los fallos sin respuesta de la base y las clases transitorias (conexión, transacción abortada, falta de recursos).
- El indicador de sincronización suma un cuarto estado, _rechazado_, para lo que la base no aceptó. La UI sigue sin decir "guardado" para algo que está en cola.

**La réplica es una sola entrada del cache**, `['replica', usuarioId]`. `bootstrap()` la reemplaza entera; `delta(cursor)` la mezcla fila por fila comparando `version`: gana la que llega salvo que sea más vieja, que es un delta fuera de orden. Reconcile completo al entrar y cada 24 horas (ADR 0010). Dos cosas que no son obvias y que se pagan caro:

- **La mezcla se hace sobre el cache fresco, no sobre la foto que se leyó antes del viaje a la base.** Entre que sale el pedido y vuelve, la cola puede haber agregado o sacado filas; mezclar sobre la foto vieja las borraba. En la rama de rechazo eso era permanente: la fila que la base no aceptó volvía al cache y ningún delta la iba a sacar, porque en el servidor no existe.
- **El reconcile no corre mientras haya cambios en la cola.** Reemplaza la copia entera, así que se llevaría puestas las filas optimistas que todavía no llegaron al servidor. Espera a que la cola drene.

El `usuarioId` está en la clave y adentro de la réplica: si el que abre la app no es el mismo, la réplica se descarta y se arranca de cero.

**Al cerrar sesión se borra todo lo local**: la cola de mutaciones, el cache de queries y el almacén de IndexedDB. Si quedan cambios sin sincronizar, el botón dice cuántos se pierden y pide confirmarlo. Sin red, el `signOut()` cae a `scope: 'local'` para que cerrar sesión siempre funcione.

**Y la limpieza no depende del botón.** Una sesión se termina de muchas maneras: el refresh token revocado, la contraseña cambiada desde otro lado, o el propio `signOut()` fallando después de haber borrado la sesión local. En todas esas, la copia entera del taller quedaba en el disco y la cola se reejecutaba con el usuario siguiente: como el `household_id` lo pone la base según la sesión, un movimiento de uno terminaba escrito en el taller del otro. Por eso el borrado cuelga del evento `SIGNED_OUT` y de encontrar datos de otro usuario al arrancar, no de que alguien toque un botón.

**`VERSION_CACHE` pasa a `2`**: cambió la forma de lo que se persiste, así que el cache viejo se descarta solo.

## Alternativas descartadas

- **Enlace mágico**, aunque el diseño lo dibuje: exige red y correo justo donde no hay señal, y dos mails por hora no alcanzan para trabajar.
- **`@supabase/ssr`**: es para frameworks con servidor; esta app es una SPA.
- **`getUser()` para las guardas**: un round trip al servidor de Auth antes de mostrar cualquier cosa.
- **Flujo implicit**: evita el problema del enlace abierto en otro dispositivo, pero deja el token en la URL.
- **Una base de IndexedDB por usuario**: más partes para sostener. Con borrar al salir y el `usuarioId` en la clave alcanza.
- **Ordenar la cola a mano** (un drenado propio que espere a cada mutación): reimplementa lo que `scope` ya hace, y habría que sostenerlo en cada reintento.

## Consecuencias

- Mientras no existan invitaciones, dar acceso es correr un script contra la base. Está documentado en `packages/db/CLAUDE.md` y la pantalla "Todavía sin acceso" no promete otra cosa.
- La contraseña mínima es 6, que es lo que impone hoy el proyecto. Subirla es cambiarla en el proyecto y en el texto de ayuda del formulario.
- El formulario de movimientos repite en TypeScript la regla `movimientos_forma_segun_tipo` de la base (qué lados lleva cada tipo). Es la única copia de una regla de SQL en la app y está acá anotada: cuando los movimientos tengan modelo en `@maun/domain`, esa regla se muda ahí con su test gemelo contra SQL, como la cascada (ADR 0011).
- **Subir `VERSION_CACHE` tira la cola.** El buster descarta el cliente persistido entero, mutaciones incluidas, y eso es dato del usuario, no cache. Mientras la cola y el cache compartan el mismo blob, un deploy que lo suba se hace con la cola vacía o se avisa. Separarlos es trabajo para cuando haya más de un escritor.
- **El persister reescribe la réplica entera en cada evento del cache**, sin throttle en esta versión de TanStack: un movimiento dispara varias escrituras completas. Hoy el dataset es chico y no se nota; es lo primero a medir cuando crezca, con los umbrales del ADR 0009.
- **Un rechazo se ve mientras la app esté abierta y hasta 24 horas** (el `gcTime` de la mutación): después no queda rastro de lo que el usuario cargó y la base no aceptó. La pantalla que los liste y permita reintentarlos o descartarlos es trabajo de la 2D.
- El e2e cubre lo que no necesita credenciales: la redirección al login, la validación del formulario y la navegación entre las pantallas de acceso. Entrar de verdad necesita un usuario y mails reales: se prueba a mano.
- La fase 2D lee de la réplica; ninguna pantalla consulta PostgREST por su cuenta.
