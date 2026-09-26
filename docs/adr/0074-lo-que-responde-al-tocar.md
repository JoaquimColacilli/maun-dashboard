# 0074. Lo que responde al tocar: se hunde, se desliza, se abre desde el botón y se tacha

- Estado: aceptada
- Fecha: 2026-09-25
- Sigue al [0073](0073-la-app-se-llama-numa.md), en el mismo pedido.
- Enmienda al [0068](0068-la-mesa-y-el-plano.md): se mueven más cosas que las cuatro del §11, todas
  al tocar y hasta quedar quietas, y los avisos son la excepción declarada; el fondo del elegido de los
  segmentados de un renglón viaja (§4), y el interruptor de los archivos deja el `bg-hogar`.
- Enmienda al [0066](0066-las-transiciones-del-celular.md): el «+» del celular gira con el resorte
  expresivo, un aviso que nace durante una transición entra quieto, y lo nuevo termina en la pantalla
  quieta, así que el arnés no cambia.
- Enmienda al [0069](0069-el-dibujo-del-trabajo-del-cliente.md): las páginas del cliente tampoco se
  mueven al apretar ni al copiar, y la marca `data-quieta` las cubre también adentro de la app.
- Enmienda al [0020](0020-pulido-visual.md) (los avisos entran y salen, y el contexto de salida de
  `ConSalida` se exporta como `useSalida`), al [0034](0034-la-agenda-calcula-lo-que-sale-de-los-trabajos.md)
  y al [0045](0045-los-costos-estimados-lo-que-hace-falta-y-mover-en-la-agenda.md) (tildar dibuja la
  tilde y corre la línea; destildar vuelve en el acto) y al [0048](0048-los-datos-para-transferir.md)
  («Copiado» dibuja su tilde).

## Contexto

Joaquim pidió «implementar bencho.dev en la app, por sus micro-transiciones». Antes de empezar dejó
decidido: que de Bencho no se instala nada, porque es un sitio y no una librería, y la app rechaza por
escrito las librerías de animación (0066, 0068); que se traen seis bloques, reescritos con los tokens y
los resortes de la app sobre los controles que ya existen; que nada se mueve por su cuenta, salvo los
avisos; y que las páginas del cliente siguen quietas (0069), también al apretar y al copiar.

Hasta este ADR ningún control cambiaba al apretarlo (el único `active:` era el cursor del recorte de la
foto), los tres interruptores eran hechos a mano y su perilla saltaba de lado, el elegido de los
segmentados cambiaba de golpe, el menú del «+» se montaba y desmontaba sin transición, lo tildado se
tachaba en el acto y los avisos aparecían y se iban de golpe.

## Qué es Bencho

- **Un sitio para probar bloques de interfaz y llevarse su código**: «A library of interactive UI
  blocks you can explore, tweak, and take straight into your projects» (portada, leída el 25 de
  septiembre de 2026). No hay paquete ni registry: cada bloque vive en `https://bencho.dev/?c=<id>`, con
  un panel de controles y una pestaña Code que copia el uso y el CSS sin pedir cuenta.
- **Tiene 41 bloques, no 32.** El pedido citaba «32 live components»; hoy el registro de bloques del JS
  público (`index-BFyh4sKd.js`) tiene 41, la grilla de la portada muestra 38 y el sitemap nombra 22.
  Nueve no estaban en la cuenta del pedido: Particles, Label input, One-time code, Generate, Step
  player, Card stack, Folding frame, Browser tabs y Action node. Van a «Lo que no se trajo».
- **El sitio cambia seguido**, y sus propias notas no coinciden con lo que corre: la pestaña CSS del
  Liquid toggle describe otra variante (dos gotas con filtro) con valores `NaN`; la del Create menu da
  otros tiempos y otros tamaños que los de la página. Los números de este ADR son los medidos, no los
  de las notas.

### La licencia

Se leyó el 25 de septiembre de 2026 en `https://bencho.dev/licence` con el Chromium de Playwright, desde
un script que no se commitea, sin cuenta y sin aceptar nada (la página se arma en el navegador: respondió
200 y 2.999 caracteres de texto). Dice «LAST UPDATED 10 SEPTEMBER 2026». Lo que importa, tal cual:

