# 0068. La mesa y el plano: la app se apoya en una mesa y los dibujos tienen su lámina

- Estado: aceptada
- Fecha: 2026-09-24
- Corrige al [0016](0016-el-cobro-y-el-rechazo-que-encuentra-al-usuario.md) y al
  [0023](0023-sesion-bloqueo-con-huella-y-passkeys.md): el corte del despiece y el canto del acceso
  nunca se vieron en el build, y ahora corren.
- Enmienda al [0013](0013-shell-navegacion-e-inicio.md) (la cápsula del destino activo, y el riel y la
  barra lateral sobre la mesa), al [0020](0020-pulido-visual.md) (la rampa del oscuro, el papel en
  `#171717`, la mesa y los radios) y al [0062](0062-el-reparto-en-la-compu.md) (las separaciones, y
  `SeccionEnFila` como tarjeta). Sigue al [0066](0066-las-transiciones-del-celular.md): el lienzo de las
  transiciones pasa a la mesa y el encabezado de la ficha, que es donde termina la tarjeta de la lista,
  es una tarjeta.
- Enmendado el 2026-09-25 por el [ADR 0069](0069-el-dibujo-del-trabajo-del-cliente.md): «Tu mueble»
  dibuja el proceso del trabajo (`TrabajoEnEtapa`) y no un mueble, Gracias es una tarjeta firmada, y el
  lienzo centra el dibujo también de costado. `MuebleEnEtapa` y `Carcasa` ya no existen.
- Enmendado el 2026-09-25 por el [ADR 0073](0073-la-app-se-llama-numa.md): el «MAUN» de la barra
  lateral (sección 6) y el del panel de acceso (sección 15) pasan a ser el logotipo de NUMA, a la altura
  de sus mayúsculas, y el menú de «Cargar algo nuevo» pasa de `top-[81px]` a `top-[71px]`, a los mismos
  15 px del botón. La firma «Taller MAUN» de `/v/` y `/o/` no cambia: es del taller.
- Enmendado el 2026-09-25 por el [ADR 0074](0074-lo-que-responde-al-tocar.md): además de las cuatro
  cosas de la sección 11 se mueven, al tocarlas y hasta quedar quietas, el apretón de los botones y los
  chips, la perilla del interruptor, el fondo del elegido de los segmentados de un renglón, el menú del
  «+», la tilde y el tachado de lo recién tildado y la tilde de «Copiado». Los avisos entran y se van
  animados aunque los dispare la cola o el reloj: son la excepción declarada. El interruptor de los
  archivos que ve el cliente deja el `bg-hogar` y pasa a tinta.

## Contexto

En un pedido anterior se armó un sistema de ilustraciones propio: dibujos de línea en isométrica que
parecen un plano del taller, con una sola tinta y el color de los tesoros solo en el canto de las
piezas. Puestos en la app de ese momento no encajaban. En Inicio, el tablero dibujado flotaba en el
medio de la nada, porque la app no estaba pensada para tener dibujos: pantallas blancas, secciones
separadas por líneas o por cajas grises, radios de 2 a 6 px. Un dibujo necesita un lugar que lo
contenga, y la app no tenía ninguno: todo era el mismo blanco, así que el dibujo quedaba suelto sobre
la misma superficie que el texto y los montos.

El pedido: un rediseño de la app entera, en el celular, la tablet y la compu, para que los dibujos
tengan un lugar propio y la app se vea moderna y cuidada, con la funcionalidad exactamente igual y sin
textos nuevos, salvo los de la portada de Inicio y los rótulos de los dibujos. Lo que más importa es el
celular. No toca la base.

El pedido llegó en dos partes, porque el primer mensaje se cortó en los 50.000 caracteres. La primera
parte (secciones 1 a 6) es la base: el corte que no se animaba, el módulo, la mesa, las piezas, la
navegación y el corte del mes. La segunda (secciones 7 a 12) pone los dibujos en su lugar: la portada,
el despiece, los vacíos, los avisos, la revisión pantalla por pantalla, el e2e y lo que queda escrito.

## Lo investigado

Las fuentes se leyeron el 24 de septiembre de 2026, en el relevamiento del pedido. Las direcciones
están al final.

### Dónde ponen los dibujos los sistemas y las apps

- Los dibujos van en los momentos sin datos (vacíos, errores, primer uso y éxito), de un solo concepto.
  Atlassian avisa que «Excessive illustrations increase cognitive load»; Carbon pide solo texto cuando
  varios bloques de un tablero están vacíos a la vez; Stripe usa, para un vacío por filtro, un mensaje
  compacto sin imagen y sin «crear el primero».
- Un dibujo bien integrado va dentro de un componente que le reserva el lugar, con pocos tamaños fijos
  (GitLab reserva 72, 144 y 288 px; Polaris, 226) y el título al lado (SLDS lo exige). En pantallas
  anchas, Carbon pone el dibujo a la izquierda del bloque, como un solo bloque.
- La evidencia: los «detalles seductores» distraen en tareas de carga alta (Harp y Mayer, 1998) y lo
  pertinente al contenido ayuda (Brom y otros, 2018: d = 0,32 en comprensión). Por eso las pantallas de
  números quedan limpias y el tablero del despiece, que es el gráfico mismo, sí va.

### La accesibilidad

Coinciden todos: el dibujo es decorativo (Atlassian, Polaris, Carbon, IBM, SLDS, GitLab) y va afuera
del árbol de accesibilidad; Apple pide sacar de VoiceOver lo decorativo. El texto que importa va al lado
del dibujo, nunca adentro.

### iOS 26 y Material 3 Expressive

Los dos separan la navegación del contenido en su propia capa, con las esquinas de adentro siguiendo
la curva de afuera. Los dos llevan la acción principal aparte, a la derecha de la barra. La barra de
MAUN ya era una píldora que flota con el + en el medio: de ahí sale solo la cápsula del destino activo.

### El vidrio, con medida

NN/g criticó en 2025 que el vidrio de iOS 26 prioriza el espectáculo sobre la lectura: el contenido que
pasa por debajo le baja el contraste a los rótulos. La barra de MAUN ya tenía un vidrio chico (papel al
80 % con desenfoque) y queda así; no se suma vidrio en ningún otro lado.

### Las superficies tonales y los radios concéntricos

Material 3 separa los planos con superficies de distinto tono en vez de sombras, con radios de 16 a 20
en tarjetas y 28 en hojas. Las esquinas concéntricas (el radio de adentro es el de afuera menos la
distancia entre los dos) son las que usan iOS 26 y Material 3 para que una pieza anidada se lea como
parte de la de afuera: la lámina (14) adentro de la tarjeta (20, con 6 de relleno), la cápsula del
destino activo (50 de alto) adentro de la píldora (62, con 6 alrededor).

## Decisión

### La regla que manda

