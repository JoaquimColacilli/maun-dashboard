# @maun/web

React 19, Vite 8 y Tailwind 4, empaquetada como PWA. Hoy tiene el acceso (login, registro, recuperación), las guardas de ruta, la réplica del household con su cola de salida, el marco con su navegación por ancho de pantalla, Inicio, Ajustes, **Clientes** (lista, ficha y formulario) y **Proyectos** (lista con su control segmentado, formulario y detalle), que es la superficie más grande. Las secciones que faltan (Seguimiento, Diezmo, Finanzas) son pantallas que dicen qué llega y cuándo, no rutas muertas.

## Capas (FSD, ADR 0006)

```
src/
  main.ts      solo llama a arrancar()
  app/         arranque, providers, router con sus guardas y layout del shell
  pages/       una carpeta por ruta, finas: componen features y entidades
  features/    acciones del usuario (iniciar-sesion, crear-cuenta, recuperar-acceso,
               cerrar-sesion, configurar-taller, registrar-movimiento, editar-cliente,
               editar-proyecto)
  entities/    sesion, replica (la copia del household y su contexto), tesoro, cliente y proyecto
  shared/      api (Supabase), config, lib (cache, claves, plata, fechas, orden, tesoros,
               uuid, sync) y ui
```

- Solo se importa hacia capas de abajo, y un slice no importa a otro de su misma capa.
- Todo se importa por el `index.ts` del slice: `@/entities/proyecto`, nunca `@/entities/proyecto/model/calculo`.
- Esas dos reglas las impone `boundaries/dependencies` y rompen el lint.
- `@maun/ui` se importa solo desde `shared/ui`; el resto del código usa `@/shared/ui`.
- Supabase (`@maun/db`, `@supabase/supabase-js`) se importa solo desde `shared/api`, que es la única puerta: ahí viven el cliente, las operaciones de auth, `sincronizar()` y las mutaciones.
- `@/` apunta a `src/`. Está definido en `tsconfig.app.json` y en `vite.config.ts`: si cambia, cambia en los dos.
- El estado del servidor vive en TanStack Query, dentro de `entities/*/api`. Las query keys llevan ids. El resto es estado local de React; no hay state manager global.
- **El catálogo de tesoros y el ordenamiento de listas también viven en `shared/lib`** (`tesoros.ts`, `orden.ts`): los usan dos slices de `entities` cada uno, y un slice no puede importar a otro. `entities/tesoro` re-exporta el catálogo, así que su API pública no cambió (ADR 0015).
- **Las claves de la réplica viven en `shared/lib/claves.ts`**, no en `entities/replica`: la mutación de cada entidad las necesita para aplicarse optimista, y un slice de `entities` no puede importar a otro. `entities/replica` las re-exporta, así que su API pública no cambió (ADR 0014).
- La plata es `Money` de `@maun/domain`: un `number` entero de centavos con brand. Nunca `BigInt` de JavaScript (ADR 0002). Para mostrarla y leerla, `formatearPesos` y `parsearPesos` de `@/shared/lib`.

## Acceso y sesión (ADR 0012)

