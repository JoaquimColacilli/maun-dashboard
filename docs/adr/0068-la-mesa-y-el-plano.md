# 0068. La mesa y el plano: la app se apoya en una mesa y los dibujos tienen su lámina

- Estado: aceptada, primera parte (secciones 1 a 6 del pedido)
- Fecha: 2026-09-24
- Corrige al [0020](0020-pulido-visual.md) en el papel del oscuro, los radios y las superficies, y al
  [0016](0016-el-cobro-y-el-rechazo-que-encuentra-al-usuario.md) y al
  [0023](0023-sesion-bloqueo-con-huella-y-passkeys.md) en que el corte ya corre de verdad. Sigue al
  [0062](0062-el-reparto-en-la-compu.md) (cada sección de `SeccionesEnFilas` pasa a ser una tarjeta; el
  orden del DOM sigue siendo el que se ve) y al [0066](0066-las-transiciones-del-celular.md) (el lienzo de
  las transiciones pasa a la mesa).

## Contexto

En un pedido anterior se armó un sistema de ilustraciones propio: dibujos de línea en isométrica que
parecen un plano del taller. Puestos en la app de hoy no encajaban. En Inicio, el tablero dibujado
flotaba en el medio de la nada, porque la app no estaba pensada para tener dibujos: pantallas blancas,
secciones separadas por líneas o por cajas grises, radios de 2 a 6 px.

El pedido: un rediseño de la app entera, en el celular, la tablet y la compu, para que los dibujos
tengan un lugar propio y la app se vea moderna y cuidada, con la funcionalidad exactamente igual y sin
textos nuevos, salvo los de la portada de Inicio y los rótulos de los dibujos. Lo que más importa es el
celular.

### La regla que manda

**La mesa y el plano.** El fondo de toda la app pasa a ser una mesa de trabajo, un gris cálido apenas
marcado. Lo que se lee y se toca va en tarjetas de papel apoyadas encima, con un borde de un pelo y
radio 20. Los dibujos son planos, y un plano siempre está sobre una **lámina**: una placa con la grilla
de puntos de la isométrica, adentro de una tarjeta y pegada a su título. Ningún dibujo va suelto; a lo
sumo una lámina por pantalla, con `aria-hidden` y su texto al lado. El color entra por el canto: los
tesoros pintan el canto de las piezas del tablero y el de sus propias tarjetas, y nada más cambia de
color. Todo sale de los tokens.

### Lo que dicen los que lo hacen bien

- Los dibujos van en los momentos sin datos (vacíos, errores, primer uso y éxito), de un solo concepto.
  Atlassian avisa que «Excessive illustrations increase cognitive load»; Carbon pide solo texto cuando
  varios bloques de un tablero están vacíos a la vez; Stripe usa, para un vacío por filtro, un mensaje
  compacto sin imagen y sin «crear el primero».
- Un dibujo bien integrado va dentro de un componente que le reserva el lugar, con pocos tamaños fijos
  (GitLab reserva 72, 144 y 288 px; Polaris, 226) y el título al lado (SLDS lo exige). En pantallas
  anchas, Carbon pone el dibujo a la izquierda del bloque, como un solo bloque.
- En accesibilidad coinciden todos: el dibujo es decorativo (Atlassian, Polaris, Carbon, IBM, SLDS,
  GitLab; Apple pide sacar de VoiceOver lo decorativo).
- La evidencia: los «detalles seductores» distraen en tareas de carga alta (Harp y Mayer, 1998) y lo
  pertinente al contenido ayuda (Brom y otros, 2018: d = 0,32 en comprensión). Por eso las pantallas de
  números quedan limpias y el tablero del despiece, que es el gráfico mismo, sí va.
- iOS 26 y Material 3 Expressive separan la navegación del contenido en su propia capa, con las
  esquinas de adentro siguiendo la curva de afuera. La barra de MAUN ya era una píldora que flota: de ahí
  sale solo la cápsula del destino activo. NN/g criticó en 2025 que el vidrio prioriza el espectáculo:
  no se suma vidrio.
- Las superficies tonales reemplazan a las sombras (Material 3), con radios de 16 a 20 en tarjetas y 28
  en hojas.

## Decisión

### 1. El corte vuelve a moverse

