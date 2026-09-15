# 0035. Un service worker propio, con el mismo precache

- Estado: aceptada, corregida
- Fecha: 2026-09-14
- Completa al [0005](0005-offline-first.md). Es el paso previo de los avisos
  ([0036](0036-avisos-por-dispositivo-fuera-de-la-replica.md)).
- Corregido por el [0037](0037-tocar-un-aviso-vuelve-sin-pedir-la-huella.md) en qué hace tocar la
  notificación.

## Contexto

El service worker lo generaba `vite-plugin-pwa` con `generateSW`: un archivo de Workbox al que no se le
suma código propio sin `importScripts`. Los avisos necesitan `push` y `notificationclick`. Es la pieza
más riesgosa del PR: si el precache o la actualización se rompen, la app no abre sin señal, que es su
razón de ser, y un service worker roto no se arregla con un deploy, porque el viejo sigue sirviendo el
shell.

## Decisión

**`strategies: 'injectManifest'` con `apps/web/sw/sw.ts`**, escrito a mano con las mismas piezas de
Workbox que usaba el generado y en la misma versión (`workbox-precaching` y `workbox-routing` 7.4.1, las
dependencias nuevas de la app):

- `precacheAndRoute(self.__WB_MANIFEST)`, con los mismos `globPatterns`;
- `cleanupOutdatedCaches()`;
- `NavigationRoute(createHandlerBoundToURL('/index.html'))`, para abrir cualquier ruta sin señal;
- el mensaje `SKIP_WAITING`, que es lo que manda «Actualizar» con `registerType: 'prompt'`.

Compila con su propio `tsconfig.sw.json` (`lib: WebWorker`) y entra en el typecheck y en ESLint, con los
globals de service worker. **Se commiteó solo, primero y sin nada de push**, y se verificó antes de
seguir.

Los handlers de push llegaron con la pantalla de avisos:

- `push` arma la notificación con lo que manda la función (`titulo`, `cuerpo`, `url`, `etiqueta`). Si
  llega sin datos o con algo que no es JSON, igual muestra una: con `userVisibleOnly`, un push sin
  notificación lo penaliza el navegador.
- `notificationclick` busca una ventana abierta de la app. Si la hay, le avisa que vuelve por un aviso,
  espera su respuesta y la enfoca, sin recargarla; si no, abre una. Solo acepta URLs del mismo origen.
  El porqué, y la excepción al bloqueo que implica, están en el ADR 0037.

## Alternativas descartadas

- **`generateSW` con `importScripts` de un archivo de push.** Ese archivo quedaría fuera de TypeScript,
  del lint y del manifiesto con revisión.
- **Un service worker sin Workbox.** Reescribir las revisiones del precache y la limpieza es justo lo que
  no se quería arriesgar.

## Objeciones

- **Tocar la notificación recargaba el documento** (`navigate`), y abrir la app pide la huella. Quedó
  corregido en el ADR 0037: con la app abierta atrás, la enfoca sin recargar.
- **Chromium headless no muestra notificaciones**: el permiso queda `denied` aunque Playwright lo
  conceda. El e2e comprueba lo que el service worker le pasa a `showNotification`, no una notificación
  en pantalla, y el click no tiene prueba automática: se prueba el mensaje que manda.
- **Nada de esto se probó en un teléfono.**

## Verificación

Un script de Playwright contra el build servido estático, fuera del repo, en tres escenarios:

| Escenario | De                              | A                                |
| --------- | ------------------------------- | -------------------------------- |
| Control   | `main`                          | `main` con un byte cambiado      |
| Pasaje    | `main`, service worker generado | esta rama, service worker propio |
| Futuro    | esta rama                       | esta rama con un byte cambiado   |

En cada uno comprobó que la página queda controlada, que `/acceso`, `/clientes` y una ruta inexistente
abren sin señal, que aparece el aviso de versión nueva con el service worker en espera, que «Actualizar»
recarga, que el cache de precache viejo se borra y que el precache tiene exactamente las 22 URLs del
manifiesto. **45 de 45.** Los manifiestos de `main` y de la rama son idénticos en URL y revisión.

- La suite e2e completa después del cambio: 198 pasaron, 49 omitidas, ninguna falla.
- `avisos.spec.ts` entrega un push por CDP (`ServiceWorker.deliverPushMessage`) y comprueba la
  notificación que arma el service worker, con datos y sin datos.
