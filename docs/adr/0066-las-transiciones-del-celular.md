# 0066. Las transiciones del celular: una puerta, una pila y un coordinador

- Estado: aceptada
- Fecha: 2026-09-23
- Corrige al [0013](0013-shell-navegacion-e-inicio.md) en las transiciones: `conTransicion()` y el
  cross-fade de cada navegación se van. La tablet y la compu se ven igual que antes.
- Enmendado el 2026-09-25 por el [ADR 0074](0074-lo-que-responde-al-tocar.md): el «+» del celular gira
  con el resorte expresivo rápido en lugar de `--dur-fast`, y al elegir una acción el menú y el giro
  vuelven en el acto para que la transición de la navegación se lleve la pantalla quieta. Lo que
  responde al tocar (el apretón, que vuelve sin transición al soltar) termina en la pantalla quieta, y
  un aviso que nace durante una transición entra quieto: el arnés no cambió sus umbrales.

## Contexto

En el celular la app cambiaba de pantalla de golpe o con un cross-fade parejo, y el botón de atrás del
teléfono no se animaba. Cada pantalla navegaba por su cuenta (`Link`, `useNavigate`, el `viewTransition`
del router, `conTransicion()`), así que nadie sabía de dónde venía ni adónde iba una navegación, y el
historial se llenaba: volver desde una ficha abierta por la barra no llevaba a ningún lado útil,
guardar un formulario dejaba el formulario atrás y las pestañas apilaban entradas.

El pedido: transiciones de app nativa **solo en el celular**, con una sola pieza que decide cada
movimiento, el atrás del teléfono animado igual que la flecha, nada que salte al empezar ni al terminar,
y si una transición no puede ser perfecta, que no ocurra.

## Decisión

### La puerta (`shared/lib`)

Toda navegación pasa por `<Ir a>`, `useIr()` y `useVolver(padre)`. `ir(destino, { como, state, senal,
desdeLaNavegacion, sinTransicion })` con `como` en `apilar`, `reemplazar` o `terminar`. La puerta es un
puerto: la implementa `app/` por contexto, arriba de `ConBloqueo` y debajo de las pantallas de acceso;
sin proveedor navega derecho con el router. ESLint rechaza `Link`, `NavLink` y `useNavigate` fuera de la
puerta, del coordinador y de los tests, y `viewTransition` y `useViewTransitionState` en todo el repo.

**La pantalla que se va queda quieta hasta irse.** No estaba en el pedido y salió de medir. `ir` y
`volver` anuncian la salida; el marco le da a la pantalla y a su hoja la réplica de antes del toque
hasta que la ubicación cambia o la cola del coordinador se vacía. Sin esto, una escritura optimista
hecha antes de `ir` se veía en la pantalla que se iba: al borrar un trabajo en el celular, «Ese proyecto
no está» quedaba 600 ms detrás de la hoja que se cerraba (la hoja se desmontaba con la ficha y la
navegación esperaba el respaldo), y al cobrar, la pantalla del cobro se redirigía sola a la ficha antes
de la navegación con la señal, que terminaba una entrada más atrás y sin el corte.

### La pila

El historial se porta como una pila, en todos los anchos salvo la regla 2:

1. **Volver va atrás** si la entrada anterior es del mismo documento; si no, reemplaza por el padre. En
   el celular, si el padre es la raíz de una sección, deja Inicio abajo. La etiqueta de la flecha dice
   adónde vuelve de verdad.
2. **Las secciones** (solo el celular): la barra deja la pila en `[Inicio, raíz]`; tocar la sección en la
   que estás, más adentro, vuelve a su raíz; en la raíz no hace nada.
3. **Las pestañas reemplazan**: las cuatro de Proyectos y las dos de Opiniones.
4. **Terminar nunca apila**: va atrás si el destino es la entrada anterior; si ya está en el destino, no
   hace nada; si no, reemplaza.
5. **La señal de una vez** (`recienLiquidado`, `recienAprobado`) reemplaza al `state`: la toma la primera
   entrada que se pinta en el destino y no vuelve al ir y venir.
6. La ficha de una respuesta (`/opiniones?respuesta=`) se cierra como una hoja por ruta.

Nunca se viaja a una entrada de otro documento. La API de Navigation se usa para leer y escuchar; para
actuar, el router (`router.navigate(-n)`), nunca `navigation.navigate()`.

### El coordinador (`app/navegacion`)

- **El catálogo** dice de cada pantalla su sección, su forma (pantalla, capa u hoja), su profundidad y
  su pestaña. **La política** es pura: de dónde, adónde, cómo y el ancho, sale un movimiento y un
  alcance, o ninguno. **La memoria** guarda en `sessionStorage` el movimiento con que se llegó a cada
  entrada (por su `key`, con tope), y volver anima el inverso de ese.