**El corte nunca se había visto en producción.** `@keyframes maun-corte` vivía adentro de `@theme
static` y lo nombraban solo los `style` en línea de `DistribucionDespiece` y `PantallaDeAcceso`.
Tailwind 4 emite los `@keyframes` de `@theme` solo si el CSS los nombra (con una variable `--animate-*` o
una declaración `animation`), y un `style` en línea no cuenta: el CSS del build no los tenía.
`--animate-maun-corte` los hace emitir. Medido sobre el build: en `main`, `@keyframes maun-corte` no
está; en esta rama, sí.

- `cobro.spec.ts` mide que, al volver de confirmar un cobro, la región «Distribución de la ganancia»
  tenga `maun-corte` corriendo en sus piezas (`getAnimations({ subtree: true })`), y `acceso.spec.ts`,
  que el canto lo tenga la primera vez. Sin la variable, el del canto falla («Received: false»): se
  probó sacándola.

### 2. Los dibujos en el sistema de diseño

El módulo de ilustraciones (`packages/ui/src/ilustracion/`), `TarjetaConLamina` y `EstadoVacio` entran
tal como vinieron, con sus 44 tests, y se exportan desde `@maun/ui`. `theme.css` suma `maun-trazo`,
`--dur-trazo` (cero con `prefers-reduced-motion`), las reglas de `.ilustracion` y las de `.lamina`, afuera
de los bloques que escribe `pnpm --filter @maun/ui resortes`.

- **`EstadoVacio` es una `section` con nombre, o sea una región**, donde hoy los vacíos son un `div`.
  Es el único rol que suma el rediseño. Se nombra por su `h2`, o por `etiqueta`.
- **Las props del módulo están en español**, como las de `Tablero`, `PrincipalYApoyo` y
  `MontoQueEntra`. El «props en inglés» del `CLAUDE.md` del paquete viene de los primeros componentes.
- **Lo único que se tocó del zip:** `TarjetaConLamina.tsx` y `TarjetaConLamina.test.tsx` no pasaban
  el Prettier del pre-commit por el largo de dos renglones. Se reacomodaron los renglones, sin cambiar
  una letra del código.

### 3. La mesa

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
| `--punto-de-la-lamina`                      | —                      | `rgba(20, 20, 20, 0.14)` / `rgba(237, 237, 237, 0.11)` |
| `--text-h1` / `--text-h1-lg`                | 26 / 30 px             | 30 / 36 px                                             |
| `--text-section`                            | 15 px                  | 17 px                                                  |
| `--text-portada` (nuevo)                    | —                      | 26 px                                                  |
| Radios control, field, panel, dialog, sheet | 2, 4, 6, 8, 12 px      | 8, 12, 20, 24, 28 px                                   |
| `--radius-lamina` (nuevo)                   | —                      | 14 px                                                  |
| `--page-pad-mobile`                         | 20 px                  | 16 px                                                  |

- **El oscuro sube el papel a `#171717`** para que la tarjeta se despegue de la mesa, y por eso corre
  toda la rampa de grises. `--paper-notas` del oscuro queda como estaba: el borde y los renglones ya
  separan las notas del papel.
- **Contraste, medido con la fórmula de WCAG:** `text-3` da 5,17:1 sobre el papel claro y 4,58:1 sobre
  la mesa clara (el `#8a8a8a` de antes daba 3,05 sobre la mesa); en oscuro, 4,92 sobre el papel y 5,41
  sobre la mesa. Los tesoros del oscuro siguen siendo los de siempre y sobre `#171717` dan 8,51 (hogar),
  7,64 (maun), 7,33 (diezmo) y 7,20 (cocos).
- **El `body` es la mesa y el `<main>` sigue sin fondo propio**: con un fondo, cambiaría la foto de la
  raíz en todos los movimientos del celular. Por eso `transiciones.css` pinta la mesa, no el papel, debajo
  de la pantalla que se mueve en el empuje y en la vuelta. `e2e:transiciones` pasa: 15 de 15, en claro y
  en oscuro.
