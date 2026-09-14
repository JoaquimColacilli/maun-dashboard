# 0028. La huella se pide cada vez que se sale

- Estado: aceptada
- Fecha: 2026-09-13
- Corrige al [0026](0026-el-bloqueo-cuenta-el-tiempo-afuera.md): ya no hay minuto de gracia.

## Contexto

El 0026 dejó un minuto de gracia: salir y volver, o cerrar y abrir la app, antes de un minuto desde
la última vez adentro no pedía la huella. El dueño lo probó en el Samsung, con la app instalada:
sale, entra, y la app no le pide nada. Quiere que la pida cada vez.

## Decisión

- **Volver de segundo plano bloquea siempre**, sin esperar, si la app estaba abierta cuando se ocultó
  (`salioAbierta`, en memoria). Si se ocultó estando bloqueada, o se desbloqueó mientras estaba oculta,
  volver no bloquea: el pedido de la huella del sistema puede ocultar la página, y sin esa regla
  desbloquear volvería a bloquear en el acto. Activar el bloqueo borra la salida pendiente por lo
  mismo.
- **Abrir la app bloquea siempre, salvo una recarga de verdad**: tipo de navegación `reload`, página
  no descartada (`document.wasDiscarded`) y a menos de 15 segundos de la última vez adentro. Una
  recarga anota `salioEn` al descargarse, así que cae adentro del tope. Una página que Android
  descartó en segundo plano y restaura como recarga, no.
- Se va `UMBRAL_DEL_BLOQUEO_MS`. `TOPE_DE_UNA_RECARGA_MS` baja de diez minutos a quince segundos: sin
  el minuto de gracia, la recarga ya no depende de «nunca salió a segundo plano», sino de que la
  descarga haya sido recién.
- Tirar para actualizar no cambia (ADR 0027): sincroniza sin recargar, así que no pasa por acá.

## Consecuencias

- Salir a WhatsApp o al teléfono desde una ficha, elegir la foto de perfil o apagar la pantalla pide
  la huella al volver. `BloqueoAlVolver` no desmonta nada: lo que se estaba cargando sigue ahí.

## Objeciones

- **No se probó en el teléfono.** El e2e simula la visibilidad (Chromium headless nunca pasa una
  página a segundo plano) y cuenta los pedidos de huella con el autenticador virtual.
- **Los quince segundos son un número elegido.** Una recarga que tarde más en un teléfono lento
  pediría la huella.
- **Si alguna ceremonia del sistema oculta la página con la app abierta** (hoy: el selector de la
  foto de perfil), al volver pide la huella.