- **La compuerta** es un `Proxy` de `window` que se le pasa al router al crearlo en `arrancar()`:
  captura su listener de `popstate`. El atrás del teléfono se retiene (hasta un segundo), el
  coordinador decide y se lo entrega adentro de la transición, así el botón y la flecha se ven igual.
  Si el navegador ya animó el gesto (`hasUAVisualTransition`), pasa derecho.
- **El escenario** es lo único que llama a `startViewTransition` (lint). Transiciona el `<main>` cuando
  cambia solo el contenido y el documento cuando entra o sale la capa del proyecto y en la tarjeta (ver
  desvíos). Los tipos van por `:active-view-transition-type()`.
- **La actualización** ejecuta los pasos del plan con `flushSync` y espera la señal del marco: el
  `layoutEffect` de `Marco` que corre después de `useScrollPorPantalla` para esa `key`. Las navegaciones
  se encolan; una nueva saltea la transición en curso y entrega lo retenido.
- **Las hojas**: ninguna transición de página al abrir o cerrar una. En el celular, salir a otra
  pantalla desde una hoja abierta por estado la cierra primero y después navega.
- **Los nombres** (`view-transition-name`) solo existen durante una transición; los pone y los saca el
  escenario sobre marcadores `data-*`. Tirar para actualizar ignora los gestos mientras hay una.
- `prefers-reduced-motion`, la página oculta o sin la API: ninguna transición, el cambio es instantáneo.
- **En la tablet y la compu** solo lo que sale de la navegación funde con el cross-fade del navegador,
  del documento y sin tipo, como antes. Un enlace no transiciona.

### Los movimientos

Resortes de Material 3 como curvas `linear()` y duraciones en `theme.css` (`--resorte-*`, `--dur-*`),
generados por `resortes.ts` y atados al CSS por un test. Solo se animan `transform` y `opacity` de las
imágenes; a lo que se desliza se le saca el `plus-lighter` reemplazando la animación. Al 0 % y al 100 %
cada movimiento es la pantalla quieta. Las reglas están en `app/styles/transiciones.css` y cuelgan de su
tipo. La sombra del empuje y el atenuado de la subida son tokens con su par oscuro.

| Movimiento        | Cuándo                         | Alcance   | Qué se ve                                                                                                     |
| ----------------- | ------------------------------ | --------- | ------------------------------------------------------------------------------------------------------------- |
| Fundido           | Cambiar de sección             | `<main>`  | La que se va se apaga en 90 ms; la nueva aparece de 90 a 320 ms y crece de 0,92 a 1.                          |
| Empuje            | Entrar a algo                  | `<main>`  | La nueva entra por la derecha a todo el ancho con sombra; la de abajo se corre −30 %. Espacial, 317 ms.       |
| Vuelta            | Volver                         | `<main>`  | El espejo: la que se va sale por la derecha, por encima.                                                      |
| Subida            | Entra la capa del proyecto     | documento | Sube desde abajo tapando la barra; la de abajo queda quieta y se apaga. Espacial lento, 484 ms.               |
| Bajada            | Sale la capa                   | documento | Baja y se va. Espacial, 317 ms.                                                                               |
| Tarjeta           | Tocar la tarjeta de un trabajo | documento | La tarjeta se vuelve el encabezado de su ficha (título, cliente y estado).                                    |
| Tarjeta de vuelta | Volver a la lista              | documento | El encabezado vuelve a su tarjeta si quedó a la vista; si no, se apaga en su lugar y la lista funde.          |
| Pestaña           | Cambiar de pestaña             | `<main>`  | Lo de abajo se va ±30 px apagándose; el fondo de la pestaña elegida viaja con un rebote leve; el resto cruza. |

`?camara-lenta` multiplica todas las duraciones por cinco con una sola variable (`--camara-lenta`), se
recuerda en la sesión y se apaga con `?camara-lenta=0`.

## Desvíos del pedido

- **La tarjeta va sobre el documento, no sobre el `<main>`.** En Chromium, una transición del `<main>`
  con una pieza con nombre que desaparece mientras se actualiza se saltea con «Transition was aborted
  because of invalid state. Prepaint layout check failed». Medido: la tarjeta de ida, 0 de 3 con
  `flushSync` y 3 de 3 sin él, pero entonces la vuelta falló 1 de 3; un `<h1>` nombrado a mano que
  desaparece, rechazado tanto al empujar como al volver; con retiro manual del DOM, pasa o no según el
  cuadro. El código de Chromium lo explica: mientras la actualización está pendiente,
  `RunPostPrePaintSteps` sigue mirando al elemento viejo y devuelve falso si ya no tiene caja. Sobre el
  documento, 10 de 10. Lo que flota abajo va como pieza propia que queda quieta, para que la barra no
  parpadee con el resto. Lo que cuesta: durante los 320 ms de la tarjeta la barra no se puede tocar.
