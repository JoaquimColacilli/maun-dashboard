# 0061. El aviso de versión nueva sale del registro, y refrescar pregunta

- Estado: aceptada
- Fecha: 2026-09-22
- Corrige al [0035](0035-un-service-worker-propio.md) en quién registra el service worker y cómo se
  entera la app de una versión nueva. Completa al [0027](0027-tirar-para-actualizar-sincroniza.md):
  tirar para actualizar también pregunta. Actualiza al [0050](0050-la-vista-publica-no-depende-del-armazon-de-la-app.md)
  y al [0026](0026-el-bloqueo-cuenta-el-tiempo-afuera.md) en quién registra y quién recarga.

## Contexto

El hermano del dueño lo vio usándola: el aviso «Hay una versión nueva» tarda en aparecer, en el celular
y en la compu, y en la app instalada, si tira hacia abajo seguido, no aparece nunca. Él lo vive como
que cada tirón «vuelve a cero» la espera. Lo primero era averiguar qué se reiniciaba de verdad.

## La causa: nadie preguntaba

Se midió con el arnés de este PR (abajo) contra el código de `main`, en Chromium. De los cinco puntos
que había para mirar, cuatro se descartaron y uno era la causa:

| Punto                                      | Qué se midió                                                                                                                                                                                                                                                                                                                                      | Veredicto      |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| 1. ¿Tirar recarga?                         | El gesto propio sincroniza: cero documentos pedidos (e2e del 0027) y una marca puesta en `window` sigue ahí después de cada tirón. El nativo está apagado en `html` y `body` (`celular.spec.ts`); Chrome lo lee de `html` desde la 140 y antes de `body`, y están los dos. Solo `/v/` y `/o/` lo prenden, a propósito (0050), y ahí no hay aviso. | Descartado     |
| 2. ¿Se desmonta el dueño del aviso?        | `AvisoActualizacion` vivía en `Shell`, arriba del bloqueo y del router. Contando las llamadas a `register()`: una por documento después de tres tirones, de cambiar de pantalla y de bloquear y desbloquear con la huella.                                                                                                                        | Descartado     |
| 3. ¿Un timer propio que arranca al montar? | No había ninguno, y ese era el problema: la app nunca llamaba a `update()` (cero llamadas después de tirar). Solo preguntaba el navegador, después de una navegación o una vez por día.                                                                                                                                                           | **La causa**   |
| 4. ¿`sw.js` cambia entre pedidos?          | Dos pedidos a producción: el mismo SHA-256 (`9203D204…`), el mismo ETag, con y sin gzip.                                                                                                                                                                                                                                                          | Descartado     |
| 5. ¿La descarga pasa los cinco minutos?    | El precache son 31 archivos, 1622,74 KiB, pero Workbox 7.4.1 mira la caché antes de bajar (`PrecacheStrategy._handle`) y solo baja lo que cambió: en un PR común, el chunk de la app (154 kB comprimido) y el HTML. Para pasar el tope de cinco minutos con 400 kB haría falta menos de 1,4 KB/s.                                                 | No es la causa |

**Lo que pasaba.** El navegador busca una versión nueva cuando navega a una página de la app, y Chromium
lo hace un segundo después de que esa página queda con la red casi quieta (`kUpdateDelay`,
`IdlenessDetector`). Medido: sale a los 1,7 s de recargar. Pero una app instalada que vuelve de segundo
plano no navega, y tirar sincronizaba datos sin preguntar nada. El aviso aparecía recién cuando Android
mataba la app y la próxima apertura era en frío, o una vez por día. Tirar en bucle no lo reiniciaba:
**ningún tirón preguntaba**. Desde afuera se ve igual que una espera que vuelve a cero.

**Lo que no pasaba, aunque lo parecía.** Una recarga no corta una descarga en curso: con cuatro
recargas mientras se retenía lo nuevo, el archivo se pidió una sola vez. Y la página abierta cuando
termina se entera, incluso en `main`, porque su `register()` queda en la cola de Chromium detrás de la
instalación y resuelve con la versión ya esperando (razonado del código del coordinador de trabajos;
medido el efecto: 66 ms después de soltar). El agujero de `workbox-window` que ignora
`registration.installing` es real en su código, pero en Chromium esa cola lo tapaba.

## Decisión

### Un solo dueño, afuera de React