> The blocks are MIT licensed. Take them to work, ship them in a product, change them, sell what you
> build with them. The site around them is not part of that.
>
> You may: Use it commercially, inside a company, in a product you sell. Change it, build on it, keep
> your changes to yourself. Redistribute it. No attribution on your interface, no link back, nothing to
> ask us first.
>
> You must: Keep the copyright notice with substantial copies of the source — the ordinary MIT
> condition, quoted in full below. Nobody expects a notice beside a pasted rule of CSS.

Sigue con el texto MIT entero, «Copyright (c) 2026 Lorenzo Cabra». Lo que no es MIT: el sitio, el nombre
y la cabra (marca), las fotos de algunos bloques y las cosas de terceros.

- **No hace falta atribución en la interfaz.** La condición es conservar el aviso de copyright en las
  copias sustanciales del código fuente, y **en el repo no hay ningún fragmento de Bencho**: se leyó su
  código para estudiar los tiempos y se escribió todo de nuevo con los tokens. Lo que se tomó son
  ideas y dos números (22 ms entre filas, 6 px de subida). Igual se nombra acá, porque es de donde salió.
- Cuatro bloques llevan una marca «pro» en el registro (Tilt card, Search, Wheel y Command bar). La
  licencia dice que todos los bloques son MIT, sin niveles; ninguno de los cuatro entra.
- Los directorios de terceros que lo daban como «freemium» no hacen falta: la licencia se leyó en el
  sitio.

### Cómo se estudió

Cada bloque de la tabla se usó con el mouse (1440 × 900), con el teclado y con el celular emulado
(390 × 844, táctil), y con `prefers-reduced-motion`, midiendo cuadro por cuadro con un bucle de
`requestAnimationFrame` (`getBoundingClientRect`, los estilos computados y `getAnimations()`), y
congelando cuadros con `Animation.setPlaybackRate` de CDP. Con la página intacta, Chromium sin ventana
iba a 12–25 cuadros por segundo por el desenfoque del fondo; para medir a 60 se ocultó la pared de
bloques detrás del diálogo, sin tocar el bloque. Los scripts y las mediciones quedaron fuera del repo.
Nada se probó en un teléfono de verdad ni en Safari.

## Lo que se trajo, bloque por bloque

Medidas en px del bloque (el sitio los muestra a ×1,25), tiempos desde el click.

### Liquid toggle (`liq-toggle`) → el interruptor

- **Qué hace el bloque**: el fondo mide 92 × 46 y la perilla es un círculo de 36 que viaja 46 px con un
  resorte (rigidez 170, amortiguación 21,5, masa 0,9: ζ ≈ 0,87): mitad a los 121–126 ms, 99 % a los
  355–360 ms. Se estira según la velocidad, con `scaleX` y su inversa en el alto: como mucho 1,095 (+9,5 %
  de ancho) a los 205–215 ms, con la perilla ya al 83 %. El eje de escala está en el centro, así que se
  estira para los dos lados. Los colores cambian en 320 ms con `ease`. Con menos movimiento no reduce
  nada: lo anima JavaScript y la preferencia no le llega. Con Espacio sostenido, cada repetición de la
  tecla lo cambia (7 cambios en una pulsación).
- **Qué se tomó**: que la perilla viaje deformándose y vuelva a su forma al llegar.
- **Cómo lo hace la app**: la perilla es un círculo posicionado por sus dos bordes (`left` y `right`),
  no una escala. Al prender, el borde de adelante (`right`) sale con el resorte espacial rápido (224 ms)
  y el de atrás (`left`) lo alcanza con el espacial (317 ms), un cuarto del rápido después
  (`--retraso-del-borde-de-atras`, 56 ms). Al apagar, al revés. Sin JavaScript de física. Medido: la
  perilla de 26 px llega a 40,4 px de ancho y queda en 26 al terminar.
- **Un solo componente**: `Interruptor` de `@maun/ui`, `role="switch"` con `aria-checked`, con los
  nombres accesibles de antes. Reemplaza a los tres hechos a mano (`recibir-avisos`, los archivos que ve
  el cliente y la pregunta obligatoria de la encuesta). El de los archivos deja el `bg-hogar`: prendido es
  tinta, como los otros dos, porque los colores de tesoro son para la plata (0068).
- **Solo se mueve si lo cambió el dedo** (`data-tocado`, que pone el click): al montarse, o si el dato
  cambia desde otro lado, la perilla está en su lugar.