- Mail y contraseña, nunca enlace mágico: el taller no tiene señal y el proyecto manda dos mails por hora.
- La sesión se valida con `getClaims()` (verificación local del JWT). `getUser()` no va en el camino crítico. Sin red y con el token vencido se cae a la sesión guardada, sin verificar: la barrera real es Postgres, no la app.
- Hay **una sola suscripción** a `onAuthStateChange` para toda la app (`entities/sesion/model/store.ts`). No agregues otra por componente: remonta el estado y hace parpadear el skeleton. El callback no llama a Supabase, solo escribe estado.
- `/acceso/nueva-contrasena` exige que la sesión venga del enlace de recuperación: con la sesión abierta alcanzaría para cambiar la contraseña sin saber la anterior.
- **El registro es auto-servicio:** quien confirma su mail sale con su propio taller, creado por un trigger de `auth.users` en la misma transacción que la cuenta. No hay pantalla de "sin acceso" y no la agregues: una sesión sin taller es un alta que quedó a medias, y cae en el error genérico con reintentar.
- Tres guardas, tres preguntas distintas: `RutaPublica` (¿ya hay sesión?), `RutaConSesion` (¿hay sesión?) y `RutaConAcceso` (¿la réplica trae household?). Un error al sincronizar **no** es falta de acceso, y al revés tampoco: son mensajes distintos sobre el mismo `ErrorDeCarga`.
- Rutas: `/acceso`, `/acceso/crear-cuenta`, `/acceso/recuperar`, `/acceso/nueva-contrasena` (ahí cae el enlace de recuperación), y adentro del marco `/` (Inicio), `/seguimiento`, `/proyectos`, `/clientes`, `/finanzas`, `/diezmo` y `/ajustes`.
- **La primera configuración es el estado vacío de Inicio, no un asistente** (ADR 0012). Los ajustes nacen en cero y `faltaConfigurar()` es lo que decide el texto. El formulario de `features/configurar-taller` es el mismo que va a usar Ajustes en la 2D: no lo dupliques ahí.
- Al terminar la sesión se borra la cola, el cache y el almacén de IndexedDB (`limpiarDatosLocales`). **No cuelga del botón**: también corre con el evento `SIGNED_OUT` y cuando al arrancar hay datos de otro usuario. Si no, el próximo login hereda los datos y la cola del anterior, y esa cola escribe en su household.

## Pantallas y navegación (ADR 0013)

- **La app renderiza desde la réplica local, nunca desde la red.** La réplica llega por contexto (`useReplicaDelTaller()`), provista por `RutaConAcceso`, que ya la tiene resuelta antes de dejar pasar. **Ninguna pantalla adentro del marco tiene estado de carga**: si te encontrás escribiendo un skeleton para una de ellas, la pantalla no puede quedarse sin datos y el skeleton está de más.
- Sin `lazy` ni Suspense con spinner para las pantallas del taller: se importan directo. El code splitting queda para las de acceso, que son las únicas que dependen de la red.
- `app/layout/destinos.ts` es el modelo de la navegación: los destinos, cuáles se ven en cada ancho y `destinoResaltado`, que marca Proyectos cuando estás en Seguimiento y no hay destino propio. `Navegacion.tsx` elige **una sola** de las tres barras con `matchMedia`: tres `<nav>` en el DOM son tres landmarks.
- El foco y el anuncio al cambiar de ruta los hace `Marco.tsx` sobre el `<main>`, no cada pantalla. Las pantallas **no** renderizan `<main>`: ya hay uno.
- Las transiciones van con `conTransicion()` (`document.startViewTransition` + `flushSync`), nunca con el componente `<ViewTransition>` de React.
- El nodo raíz está anclado con `position: fixed; inset: 0` por el problema de `100vh` en PWA instalada, y el contenido lleva `calc(var(--bottom-nav-clearance) + env(safe-area-inset-bottom))` de padding inferior.

## Offline (ADR 0005 y 0010)