`shared/lib/version-nueva.ts` arranca una sola vez en `arrancar()`, antes de montar React, y nunca en
`/v/` ni en `/o/`. Lee el registro apenas arranca (`getRegistration()`, sin red); el `register()` y el
primer chequeo esperan al `load`. Registra `/sw.js` con el mismo alcance y tipo que antes: cambiar la
URL puede dejar a la app instalada sin enterarse de versiones futuras. El vigía se guarda en
`globalThis` con un `Symbol.for`, así que llamarlo dos veces, o reevaluar el módulo en caliente, no
registra ni escucha dos veces. La interfaz lo lee con `useSyncExternalStore` (`useVersionNueva`), y la
foto es el worker que espera: un objeto estable, no uno nuevo por lectura.

### El estado sale del registro

- Hay versión nueva si hay `registration.waiting` y además una activa. Al arrancar, lo que haya
  instalándose se sigue desde ese momento, sin esperar un `updatefound`.
- `updatefound` se escucha siempre y nunca se saca. Cada worker se sigue una vez (`statechange`) y
  después de cada evento se recalcula mirando el registro, no acumulando eventos. Se verificó en
  Chromium que al llegar el `statechange` a `installed`, `registration.waiting` ya es ese worker.
- Una instalación que falla queda `redundant` y no deja nada roto: la siguiente que sale bien muestra el
  aviso.

### Cuándo se pregunta

Al arrancar (después del `load`), al tirar para actualizar y con «Sincronizar ahora» (los dos pasan por
`useSincronizarAhora`), cuando la app vuelve a verse (`visibilitychange`), cuando vuelve la red
(`online`) y una vez por hora mientras se ve. Lo decide una función pura, `decidirElChequeo`:

- Nunca dos a la vez: el nuevo se suma al que está en curso.
- Mientras se baja una versión, no pregunta.
- Sin señal no sale a la red y lo deja pendiente. `update()` se atrapa siempre: sin señal no hay nada en
  la consola ni un `unhandledrejection`, y no reintenta solo.
- Los automáticos, como mucho uno por minuto. Tirar y «Sincronizar ahora» no tienen ese límite.
- **Al volver la red pregunta aunque haga menos de un minuto, solo si quedó uno pendiente.** Si no, un
  chequeo de hace 20 segundos haría callar al que pidió el dueño cuando no había señal.

### Tocar «Actualizar»

Manda `SKIP_WAITING` (el mismo mensaje que escucha `sw.ts`; un test lo ata) a la que espera y recarga
una sola vez: con `controllerchange` o, en una página sin controlar, cuando la nueva queda `activated`.
Si ya no hay ninguna esperando, recarga igual. La huella queda como hoy: es una recarga de verdad.

**Varias pestañas en la compu, como antes**: la que mostró el aviso recarga cuando otra aplica la
versión. Antes lo hacía el paquete (`controlling` con `isUpdate`), ahora el módulo. Una que nunca lo
mostró no recarga.

### El indicador del gesto no queda tapado

Con el aviso a la vista, la pastilla de tirar para actualizar quedaba debajo del aviso, que tiene más
`z-index`. Ahora cuelga del borde de abajo del aviso, medido al empezar a tirar.

## Alternativas descartadas

- **Subir `useRegisterSW` a la raíz y dejar el resto igual.** El dueño ya era uno solo y no se
  desmontaba (medido), así que no arreglaba nada: seguiría sin preguntar al volver ni al tirar.