### Icon bar (`icon-bar`) y Magnetic select (`magnet-select`) → el fondo del elegido

- **Icon bar** es lo que pedía la tabla: el fondo del elegido viaja en dos tiempos. Primero se estira
  hasta cubrir el lugar viejo y el nuevo (190 ms, `cubic-bezier(.32,.72,.24,1)`), con la cola quieta;
  a los 150 ms un temporizador lo pasa al segundo tiempo, que lleva la cola al destino y devuelve el
  ancho (420 ms, con un rebote de 3 px en la cola). Termina a los 560–590 ms, sea cual sea la distancia.
  Son transiciones de `transform` y `width`. Tampoco respeta menos movimiento.
- **Magnetic select no es un segmentado**: es un racimo hexagonal de siete discos donde el elegido crece
  y los demás se corren; no hay ningún fondo que viaje. El pedido lo daba como par del Icon bar y la
  premisa no coincide. De él se tomó solo el escalón de **22 ms por paso de distancia**, que es el mismo
  del Create menu y quedó como `--dur-escalon`.
- **Cómo lo hace la app**: `FondoDelElegido` de `@maun/ui` es un `span` detrás de las opciones, con el
  `bg-elevado shadow-float` que antes tenía el elegido. Mide la opción elegida (`[data-opcion]`, hija
  directa de la pista) y se posiciona por sus cuatro bordes, así que no cambia el marcado, el rol ni el
  teclado de nadie. Cuando el dedo cambió la opción (un `pointerdown`, `keydown` o `click` en la pista)
  pone `data-hacia` y viaja con la misma receta del interruptor: el borde de adelante con el espacial
  rápido y el de atrás con el espacial, 56 ms después. Medido en el orden de Clientes: el fondo llega a
  205,3 px (cubre las dos opciones, como el Icon bar) y termina en 100,3, el ancho de la opción. Al
  montarse, al cambiar de ancho la pista (`ResizeObserver`) o si el dato cambia desde otro lado, se ubica
  sin transición en el mismo cuadro.
- **Van los cuatro de elección única de un renglón**: `SelectorDeTema` (radios nativos), `HojaDeMovimiento`
  y el orden de `ClientesPage` (botones `role="radio"`) y `HojaDeCliente` (un `fieldset`). No van
  `ComoTePaga`, que son casillas y puede haber dos, ni los de `rounded-panel` que pueden partirse, ni
  las pestañas que navegan (Proyectos, Opiniones), que ya mueve el coordinador (0066).

### Create menu (`liq-create`) → el menú del «+»

- **Qué hace el bloque**: al soltar, la píldora del botón se achica un poco y a los 60 ms su mismo fondo
  se estira hasta ser el menú, cambiando el ancho, el alto y el radio de verdad (de 103 × 38 a
  212 × 166) con un resorte sin rebote, centrado en el botón. Las cuatro filas entran escalonadas cada
  **22 ms**, cada una de opacidad 0 a 1 en 150 ms y subiendo **6 px** en 240 ms. Cierra hacia el botón
  con las filas todas juntas. El «+» no gira. Con el teclado anda mal: Escape no cierra y las filas
  invisibles siguen en el orden del Tab con el menú cerrado.
- **Cómo lo hace la app**: el menú no cambia de tamaño (solo `transform` y `opacity`): crece con `scale`
  de 0,4 a 1 desde el «+» (`origin-bottom` en el celular, `origin-top-left` en el riel y la barra
  lateral), con el resorte espacial (317 ms) y la opacidad con el de efectos rápidos (150 ms). Las
  acciones entran escalonadas cada `--dur-escalon` (0, 22, 44, 66 y 88 ms) subiendo 6 px, y el fondo que
  lo cierra se funde. Todo entra con `@starting-style`.
- **Cierra hacia el «+»**: vuelve a 0,4 y 0 con el espacial rápido, y las acciones se van juntas, como en
  el bloque. Mientras sale queda montado con `ConSalida`, con el menú y su fondo `inert` y sin tomar
  toques: el fondo deja de tomar toques apenas empieza a salir. Se desmonta con el `transitionend` de la
  opacidad o con el respaldo de 400 ms de las hojas.
- **Al elegir una acción se va en el acto**: el menú, su fondo y el giro del «+» vuelven sin transición
  y la navegación se lleva la pantalla (el coordinador tiene su propio movimiento).
