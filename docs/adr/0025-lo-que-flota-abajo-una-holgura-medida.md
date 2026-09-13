# 0025. Lo que flota abajo: una holgura medida, no una constante

- Estado: aceptada
- Fecha: 2026-09-13
- Corrige al [0013](0013-shell-navegacion-e-inicio.md) en el padding inferior del contenido.

## Contexto

El dueño lo ve en un Samsung de verdad, con la app instalada: al final del scroll, la barra inferior
tapa lo último de la pantalla. En Inicio, la última línea de la tarjeta de Cocos («nuevos» queda
debajo de la barra); en la ficha de un cliente, el botón «Arrancar un proyecto con …» queda debajo del
botón redondo. El paso anterior reservó lugar para el aviso «Sin conexión», que es correcto, y cerró
el caso con un test que revisaba **controles**: el texto no entraba en su definición de tapado.

## Lo que se encontró

- **Son un solo problema, no dos.** «Arrancar un proyecto» no está anclado abajo: es el último
  elemento del flujo de la ficha. Ninguna pantalla del celular tiene un botón anclado (la lista
  completa está abajo).
- **La constante alcanzaba en el emulador.** `--bottom-nav-clearance` eran 108 px; el botón redondo
  sobresale 15 px de la píldora y su borde de arriba queda a 91 px del fondo. En el Chromium del e2e,
  a 390 × 844 y sin zona segura, no se tapa nada: por eso el test anterior no veía nada, y no lo habría
  visto aunque revisara texto.
- **Lo que rompe la cuenta es que la raíz no mida lo mismo que la ventana.** `#root` es
  `position: fixed; inset: 0`, pero también `height: 100dvh`, y ese alto le gana a `bottom: 0`. La
  barra se posiciona contra la ventana; el `<main>` termina donde termina `100dvh`. Si en el teléfono
  `100dvh` llega más abajo que la ventana, el final del scroll queda escondido esa diferencia y el
  padding fijo se queda corto. Con la raíz 64 px más alta que la ventana, las capturas del e2e son las
  del teléfono: «nuevos» cortado por el borde de la píldora y el botón negro debajo del redondo.
  **Es la explicación que reproduce las dos capturas, no una medición en el Samsung.** Los 56 a 67 px
  salen de medir las capturas del dueño, y son del orden de la barra de navegación del sistema. La
  guía de edge-to-edge de Chrome dice que desde Chrome 135, con `viewport-fit=cover`, el viewport se
  extiende bajo la barra del sistema; no dice cómo resuelve `dvh` una app instalada.
- **El arreglo del aviso «Sin conexión» tenía un hueco.** Medía el indicador con un `ResizeObserver`,
  que no se entera cuando la zona segura lo mueve sin cambiarle el tamaño. Con la zona segura cambiando
  en caliente, que es lo que hace Chrome con el «chin», el aviso volvía a tapar el último control.

## Decisión

**Una sola medición: el rectángulo del envoltorio de todo lo que flota abajo.** `Marco` tiene un pie
fijo (`data-lo-que-flota-abajo`) con el indicador de sincronización y, en el celular, la barra. **El
botón redondo pasó a estar en flujo** dentro de la barra: un grid donde el botón y la píldora
comparten celda y la píldora baja 15 px. El rectángulo del pie es la huella visual completa; si
mañana el botón crece, el pie crece con él.

`useHolguraInferior` lo mide con un `ResizeObserver` sobre el pie y sobre el `<main>` (con
`box: 'border-box'`, para enterarse del padding de la zona segura), y con `resize`,
`orientationchange` y el `resize` del `visualViewport`. De esa medición salen los dos consumidores:

- **`--holgura-inferior`**, una variable CSS en `Marco`: la distancia entre el borde de arriba del
  pie y el fondo de la ventana, más un respiro de 12 px. La usa todo lo que se ancla con
  `position: fixed`: los avisos y el menú de «Cargar algo nuevo».
- **El padding inferior del `<main>`**: la distancia entre el borde de arriba del pie y el fondo
  **del propio `<main>`**, más el mismo respiro. Cuando la raíz mide lo mismo que la ventana es el
  mismo número. Cuando no, la diferencia es exactamente lo que el `<main>` se sale de la ventana.

**Se apartó del pedido en ese punto.** El pedido medía el contenido contra el borde inferior de la
ventana. Contra la ventana, en el caso que reproduce el teléfono, el padding queda corto justo por la
diferencia que causa el problema; contra el fondo del contenedor que scrollea, no.

- **Mientras se escribe, el padding del contenido no se achica.** Con el foco en un campo la barra se
  desmonta (ADR 0013); si el padding bajara ahí, el fondo se correría debajo del campo que se está
  escribiendo. Crece si hace falta y se vuelve a medir al soltar el foco.
- **Sin nada que flote** (tablet y escritorio, sincronizado) el padding del contenido es cero, como
  antes.