**La mesa y el plano.** El fondo de toda la app pasa a ser una mesa de trabajo, un gris cálido apenas
marcado. Lo que se lee y se toca va en tarjetas de papel apoyadas encima, con un borde de un pelo y
radio 20. Los dibujos son planos, y un plano siempre está sobre una **lámina**: una placa con la grilla
de puntos de la isométrica, adentro de una tarjeta y pegada a su título. Ningún dibujo va suelto; a lo
sumo una lámina por pantalla, con `aria-hidden` y su texto al lado. El color entra por el canto: los
tesoros pintan el canto de las piezas del tablero y el de sus propias tarjetas, y nada más cambia de
color. Todo sale de los tokens.

### 1. El corte vuelve a moverse

**El corte nunca se había visto en producción.** `@keyframes maun-corte` vivía adentro de
`@theme static` y lo nombraban solo los `style` en línea de `DistribucionDespiece` y
`PantallaDeAcceso`. Tailwind 4 emite los `@keyframes` de `@theme` solo si el CSS los nombra (con una
variable `--animate-*` o una declaración `animation`), y un `style` en línea no cuenta: el CSS del build
no los tenía. `--animate-maun-corte` los hace emitir. `cobro.spec.ts` mide que, al volver de confirmar
un cobro, las piezas de «Distribución de la ganancia» tengan `maun-corte` corriendo, y `acceso.spec.ts`,
que el canto lo tenga la primera vez. Sin la variable, el del canto falla: se probó sacándola.

### 2. Los dibujos en el sistema de diseño

El módulo de ilustraciones (`packages/ui/src/ilustracion/`), `TarjetaConLamina` y `EstadoVacio` entran
tal como vinieron, con sus 44 tests, y se exportan desde `@maun/ui`. `theme.css` suma `maun-trazo`,
`--dur-trazo` (cero con `prefers-reduced-motion`), las reglas de `.ilustracion` y las de `.lamina`, afuera
de los bloques que escribe `pnpm --filter @maun/ui resortes`.

### 3. La mesa: los tokens

Los tokens cambian en `theme.css` y todo lo que ya usaba tokens cambia solo.

| Token                                       | Antes (claro / oscuro) | Ahora (claro / oscuro)                                 |
| ------------------------------------------- | ---------------------- | ------------------------------------------------------ |
| `--color-mesa` (nuevo)                      | —                      | `#f2f1ed` / `#0b0b0b`                                  |
| `--color-lamina` (nuevo)                    | —                      | `#f7f6f2` / `#111111`                                  |
| `--color-paper`                             | `#ffffff` / `#121212`  | `#ffffff` / `#171717`                                  |
| `--color-surface`                           | `#f4f4f4` / `#1c1c1c`  | `#f4f4f4` / `#1f1f1f`                                  |
| `--color-surface-2`                         | `#f0f0f0` / `#232323`  | `#f0f0f0` / `#262626`                                  |
| `--color-surface-3`                         | `#fafafa` / `#171717`  | `#fafafa` / `#1b1b1b`                                  |
| `--color-elevado`                           | `#ffffff` / `#2e2e2e`  | `#ffffff` / `#303030`                                  |
| `--color-hairline`                          | `#e4e4e4` / `#2a2a2a`  | `#e6e4df` / `#2a2a2a`                                  |
| `--color-hairline-soft`                     | `#efefef` / `#212121`  | `#efede9` / `#222222`                                  |
| `--color-border`                            | `#d9d9d9` / `#3d3d3d`  | `#d9d9d9` / `#3f3f3f`                                  |
| `--color-text-3`                            | `#8a8a8a` / `#7a7a7a`  | `#6d6d6d` / `#868686`                                  |
| `--punto-de-la-lamina` (nuevo)              | —                      | `rgba(20, 20, 20, 0.14)` / `rgba(237, 237, 237, 0.11)` |
| `--text-h1` / `--text-h1-lg`                | 26 / 30 px             | 30 / 36 px                                             |
| `--text-section`                            | 15 px                  | 17 px                                                  |
| `--text-portada` (nuevo)                    | —                      | 26 px                                                  |
| Radios control, field, panel, dialog, sheet | 2, 4, 6, 8, 12 px      | 8, 12, 20, 24, 28 px                                   |
| `--radius-lamina` (nuevo)                   | —                      | 14 px                                                  |
| `--page-pad-mobile`                         | 20 px                  | 16 px                                                  |

- **El oscuro sube el papel a `#171717`** para que la tarjeta se despegue de la mesa, y por eso corre
  toda la rampa de grises. `--paper-notas` del oscuro queda como estaba.
- **Contraste, medido con la fórmula de WCAG 2.2:** `text-3` da 5,17:1 sobre el papel claro y 4,58:1
  sobre la mesa clara (el `#8a8a8a` de antes daba 3,05 sobre la mesa); en oscuro, 4,92 sobre el papel y
  5,41 sobre la mesa. Los tesoros del oscuro siguen siendo los de siempre y sobre `#171717` dan 8,51
  (hogar), 7,64 (maun), 7,33 (diezmo) y 7,20 (cocos).
- **El `body` es la mesa y el `<main>` sigue sin fondo propio**: con un fondo, cambiaría la foto de la
  raíz en todos los movimientos del celular. `transiciones.css` pinta la mesa, no el papel, debajo de la
  pantalla que se mueve en el empuje y en la vuelta.
- **La barra de estado toma el color de la mesa.** Dos `meta name="theme-color"` con `media`, arriba del
  script que elige el tema; el script y `elegirTema` las pisan cuando el tema es forzado y con «según el
  sistema» cada una vuelve a la suya. El manifiesto pasa a `#f2f1ed`. Son los únicos hex fuera de
  `theme.css`: ahí no hay CSS.
- **En claro, los grises casi no se distinguen de la mesa** (`surface-2` queda a 3/255, `surface` a 7,
  `surface-3` a 13). Adentro de una tarjeta siguen igual; sobre la mesa, un bloque gris pasa a papel y un
  fondo hundido, un esqueleto, un hover o una insignia pasan a `bg-ink/5` o `bg-ink/6`.
- **Los radios nuevos deformaban formas chicas**, que quedan fijas: la casilla de «varias» en
  `rounded-[4px]` contra el círculo de «una», las leyendas y las barras de los gráficos en `rounded-[2px]`,
  los colores de la lista del despiece en `rounded-[3px]`, y las fichas de ícono de 36 px en
  `rounded-field`. La punta de la capa del día baja a `anchor(top) + 20px`, porque a 11 caía en la curva.

### 4. Las recetas

- **La tarjeta** es `rounded-panel border border-hairline bg-paper`, siempre las tres juntas y sin
  sombra: de contenido con `px-4 py-4 md:px-5`, de lista con `px-4` y renglones
  `border-t border-hairline-soft first:border-t-0`, con lámina con `p-1.5`. **Nunca una tarjeta adentro de
  otra**: lo de adentro va en `rounded-field`. Sobre la mesa, sin tarjeta, van el header de las pantallas
  de lista, los títulos que agrupan tarjetas, las cabeceras de día, el volver, las herramientas de las
  fichas y los botones sueltos. Las tarjetas apiladas se separan con `gap-3 md:gap-4` en su contenedor.