- **El «+» del celular gira** 45° con el resorte expresivo rápido (359 ms, amortiguación 0,6, un rebote
  chico), como pidió Joaquim; en el bloque no gira.

### Checklist (`checklist`) → «Lo que hace falta» y la agenda

- **Qué hace el bloque**: un resorte a mano por fila (ζ ≈ 0,41) mueve todo junto: el relleno de la caja
  crece desde el centro con un pico de 1,214 a los 168 ms; la tilde se dibuja con `stroke-dashoffset`
  entre los 34 y los 118 ms; la raya crece con `scaleX` desde la izquierda entre los 51 y los 101 ms, del
  ancho del texto, y el texto baja a 0,42 de opacidad. Destildar está animado y deja un puntito oscuro
  en la caja (el relleno pasa por −0,214 a los 162 ms). Con las tres tildadas, las filas se caen.
- **Qué se tomó**: la tilde que se dibuja y la línea que corre sobre el texto un momento después.
- **La tilde** es `Tilde` de `@maun/ui`, un trazo propio con `pathLength="1"` (el `check` de lucide no
  se puede dibujar) que va del brazo corto al largo, como se escribe una tilde. Con `data-dibujar` reusa
  `@keyframes maun-trazo` con el resorte de efectos (231 ms).
- **La línea** es una copia del texto sin tinta con su `line-through` (`.linea-del-tachado`), que se
  descubre de izquierda a derecha con `clip-path` (`@keyframes maun-tachado`, 231 ms, un escalón de 22 ms
  después de la tilde). Mientras corre, el texto de verdad esconde su propia línea
  (`decoration-transparent`); al terminar, el `animationend` apaga todo y queda el tachado de siempre.
  - En **«Lo que hace falta»** la copia es la que ya hacía crecer el `textarea`, que tiene el texto con su
    largo y sus renglones. La casilla sigue siendo un `input type="checkbox"`, ahora con
    `appearance: none`, su borde y la tinta al tildar, y la misma zona de 44 px.
  - En **la agenda** la casilla es el botón `role="checkbox"` de siempre, y la copia es un `span`
    `aria-hidden` encima del texto.
- **Solo en el renglón recién tildado**, con un estado local: `recienTildada` en la fila de «Lo que hace
  falta», y el id en `useAccionesConFoco` en la agenda, que sobrevive a que React mueva el renglón al
  final (`conLoHechoAlFinal`) porque no vive en el renglón. Nunca por `data-hecha` ni `data-listo`, que
  ya están al montar y harían correr todo lo hecho cada vez que se abre la pantalla.
- **Destildar vuelve en el acto**, sin el puntito del bloque.

### Notify (`toasts`) → copiar

- **El bloque ya no tiene avisos**: hoy es un botón que se prende y se apaga, con la campana que oscila
  820 ms, un fundido cruzado del texto en 200 ms y el ancho de 62 a 106 px en 460 ms con rebote. No hay
  tilde ni trazo que se dibuje. Con menos movimiento solo saca la campana.
- **Qué se tomó**: la idea de un botón que responde cambiando su texto. **La tilde que se dibuja es
  nuestra**, la misma `Tilde` de arriba: los cuatro botones de copiar (`DatoCopiable`, `HojaDelQr`,
  `PantallaDeCompartir`, `PedirLaOpinion`) muestran «Copiado» con la tilde dibujándose. El ancho no se
  anima.

### Los bloques de apretar → el apretón

- **No se hunden todos.** De los 13 bloques de apretar, con el mouse 7 achican el control mientras el
  botón está apretado (Generate, Step player, Palette, Now playing, Radial menu, Inline confirm y
  Notify), 2 recién después de soltar (Create menu, Search) y 4 no se achican (Todo tower, Checklist,
  Drag stepper, Liquid toggle). Ninguno baja con `translate` ni baja la sombra: el único hundirse es
  `scale`, casi siempre a 0,94 (0,96 en Notify y en la tapa de Now playing) en 130 ms con
  `cubic-bezier(0.3, 0.9, 0.4, 1)`, y vuelven en 130 ms.
