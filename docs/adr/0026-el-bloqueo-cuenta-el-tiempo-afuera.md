# 0026. El bloqueo cuenta el tiempo afuera, no las aperturas

- Estado: aceptada
- Fecha: 2026-09-13
- Completa al [0023](0023-sesion-bloqueo-con-huella-y-passkeys.md) en cuándo se pide la huella.

## Contexto

Con la app instalada, cada recarga estando adentro volvía a pedir la huella. La marca de
«desbloqueada en esta apertura» vivía en memoria (ADR 0023): una recarga crea un documento nuevo,
así que para el código recargar y abrir la app eran lo mismo. Y quedaba pendiente, anotado como
objeción en el 0023, bloquear al volver de segundo plano.

## Decisión

**Va por tiempo, como las apps de banco.** La marca `maun:bloqueo` guarda dos momentos además de la
credencial:

- `desbloqueadaEn`: al desbloquear con la huella, al entrar con la contraseña y al activar el bloqueo
  (`marcarDesbloqueada`, `activarBloqueo`).
- `salioEn`: cuando la app se oculta estando desbloqueada.

**Al abrir**, si pasó menos de un minuto desde la última vez adentro (el más nuevo de los dos
momentos), no se pide la huella. Si pasó más, si no hay ningún momento (la marca de antes de este
cambio) o si el reloj quedó atrás del momento guardado, se pide. El «ahora» es el de la carga del
módulo, no el del montaje de la guarda: una sesión que tarda en validarse con mala señal no se come el
umbral.

**Al volver de segundo plano** es la misma cuenta: `visibilitychange` a visible (o `pageshow` desde el
bfcache), y si pasó un minuto desde `salioEn`, se bloquea.

**Un solo umbral, de un minuto, para las dos.** Un Samsung mata una PWA en segundo plano cuando
quiere: volver a la app es a veces un regreso y a veces un arranque en frío, y el usuario no lo
distingue ni lo decide. Con dos umbrales, la misma espera pediría la huella o no según la memoria
libre del teléfono. Un minuto es el orden que traía el pedido: una recarga tarda segundos, contestar un
mensaje corto no pide la huella, y dejar el teléfono en el banco de trabajo sí.

**Descartado: el almacenamiento de sesión.** Sobrevive a lo que el usuario cree un arranque en frío,
porque el sistema suspende la app y el navegador restaura la sesión: falla hacia el lado peligroso.
El tiempo falla hacia el lado molesto: si un momento no se llegó a escribir, se pide la huella.

## Cuándo se anota que salió

**Solo cuando se oculta estando a la vista.** `visibilitychange` a `hidden` escribe `salioEn`, y
**solo en la transición**: un segundo aviso de oculta sin haber vuelto a estar visible no renueva el
momento. `pagehide` también escribe, pero **solo si el documento seguía visible**, que es el caso de
un navegador que no avisa la visibilidad al descargar.

La transición la encontró el e2e: al recargar, el navegador dispara su propio `visibilitychange`, y
con la visibilidad simulada en «oculta» ese aviso renovaba el momento en cada recarga. En un teléfono
un documento ya oculto no recibe ese segundo aviso, pero la regla no tiene por qué depender de eso.

**Se apartó del camino obvio de escribir siempre en `pagehide`.** Cerrar desde recientes una app que
estaba hace una hora en segundo plano puede disparar `pagehide` con el documento ya oculto. Renovar el
momento ahí haría que reabrirla dentro del minuto no pida nada, después de una hora afuera. Los tests
unitarios cubren los dos sentidos.

## El tipo de navegación, como apoyo

`performance.getEntriesByType('navigation')` dice `reload` en una recarga. Se usa en una sola regla,
que solo puede evitar un pedido: **una recarga no pide la huella si desde el último desbloqueo la app
nunca salió a segundo plano, y el desbloqueo fue hace menos de diez minutos**
(`TOPE_DE_UNA_RECARGA_MS`).

- Cubre el caso en que el momento de salida no se llegó a escribir al descargar.
- **No puede ser más amplia.** El tipo varía entre plataformas cuando una app instalada se restaura, y
  una restauración informada como `reload` estiraría el bloqueo de segundo plano. La condición «nunca
  salió a segundo plano» es la que la deja afuera: para que el sistema la restaure, la app tuvo que
  ocultarse, y eso quedó escrito.
- Lo que queda sin cubrir: la app abierta y desbloqueada, el teléfono que se apaga sin ningún evento,
  y una reapertura informada como `reload` dentro de los diez minutos.