- **`Button` es una cápsula** y suma `variant="herramienta"` con `size="herramienta"`: un círculo de
  44 px con el ícono, que con `className="sm:px-4"` pasa a cápsula con texto desde `sm`. Deshabilitada
  conserva su forma. Los altos y los rellenos de los demás tamaños no cambian (0033).
- **`SeccionesEnFilas`**: cada sección es una tarjeta a todo el ancho, sin el tope de 560 ni la línea
  de arriba, separadas con `gap-3` y `gap-4` desde 40rem; desde 44rem sigue con sus dos columnas
  adentro. **`PrincipalYApoyo`** junta las columnas (`gap-x-4`) y separa por defecto con `gap-y-3`; como
  su test prohíbe `md:` en la grilla, las pantallas que lo usan le pasan
  `separacion="gap-y-3 @min-[40rem]/apoyo:gap-y-4"`. **`BloquePlegable`** es tarjeta por defecto y
  `enTarjeta={false}` lo anida. **`PanelDeAvisos`** es una tarjeta con su tinte en las fichas y
  `anidado` en Ajustes.
- **Botones, chips, insignias y buscadores son cápsulas**; los segmentados llevan pista `bg-ink/6 p-1`
  con el elegido en `bg-elevado shadow-float` (en cápsula los de un renglón; en `rounded-panel` con
  segmentos de 16 px los que pueden partirse). En las pestañas de Proyectos y de Opiniones el fondo del
  elegido sigue siendo el `span` aparte, sin transición (0066). Desde el
  [ADR 0074](0074-lo-que-responde-al-tocar.md), en los de elección única de un renglón el
  `bg-elevado shadow-float` es `FondoDelElegido`, un fondo aparte que viaja a la opción nueva cuando el
  dedo la cambia; los que pueden partirse cambian de golpe como antes.
- **El vacío por un filtro o una búsqueda es una caja punteada**, sin dibujo y sin botón de crear.
- **El encabezado de cada ficha es una tarjeta**, con el cliente, el título, el estado, la marca de
  liquidación, la nota de «Pasó de Consultas…» y las fechas, y lleva el único `data-destino-de` de la
  ficha: es donde termina el movimiento de la tarjeta de la lista (0066), que tiene el mismo ancho
  (358 px a 390) y el mismo radio. Es una caja de verdad, pintada desde el primer cuadro, sin sombra, sin
  anillo y sin `hover`.
- **Sobre la mesa, el `hover` es `bg-ink/5`**: el arnés de las transiciones compara píxeles con el
  puntero quieto sobre la barra lateral.

### 5. La lámina, `TarjetaConLamina` y `EstadoVacio`

- **`Lamina`** es la placa: `aria-hidden`, `data-lamina`, `--color-lamina` con la grilla de puntos de la
  isométrica (`--punto-de-la-lamina`, cada 24 × 13,86 px, que es el paso de la isométrica), y el radio
  `--radius-lamina`, que es el de la tarjeta menos su relleno. Centra el dibujo y lo achica con
  `max-width` y `max-height` si no entra.
- **`TarjetaConLamina`** es la tarjeta con la lámina y su columna de texto. Es el contenedor
  `con-lamina`: por debajo de 40rem la lámina va arriba (196 px de alto) y el texto abajo; desde 40rem,
  lado a lado, con la lámina de por lo menos 280 px. **Es el único contenedor que existe en todos los
  anchos**, porque no es un reparto: decide dónde va el dibujo respecto de su texto.
- **`EstadoVacio`** es la tarjeta con una escena, un `h2` y su texto, y las acciones como hijas. **Es una
  `section` con nombre, o sea una región**, donde antes los vacíos eran un `div` o una `section` sin
  nombre: es el único rol que suma el rediseño. Se nombra por su `h2`, o por `etiqueta` (la Agenda
  conserva «El mes está vacío»).
- **El título de lámina** es `font-display text-lema leading-tight text-pretty
@min-[40rem]/con-lamina:text-portada`, sin `font-semibold`, porque Young Serif tiene un solo peso. Lo
  usan `EstadoVacio`, el arranque y todos los avisos; en la app vive en `TITULO_DE_LAMINA`, junto con el
  ancho de las escenas (`ESCENA_EN_LA_LAMINA`, 208 px y 240 desde 40rem).
- **Los avisos llevan la lámina primero, afuera del `role="alert"`.** El `Aviso` de `shared/ui` (el de
  `ErrorDeCarga`) arma su `<main>` y adentro una `TarjetaConLamina` con `se-corto`; en su columna va el
  alerta con el `h1`, el mensaje y el detalle, y abajo, afuera del alerta, la `FilaDeAcciones`. Los
  avisos de `/v/` y `/o/` tienen arriba la firma del taller sobre la mesa y abajo la tarjeta: el enlace
  muerto con `anulado`, sin señal con `sin-senal`, el error con `se-corto`. «Ese trabajo no está», adentro
  de la app, sale del mismo aviso. «Ese proyecto no está» y «Ese cliente no está» llevan `anulado`, con
  su `h1`, su texto y su botón adentro de la tarjeta.
- **Gracias** lleva el mueble con la tilde (`gracias`, que se traza una vez al llegar) en una
  `TarjetaConLamina` debajo de la marca del taller, y la reseña en su propia tarjeta. En la vista previa
  del editor aparece adentro de una hoja: es la única excepción a «las hojas no llevan dibujo», porque
  ahí se muestra la página del cliente tal cual.
- **«Tu mueble»**, en la página del cliente, es una `TarjetaConLamina` con el mueble en la etapa del
  trabajo (`etapaDelMueble`) y todo lo que tenía, sin cambios, en la columna de texto. Los renglones con
  línea arriba suman `self-stretch`, porque la columna es `items-start` y la línea quedaba del ancho del
  texto. El dibujo no tiene texto, así que el `innerText` de «Tu mueble» sigue siendo el mismo en la app
  y por el enlace.
  - **Enmendado por el [ADR 0069](0069-el-dibujo-del-trabajo-del-cliente.md).** El mueble de la etapa
    era siempre el mismo, y el cliente de una cocina veía una cómoda. La lámina dibuja el proceso: el
    anotador, el presupuesto, el presupuesto con la seña encima, el serrucho, la casa y la casa con la
    tilde, según `etapaDelDibujo`. Gracias, una tarjeta firmada.

### 6. La barra del celular

La barra queda en su lugar, con sus cuatro destinos y el + montado en el medio de la píldora, como la
tiene en la mano el dueño. Cambia solo el adentro de los destinos: el activo lleva una cápsula `bg-ink/7`
de 50 px adentro de la píldora de 62, con 6 px arriba, abajo y en las puntas, donde su curva sigue la de
la píldora. El riel y la barra lateral pierden el fondo y el borde y quedan sobre la mesa; el destino
activo es una cápsula de papel, y en el riel Ajustes también se marca cuando está activo.