- **Qué se tomó**: que apretar es solo `scale`, y solo mientras está apretado (`:active`).
- **Los valores son nuestros**: `apretable`, una `@utility` de `theme.css`, lleva el control a
  `--escala-del-apreton` (0,97) con el resorte de efectos rápidos (150 ms, sin rebote). La transición de
  `scale` va solo en `:active` y se suma a la que el elemento ya tenía, que la declara en
  `--transicion-propia` (los colores de `Button`, el giro del «+»). **Al soltar vuelve sin transición**:
  el arnés compara el 0 % de una navegación con la pantalla quieta, y un botón a medio volver lo
  rompería. Deshabilitado no se hunde; con menos movimiento y en las páginas del cliente, tampoco.
- **Lo llevan** `Button`, los chips con `aria-pressed` (los atajos de la anotación, las horas de los
  avisos, el detalle y «Hoy»/«Ayer» del movimiento, los filtros de la agenda y de Finanzas, los de
  Consultas y Proyectos, «La aprobó», «Ver los números» y los horarios de la fecha de entrega del
  0071), los tres «+ Anotar» y los tres «+» de la navegación. Nada más.
- **En el celular emulado**, Chromium no aplica `:active` mientras el dedo está apoyado: lo aplica unos
  150 ms después de levantarlo. En un teléfono de verdad debería aplicarse con el dedo encima; no se
  pudo medir.

### Los avisos → entran desde abajo y se van con un fundido

No salen de Bencho, porque Notify ya no los tiene: es una decisión nuestra, con los tokens.

- **Entran** con `@starting-style`: de opacidad 0 y 12 px más abajo a su lugar, la opacidad con el de
  efectos rápidos (150 ms) y el `translate` con el espacial rápido (224 ms).
- **Se van con un fundido** de 150 ms, en su lugar. Los avisos son una lista y `ConSalida` maneja un
  solo valor, así que `Avisos` junta los que siguen con los que se fueron (`conLosQueSeVan`): el que se
  va queda en su lugar, `inert`, sin tomar toques y con `data-saliendo`, hasta el `transitionend` de su
  opacidad o el respaldo de 400 ms de las hojas. Un error que se va hace lo mismo adentro de su
  `role="alert"`, que también queda `inert`.
- **Un aviso que se reemplaza no sale y vuelve a entrar**: `avisarEnPantalla` conserva el `id` del de su
  clave (0030), así que cambia el texto en su lugar.
- **Un aviso que nace durante una transición de pantalla entra quieto** (`transition: none`), porque la
  foto de la transición lo congelaría a medio entrar.

## Cómo se mueve todo, en una tabla

| Qué                   | Propiedades                          | Tokens                                                                    |
| --------------------- | ------------------------------------ | ------------------------------------------------------------------------- |
| El apretón            | `scale`                              | `--escala-del-apreton`, efectos rápidos; vuelve sin transición            |
| La perilla            | `left` y `right` de algo posicionado | espacial rápido adelante; espacial atrás, `--retraso-del-borde-de-atras`  |
| El fondo del elegido  | `left` y `right` de algo posicionado | los mismos                                                                |
| El menú del «+»       | `scale` y `opacity`                  | espacial al abrir, espacial rápido al cerrar, efectos rápidos la opacidad |
| Las acciones del menú | `opacity` y `translate`              | efectos rápidos y espacial rápido, `--dur-escalon` entre una y otra       |
| El giro del «+»       | `rotate`                             | expresivo rápido                                                          |
| La tilde              | `stroke-dashoffset`                  | `maun-trazo` con efectos                                                  |
| La línea del tachado  | `clip-path`                          | `maun-tachado` con efectos, un `--dur-escalon` después                    |
| Los avisos            | `opacity` y `translate`              | efectos rápidos y espacial rápido                                         |

- **Ninguno usa View Transitions**, que son del coordinador, ni cambia el tamaño de algo que empuje lo
  de al lado.
- **Al aparecer, nada viaja.** El interruptor, el segmentado y la tilde se muestran en su estado cuando
  la pantalla se monta, y se mueven solo cuando el dedo los cambia. Clientes es la pantalla a la que
  llega el arnés de la compu, y el fondo de su orden se ubica sin transición en el cuadro del montaje.
- **Con menos movimiento**, todos los tokens de duración valen cero (`--dur-escalon` también, y el
  retraso del borde de atrás sale de una duración), el apretón no se hunde y el barrido global deja
  cada animación en 0,01 ms. **El barrido suma `animation-iteration-count: 1`**: sin eso, un loop
  seguía girando cada 0,01 ms.