## Volver a bloquear no desmonta la app

**Decisión propia.** Al abrir, `ConBloqueo` sigue reemplazando todo por la pantalla de bloqueo, sin
réplica detrás (ADR 0023). Al volver de segundo plano, no: `BloqueoAlVolver` es un `<dialog>` modal a
pantalla completa **encima de la app montada**.

- Con un umbral de un minuto, desmontar se llevaría un movimiento a medio cargar cada vez que alguien
  sale a buscar un número en WhatsApp. El e2e carga un texto en la hoja de movimiento, bloquea y, al
  desbloquear, el texto sigue ahí.
- **Es un `<dialog>` y no un div**: una hoja abierta también es un `<dialog>` modal, y deja inerte
  todo lo que no sea el modal de más arriba. Un div encima no se podría tocar.
- Escape y el gesto de atrás no lo cierran: el `cancel` se cancela, y si igual se cierra, se vuelve a
  abrir mientras la app siga bloqueada.
- La barrera sigue siendo de uso (ADR 0023): la app queda detrás, tapada e inerte. Quien tenga las
  herramientas de desarrollo ya tenía la sesión.

**La ceremonia espera el foco.** Chrome exige que la página tenga el foco para
`navigator.credentials.get()`, y al volver de segundo plano la visibilidad puede llegar antes. Si
`document.hasFocus()` da falso, `PantallaDeBloqueo` espera el `focus` en vez de pedir, fallar y caer a
la contraseña.

## Las recargas que nadie pidió

- **Tirar hacia abajo.** `overscroll-behavior-y: none` en `html` y `body`. El scroll es del `<main>`, y
  el gesto en su tope se encadena a la raíz, que es donde el navegador dispara la recarga. La app
  sincroniza sola y tiene su indicador: esa recarga no trae nada y reinicia la app. **Solo se verificó
  el estilo computado**: Chromium headless no tiene ese gesto.
- **El service worker no recarga solo.** Está en modo `prompt`. El `sw.js` generado tiene un único
  `skipWaiting()`, dentro del mensaje `SKIP_WAITING`, y ningún `clientsClaim()`. La recarga del paquete
  (`controlling` → `location.reload()`) solo sale después de tocar «Actualizar» en el aviso. La rama de
  `autoUpdate` está en el bundle pero no corre.
- **React Router** trae en el vendor un `location.reload()` para cuando falla la carga de un módulo de
  ruta. Es del modo framework; este router no usa `lazy` en sus rutas, así que no se alcanza.

## Verificación

- `huella.test.ts`, con reloj falso: la decisión al abrir (sin momentos, dentro y fuera del minuto,
  reloj atrasado, la regla de la recarga y su tope), anotar al ocultarse solo estando adentro, volver
  antes y después del minuto, y `pagehide` con el documento oculto y visible.
- `bloqueo.spec.ts`, en el celular, con el reloj de Playwright y la visibilidad simulada (Chromium
  headless nunca pasa una página a segundo plano, así que se reemplaza `document.visibilityState` y se
  dispara el evento):
  - recargar estando adentro, enseguida y a los diez minutos, no pide la huella;
  - cerrar y abrir a los veinte segundos no la pide, y un arranque en frío pasado el minuto sí;
  - volver de segundo plano a los veinte segundos no la pide, y pasado el minuto sí, sin perder lo que
    se estaba cargando.

## Objeciones

- **El tipo de navegación suma poco.** Con el momento escrito al ocultarse, una recarga de verdad
  siempre encuentra un momento de hace segundos. La regla de apoyo solo cambia algo si esa escritura
  falló, y no se la puede ensanchar sin abrir el agujero de la restauración. Se implementó acotada.
- **Nada de esto se probó en un teléfono.** Que Android dispare `visibilitychange` o `pagehide` al
  tirar para recargar, que el foco llegue después de la visibilidad y que `overscroll-behavior` apague
  el gesto en la app instalada son lo documentado, no lo medido.
- **El 0023 decía que al bloquear no queda nada montado detrás.** Sigue siendo así al abrir. Al volver
  de segundo plano queda la app montada y tapada, por lo que se explica arriba.

## Consecuencias

- Toda forma nueva de desbloquear pasa por `marcarDesbloqueada`, que es la que anota el momento.
- `limpiarDatosLocales` borra la marca, y con ella los momentos.
- El umbral vive en un solo lugar: `UMBRAL_DEL_BLOQUEO_MS`.