Medido en Chromium con la letra real, por `rediseno.spec.ts`: el ancho de cada botón y el de su
etiqueta en semibold, con ese destino activo, medida con un `Range` sobre el texto:

| Ancho | Inicio y Finanzas | Proyectos y Clientes | «Proyectos» | «Clientes» | «Finanzas» | «Inicio» |
| ----- | ----------------- | -------------------- | ----------- | ---------- | ---------- | -------- |
| 320   | 47 px             | 53 px                | 50,5 px     | 41,6 px    | 45,6 px    | 29 px    |
| 360   | 57 px             | 63 px                | 50,5 px     | 41,6 px    | 45,6 px    | 29 px    |
| 390   | 64,5 px           | 70,5 px              | 50,5 px     | 41,6 px    | 45,6 px    | 29 px    |

El + queda centrado (0 px corrido) y 15 px arriba de la píldora en los tres anchos, sin pisar ningún
destino, y el centro de cada botón toca ese botón. A 320 el botón de «Proyectos» mide 53 y su etiqueta
50,5: entra con 1,25 px de cada lado. En la barra
lateral, «MAUN» en 36 px agranda su renglón 9 px y el menú de «Cargar algo nuevo» pasa de `top-[72px]` a
`top-[81px]`: sigue a 15 px del borde de arriba del botón. **Enmendado por el
[ADR 0073](0073-la-app-se-llama-numa.md)**: el logotipo de NUMA deja el renglón en el alto del enlace
(44 px) y el menú pasa a `top-[71px]`, medido otra vez a 15 px del botón.

**La barra vuelve después del toque, no en el medio.** Se escondía al enfocar un campo y volvía en el
`focusout`. Con el rediseño, en la ficha de un contacto el botón «Anotar el relevamiento» quedó en
791–835 px de una pantalla de 844, justo donde vuelve la barra: el `mousedown` sobre el botón sacaba el
foco de la fecha, la barra aparecía encima y el `mouseup` caía sobre ella, así que el formulario no se
mandaba. `hecho-y-marcado.spec.ts` lo encontró en el celular. Ahora, si hay un botón apretado, la barra
espera a que se suelte, y en todos los casos vuelve en la tarea siguiente, cuando el toque ya llegó a su
botón. Mientras se escribe se sigue escondiendo igual. Por eso el test de la barra en
`Navegacion.test.tsx` espera su vuelta con `findByRole` en vez de `getByRole`, y suma uno con relojes
falsos que mide el orden.

### 7. La portada de Inicio y el corte del mes

**Inicio abre con lo que dejó el mes**: lo cobrado en los trabajos cerrados, cortado por tesoro. Es el
mismo despiece de la ficha (0016), sumado por mes, y no toca la base.

- `distribucionCongelada(proyecto)` sale de `despieceDelProyecto`: la distribución de la fila de un
  trabajo liquidado, o nada.
- `corteDelMes(replica, mes)` suma los cobrados y los perdidos con `fecha_cobro` en el mes, **también los
  repartidos en la apertura**: el trabajo se cerró ese mes y su despiece es ese, igual que para el sueldo
  del mes. Hogar es el sueldo; Maun, los fijos más el remanente cuando es positivo (el negativo cuenta
  cero, como en el despiece); Diezmo, el diezmo. Los gastos son lo cobrado menos las tres partes: lo que se
  fue en materiales y no llegó a ningún tesoro. Un trabajo con más gastos que lo cobrado cuenta, sus
  partes dan cero y lo cobrado va entero a gastos.
- `piezasDelCorte` arma las piezas del tablero (hogar, maun, diezmo y gastos, en ese orden y solo las
  que no son cero; los gastos van sin color, con el canto crudo y rayado) y `fraseDelCorte` lo cuenta. La
  pieza usa el nombre del tesoro («Maun 26%»); la frase habla como el resto de la app, que a esa caja le
  dice el taller («26% al taller»). Una parte que redondea a cero dice «menos del 1%», y ningún
  porcentaje lleva espacio antes del signo.
- **`PortadaDeInicio`** va apenas abajo del `header`, antes de los tesoros: una `TarjetaConLamina` con su
  `h2`, en tres estados que ocupan el mismo lugar con la misma forma. **El corte**: «El corte de
  septiembre», la frase en Young Serif, y en la lámina el tablero cortado con la medida de lo cobrado
  (la cota) desde la tablet. **Sin corte** (ningún trabajo cerrado en el mes, o nada cobrado): el mismo
  `h2`, la frase y el tablero entero con los ejes por donde se va a cortar. **El arranque** (falta
  configurar, y gana aunque haya corte): «El taller arranca acá» con el título de lámina, el párrafo y
  los dos botones de siempre, y el tablero con la escuadra, el lápiz y la primera marca. La sección del
  arranque que estaba abajo de las tarjetas se va, porque subió entera.
- **Se corta una vez por sesión**, con una bandera de módulo como la del canto del acceso. Mientras la
  bandera esté sin marcar, la portada le pasa `animar` al tablero cortado o a la marca del arranque, y
  la marca en cuanto se muestra uno de los dos. El tablero sin cortar no se mueve ni la gasta, así el
  primer corte de la sesión se ve aunque Inicio se haya abierto antes sin corte.

### 8. El despiece es el tablero

La distribución de la ganancia deja de ser una barra y pasa a ser el tablero: en proyección, el plano de
trazos; al cobrar, cortado en las piezas de cada tesoro con su canto. Es el mismo dibujo que la
portada, en chico, para un solo trabajo. La sección «Distribución de la ganancia» es una tarjeta con
lámina propia (`p-1.5`): arriba la cabecera con la neta, en el medio la lámina (176 px, 216 desde la
tablet), abajo la lista de piezas y las notas. Con la neta en cero o menos, en el lugar de la lámina va
una caja punteada, sin dibujo.

Las piezas llevan un nombre corto (`Diezmo`, `Sueldo`, `Costos fijos`, `Remanente`), porque la etiqueta
del diezmo ya lleva su tasa y el rótulo diría «Diezmo 10% 10%». El `detalle` de cada pieza es el `title`
que tenía cada segmento de la barra: el globito al pasar el mouse sigue estando, también en proyección,
donde cada pieza de trazos toma el mouse en toda su cara. Una liquidación en cola es real, así que
también se corta. Los que lo usaban sacan su tarjeta de alrededor.

### 9. Las escenas

Llevan lámina solo las pantallas enteras vacías y los avisos que ocupan la pantalla, más la portada, el
despiece, «Tu mueble» y Gracias. Las escenas son estáticas: el paso 09 del arnés de las transiciones cae
en Historial vacío, y el vacío tiene que estar pintado desde el primer cuadro.