- **Los tres loops que no tenían guarda** (el spinner de `Button`, el de la encuesta y el brillo del QR)
  van con `motion-safe:` y con menos movimiento muestran un estado fijo, como «Tirar para actualizar».
- **Los `@keyframes` nuevos se llaman `maun-*`** (`maun-tachado`), como los de antes: el nombre interno
  no cambió (0073).

## Las páginas del cliente

No se mueve nada, tampoco al apretar ni al copiar (0069). Las guardas cuelgan de
`:where(html[data-vista='publica'], [data-quieta])`: la primera es la de `/v/` y `/o/`; `data-quieta` es
una marca propia en la raíz de `VistaDelCliente` (la `Pagina` misma, con `quieta`) y en las dos raíces
de la encuesta, así «Así la ve tu cliente» y «Mostrarle al cliente» quedan iguales a lo que ve él. Las
transiciones de color y las hojas que esas páginas ya tenían siguen como estaban, y la firma de Gracias
se sigue trazando.

**La marca va en la `Pagina`, no en un envoltorio.** La primera versión envolvía la vista en un `div`
con `display: contents`, y el test del reparto (0062) la dio por fuera del molde en todos los anchos: su
medición no entra en un elemento sin caja, así que no encontraba el `data-pagina` de adentro. `Pagina`
suma `quieta`, que pone `data-quieta` en el mismo molde.

**Las guardas van con `!important`.** El e2e encontró que en `/v/` «Copiado» dibujaba su tilde:
`.tilde[data-dibujar] path` tiene más especificidad que la guarda, cuyo `:where()` no suma nada. Con
`!important` la guarda gana siempre, y `movimiento.test.ts` lo exige.

## Lo que no se trajo

| Bloques                                                                                                                                                | Por qué                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Los de arrastrar: Slide to confirm, Reorder list, Wheel, Range dial, Slosh slider, Dragging ball, Glass bubble, Carousel, Folding frame y Browser tabs | Lo que se hace arrastrando necesita otra forma sin arrastrar (WCAG 2.2, 2.5.7), y la app no tiene nada que se arrastre salvo mover en la agenda, que ya tiene su gesto. |
| Los de pasar el mouse: Tilt card, Image accordion, Magnifying dock, Escape button, Progress ticks, Particles, Card stack y Action node                 | La app se usa sobre todo con el dedo, y el 0068 no mueve nada al pasar el mouse: el arnés compara píxeles con el puntero quieto.                                        |
| Inline confirm                                                                                                                                         | La app eligió deshacer en lugar de preguntar, y las confirmaciones que quedan explican consecuencias que no entran en un botón.                                         |
| Pull to refresh                                                                                                                                        | Ya existe, con su gesto medido (0027).                                                                                                                                  |
| Los metaballs de los bloques líquidos                                                                                                                  | El filtro que funde las formas no es del lenguaje de tinta sobre papel y cuesta en el celular.                                                                          |
| Command bar, Search, Assignees, Drag stepper, Palette, Now playing, Radial menu, Canvas toolbar, Todo tower, Aspect ratio y Selection list             | No tienen en la app un control que los reciba.                                                                                                                          |
| Label input                                                                                                                                            | Los campos ya tienen su etiqueta arriba, fija y alineada en su grilla (0020): no hay una etiqueta que mover.                                                            |
| One-time code, Generate y Step player                                                                                                                  | La app no tiene un código de un solo uso, ni algo que se genere, ni un reproductor. El «cargando» de `Button` ya existe.                                                |

De esta tabla se usaron solo los de apretar, para ver si se hunden. Los demás se descartaron por lo que
son, sin medirlos.

## Desvíos del pedido

- **Los números de los ADR son 0073 y 0074**: `main` ya tenía el 0072.
- **La regla de los avisos durante una transición es `:root:is(:active-view-transition,
:has(:active-view-transition))`**, no `:root:has(:active-view-transition)`. Probado en Chromium: en
  una transición del documento la activa es la raíz misma, y `:has()` solo mira a los descendientes,
  así que no la cubría. Con `:is()` cubre las del documento (la raíz) y las del `<main>` (la raíz la
  tiene adentro).
- **Los avisos se van con `transitionend` y entran con `@starting-style`, no con `@keyframes` y
  `animationend`.** Un `@keyframes` apagado durante la transición de pantalla arrancaría tarde, cuando la
  transición termina; una transición con `@starting-style` que no corrió deja el aviso en su lugar.