- **Las etiquetas de las pestañas son piezas propias** (una por pestaña, con `view-transition-class`),
  por encima del fondo que viaja: si no, el fondo tapa la etiqueta de la pestaña de destino a mitad de
  camino.
- **Terminar en el mismo lugar no hace nada** (regla 4): antes reemplazaba y volvía a montar la pantalla.

## Lo que se midió

- **El arnés** (`e2e:transiciones`, en `pnpm verify` después del reparto): congela cada movimiento al 0,
  50 y 100 % y compara el 0 con la pantalla de antes y el 100 con la de después, por bloques de 8 px
  del aparato con una tolerancia de 0,5 % de bloques distintos (la foto de una transición y la pantalla
  quieta no rasterizan igual el texto). Celular claro y oscuro, tablet de 768 y compu de 1024 y 1440.
  14 de 14.
- **El rendimiento** (a pedido, `MEDIR_EL_RENDIMIENTO=1`): CPU ×4, diez vueltas por todos los
  movimientos, del toque a que la transición arranca. Medianas de 55 a 90 ms salvo la tarjeta, 107 ms.
  Cero cuadros de más de 50 ms mientras algo se mueve; los que hay son antes de arrancar, mientras se
  pinta la pantalla nueva con la vieja congelada.
- **El video** del recorrido, a pedido (`GRABAR_EL_VIDEO=1`), en velocidad normal y en cámara lenta.

## Objeciones

- **La meta de 100 ms del toque al arranque mide el render de la pantalla más que la transición.** La
  animación no puede arrancar antes de que exista la pantalla nueva, y la ficha de un trabajo tarda
  entre 80 y 100 ms en pintarse con la CPU a ×4. La tarjeta queda 7 ms arriba. Lo que se nota en la mano
  es un tirón mientras algo se mueve, y de eso no hay ninguno.
- **Las transiciones del `<main>` son jóvenes en Chromium** y ya obligaron a sacar la tarjeta. Si otro
  movimiento empezara a saltearse, la política tiene que mandarlo al documento, no al revés.
- **El cruce de las etiquetas de las pestañas se ve un poco borroneado a mitad de camino**, porque la
  elegida va en semibold y las otras en medium. Arreglarlo es darles el mismo peso, y eso cambia cómo se
  ven en la compu, que el pedido deja igual.
- **El rebote del fondo de la pestaña asoma unos píxeles afuera del riel** en el salto en diagonal de la
  grilla de 2×2 del celular, durante unos 100 ms. Es el rebote expresivo que se pidió.

## Alternativas descartadas

- **El componente `<ViewTransition>` de React.** Ata cada animación a un commit de React y no ve el
  `popstate` del atrás del teléfono, que es justo lo que hay que retener para animarlo. No tiene alcance
  en elementos.
- **El `viewTransition` del router.** Transiciona el documento entero sin tipos, igual para ir que para
  volver, y no pasa por el atrás del teléfono.
- **Una librería de animación.** Mantiene las dos pantallas montadas y animadas por JavaScript en el hilo
  principal, pelea con la restauración del scroll y suma peso al bundle, para lo que el navegador ya
  hace con dos fotos.
- **Un gesto de atrás propio desde el borde.** Choca con el gesto del sistema de Android y con el atrás
  predictivo; el navegador ya anima el suyo y la compuerta lo respeta.
- **`<Activity>` para dejar vivas las pantallas anteriores.** Resuelve otra cosa (no desmontar), gasta
  memoria y deja pantallas con una réplica vieja. No anima.

## Consecuencias

- Una navegación nueva pasa por la puerta. Un movimiento nuevo es una entrada en la política, una regla
  en `transiciones.css` colgada de su tipo y una fila en el arnés.
- Una pantalla que escribe de forma optimista y después navega no necesita cuidarse de que se vea la
  escritura: la pantalla que se va queda quieta.
- Una pieza con nombre en el `<main>` no puede desaparecer mientras se actualiza (ver desvíos).

## Fuentes

- Material Design 3, «Easing and duration» y los resortes de `motionScheme` (amortiguación y rigidez de
  los espaciales y de efectos, estándar y expresivos).
- MDN, «View Transition API», `:active-view-transition-type()`, `ViewTransition.types` y
  `Element.startViewTransition()`; Chrome for Developers, «Scoped view transitions».
- Chromium, `view_transition_style_tracker.cc`, `RunPostPrePaintSteps` y
  `RunPostPrePaintStepsForElement`: devuelven falso si un elemento seguido no tiene caja o está
  fragmentado; `view_transition.cc` saltea con `kPostPrePaintFailed`.
- WHATWG, Navigation API: `navigation.entries()`, `currentEntry`, `navigate` con `navigationType` y
  `hasUAVisualTransition`.