- `app/providers/query-client.ts` configura `networkMode: 'offlineFirst'` para queries, `'online'` para mutaciones (con `'offlineFirst'` una mutación sin red falla en vez de quedar en cola) y un `gcTime` de 7 días, igual al `maxAge` del persister.
- El cache se persiste en IndexedDB con structured clone (`shared/lib/cache/persister.ts`). No lo cambies por un persister de localStorage: es síncrono y chico.
- Toda mutación que pueda quedar en cola necesita tres cosas: su `mutationKey`, su `mutationFn` registrada en `app/providers/mutaciones-persistibles.ts` y **`scope: COLA_DE_SALIDA`**. Sin lo segundo, `resumePausedMutations()` falla con "No mutationFn found"; sin lo tercero, la cola drena en paralelo y dos cambios del mismo mes se pisan.
- Se persiste **toda mutación pendiente**, pausada o no (`esPersistible`), y al restaurar se llama a `reanudarCola`, que continúa primero las que quedaron a mitad de envío. El default de TanStack guarda solo lo pausado, y con señal mala una mutación sale sin pausarse.
- `onMutate` cancela las sincronizaciones en vuelo antes de tocar el cache, y `sincronizar()` mezcla sobre el cache fresco: si no, la respuesta de la base pisa lo que la cola escribió mientras tanto.
- La réplica del household es una sola entrada del cache (`['replica', usuarioId]`). Se arma con `bootstrap()` y se mantiene con `delta(cursor)`; el reconcile completo corre al entrar y cada 24 horas, salvo que haya cola pendiente. Las pantallas leen de ahí: nada consulta PostgREST por su cuenta.
- Forma de las mutaciones (ADR 0010): alta, upsert de la fila completa por id (UUIDv7 generado en el cliente con `uuidv7()`); edición, update por id con solo las columnas que cambiaron; baja, update de `deleted_at` con la marca fijada al encolar. `ajustes` solo se edita.
- Cada mutación se aplica optimista a la réplica con `aplicarFilaLocal` y, si la base la rechaza, se saca con `quitarFilaLocal`.
- Los rechazos con SQLSTATE `MNxxx` y `42501` no se reintentan: se le muestran al usuario. Tampoco se reintenta ningún otro SQLSTATE definitivo (una violación de check nunca va a andar y tapa la cola, que drena de a una). La red, los timeouts y las clases transitorias sí.
- Nunca muestres "guardado" para una mutación en cola. Para el estado real usá `useEstadoSync` y `describirEstadoSync` de `@/shared/lib`. El `IndicadorSync` global es el que lo dice y **desaparece cuando no hay nada pendiente**: en un test, que no esté es la señal de que ya llegó a la base.
- `crearQueryClient()` siembra `onlineManager` con `navigator.onLine`. **No lo saques**: `onlineManager` arranca en `true` fijo y solo cambia con los eventos de `window`, así que abrir la app ya sin señal la dejaba creyendo que hay red, con las mutaciones fallando en vez de encolarse (ADR 0014).
- Un rechazo definitivo tapa la cola, que drena de a una. Por eso el formulario frena lo que la base rechazaría por `check` (el formato del CUIT y el del email) aunque el resto de la validación solo advierta.
- Si cambia la forma de los datos persistidos, subí `VERSION_CACHE`.
- El service worker precachea solo el shell: no agregues `runtimeCaching` para la API de Supabase.
- El bundle se parte en dos: el vendor en su propio chunk y el código de la app en otro (`manualChunks` en `vite.config.ts`). No baja el arranque, pero un cambio de pantalla deja de obligar a rebajar el bundle entero del precache (ADR 0015).

## Sistema de diseño

- Las pantallas se portan desde `design-reference/*.dc.html`, con el mismo markup y los mismos tokens. Cada pantalla tiene cuatro estados (cargando, vacío, con datos y error) y tres anchos (390, tablet y 1440).
- Solo se usan utilidades de tokens: `bg-ink`, `text-text-2`, `bg-hogar-tint`, `text-money-lg`, `rounded-panel`, `h-button`, `px-(--page-pad-mobile)`. Los colores y tamaños por defecto de Tailwind no existen, y no hay hex sueltos.
- Los componentes de `design-reference/src/components/app` conocen el dominio: van a `entities` o a `features`, no a `packages/ui`.
- El error de un campo va en el `error` de su `Campo`, que lo ata con `aria-describedby` y marca el input inválido. El `<p role="alert">` suelto queda solo para lo que no es de ningún campo, y nunca los dos a la vez: serían dos alertas.
- `Cargando` y `Aviso` viven en `shared/ui` porque los usan `app/` y `pages/`. `Cargando` lleva `role="status"` y su texto para el lector de pantalla.
- `design-reference/src/lib/format.ts` calcula la cascada sobre el presupuesto: no se porta, se usa `@maun/domain`.
- `Login.dc.html` está dibujado para enlace mágico: se portó el layout y se cambió el texto (ADR 0012).

## Entorno

- Las variables se validan con zod en `shared/config/env.ts`, al arrancar (`app/arranque.tsx`). Si falta una, la app muestra cuál y no monta.
- Para agregar una variable, sumala en tres lugares: el esquema, `.env.example` y el `env` de las tareas `build` y `e2e` en `turbo.json`. Turbo no les pasa a las tareas las variables que no están declaradas.
- `index.html` usa `%VITE_SUPABASE_URL%` en el `preconnect`: Vite lo reemplaza al construir.
- `vite.config.ts` corta el build si una variable `VITE_` parece secreta: su nombre tiene `SECRET` o `SERVICE_ROLE`, o su valor es `sb_secret_...` o un JWT de service_role.