- **Magnetic select no aporta el fondo que viaja** (no lo tiene): el fondo sale del Icon bar.
- **La tilde de «Copiado» no sale de Notify**, que no la tiene.
- **Los chips del horario de la fecha de entrega (0071) llevan el apretón**, por la regla del pedido: lo
  que sumó la entrega entra en las mismas reglas.
- **`useSalida` y el respaldo de 400 ms viven en `shared/ui/salida.ts`**, no en `Hoja.tsx`: un archivo de
  componentes que además exporta un hook rompe la recarga en caliente, y el lint lo prohíbe.

## Objeciones

- **El estiramiento es mucho más fuerte que el de Bencho.** La perilla pasa de 26 a 40,4 px (+55 %)
  y el fondo del segmentado cubre las dos opciones; el Liquid toggle se estira un 9,5 % con sus valores
  por defecto. Es lo que da mover los dos bordes con dos resortes de Material 3 que difieren en 93 ms más
  el retraso: la forma es la del Icon bar, no la del Liquid toggle. En las capturas se ve bien, pero se
  ve. Si resulta mucho, la palanca es una: `--retraso-del-borde-de-atras` en 0 lo baja, y usar el
  espacial rápido en los dos bordes lo apaga.
- **En un texto de varios renglones, la línea corre por todos a la vez**, de izquierda a derecha, no
  renglón por renglón: el recorte va en el bloque, porque en un elemento en línea Chromium recorta con la
  caja del primer renglón y los demás no se veían.
- **Con el teclado en el celular, el menú del «+» queda antes del botón en el orden del DOM** (ya era
  así en `main`): Tab desde el «+» abierto va al contenido de la pantalla, no a las acciones, y Escape lo
  cierra. En la compu el orden es «+», «Cerrar el menú» y las acciones. No se cambió porque no es de
  este pedido.
- **Con `?camara-lenta`** (0066) las salidas del menú y de los avisos duran más que el respaldo de
  400 ms y se cortan antes de terminar, igual que las hojas. Es una herramienta para mirar, no algo que
  vea el dueño.
- **Nada de esto se probó en un teléfono.** En particular, cuánto se nota el apretón con el dedo encima
  y cómo se ven los resortes a 120 Hz.

## El peso

Medido con `pnpm --filter @maun/web build` en `main` (`b5186e6`) y en esta rama, con la marca del 0073 y
la novedad incluidas (medido otra vez el 26 de septiembre, con la dirección nueva):

| Archivo             | `main`                   | Esta rama                | Diferencia            |
| ------------------- | ------------------------ | ------------------------ | --------------------- |
| `index.html`        | 2,30 kB (0,94 gzip)      | 2,85 kB (1,09 gzip)      | +0,55 kB (+0,15 gzip) |
| CSS (`index-*.css`) | 101,31 kB (20,00 gzip)   | 106,06 kB (20,93 gzip)   | +4,75 kB (+0,93 gzip) |
| `ui-*.js`           | 150,37 kB (47,84 gzip)   | 151,91 kB (48,41 gzip)   | +1,54 kB (+0,57 gzip) |
| `index-*.js`        | 700,79 kB (193,08 gzip)  | 706,61 kB (195,01 gzip)  | +5,82 kB (+1,93 gzip) |
| `crear-cuenta-*.js` | 2,71 kB (1,37 gzip)      | 2,71 kB (1,38 gzip)      | —                     |
| `vendor-*.js`       | 753,91 kB (220,48 gzip)  | 753,91 kB (220,48 gzip)  | sin cambios           |
| Precache            | 31 entradas, 1810,04 KiB | 37 entradas, 1843,31 KiB | +6, +33,27 KiB        |

- **El `index.html`** crece por el arranque que cambia los íconos en `/v/` y `/o/` (0073).
- **El CSS** crece por el apretón, el interruptor, el fondo del elegido, la tilde, el tachado, el menú,
  los avisos y sus guardas.
- **`ui`** suma `Logotipo`, `Isotipo`, `Interruptor`, `FondoDelElegido` y `Tilde`; **`index`**, la salida
  del menú y de los avisos, el estado de lo recién tildado, el título de `/v/` y la novedad (medio kB).