- **La barra de estado toma el color de la mesa.** Dos `meta name="theme-color"` con `media`, arriba del
  script que elige el tema; el script y `elegirTema` las pisan cuando el tema es forzado y con «según el
  sistema» cada una vuelve a la suya. El manifiesto pasa a `#f2f1ed`. Son los únicos hex fuera de
  `theme.css`: ahí no hay CSS.
- **En claro, los grises casi no se distinguen de la mesa** (`surface-2` queda a 3/255, `surface` a 7,
  `surface-3` a 13). Adentro de una tarjeta siguen igual; sobre la mesa, un bloque gris pasa a papel y un
  fondo hundido, un esqueleto, un hover o una insignia pasan a `bg-ink/5` o `bg-ink/6`. La tira de la
  agenda, que se pega arriba, pasa a `bg-mesa`.
- **Los radios nuevos deformaban formas chicas**, que quedan fijas: la casilla de «varias» en
  `rounded-[4px]` contra el círculo de «una», las leyendas y las barras de los gráficos en `rounded-[2px]`,
  los colores de la lista del despiece en `rounded-[3px]`, y las fichas de ícono de 36 px en
  `rounded-field`. La punta de la capa del día baja a `anchor(top) + 20px`, porque a 11 caía en la curva.

### 4. Las piezas

- **La receta de la tarjeta** es `rounded-panel border border-hairline bg-paper`, siempre las tres
  juntas: de contenido con `px-4 py-4 md:px-5`, de lista con `px-4` y renglones
  `border-t border-hairline-soft first:border-t-0`. **Nunca una tarjeta adentro de otra**: lo de adentro
  va en `rounded-field`. Sobre la mesa, sin tarjeta, van el header de las pantallas de lista, los títulos
  que agrupan tarjetas, las cabeceras de día, el volver y las herramientas de las fichas. Las tarjetas
  apiladas se separan con `gap-3 md:gap-4` en su contenedor.
- **`Button` es una cápsula** y suma `variant="herramienta"` con `size="herramienta"`: un círculo de
  44 px con el ícono, que con `className="sm:px-4"` pasa a cápsula con texto desde `sm`. Deshabilitada
  conserva su forma: la variante deshabilitada de siempre (`bg-hairline px-[18px]`) la habría
  deformado. Los altos y los rellenos de los demás tamaños no cambian (0033).
- **`SeccionesEnFilas`**: cada sección es una tarjeta a todo el ancho, sin el tope de 560 ni la línea
  de arriba; desde 44rem sigue con sus dos columnas adentro. **`PrincipalYApoyo`** junta las columnas
  (`gap-x-4`) y separa por defecto con `gap-y-3`; como su test prohíbe `md:` en la grilla, las pantallas
  que lo usan le pasan `separacion="gap-y-3 @min-[40rem]/apoyo:gap-y-4"`. **`BloquePlegable`** es tarjeta
  por defecto y `enTarjeta={false}` lo anida (lo usa `CostosDeCotizar anidado` adentro de «Qué falta»).
  **`PanelDeAvisos`** es una tarjeta con su tinte en las fichas y `anidado` en Ajustes.
- **Botones, chips, insignias y buscadores son cápsulas**; los segmentados llevan pista `bg-ink/6 p-1`
  con el elegido en `bg-elevado shadow-float` (en cápsula los de un renglón; en `rounded-panel` con
  segmentos de 16 px los que pueden partirse). En las pestañas de Proyectos y de Opiniones el fondo del
  elegido sigue siendo el `span` aparte, sin transición (0066).
- **El vacío por un filtro o una búsqueda es una caja punteada**, sin dibujo y sin botón de crear.
- **El canto**: las cuatro tarjetas de los tesoros de Inicio y «Estado del diezmo» pasan de su tinte a
  papel con 5 px del color de su tesoro abajo, en un `span` `aria-hidden` y sin texto (lo recorre
  `montos-en-las-tarjetas`), y 4 px más de relleno abajo. El Hogar en negativo sigue con su losa.
- **El encabezado de cada ficha es una tarjeta**, con el cliente, el título, el estado y las fechas, y
  lleva el `data-destino-de`: es el destino de la transición desde la tarjeta de la lista, que tiene el
  mismo ancho y el mismo radio. El pedido pone «el header de la pantalla» sobre la mesa; se leyó como el
  de las pantallas de lista, porque las maquetas dibujan la ficha así y la transición lo necesita.