## Tests

- Vitest y Testing Library, al lado del archivo (`*.test.ts[x]`).
- `shared/lib/cache/cola.test.ts` es el test de la cola: usa IndexedDB de verdad (`fake-indexeddb`) y prueba que sin red la mutación queda en pausa, sobrevive a cerrar la app y se aplica en orden al volver la señal.
- El household de prueba se vacía con `vaciarTaller` (proyectos primero, después clientes): la base rechaza con `MN003` la baja de un cliente con proyectos vivos.
- Playwright en `e2e/`, con cinco proyectos: `setup`, `acceso-celular` y `acceso-escritorio` (sin sesión, en `e2e/sin-sesion/`), y `celular` y `escritorio` (con sesión, en `e2e/con-sesion/`).
  - La primera vez hay que instalar chromium: `pnpm --filter @maun/web exec playwright install chromium`.
  - Necesita `apps/web/.env` con `VITE_SUPABASE_URL`, la publishable key y **`E2E_EMAIL` / `E2E_PASSWORD`**, que van sin prefijo `VITE_` porque no entran al bundle. Están en `.env.example`.
  - `setup` entra una vez por el formulario de verdad y guarda el `storageState`; los dos proyectos con sesión lo reusan.
  - **Corre contra el build (`vite build && vite preview`), no contra el dev server**: el service worker solo existe en el artefacto real, y sin él no se puede probar cerrar la app y reabrirla sin señal.
  - `workers: 1`: los proyectos comparten el household de la cuenta de prueba y cada test con sesión lo vacía antes de empezar (`e2e/apoyo/taller.ts`).
  - Ese taller se vacía en cada corrida: no lo uses para mirar datos a mano.

## Proyectos (ADR 0015)

- **El proyecto es un agregado: se guarda entero, con sus pagos y sus gastos, por `guardar_proyecto`.** Una sola mutación en la cola, una sola transacción en la base. No hay mutaciones sueltas de pagos ni de gastos, y no las agregues: el orden de la foreign key, la atomicidad y la cola que drena de a una son el motivo.
- La edición manda la fila entera del proyecto y la `version` que vio el usuario. Si la base cambió, rechaza con `MN006`. **Las filas hijas que el usuario sacó viajan marcadas con `borrado` en el mismo array, y solo las que existían**: la base nunca borra lo que el cliente no vio, porque `proyectos.version` no se mueve cuando solo cambian sus hijos.
- Una baja de fila hija lleva **solo su id**. El tipo `BajaDeFilaHija` lo hace irrepresentable de otra forma: mandar una fecha vacía rompía la llamada entera con un `22007` sin mensaje.
- **El formulario no se cierra hasta que la mutación resuelve o queda en pausa.** Con señal, un rechazo se ve ahí, con lo que el usuario escribió todavía en pantalla; sin señal, la mutación se pausa y el formulario se cierra igual.
- El select de estado ofrece solo el estado actual y sus transiciones válidas (`estadosDisponibles`): un estado inválido rebota con `MN007`, que es definitivo y tapa la cola.
- **El foco de una fila nueva lo pone `shouldFocus` de `useFieldArray`.** No agregues otro foco propio: compiten y el que llega tarde escribe en el campo equivocado.
- Las tres pestañas (`Seguimiento · Activos · Historial`) son rutas, no estado local: `/seguimiento` y `/proyectos` montan la misma pantalla. No hay `pages/seguimiento`.
- `despieceDelProyecto` y `DistribucionDespiece` los comparten la ficha y la pantalla de cobro: lo que cambia entre las dos es el modo (`real` o `proyeccion`), no la cuenta. La proyección sale de `calcularLiquidacion` del dominio, nunca del `despiece` del diseño, que reparte sobre el presupuesto.
- **El ordenamiento de listas es `shared/lib/orden.ts`**, compartido con Clientes. Lo que falta va al final en los dos sentidos y el desempate es estable. Si agregás una columna, es un `Criterio` más, no otro `sort`.
- `entregaEstimada` cuenta solo días de semana: acepta feriados por parámetro, pero **nadie le pasa una lista todavía**.

## Cobrar y liquidar (ADR 0016)