- **El precache** suma los íconos nuevos de NUMA y los del taller con su nombre nuevo; `pwa-64x64.png`,
  `pwa-192x192.png` y el enmascarable viejo se fueron (0073).
- **Ninguna dependencia nueva.**

## Cómo se verificó

- **En unidad**: `Interruptor` (el rol, `aria-checked`, el nombre, que se mueve solo si lo tocaron),
  `FondoDelElegido` (se ubica quieto al montarse y al cambiar desde afuera, viaja con `data-hacia` solo
  al tocar), `Tilde`, el menú (queda montado e `inert` mientras sale, y se desmonta en el acto al
  elegir), `Avisos` (el que se va sigue en el DOM, `inert`, hasta terminar), `FilaDeNecesidad`,
  `FilaDeEvento`, `DatoCopiable`, y `movimiento.test.ts` en `@maun/ui` (el apretón, el barrido y las
  guardas con `!important`).
- **e2e, `con-sesion/lo-que-responde-al-tocar.spec.ts`**, en celular y en escritorio (la agenda, solo en
  el celular):
  - cada movimiento arranca y termina en la pantalla quieta: la captura al terminar, comparada con
    `comparar` de `e2e/transiciones/capturas.ts` contra la misma pantalla recién montada en ese estado,
    dio 0,00 % de bloques distintos en todos los casos, salvo el menú cerrado en la compu (0,06 %, debajo
    del 0,5 % del arnés);
  - lo medido en el camino: la perilla de 26 a 40,4 px; el fondo de 100,3 a 205,3 px; el menú con
    `opacity` y `scale`, escalones de 0, 22, 44, 66 y 88 ms y el origen en el «+» (`125px 240px` en el
    celular, `0px 0px` en la compu); al tildar, `maun-trazo` y `maun-tachado`; el aviso que entra con
    `opacity` y `translate`, y el que se va que sigue, `inert` y fundiéndose; al copiar, `maun-trazo`;
  - con `reducedMotion: 'reduce'`, ninguna animación ni transición de lo nuevo dura más de 0,01 ms en
    `getAnimations()`;
  - en `/v/` y adentro de la app, después de apretar y de copiar, ningún elemento cambió `scale`,
    `translate` ni `clip-path`, y no corrió ningún `@keyframes`; en la encuesta, solo `maun-trazo` en la
    firma de Gracias;
  - el teclado, con el árbol de accesibilidad de cada paso: el interruptor cambia con Espacio y con Enter
    y conserva el foco; el segmentado sigue con una parada de Tab por opción y Espacio elige, como antes;
    Enter en el «+» lo abre (`[expanded]`) y Escape lo cierra.
- **`e2e:transiciones` sigue en verde sin tocar sus umbrales**, y `rediseno.spec.ts` no se tocó.
- **El test del reparto** (`e2e:reparto`, 0062) encontró el envoltorio `display: contents` de la vista
  del cliente: en todos los anchos, por el enlace y adentro de la app, «no está adentro del molde de la
  página». Con la marca en la `Pagina` volvió a pasar, sin tocar el test.
- **Los cuadros**, con y sin menos movimiento y a 1/10 de velocidad, del menú al abrir y al cerrar, el
  segmentado, el apretón, el aviso al entrar y al salir, la agenda al tildar y copiar; y un video de cada
  recorrido. Mirados uno por uno.

## Fuentes

Leídas el 25 de septiembre de 2026.

- Bencho: <https://bencho.dev/>, <https://bencho.dev/licence>, <https://bencho.dev/sitemap.xml> y cada
  bloque en `https://bencho.dev/?c=<id>` (`liq-toggle`, `icon-bar`, `magnet-select`, `liq-create`,
  `checklist`, `toasts` y los de apretar), con su JS público (`index-BFyh4sKd.js`, el registro de bloques)
- W3C, WCAG 2.2 (2.3.3, 2.5.7 y 2.5.8): <https://www.w3.org/TR/WCAG22/>
- MDN, `:active-view-transition`: <https://developer.mozilla.org/en-US/docs/Web/CSS/:active-view-transition>;
  `@starting-style`: <https://developer.mozilla.org/en-US/docs/Web/CSS/@starting-style>;
  especificidad de `:where()` y `:is()`: <https://developer.mozilla.org/en-US/docs/Web/CSS/:where>
- Los resortes de Material 3 y el arnés: [0066](0066-las-transiciones-del-celular.md)