- **El volver y las cuatro herramientas de la ficha de obra entran a 320.** Con `gap-1` y el volver en
  `pr-2`, como proponía el pedido, «Proyectos» se pasaba 0,1 px y «Opiniones» 1,1. Con el volver en
  `pr-1` quedan 3,9 y 2,9 px libres, y 16 con «Clientes». La fila además se parte si una etiqueta no
  entrara, con las herramientas a la derecha, en vez de salirse. Las tres fichas usan lo mismo.
- **Las páginas públicas (`/v/` y `/o/`) también van sobre la mesa**, con sus secciones en tarjetas.
  «Tu mueble» es por ahora una tarjeta común; su lámina llega con la sección que la decide.

### 5. La navegación

La barra del celular queda como estaba, en su lugar, con sus botones y el + montado sobre la píldora.
Cambia solo el adentro de los destinos: el activo lleva una cápsula `bg-ink/7` de 50 px adentro de la
píldora de 62, con 6 px arriba, abajo y en las puntas, donde su curva sigue la de la píldora. El riel y
la barra lateral pierden el fondo y el borde y quedan sobre la mesa; el destino activo es una cápsula de
papel, y en el riel Ajustes también se marca cuando está activo.

Medido en Chromium con la letra real:

| Ancho | Inicio y Finanzas | Proyectos y Clientes | «Proyectos» | «Finanzas» |
| ----- | ----------------- | -------------------- | ----------- | ---------- |
| 320   | 47 px             | 53 px                | 49,9 px     | 44,8 px    |
| 360   | 57 px             | 63 px                | 49,9 px     | 44,8 px    |
| 390   | 64,5 px           | 70,5 px              | 49,9 px     | 44,8 px    |

El + queda centrado y 15 px arriba de la píldora en los tres anchos, sin pisar ningún destino. En la
barra lateral, «MAUN» en 36 px agranda su renglón 9 px (de 63 a 72) y el menú de «Cargar algo nuevo» pasa
de `top-[72px]` a `top-[81px]`: sigue a 15 px del borde de arriba del botón, como antes.

### 6. El corte del mes

Inicio va a abrir con lo que dejó el mes: lo cobrado en los trabajos cerrados, cortado por tesoro. Es el
mismo despiece de la ficha (0016), sumado por mes, y no toca la base.

- `distribucionCongelada(proyecto)` sale de `despieceDelProyecto`: la distribución de la fila de un
  trabajo liquidado, o nada. `despieceDelProyecto` la usa y devuelve lo mismo que antes.
- `corteDelMes(replica, mes)` suma los cobrados y los perdidos con `fecha_cobro` en el mes, **también los
  repartidos en la apertura**: el trabajo se cerró ese mes y su despiece es ese, igual que para el sueldo
  del mes. Hogar es el sueldo; Maun, los fijos más el remanente cuando es positivo (el negativo cuenta
  cero, como en el despiece); Diezmo, el diezmo. Los gastos son lo cobrado menos las tres partes: lo que se
  fue en materiales y no llegó a ningún tesoro. El check `proyectos_distribucion_cuadra` hace que las
  partes nunca pasen lo cobrado.
- `piezasDelCorte` arma las piezas del tablero (hogar, maun, diezmo y gastos, solo las que no son cero)
  y `fraseDelCorte` lo cuenta. La pieza usa el nombre del tesoro («Maun 26%»); la frase habla como el
  resto de la app, que a esa caja le dice el taller («26% al taller»).
- `porcentaje` sale de `DistribucionDespiece` a `entities/proyecto/model` y lo usan los dos.
  `shared/lib/porcentaje.ts` no sirve: formatea puntos básicos con coma.

## Desvíos del pedido

- **El número.** El pedido llamaba a este ADR 0067, pero ese número lo tomó la #44 («la vista antes de
  aprobar»), mergeada el mismo día. Este es el 0068, y la rama, `feature/40-la-mesa-y-el-plano`.
- **El volver de las fichas va en `pr-1`**, no en `pr-2` (ver arriba), y su fila se puede partir.
- **Los esqueletos**: donde el esqueleto dibuja una tarjeta (el bloque de `Cargando` y el de los
  avisos), es una tarjeta de papel vacía; las rayas, `bg-ink/6`.