- **Cobrar y dar por perdido son pantallas propias** (`/proyectos/:id/cobrar` y `/cerrar`), no un botón con un modal. **No agregues un «¿estás seguro?»**: lo que confirma es el despiece con los importes reales, y el botón dice el verbo. Reabrir sí lleva confirmación liviana, porque deshace un reparto cerrado.
- **Toda liquidación se aplica optimista a la réplica con la fila entera congelada** (`filaLiquidada`), no solo con el estado. Si no, `liquidacionesDeLaReplica` deja de contarla, el acumulado del mes queda corto y el cobro siguiente rebota con `MN006`. Es el requisito que el ADR 0011 le dejaba al 2C.
- **La fila optimista sube la `version`.** Reabrir un cobro que todavía está en la cola manda la versión que el servidor va a tener cuando drene, no la que había antes.
- **La respuesta de un guardado no pisa una liquidación optimista** (`aplicarSiNoEsVieja`): al cobrar con pago final salen dos mutaciones y la primera vuelve con el proyecto todavía en `entregado`.
- **Un cobro encolado no está cobrado.** El indicador global no alcanza para plata: `MarcaDeLiquidacion` da el estado por fila y la distribución se muestra marcada como provisoria (`provisoria` de `DistribucionDespiece`). Los saldos de Inicio son los optimistas, con `LiquidacionesSinConfirmar` debajo diciendo cuántas faltan confirmar.
- **Los rechazos y los ajustes van a la bandeja de avisos** (`shared/lib/avisos`), que se persiste y **dura hasta que el usuario la descarta**. No uses el `gcTime` de la mutación para eso: una mutación en `error` no se persiste (`esPersistible` solo deja pasar `pending`), así que cerrar la app se la lleva.
- **Nunca muestres un `MNxxx` ni la palabra «versión».** `traducirRechazo(error, contexto)` de `@/shared/api` devuelve qué pasó y qué hacer; el contexto (la operación y el proyecto) es lo que distingue un `MN001` al cobrar de un `MN001` al guardar un gasto.
- **La app manda el acumulado del mes que vio** (`liquidacion.previo`). Si no es el de la base, la liquidación vuelve **ajustada**, no rechazada: se compara `dist_sueldo_previo_centavos` contra lo que se mandó (`ajusteDeLaLiquidacion`) y se explica la diferencia en plata.
- **El formulario bloquea los pagos y los gastos de un proyecto liquidado, y ese aviso lleva el botón para descongelarlo.** No es un adorno: sin él es un callejón sin salida, que es lo que el ADR 0011 prohíbe. Al descongelar desde ahí hay que mover tres cosas o el guardado siguiente rebota: la versión que se va a mandar (la reversión la subió), el `estado` del formulario (seguía en `perdido`, y eso sale `MN007`) y a dónde ir al guardar, que pasa a ser la pantalla de liquidación.
- El corte se anima con `clip-path` y un retraso por pieza, una sola vez, por el `state` de la navegación. `prefers-reduced-motion` ya lo neutraliza `theme.css`: no agregues un caso especial.
- **`vaciarTaller` del e2e descongela antes de borrar** (`descongelarProyectos`): un liquidado con pagos o gastos no se borra (`MN001`) y sin borrarlo tampoco se borra su cliente (`MN003`).
- `useLiquidacionEnVuelo` filtra **todas** las mutaciones pendientes, y el guardado del agregado también lleva un `pedido`: lo que distingue a una liquidación es que el suyo trae `proyectoId`. Si agregás otra mutación con esa forma, ajustá el filtro.

## Cosas que muerden en el e2e

- **`page.goto` reinicia la app**, y una mutación recién encolada puede no haber llegado todavía a IndexedDB: un cobro sin señal seguido de un `goto` se pierde. Para encadenar dos operaciones sin señal, navegá por la interfaz (los `Link`) en vez de recargar. Cerrar y reabrir la app sí se prueba, pero después de esperar a que el cambio esté aplicado.
- **PostgREST rechaza un `PATCH` sin filtro** con un `21000` («UPDATE requires a WHERE clause»), aunque la RLS ya deje una sola fila a la vista: los helpers que editan por REST llevan el filtro igual.
- El navegador **normaliza `0ms` a `0s`** al leer una custom property computada: para afirmar sobre una duración, comparar el número y no el texto.