| Dónde                            | Escena                            | Qué dibuja                                                                | Por qué                                                                 |
| -------------------------------- | --------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Proyectos, Activos vacío         | `sin-proyectos`                   | el mueble en plano, de trazos, con su cota                                | un trabajo activo empieza siendo un plano que todavía no se construyó   |
| Proyectos, Historial vacío       | `sin-historial`                   | el tablero entero, con los ejes por donde se va a cortar                  | el historial es lo cobrado, y cobrar es cortar el tablero               |
| Consultas vacía                  | `sin-consultas`                   | el metro plegable                                                         | una consulta es la visita: antes que nada, se mide                      |
| Seguimiento vacío                | `sin-seguimiento`                 | la hoja de un presupuesto con la esquina doblada                          | el seguimiento es un presupuesto que espera                             |
| Clientes vacía                   | `sin-clientes`                    | la agenda del taller, cerrada, con su etiqueta y sus pestañas             | es lo que dice el título: «La agenda del taller, todavía vacía»         |
| Finanzas sin movimientos         | `sin-movimientos`                 | la pila de tableros, sin tocar                                            | la plata del taller todavía no se movió                                 |
| Opiniones, Resultados sin enviar | `sin-opiniones`                   | el mueble terminado con una etiqueta de tres circulitos sin marcar        | reemplaza los tres circulitos que ya estaban ahí, ahora con su mueble   |
| Agenda vacía, en el celular      | `agenda-vacia`                    | la hoja del mes vacía, con un día rodeado a mano                          | es la agenda de papel del taller; la grilla de la compu ya es el dibujo |
| Enlace muerto, «no está»         | `anulado`                         | la hoja con el plano tachado a mano                                       | lo que había ahí se dio de baja                                         |
| Sin señal                        | `sin-senal`                       | la hoja con el plano de trazos                                            | el trabajo está, pero no llega: se ve el contorno y no el mueble        |
| Error de carga y de los enlaces  | `se-corto`                        | la hoja partida en dos con el eje del corte                               | se cortó algo en el medio, y el enlace sigue sirviendo                  |
| Gracias                          | `gracias`                         | la tarjeta de agradecimiento con la firma que se traza (ADR 0069)         | el cliente terminó; el taller le agradece de su puño                    |
| «Tu mueble»                      | `TrabajoEnEtapa`                  | lo que está sobre la mesa en cada etapa, sin mueble (ADR 0069)            | el cliente ve en qué anda su trabajo, sea cual sea el mueble            |
| Portada de Inicio                | `TableroCortado`, `TableroEntero` | el corte del mes, el tablero sin cortar o el tablero con las herramientas | es el gráfico mismo: qué parte de lo cobrado fue a cada tesoro          |
| Despiece de la ficha             | `TableroCortado`                  | el tablero de un trabajo, de trazos o cortado                             | es el gráfico mismo, para un solo trabajo                               |

No llevan dibujo: los vacíos de una búsqueda o de un filtro (Finanzas con un filtro puesto es la caja
punteada con «Nada con esos filtros»), un vacío adentro de una sección que tiene otras cosas (los pagos
de una obra, los trabajos de un cliente, lo generado del diezmo), las hojas salvo Gracias en la vista
previa, las tarjetas de contenido y de lista, los esqueletos, `SinRespuestas` (que pasa a una tarjeta de
contenido con su `h2` en Young Serif) y `LoQueContestaste`.

### 10. El color, por el canto

Los tesoros no tiñen tarjetas ni láminas. Pintan el canto de las piezas del tablero cuando lo que se
dibuja es plata, y el canto de sus propias tarjetas (las marcas chicas de siempre, como las barras de
progreso o los cuadraditos de la lista del despiece, siguen con su color): las cuatro de Inicio y «Estado del diezmo» son papel con
5 px del color del tesoro abajo, en un `span` `aria-hidden` sin texto, y 4 px más de relleno abajo. El
Hogar en negativo sigue con su losa, porque ahí el color es la alerta.

### 11. El movimiento

Se mueven cuatro cosas, y ninguna en loop, al pasar el mouse ni al scrollear:

- **el corte de la portada**, una vez por sesión (sección 7);
- **el despiece**, al volver de confirmar un cobro (0016);
- **el canto del acceso**, una vez por carga (0023);
- **la tilde de Gracias** y **la marca del arranque**, que se trazan una vez al aparecer.

Con `prefers-reduced-motion`, `--dur-corte`, `--dur-corte-stagger`, `--dur-trazo` y `--dur-medium` valen
cero y el barrido global deja cada animación en 0,01 ms: todo aparece hecho.

**Enmendado por el [ADR 0074](0074-lo-que-responde-al-tocar.md)**: la regla sigue siendo que nada se
mueve por su cuenta, en loop, al pasar el mouse ni al scrollear, pero ya no son cuatro cosas. Lo que
responde al dedo se mueve y termina quieto (el apretón, el interruptor, el fondo del segmentado, el
menú del «+», la tilde y el tachado, «Copiado»). **Los avisos son la excepción**: entran desde abajo y
se van con un fundido aunque los dispare la cola o el reloj, y uno que nace durante una transición de
pantalla entra quieto. El barrido de menos movimiento suma `animation-iteration-count: 1`, y los tres
loops que no tenían guarda van con `motion-safe:`.

### 12. La accesibilidad

- **Cada lámina es `aria-hidden`**, y el dibujo no aparece en el árbol de accesibilidad: lo que dice
  está en el texto de al lado. Los rótulos y la cota de los tableros son texto nuevo, pero adentro de algo
  `aria-hidden`: el lector de pantalla no los lee. El `<title>` de cada pieza del despiece es solo para el
  mouse; la misma información está en la lista de piezas de abajo.
- **`EstadoVacio` suma una región con nombre** en cada pantalla vacía. Es el único rol nuevo.
- **La Agenda vacía pasa su título de `<p>` a `h2`**, y la sección conserva su nombre.
- **Los avisos dejan el dibujo afuera del `role="alert"`**, con un solo `h1`: el alerta se anuncia igual
  que antes.
- **El orden del DOM es el que se ve.** La portada va entre el `header` y los tesoros; el arranque subió
  con sus botones, que siguen antes de los tesoros en el DOM.

### 13. El peso

Medido con `pnpm --filter @maun/web build` en `main` (`a289e82`) y en esta rama, con la novedad incluida:

| Archivo                  | `main`                  | Esta rama               | Diferencia             |
| ------------------------ | ----------------------- | ----------------------- | ---------------------- |
| `index.html`             | 1,87 kB (0,82 gzip)     | 2,30 kB (0,94 gzip)     | +0,43 kB (+0,12 gzip)  |
| CSS (`index-*.css`)      | 95,99 kB (18,75 gzip)   | 100,82 kB (19,90 gzip)  | +4,83 kB (+1,15 gzip)  |
| `ui-*.js`                | 124,22 kB (40,18 gzip)  | 142,54 kB (45,75 gzip)  | +18,32 kB (+5,57 gzip) |
| `index-*.js`             | 629,73 kB (173,43 gzip) | 638,96 kB (175,40 gzip) | +9,23 kB (+1,97 gzip)  |
| `crear-cuenta-*.js`      | 2,70 kB                 | 2,71 kB                 | +0,01 kB               |
| `vendor-*.js` y el resto | sin cambios             | sin cambios             | —                      |

