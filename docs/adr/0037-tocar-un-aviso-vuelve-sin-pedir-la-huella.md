# 0037. Tocar un aviso vuelve a la app sin pedir la huella

- Estado: aceptada
- Fecha: 2026-09-14
- Corrige al [0028](0028-la-huella-se-pide-cada-vez-que-se-sale.md) en una sola puerta: volver por un
  aviso. Corrige al [0035](0035-un-service-worker-propio.md) en qué hace tocar la notificación.

## Contexto

Con el 0035, tocar un aviso enfocaba la ventana y la llevaba a la agenda con `navigate`, que recarga el
documento, y abrir la app pide la huella. Aun enfocando sin recargar, el 0028 bloquea toda vuelta de
segundo plano con la app abierta. El dueño toca un aviso con la app atrás y se encuentra con la huella:
la misma molestia que el 0027 le sacó a tirar para actualizar, por otra puerta.

## Decisión

- **Si hay una ventana de la app abierta, tocar el aviso la enfoca: no abre ni recarga un documento.**
  El service worker busca las ventanas del origen con
  `clients.matchAll({ type: 'window', includeUncontrolled: true })`. Solo si no hay ninguna abre una
  con `clients.openWindow`.
- **Antes de enfocarla le avisa que vuelve por un aviso, y espera la respuesta** (`MessageChannel`, con
  un tope de 500 ms). La ventana anota la vuelta (`anotarVueltaPorUnAviso`), contesta y navega a la ruta
  del aviso con el router, sin recargar. Esperar la respuesta es lo que asegura que la marca esté puesta
  antes del `visibilitychange` que produce el foco.
- **Esa vuelta no bloquea, y solo esa.** `alVolver` no cierra la apertura si la marca es de hace menos
  de `TOPE_DE_UNA_VUELTA_POR_AVISO_MS` (10 s). La marca se anota solo con la página oculta y se consume
  en la vuelta: la siguiente, por cualquier otra puerta, pide la huella como siempre.
- **Con la app cerrada, pide la huella.** `openWindow` es una apertura, y en eso el 0028 no cambia:
  abrir bloquea siempre, salvo una recarga de menos de quince segundos. No hay otro umbral.
- **Un aviso no abre una app que ya estaba bloqueada**: si se ocultó bloqueada, vuelve bloqueada.
- El mensaje (`MAUN_VUELTA_POR_UN_AVISO`) llega por `navigator.serviceWorker`, así que solo lo manda el
  service worker de la app, y la ruta tiene que ser del mismo origen (`rutaDelAviso`).

## Alternativas descartadas

- **Enfocar sin la excepción.** Evita la recarga, pero el 0028 igual pide la huella al volver. Se le
  preguntó al dueño y eligió la excepción.
- **Un umbral para toda vuelta de segundo plano.** Es el minuto de gracia del 0026, que el dueño probó y
  sacó.
- **Seguir con `navigate`.** Recarga, monta la app de cero y pide la huella.

## Objeciones

- **Es una puerta sin huella.** Con el teléfono desbloqueado y un aviso en la bandeja, se entra a la app
  sin huella mientras esté abierta atrás. El bloqueo es una barrera de uso, no una frontera de
  seguridad (ADR 0023), pero la excepción existe.
- **Los 10 segundos son un número elegido.** Si el sistema tarda más en traer la ventana al frente, esa
  vuelta pide la huella.
- **Si el foco falla**, la marca queda hasta 10 segundos: volver a mano en ese lapso tampoco la pide.
- **Nada de esto se probó en un teléfono.** Chromium headless no muestra notificaciones ni deja
  tocarlas. El e2e manda desde el service worker el mismo mensaje que manda `notificationclick` y simula
  la vuelta con la visibilidad controlada, así que el `focus()` real no se ejercita. Que siga permitido
  después de esperar la respuesta, dentro del tiempo que el navegador le da a `notificationclick` para
  enfocar una ventana, está razonado, no medido.

## Verificación

- `huella.test.ts`: la vuelta por un aviso no bloquea y la siguiente sí; la marca vence al tope; un
  aviso con la app a la vista no deja marca; un aviso no abre una app bloqueada.
- `vuelta-por-un-aviso.test.ts`: qué mensaje se acepta y que la ruta nunca sale de la app.
- `bloqueo.spec.ts`, en celular, con la huella del teléfono virtual sin verificar para que un bloqueo no
  se desbloquee solo y pase desapercibido: con la app abierta atrás, el mensaje del service worker la
  lleva a la agenda sin pantalla de bloqueo y sin otro pedido de huella, y la vuelta siguiente sí la
  pide; con la app cerrada, el service worker no encuentra ninguna ventana y abrir la agenda pide la
  huella.