- **La barra del celular vuelve después del toque, no en el medio.** Se escondía al enfocar un campo y volvía en el `focusout`. Con el rediseño, en la ficha de un contacto el botón «Anotar el relevamiento» quedó en 791–835 px de una pantalla de 844, justo donde vuelve la barra: el `mousedown` sobre el botón sacaba el foco de la fecha, la barra aparecía encima y el `mouseup` caía sobre ella, así que el formulario no se mandaba. `hecho-y-marcado.spec.ts` lo encontró en el celular. Ahora, si hay un botón apretado, la barra espera a que se suelte, y en todos los casos vuelve en la tarea siguiente, cuando el toque ya llegó a su botón. Mientras se escribe se sigue escondiendo igual.
- **La píldora de hoy de la tira de la agenda va en `bg-ink/6`** y no en papel, como proponía el mapa:
  el pedido la pone entre los fondos hundidos.

## Objeciones

- **La tinta de atención (`#9a6700`) da 4,31:1 sobre la mesa clara**, un poco menos de 4,5. Sobre el
  papel está bien, y casi todo lo que la usa va adentro de una tarjeta; si aparece sobre la mesa un texto
  chico en ese color, conviene oscurecerla un punto.
- **El hover `bg-ink/5` sobre la mesa casi no se ve en oscuro.** Es a propósito (el arnés de las
  transiciones compara píxeles con el puntero quieto sobre la barra lateral), y en el celular no hay
  hover.
- **Las herramientas de la ficha de obra entran a 320 con 3 a 4 px de sobra.** Android puede
  redondear la letra distinto; si en el teléfono no entran, la fila se parte en dos en vez de salirse.
- **En «Tu mueble» el trío de montos se parte en dos renglones a 390**, porque la tarjeta suma relleno.
  No se sale nada, y ese bloque cambia cuando llegue su lámina.
- **Nada de esto se probó en un teléfono de verdad.**

## Lo que queda para la segunda parte

El pedido llegó cortado en la sección 6. Quedan la portada de Inicio con el corte del mes, el tablero
dibujado del despiece, las láminas de los vacíos y de los avisos, las hojas, las pantallas de sesión, la
vista del cliente con «Tu mueble», y lo que diga el resto del pedido.

## Fuentes

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

## Verificación

- `pnpm verify` en verde en `main` antes de empezar (19 tareas, 9 min 52 s) y en esta rama (19 tareas, 10 min 24 s, y 10 min 33 s con el arreglo de la barra): dominio 577 tests, `@maun/ui` 116 (el módulo de ilustraciones y los dos componentes incluidos), la app 1148, la base 201; el arnés del aviso de versión, 29; el del reparto, 2 (pocos y muchos datos, de 768 a 2560); el de las transiciones, 15, en claro y en oscuro.
- `pnpm e2e`, dos corridas completas. En la primera, 524 pasaron, 91 se saltearon por proyecto y 2 fallaron: `hecho-y-marcado` en el celular, que era el toque que se llevaba la barra (arreglado, ver los desvíos; después 9 de 9), y `como-te-paga-y-el-qr` en la compu, que corrido de nuevo pasó 4 de 4. En la segunda, con el arreglo, 525 pasaron y falló una vez `enlaces` en la compu («Entrega más próxima» no apareció en 30 s), que corrido de nuevo pasó 22 de 22.
- `cobro.spec.ts` y `acceso.spec.ts`: 29 de 29 con el corte midiéndose; el del canto falla si se saca `--animate-maun-corte`.
- El CSS del build tiene `@keyframes maun-corte` y `maun-trazo`, `.lamina`, `.ilustracion`, `.bg-mesa`, `--color-mesa` en los dos temas y las utilidades de `TarjetaConLamina` (`text-portada`, `min-h-70` y el resto con su variante de contenedor).
- Las medidas de la barra, de las herramientas de las fichas a 320, 360 y 390 y del menú de la barra lateral se tomaron con un spec de Playwright que no queda en el repo.
- Capturas de las 29 pantallas del reparto a 390 y de 768 a 2560 con los dos talleres, y de todas a 390 en oscuro, miradas a mano.