- **Seguir con `workbox-window` y sumarle `update()` en esos momentos.** Arregla el cuándo pero hereda su
  diseño: toma como «externa» toda versión que aparece más de 60 segundos después de registrar, y después
  de la primera externa saca su `updatefound` ([workbox#3285](https://github.com/GoogleChrome/workbox/issues/3285),
  abierto). Los chequeos al volver y cada hora son exactamente eso: una pestaña abierta todo el día
  vería la primera versión nueva y ninguna más. Tampoco mira `registration.installing` al registrar
  ([#2216](https://github.com/GoogleChrome/workbox/issues/2216), cerrado sin resolver).
- **`autoUpdate` o `skipWaiting` al instalar.** Recarga en el medio de un formulario (0005).
- **Preguntar también en `focus`.** Llega junto con `visibilitychange` y duplica el pedido.
- **Preguntar más seguido que cada hora con la app quieta.** Gasta datos del taller para nada: al volver
  y al tirar ya pregunta.
- **Un aviso de «se está bajando».** No se puede tocar, y con mala señal puede quedar colgado.

## Dónde se aparta del pedido

- **`injectRegister: false`, no `null`.** En vite-plugin-pwa 1.3.0 `null` está marcado obsoleto y
  `false` es «no hacer nada»; con `'auto'` inyectaría su registro. Ya estaba en `false`. El build no trae
  `registerSW.js` ni ningún registro en el `index.html` (lo verifica el arnés).
- **`workbox-window` no se sacó**: vite-plugin-pwa 1.3.0 lo declara dependencia par obligatoria. Pasó a
  `devDependencies`, porque la app ya no lo importa.
- **El commit del gesto nativo no hizo falta**: no apareció ninguna pantalla que recargue.
- **El aviso no se puede cerrar hoy**, así que no hubo que cuidar que un chequeo lo reabra.
- **Ctrl+Shift+R en la única pestaña** deja a la versión vieja sin nadie que la use y la que esperaba se
  activa sola, sin aviso: es del navegador. Con otra pestaña abierta, tocar «Actualizar» en la forzada
  recarga una vez.

## Objeciones

- **La primera actualización a esta versión la detecta el código viejo.** El arreglo se ve recién en la
  siguiente. Y esta es pesada: cambian los tres chunks de JavaScript (unos 411 kB comprimidos), porque
  sale `workbox-window` del vendor.
- **El chequeo al arrancar compite con la carga inicial** cuando la versión es nueva: la descarga empieza
  con el `load` y no cuando la red queda quieta, como el del navegador. Es lo pedido; con mala señal, la
  sincronización de los datos y la descarga comparten la línea.
- **Al abrir hay dos chequeos**, el del módulo y el del navegador. El segundo casi siempre se suma al
  primero o encuentra lo mismo: son unos 20 kB (o un 304) más.
- **Nada de esto se probó en un teléfono.** El gesto nativo de Android, la vuelta de segundo plano real y
  Samsung Internet son razonamiento. El arnés corre en Chromium de escritorio, con la visibilidad
  simulada y un servidor local sin mala señal.

## Fuentes

- Chromium `main`: `content/public/browser/service_worker_context.h` (`kUpdateDelay` = 1 s),
  `service_worker_version.cc` (`ScheduleUpdate`, `kRequestTimeout` = 5 min), `service_worker_client.cc`
  y `third_party/blink/renderer/core/loader/idleness_detector.cc` (el aviso después de que la red queda
  casi quieta, una vez por documento), `service_worker_job_coordinator.cc` y
  `service_worker_register_job.cc` (la cola de trabajos, la instalación como parte del trabajo),
  `service_worker_single_script_update_checker.cc` (`update()` rechaza con un error de red).
  <https://chromium.googlesource.com/chromium/src/+/refs/heads/main/content/browser/service_worker/>
- [w3c/ServiceWorker#788](https://github.com/w3c/ServiceWorker/issues/788): la actualización sigue
  aunque la página se cierre. Especificación: <https://w3c.github.io/ServiceWorker/> (Soft Update,
  Schedule Job, Update, `update()`).
- web.dev, «The service worker lifecycle»: <https://web.dev/articles/service-worker-lifecycle>.
- Workbox: [#3285](https://github.com/GoogleChrome/workbox/issues/3285),
  [#2216](https://github.com/GoogleChrome/workbox/issues/2216), y el código instalado
  (`workbox-window` 7.4.1, `workbox-precaching` 7.4.1, `vite-plugin-pwa` 1.3.0).
- `overscroll-behavior`: <https://developer.chrome.com/blog/overscroll-behavior> y chromestatus
  «Propagate Viewport overscroll-behavior from Root» (Chrome 140).
- React, `useSyncExternalStore`: <https://react.dev/reference/react/useSyncExternalStore>.
- Playwright, service workers: <https://playwright.dev/docs/service-workers>.

## Verificación

**El arnés** (`apps/web/e2e/version/`, dentro de `pnpm verify`): un servidor de Node sirve en
`localhost:4180` la build A y, cuando el test lo pide, la B. La B es un segundo `vite build` real con
una novedad más inyectada al compilar: su `sw.js` y su precache los genera el build, como en un deploy.
El servidor cuenta los pedidos a `sw.js` (el chequeo lo hace el navegador y Playwright no lo ve como
pedido de la página), retiene o demora lo nuevo de la B y puede hacerlo fallar una vez. La app
instalada se prueba con `--app=` en un contexto persistente, con el headless nuevo de Chromium
(`channel: 'chromium'`), donde `display-mode: standalone` da verdadero.

Los mismos tests, contra el código de `main` y contra esta rama (Chromium, servidor local):

| Test                                                       | `main`                                          | Esta rama                                        |
| ---------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------ |
| Volviendo a la app abierta de antes y tirando cada 3 s     | **No aparece.** 9 tirones, 0 pedidos a lo nuevo | Aparece a 2,5 s de terminar la descarga, tirando |
| Abriendo mientras se baja y tirando cada 3 s               | Aparece a 1,8 s de soltar                       | 1,8 s                                            |
| Recargando cada 3 s mientras se baja                       | En la misma página, a 0,11 s de soltar          | 0,06 s                                           |
| Bloquear y desbloquear con la huella mientras se baja      | Aparece                                         | Aparece                                          |
| Una descarga que falla y después una que sale bien         | **No aparece**: nadie vuelve a preguntar        | Aparece sin recargar                             |
| Sin señal, tirar                                           | Sin errores ni pedidos                          | Sin errores ni rechazos ni pedidos               |
| Al volver la red, lo que quedó pendiente                   | **No pregunta**                                 | Pregunta una vez                                 |
| Diez tirones en cinco segundos                             | 0 pedidos a `sw.js`                             | 3 sincronizaciones, 3 pedidos                    |
| Seis vueltas a la app en seis segundos                     | 0                                               | 1 chequeo, 1 pedido                              |
| Al arrancar                                                | 0 llamadas a `update()`                         | 1, después del `load`                            |
| Volver de segundo plano con una versión publicada          | **No aparece en 30 s**                          | ~80 ms                                           |
| Abrir en una pestaña con una versión publicada             | 1,92–1,97 s                                     | 0,15–0,17 s                                      |
| Abrir la app instalada (`--app`)                           | 2,39–2,43 s                                     | 2,17–2,24 s                                      |
| Una hora a la vista / una hora oculta                      | **No pregunta** / no pregunta                   | Pregunta una vez / no pregunta                   |
| «Sincronizar ahora» en la compu                            | **No pregunta**                                 | Pregunta                                         |
| «Actualizar»: recargas, novedades, huella                  | 1, una vez, sin pedirla                         | 1, una vez, sin pedirla                          |
| «Actualizar» en una pestaña sin controlar                  | **No recarga**                                  | 1 recarga, y la otra pestaña recarga como antes  |
| Ya estaba lista, con los chequeos retenidos en el servidor | 0,12 s                                          | 0,13 s                                           |
| Tirar, cambiar de pantalla, bloquear: el aviso sigue       | Sigue; un registro por documento                | Sigue; un registro por documento                 |
| El aviso y el indicador del gesto                          | **La pastilla queda tapada**                    | Cuelga debajo del aviso                          |
| La vista pública con una versión esperando                 | Sin aviso; el cliente no registra nada          | Igual                                            |
| El build no trae un registro inyectado                     | Igual                                           | Igual                                            |

Que tres tests del bucle pasen también en `main` es parte de la evidencia: en Chromium, ni tirar ni
recargar cortan una descarga ni le esconden su final a la página. El que falla es el que reproduce lo
que pasa en el teléfono, una app que vuelve de segundo plano sin navegar.

- Tests de unidad: `version-nueva.test.ts` (el estado, los eventos, la instalación que falla, la más
  nueva que reemplaza, «Actualizar» con y sin controlador, el mensaje atado a `sw.ts` y todas las reglas
  de `decidirElChequeo`, con un registro y un reloj falsos).
- Capturas del aviso con el indicador en sus cuatro estados, en 390 y 1440 px, en claro y en oscuro.

## Consecuencias

- Nada fuera de `version-nueva.ts` registra el service worker ni decide si hay versión nueva.
- Toda forma nueva de refrescar pregunta por la versión nueva (`buscarVersionNueva` o
  `useSincronizarAhora`).
- El arnés corre en `pnpm verify`: un cambio en el registro, el precache o los chequeos se prueba ahí.
  Cuesta tiempo: `pnpm verify --force` pasó de 2 min 26 s a 6 min 5 s. El arnés dura 5,7 min, en serie
  (una cuenta de prueba, un puerto), y pasa a ser la tarea más larga, por delante de pgTAP.