- **El módulo quedó en el chunk `ui`**, el de `@maun/ui` (`manualChunks`, 0015): ahí están `data-lamina` y `maun-corte`. Los 5,57 kB comprimidos de ese chunk son los dibujos, la lámina, `TarjetaConLamina` y `EstadoVacio`.
- **Las dos páginas de afuera** (`/v/` y `/o/`) no tienen chunk propio: bajan el mismo `index.html`, el CSS, `ui`, `index` y `vendor` que la app. Antes no dibujaban nada y ahora suman 8,8 kB comprimidos (de 454,0 a 462,8 kB entre todo), que es la diferencia entera de la app.
- El CSS crece por la mesa, las reglas de `.ilustracion` y `.lamina`, los dos `@keyframes` que ahora sí se emiten y las utilidades de las variantes de contenedor.

### 14. Cómo responde a cada ancho

- **La tarjeta con lámina** apila el dibujo arriba por debajo de 40rem de tarjeta y lo pone al lado desde
  40rem, por el contenedor `con-lamina`. A 390 la lámina mide 196 px de alto, y a 768 con el riel la
  portada todavía apila (la tarjeta mide 604 px). La maqueta a 834 la muestra en dos columnas; ese ancho
  no se midió.
- **El formato del tablero sale de `useAnchoDePantalla`**, el mismo hook con el que Inicio decide su
  encabezado: `medio` en el celular (solo porcentajes) y `amplio` desde la tablet (nombre y porcentaje
  cuando entran). La portada agranda el dibujo a 400 px solo cuando la tarjeta mide más de 64rem
  (`@min-[64rem]/con-lamina:[&>svg]:w-[400px]`); por debajo entra con su tamaño, y si no entra lo achica
  el `max-width`.
- **El despiece elige por la ventana a propósito.** El `CLAUDE.md` de la web pide consultas de
  contenedor para lo que vive en una columna, y el despiece vive en una. Pero el formato es una prop del
  dibujo, no una clase: cambia la geometría del `svg` (el largo del tablero, el tamaño de la letra de los
  rótulos, cuáles entran). Elegirlo por el contenedor pediría medirlo con un `ResizeObserver` y dibujar
  dos veces. Desde 768 la columna del despiece mide más que el tablero `amplio` (306 px con su aire,
  según el mapa B), y por debajo el tablero `medio` entra en 320; la lámina achica el dibujo con
  `max-width` si hiciera falta.

### 15. Las páginas de afuera y las pantallas de sesión

- `/v/` y `/o/` también van sobre la mesa, con sus secciones en tarjetas. La firma «Taller MAUN» queda
  sobre la mesa, sin la línea de abajo.
- Las pantallas de sesión (entrar, crear cuenta, recuperar, nueva contraseña y el bloqueo) pasan su
  contenedor de `bg-paper` a la mesa, y `BloqueoAlVolver` también. El panel de la marca queda igual: su
  «MAUN» pasa de `text-h1-lg` (que creció a 36) a `text-[30px]` (desde el
  [ADR 0073](0073-la-app-se-llama-numa.md), el logotipo de NUMA de 23 px en ese mismo renglón), y su relleno de costado queda en 20 px
  aunque `--page-pad-mobile` bajó a 16. El `h1` de estas pantallas sube a 30 con el resto:
  `teclado.spec.ts` y `bloqueo.spec.ts` pasan a 390 × 460, así que queda así.
- Las hojas no cambian de estructura: toman los radios nuevos, 28 la que sube desde abajo y 24 la del
  centro, sin borde ni relleno nuevo.

## Alternativas descartadas

- **Un rediseño sin mesa, con los dibujos sobre el blanco.** Es lo que había, y es por lo que los dibujos
  flotaban: sin un plano distinto, el dibujo queda al mismo nivel que el texto y no pertenece a nada.
- **Las tarjetas con sombra en lugar de borde.** El arnés de las transiciones recorta las sombras (el
  grupo de la transición tiene `overflow: clip`) y compara píxeles; y el 0020 reserva las sombras para lo
  que flota (la barra, el +, los menús, los avisos). Una tarjeta apoyada en la mesa no flota.
- **Los tesoros con tinte en vez de canto.** Un fondo verde, ocre, violeta y azul en las cuatro tarjetas
  de Inicio compite con el tablero de la portada, que es donde el color cuenta algo. El canto dice de
  qué tesoro es la tarjeta sin pintar lo que se lee.
- **El + aparte, a la derecha de la píldora, como en iOS 26 y Material 3 Expressive.** Lo descartó
  quien pidió el rediseño: su hermano, que es quien usa la app todos los días, ya tiene la mano hecha al
  - del medio, y mover el botón más usado de la app le cambia ese gesto.
- **La barra de vidrio transparente.** NN/g mostró que el contenido que pasa por debajo le baja el
  contraste a los rótulos. La barra conserva su vidrio chico, casi opaco.
- **Las bibliotecas de ilustraciones, el 3D, la IA, Lottie y Rive.** Las bibliotecas no hablan el idioma
  del taller (personas, oficinas, plantas) y traen su propio color; el 3D y la IA no se pueden
  mantener a mano ni garantizar que sigan la tinta del tema; Lottie y Rive suman un runtime y un
  formato binario para cuatro movimientos que el CSS ya hace. El módulo propio pesa lo que pesa su SVG y
  sigue a los tokens.

## Cómo se suma una escena o una pantalla nueva

- **Una escena**: se dibuja en `packages/ui/src/ilustracion/escenas.tsx` con las piezas de
  `objetos.tsx` y `trazos.tsx`, sobre el lienzo de 160 × 120, con las clases de la gramática y sin
  colores; se suma a `ESCENAS` en `Ilustracion.tsx` y a la tabla de la sección 9, con qué dibuja y por
  qué. `Ilustracion.test.tsx` la recorre sola.
- **Una pantalla vacía**: usa `EstadoVacio` con su escena, su título y su texto, y se suma a `VACIAS`
  en `apps/web/e2e/reparto/rediseno.spec.ts` si tiene clave en `PANTALLAS`, o a `PANTALLAS` primero.
- **Un aviso que ocupa la pantalla**: una `TarjetaConLamina` con `TITULO_DE_LAMINA` en su `h1`, el
  dibujo afuera del alerta.

## Consecuencias

- La app tiene dos planos: la mesa y el papel. Cualquier bloque nuevo es una tarjeta con la receta, y
  cualquier dibujo nuevo va en una lámina.
- Los grises de superficie, en claro, casi no se ven sobre la mesa: sobre la mesa se usa `bg-ink/5` o
  `bg-ink/6`, y adentro de una tarjeta, los de siempre.