- **El pie va antes del `<main>` en el DOM.** La pantalla de proyecto del celular es una capa fija con
  el mismo `z-30`, y tiene que seguir quedando encima de la barra.
- **`--bottom-nav-clearance` se borró de `theme.css`.** Una constante muerta invita a la próxima cuenta
  a mano.

## Lo anclado abajo

Se buscó en el código todo `fixed`, `sticky` y `bottom-`:

| Elemento                                       | Dónde                | Cómo queda                                                      |
| ---------------------------------------------- | -------------------- | --------------------------------------------------------------- |
| Barra inferior y botón redondo                 | `Navegacion`         | Adentro del pie: define la holgura.                             |
| «Sin conexión», «Sincronizando…»               | `IndicadorSync`      | Adentro del pie: define la holgura.                             |
| Avisos, con el rechazo de un cobro             | `Avisos`             | `bottom: var(--holgura-inferior)`.                              |
| Menú «Cargar algo nuevo»                       | `Navegacion`         | `bottom: var(--holgura-inferior)`.                              |
| Pie de la pantalla de proyecto, en el celular  | `PantallaDeProyecto` | Capa propia a pantalla completa, tapa la barra: no la consume.  |
| Hojas                                          | `Hoja`               | `<dialog>` modal en la top layer, tapa la barra: no la consume. |
| Aviso de versión nueva                         | `AvisoActualizacion` | Anclado arriba.                                                 |
| Barras `sticky` de proyecto, Finanzas y Diezmo | sus pantallas        | Solo desde `md` o `xl`, donde no hay barra inferior.            |

## Cómo se verifica

`lo-que-flota-abajo.spec.ts` recorre 16 pantallas hasta el final del scroll, con señal y sin señal, y
en el celular bajo ocho condiciones: base; zona segura de 24, 34 y 48 px
(`Emulation.setSafeAreaInsetsOverride`); la raíz 48 y 64 px más alta que la ventana; la raíz 64 con
zona segura 48; y letra base de 22 px (`Page.setFontSizes`).

**Tapado es contenido, no solo controles.** El test junta todo lo que tiene `position: fixed` fuera
del `<main>` y arma una grilla de puntos cada 6 px sobre el rectángulo de cada pieza, incluidos sus
hijos (el botón redondo del código viejo sobresalía del rectángulo de la barra). Se queda con los
puntos donde lo de más arriba es algo flotante. Después apaga los eventos de puntero de todo lo que no
es contenido y vuelve a preguntar qué hay en cada uno: si el elemento es del `<main>` y en ese punto
hay un renglón de texto visible (medido con `Range.getClientRects()`) o un control, está tapado.

| Condición, sobre el código anterior        | Pantallas con algo tapado                     |
| ------------------------------------------ | --------------------------------------------- |
| Base, con señal y sin señal                | 0                                             |
| Letra grande                               | 0                                             |
| Con señal, raíz 48 px más alta             | 9, entre ellas la ficha del cliente           |
| Con señal, raíz 64 px más alta (± zona 48) | 11, entre ellas Inicio y la ficha del cliente |
| Sin señal, zona segura 24 o 34             | 8                                             |
| Sin señal, zona segura 48                  | 12, entre ellas Inicio                        |

Con este cambio: **cero, en las 256 combinaciones**.

**Lo que el test no vio y las capturas sí.** La primera versión del grid dejaba los botones de la
barra casi invisibles: el fondo de la píldora tiene `backdrop-filter`, crea su propio contexto de
apilamiento y se pintaba encima de los botones, que no estaban posicionados. La medición daba cero
tapados, porque mide el contenido y no la barra. Se arregló con `relative` en los botones, y
`destinos-en-celular.spec.ts` ahora verifica que en el centro de cada botón de la barra lo de más
arriba sea el botón; se comprobó que falla con el error puesto.

## Objeciones

- **La causa probable queda en pie.** `#root { height: 100dvh }` le gana a `inset: 0` y es lo que
  separa la raíz de la ventana. Sacarlo haría que la raíz y todo lo fijo usen la misma caja por
  construcción. No lo saqué: la medición cubre el caso sin depender de eso, y qué se ve debajo de la
  barra del sistema sin ese alto (hoy, el fondo de la app a través de la barra translúcida) solo se
  puede ver en el teléfono. Conviene probarlo en el Samsung en un cambio aparte.
- **Nada de esto se probó en un teléfono.** La raíz más alta es una simulación con CSS del mecanismo
  que reproduce las capturas; si el Samsung hace otra cosa, la medición igual la cubre mientras la
  diferencia sea entre el `<main>` y la barra. La letra grande cambia el tamaño base del navegador, no
  el escalado de texto de Android.
- **El test es caro**: 256 combinaciones, unos tres minutos y medio en el proyecto del celular.

## Consecuencias

- Todo elemento nuevo que flote abajo va adentro del pie o se ancla con `var(--holgura-inferior)`.
  Nunca con un número.
- Cambiar el tamaño o la posición del botón redondo no pide tocar ninguna cuenta.