- El módulo de ilustraciones y las reglas de la lámina viven en `@maun/ui` y siguen al tema solos: el
  oscuro no pidió ningún cambio en los dibujos.
- `rediseno.spec.ts` entra en el arnés del reparto, y con él en `pnpm verify`: cada pantalla vacía, los
  avisos, la portada, el despiece y la barra quedan medidos.

## Objeciones

- **La tinta de atención (`#9a6700`) da 4,31:1 sobre la mesa clara**, un poco menos de 4,5. Sobre el
  papel está bien, y casi todo lo que la usa va adentro de una tarjeta; si aparece sobre la mesa un texto
  chico en ese color, conviene oscurecerla un punto.
- **El hover `bg-ink/5` sobre la mesa casi no se ve en oscuro.** Es a propósito (el arnés), y en el
  celular no hay hover.
- **Las herramientas de la ficha de obra entran a 320 con 3 a 4 px de sobra, y la etiqueta «Proyectos»
  de la barra, con 1,25 por lado.** Android puede redondear la letra distinto; si en el teléfono no
  entran, la fila de la ficha se parte en dos en vez de salirse, pero la barra no tiene a dónde ir.
- **El hover del último renglón de la tabla de Proyectos puede asomar en las puntas de abajo.** Las
  celdas de una tabla con `border-collapse` no aceptan radio; el encabezado sí se redondeó (14 px, el de
  la tarjeta menos su relleno). Es un gris casi blanco, solo con el mouse encima, en la compu.
- **«Tu mueble», en la compu, queda apretado.** La maqueta dibuja la página del cliente en una sola
  columna ancha, pero desde el 0062 «Cómo pagar» va en la columna de apoyo: «Tu mueble» vive en una
  columna de unos 670 px, la tarjeta pasa de 40rem y pone el dibujo al lado, y la columna de texto queda
  en unos 300 px. A 1440 el título ocupa tres renglones, «Lo estamos fabricando» dos, y el trío de montos
  se parte. No se sale nada; si molesta, el umbral de `TarjetaConLamina` tendría que ser una prop, y eso es
  tocar el zip.
- **Dos diferencias chicas con las maquetas del celular.** La tarjeta de un proyecto pone sus tres montos
  en dos columnas a 390, porque pasa a tres desde 23rem de tarjeta (el umbral de siempre, medido por
  `montos-en-las-tarjetas`); la maqueta la dibuja en tres. Y el botón de un vacío mide lo que su texto,
  como antes; la maqueta del celular lo estira a todo el ancho. Ninguna de las dos cambia algo que el
  pedido nombre, así que quedan como estaban.
- **Sin señal, en `/v/` y `/o/`, el título del aviso cae a la serif del sistema.** El cliente que abre el
  enlace por primera vez no tiene Young Serif guardada, y si la señal se corta antes de que llegue, el
  título y la firma se ven en la serif del teléfono. Antes pasaba solo con la firma; el título era IBM
  Plex, que ya estaba bajada. Se lee igual.
- **El corte al abrir Inicio puede cansar.** Es una vez por sesión y dura poco más de un segundo, pero
  la sesión en el celular es larga y se abre muchas veces: si molesta, se puede dejar solo para el primer
  corte de cada mes.
- **Nada de esto se probó en un teléfono de verdad.** La barra de estado del color de la mesa, la letra
  de la barra a 320 y el corte al abrir dependen del teléfono.

## Desvíos del pedido

- **El número.** El pedido llamaba a este ADR 0067, pero ese número lo tomó la #44 («la vista antes de
  aprobar»), mergeada el mismo día. Este es el 0068, y la rama, `feature/40-la-mesa-y-el-plano`.
- **El volver de las fichas va en `pr-1`**, no en `pr-2`: con `pr-2`, a 320, «Proyectos» se pasaba
  0,1 px y «Opiniones» 1,1. Con `pr-1` quedan 3,9 y 2,9 px libres, y la fila además se parte si una
  etiqueta no entrara.
- **Lo que se tocó del zip:** `TarjetaConLamina.tsx` y `TarjetaConLamina.test.tsx` no pasaban el
  Prettier del pre-commit por el largo de dos renglones. Se reacomodaron los renglones, sin cambiar una
  letra del código.
- **Los esqueletos**: donde el esqueleto dibuja una tarjeta, es una tarjeta de papel vacía; las rayas,
  `bg-ink/6`.
- **La píldora de hoy de la tira de la agenda va en `bg-ink/6`** y no en papel, como proponía el mapa:
  el pedido la pone entre los fondos hundidos.
- **La tabla de la compu** va en su tarjeta con `px-1.5`, como pide el pedido, y las celdas de las puntas
  del encabezado llevan `rounded-tl-[14px]` y `rounded-tr-[14px]`: sin eso, el fondo del orden activo se
  salía de la curva de la tarjeta.
- **El encabezado de la ficha quedó con el atributo en el `<header>`.** Con `?camara-lenta`, la tarjeta
  de la lista crece hasta el encabezado y se ve bien: mirado a 390 cuadro por cuadro, con una captura
  cada 120 ms, la tarjeta (211 px de alto) y el encabezado (213) son una sola caja de papel con el mismo
  radio que sube y se agranda mientras su contenido se funde. No hizo falta la alternativa de dejarlo en
  el `div` de adentro.
- **El e2e del rediseño** siembra una sola vez para el corte, el despiece, las páginas de afuera, la
  barra y el recorrido de todas las pantallas (`sembrarPocos` más el trabajo cobrado hoy), en un
  `describe.serial` que lee los ajustes antes y los devuelve en su `afterAll`. Las capturas usan
  `claro` y `oscuro` como nombre del tema. El aviso sin señal y el de error de `/v/`, el error de carga y
  Gracias se alcanzaron con `setOffline` y `page.route`, y tienen su captura. Lo medido del movimiento y
  de la barra queda además en `test-results/reparto` (`movimiento-*.json` y `barra.json`), para leer los
  números y no solo el resultado.

## Los tests que cambian

Ningún test de la app ni ningún e2e cambió lo que afirma, salvo estos, cada uno por lo que pide el
rediseño:

- **`PrincipalYApoyo.test.tsx`**: la separación entre columnas pasa de `gap-x-11` a `gap-x-4`, porque
  las columnas ahora son tarjetas y se separan como el resto de las tarjetas.
- **`SeccionesEnFilas.test.tsx`**: la lista pasa de `gap-8` a `gap-3` y `gap-4` desde 40rem, y cada
  sección deja el tope de 560, la línea de arriba y su `pt-5` por la receta de la tarjeta, porque cada
  `SeccionEnFila` es una tarjeta.
- **`Button.test.tsx`** suma el caso de `herramienta`.
- **`Navegacion.test.tsx`**: el test de la barra que vuelve después de escribir espera su vuelta con
  `findByRole`, porque ahora vuelve en la tarea siguiente, y suma uno con relojes falsos que mide que el
  toque llega a su botón antes de que la barra vuelva.
- **`cobro.spec.ts`** suma que el despiece tenga `maun-corte` corriendo al volver del cobro, y
  **`acceso.spec.ts`** suma el test del canto: los dos miden la sección 1.
- **`tema.test.ts`** suma el test de la barra de estado del color de la mesa.

Los tests nuevos son los del corte del mes, `etapaDelMueble`, `DistribucionDespiece`, `PortadaDeInicio`,
`Aviso` y `rediseno.spec.ts`. Los 44 del módulo y de `TarjetaConLamina` entraron sin tocarlos.

## Verificación

- **El CSS del build.** En `main` (`a289e82`) no están `@keyframes maun-corte` ni `maun-trazo`, ni
  `.lamina`, `.ilustracion` ni `.bg-mesa`; en esta rama están todos, y `text-portada` está con su variante
  de contenedor (`@min-[40rem]/con-lamina:text-portada`), que es la única forma en que se usa.
- **`@maun/ui`**: 116 tests en verde, entre ellos los 40 del módulo y los 4 de `TarjetaConLamina`, sin
  tocarlos.
- **`e2e:reparto`**, con `CAPTURAS_DEL_REPARTO`: 9 de 9 en 11 minutos, los dos de `hueco.spec.ts` y los 7
  de `rediseno.spec.ts`. **`e2e:transiciones`** con el mismo build: 15 pasaron y 3 se saltearon (el de
  rendimiento y los dos videos, que corren a pedido), como en `main`.
- **El movimiento**, medido por `rediseno.spec.ts` con `getAnimations()`: la primera visita a Inicio
  tiene `maun-corte` corriendo en las cuatro piezas (500 ms cada una) y, en el arranque, `maun-trazo` en
  la marca (600 ms); al volver a Inicio por la barra no queda ninguna animación; con
  `reducedMotion: 'reduce'` las dos duran 0,01 ms.
- **La cámara lenta**: el paso de la tarjeta al encabezado de la ficha, mirado cuadro por cuadro a 390.
- **Las capturas** de `rediseno.spec.ts` (250: el taller vacío, el arranque, el corte, el despiece, las
  páginas de afuera con sus avisos y todas las pantallas a 390 y 1440, en claro y en oscuro) se miraron
  una por una contra `design-reference/rediseno/`. Las diferencias están en las objeciones: «Tu mueble» en
  la compu, el trío de las tarjetas de proyecto en dos columnas a 390 (la maqueta dibuja tres; el umbral
  de 23rem es el de siempre) y el botón de un vacío, que en la maqueta del celular ocupa todo el ancho y
  en la app mide lo que su texto, como antes. Sin señal, en `/v/`, el título y la firma caen a la serif del
  sistema: Young Serif no llegó a bajarse antes del corte.
- **`pnpm verify`** en verde: 19 de 19 tareas en 11,7 minutos. El dominio, 577 tests; `@maun/ui`, 116;
  la app, 1166; la base, 201; el arnés del aviso de versión, 29 (17 saltados por proyecto); el del
  reparto, 9; el de las transiciones, 15 (3 saltados). Antes de ese verde hubo dos corridas que no
  llegaron al final: en la primera, el primer test de `PortadaDeInicio` pasó los 5 segundos por defecto
  (el primer `import()` después de `vi.resetModules()`, con todo el workspace en paralelo), y se arregló
  en su propio commit; en la segunda, Vitest no pudo arrancar un worker porque Windows tenía bloqueado un
  archivo de `jsdom` (`EBUSY`), con los 1163 tests que corrieron en verde.
- **`pnpm e2e`** completo contra la cuenta de prueba: 525 pasaron, 91 se saltearon por proyecto y falló
  uno, `finanzas.spec.ts:132` en la compu, que esperó 30 s los tesoros de Inicio sin que la página
  terminara de cargar. Corrido de nuevo en la compu, cuatro veces seguidas: 53 de 53. Entre ellos pasaron
  todos los que el pedido nombra: `montos-en-las-tarjetas`, `filas-de-acciones`, `lo-que-flota-abajo`,
  `destinos-en-celular`, `tarjetas-de-proyectos`, `cobro` (con el despiece cortándose), `acceso` (con el
  canto), `pila`, `compartir-con-el-cliente`, `seguimiento`, `proyectos`, `agenda`, `teclado` y `bloqueo`.
- **Las dos intermitencias de la primera parte, en `main` y en la rama.** `como-te-paga-y-el-qr` y
  `enlaces`, tres veces seguidas cada uno: en `main` fallaron 3 corridas de 91 y en la rama 4 de 91,
  todas de `como-te-paga-y-el-qr` y del mismo modo (las formas de cobro recién guardadas no llegan a la
  página del cliente en los 5 s del test, y una vez un `fetch failed` contra Supabase). `enlaces` pasó
  entero en las dos. La intermitencia ya estaba antes del rediseño.

## Fuentes

Leídas el 24 de septiembre de 2026.

- Sistemas: <https://atlassian.design/foundations/illustrations>,
  <https://atlassian.design/components/empty-state/usage>,
  <https://carbondesignsystem.com/patterns/empty-states-pattern/>,
  <https://docs.stripe.com/stripe-apps/patterns/empty-state>,
  <https://github.com/Shopify/polaris/blob/main/polaris.shopify.com/content/components/layout-and-structure/empty-state.mdx>,
  <https://design.gitlab.com/product-foundations/illustration>,
  <https://github.com/salesforce-ux/design-system/blob/master/ui/components/illustration/docs.mdx>,
  <https://www.ibm.com/design/language/illustration/isometric-style/design/>.
- Productos: <https://linear.app/now/behind-the-latest-design-refresh>,
  <https://robinhood.com/us/en/newsroom/a-new-visual-identity/>,
  <https://www.notion.com/blog/the-thinking-behind-our-latest-brand-campaign>,
  <https://www.northbase.design/patterns/empty-states>.
- Plataformas: <https://developer.apple.com/documentation/TechnologyOverviews/adopting-liquid-glass>,
  <https://developer.apple.com/videos/play/wwdc2025/356/>, <https://www.nngroup.com/articles/liquid-glass/>,
  <https://github.com/material-components/material-components-android/blob/master/docs/theming/Color.md>,
  <https://developer.android.com/develop/ui/compose/layouts/adaptive/canonical-layouts>,
  <https://developer.chrome.com/docs/css-ui/edge-to-edge>.
- Evidencia: <https://en.wikipedia.org/wiki/Seductive_details>,
  <https://www.sciencedirect.com/science/article/abs/pii/S1747938X18302148>,
  <https://www.nngroup.com/articles/aesthetic-usability-effect/>.
- Tailwind CSS 4, `@theme`: las variables `--animate-*` son las que hacen emitir sus `@keyframes`.
- WCAG 2.2, 1.4.3 (contraste mínimo, 4,5:1 para texto normal).
