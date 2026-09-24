# @maun/ui

Sistema de diseño portado desde `design-reference/`. Los tokens, la escala tipográfica, el espaciado y los estados ya están resueltos ahí: se portan, no se reinventan.

## Frontera

`@maun/ui` no importa nada del monorepo (ni la app, ni `domain`, ni `db`), ni librerías de datos (`@supabase/*`, `@tanstack/*`), ni router. Lo impone ESLint. Los datos entran por props y las acciones salen por callbacks. Los componentes que conocen el dominio (`TesoroCard`, `DistribucionDespiece`, `EntregaBadge`, `ClienteCombobox`, `BottomNav`) no van acá: van en `apps/web/src/entities` o en `features`.

## Tokens (Tailwind 4, CSS-first)

La única fuente es `src/styles/theme.css`, portado 1:1 de `design-reference/src/styles/tokens.css` con los mismos nombres de variables:

- `@theme static`: los tokens cuyo nombre ya es un namespace de Tailwind (`--color-*`, `--text-*`, `--radius-*`, `--shadow-*`, `--leading-*`, `--font-*`, `--ease-*`). Generan utilidades (`bg-ink`, `text-text-2`, `text-money-lg`, `rounded-panel`, `shadow-float`) y quedan siempre como variables CSS.
- `@theme inline static`: alias de Tailwind a variables de `:root` (`bg-hogar`, `bg-hogar-tint`, `h-button`, `min-h-tap`, `max-w-content`).
- `:root`: el resto de los tokens con su nombre original (`--tesoro-hogar`, `--dur-fast`, `--page-pad-mobile`), para que el markup de los `.dc.html` se porte sin cambios.

Los colores, tamaños de texto, radios y sombras por defecto de Tailwind están reseteados: `bg-blue-500` o `text-sm` no existen. No hay hex sueltos en componentes. Si falta un token, se agrega en `theme.css`.

- **Los colores de las opiniones son tres: `op-bien`, `op-neutro` y `op-mal`** (ADR 0057). Dos tintas con un gris en el medio, y `op-bien` es la tinta del texto: ninguno es un color de tesoro, que están reservados. **El color nunca va solo**: cada paso de la escala lleva su carita y su palabra, y la leyenda de la barra repartida lleva forma. El oscuro redefine `op-neutro` y `op-mal`; `op-bien` sigue a `ink`.
- Las opiniones sumaron `text-body-sm`, `text-subtitulo`, `text-subtitulo-lg`, `text-firma`, `text-h2`, `text-cifra`, `text-cifra-lg` y `rounded-telefono` (el marco de «Así la ve tu cliente»), todos del showcase. Antes de sumar otro tamaño, fijate si alguno de estos sirve.
- **La mesa y el papel (ADR 0068).** El fondo de la app es `--color-mesa`, un gris cálido, y lo que se lee y se toca va en tarjetas de papel (`rounded-panel border border-hairline bg-paper`). En claro, `surface`, `surface-2` y `surface-3` casi no se distinguen de la mesa: sobre la mesa, un gris es papel o `bg-ink/5`–`bg-ink/6`; adentro de una tarjeta sigue siendo `bg-surface`. Los dibujos van siempre en una lámina (`Lamina`, `TarjetaConLamina`, `EstadoVacio`), con `aria-hidden`, y el color de los tesoros entra solo por el canto.

## Tema oscuro (ADR 0020)

- **Es por tokens, nunca con `dark:` en los componentes.** El bloque `:root { @variant dark { … } }` de `theme.css` redefine las variables, y todo lo que usa tokens cambia solo.
- Tres estados en la raíz: `data-theme="light"`, `"dark"` o `"system"` (el de arranque). El `@custom-variant dark` cubre los dos caminos: `data-theme="dark"` explícito, o `prefers-color-scheme: dark` cuando la raíz no dice `light`. **`@variant` no va adentro de `@theme`**: Tailwind 4 solo acepta variables y `@keyframes` ahí.
- `color-scheme` va en la raíz con el tema: es lo que pone oscuro el selector de fecha nativo y las barras de scroll.
- **Las sombras pasan por variables** (`--shadow-float: var(--sombra-float)` en `@theme inline`): la utilidad compilada copia el color literal, así que una sombra con el negro del modo claro no se podría cambiar después.
- Los tesoros del oscuro no son los del claro invertidos: bajan la saturación y suben la luz para leerse sobre el papel del oscuro, que desde el ADR 0068 es `#171717`. Si agregás un color, agregá los dos.
- `elevado` es la superficie del segmento elegido: en claro es blanco sobre gris, en oscuro es un gris más claro que el fondo. No uses `bg-paper` para eso, que en oscuro se hunde.

## Los resortes (ADR 0066)

- Los movimientos usan los resortes de Material 3: `--resorte-*` es la curva, como `linear()`, y `--dur-*` es lo que tarda en asentarse a una milésima. Espaciales (0,9 de amortiguación), de efectos (1) y uno expresivo (0,6), cada uno con su rigidez.
- **No se escriben a mano.** Los genera `src/resortes.ts` a partir de la amortiguación y la rigidez; `pnpm --filter @maun/ui resortes` los reescribe en `theme.css` y `resortes.test.ts` falla si el CSS no coincide con la función.
- Con `prefers-reduced-motion` las duraciones valen cero.
- La sombra del empuje (`--sombra-del-empuje`) y el atenuado de la subida (`--atenuado-de-la-subida`) son tokens con su par oscuro, como el resto.

## Molde de pantalla

- **`Pagina` es el único contenedor de pantalla**: ancho máximo, márgenes por ancho y padding vertical. La app no repite `max-w-content px-(--page-pad-*)` a mano.
- **Un solo ancho, centrado** (ADR 0062, corregido): `max-w-content` (`--content-max`, 1180 con el padding) y `mx-auto`, igual en todas las pantallas. No tiene prop de ancho a propósito: la primera versión del reparto tuvo uno por reparto y un arranque junto al menú, y dejó las pantallas corridas a la izquierda con un blanco grande a la derecha. Lleva `data-pagina`, que es lo que mide el test del reparto.

## Los tres repartos (ADR 0062)

- **`SeccionesEnFilas` + `SeccionEnFila`**: una lista de secciones que, con el contenedor `secciones` de 44rem o más, pone cada sección en una fila (título y bajada en 15rem a la izquierda, el cuerpo a la derecha). Cada sección es una tarjeta de papel a todo el ancho (ADR 0068); por debajo de 44rem, el título va arriba de los controles. Con dos columnas define `--campo-corto`, `--campo-medio` y `--campo-largo` para que los campos usen `max-w-(--campo-*)`; sin la variable, `max-width` queda en `none`.
- **`PrincipalYApoyo`**: dos columnas (22,5rem de apoyo y el resto) desde que el contenedor `apoyo` mide 52rem; con `amplio`, el apoyo pasa a 26rem desde 64rem. El lado lo decide el orden del DOM (`apoyoPrimero`), nunca `order`. El apoyo es `sticky` con el tope en `--tope-del-apoyo`: 20 px si entra en lo visible (`entraALaVista`, con 20 px de aire arriba y abajo), y si no, lo visible menos su alto menos 20 (`topeDelApoyo`), que lo pega por abajo. Se mide con `ResizeObserver` contra el contenedor que scrollea, y `data-pegado` dice `arriba` o `abajo`.
- **`Tablero`**: tarjetas en filas con `tarjetaMinima` (auto-fill, o auto-fit con `completar`) o `enUnaFila` (todas en una fila desde 54rem). No toca la alineación: las tarjetas de una fila miden lo mismo, como en toda grilla. `CeldaAncha` pone una sola a todo el ancho.
- **`CamposJuntos`**: dos o tres campos en un renglón cuando entran todos con su `campoMinimo` (12, 14 o 16rem; los umbrales son clases fijas por combinación, porque Tailwind necesita el texto literal), y si no, en columna con la `separacion` de quien lo usa; con `deADos`, tres que no entran pasan primero a dos por renglón. No es un reparto: es el renglón de campos, como `FilaDeAcciones`.
- **Los contenedores existen solo desde `md`** (`md:@container/...`): por debajo de 768 no hay consulta que se cumpla y el celular queda igual. `container-type` ya no crea bloque contenedor para lo posicionado, pero igual cada fila y cada columna es `relative`.

La app consume `@maun/ui/theme.css` y `@maun/ui/fonts.css` (IBM Plex Sans 400/500/600 y Young Serif, self-hosted con Fontsource para que funcionen offline). `theme.css` declara `@source '..'`: Tailwind escanea las clases de este paquete desde cualquier app que lo importe.

## Componentes

- Props en inglés, valores en español (`variant="primario"`, `size="chico"`, `cargando`).
- `Campo` acepta `ref` (sus props extienden `ComponentPropsWithRef<'input'>`): es lo que React Hook Form necesita para registrar el input.
- `Campo` acepta `accesorio`, que va a la derecha de la etiqueta (por ejemplo «¿La olvidaste?»), y `sufijo`, que va adentro del campo y recibe el id del input. Siguen siendo tres hijos, así que el subgrid de abajo no cambia.
- **`CampoDeContrasena` es el único campo de contraseña** (ADR 0023). El botón está siempre, con `aria-pressed` y el nombre fijo «Mostrar la contraseña». No le saca el foco al input (así el teclado del celular no se cierra), conserva el cursor y vuelve a ocultar al enviar el formulario y al volver del bfcache. El `::-ms-reveal` y el `::-ms-clear` de Edge están escondidos en `theme.css`: si no, hay dos ojos, y el de Edge desaparece solo.
- `Button` es una cápsula (`rounded-pill`, ADR 0068). Tiene `size="grande"`, del alto de un campo (48 px), para el botón principal de las pantallas de sesión, y `variant="herramienta"` con `size="herramienta"` para las herramientas de la cabecera de las fichas: un círculo de 44 px con el ícono que, con `className="sm:px-4"`, pasa a cápsula con texto; deshabilitada conserva su forma. **Los altos de los tamaños son mínimos** (`min-h-*`): una etiqueta que no entra en un renglón agranda el botón en vez de salirse (ADR 0033). No vuelvas a `h-*`.
- `Campo` acepta `contenedor`, clases que se suman al `div` que envuelve etiqueta, input y ayuda. La ayuda y el error van juntos en una sola celda, así que con `row-span-3 grid grid-rows-subgrid` dos campos en fila alinean sus inputs aunque una etiqueta o una ayuda ocupe dos líneas (ADR 0020).
- **`Avatar`** son las iniciales del nombre sobre un color que sale de un hash del nombre (`--color-avatar-1` a `-6`, con sus pares del oscuro). Con `foto`, la imagen se pone encima recién cuando carga, y si falla vuelven las iniciales; `data-foto` dice en qué estado está (`sin-foto`, `cargando`, `lista`, `fallo`). Es `aria-hidden`: el nombre siempre está escrito al lado (ADR 0021 y 0022).
- **`MoneyInput` es el campo de plata** (ADR 0020). Entrega centavos enteros (`number | null`) y muestra el importe formateado mientras se escribe: los dígitos entran por la derecha con el cursor fijo al final (5, 50, 500, 5.000), la coma abre los decimales y pegar un importe con puntos o coma lo lee entero. Decide con `InputEvent.inputType`, no comparando textos. `inputMode="decimal"` y no `numeric`: el teclado numérico de iOS no tiene coma.
- **`MontoQueEntra` es un monto en una tarjeta** (ADR 0060), con la utilidad `text-monto-que-entra` de `theme.css`: `clamp(13px, 100cqi / (caracteres × --em-por-caracter-de-monto), tope)`. La letra sale del ancho del contenedor más cercano (`@container` en un ancestro) y del largo del monto; un renglón, cifras tabulares. `caracteres` permite que una fila de tarjetas use el largo del más largo (`caracteresDe`), y `tamano` elige el tope (`tarjeta`, 26 px; `destacado`, 40 px). **`--em-por-caracter-de-monto` (0,53) es una medida de IBM Plex Sans semibold**: si cambia la letra de los números, se mide de nuevo.
- **`FilaDeAcciones` es la fila de dos o más botones** (ADR 0033): `grid-template-columns: repeat(auto-fit, minmax(min(var(--accion-min), 100%), 1fr))`. Si no entran dos columnas del mínimo, colapsa a una y todos pasan a ancho completo; con un solo botón, `auto-fit` colapsa la pista vacía y ocupa todo. Sin consultas de medio ni de contenedor. **`--accion-min` es la etiqueta más larga que vive en una fila**, medida con la fuente real («Reactivar y deshacer el reparto», 249,2 px) y redondeada a múltiplo de 4: si entra una etiqueta más larga, se sube el token, no se achica la letra. Con tres o más botones la grilla sí puede dejar uno solo abajo.
- `Icono` importa de `lucide-react` uno por uno. Se verificó sobre el build que Vite lo tree-shakea: en el bundle están los paths de los íconos que se usan, no la librería (ADR 0014).
- Área táctil mínima de 44px (`--tap-min`), foco visible y estados de carga, vacío y error según `Tokens.dc.html`.
- **Un componente que puede vivir en una columna se adapta a su ancho, no al de la ventana**: consultas de contenedor de Tailwind 4 (`@container` en un ancestro, `@sm:`, `@min-[21rem]:`), no `sm:` ni `md:`. `--container-*` no está reseteado, así que valen los tamaños de fábrica (`@xs` 20rem, `@sm` 24rem, `@md` 28rem, `@lg` 32rem). **`@container` y `@sm:` no van en el mismo elemento**: la consulta mira al ancestro, nunca a sí mismo.
- Imports relativos con extensión (`./Button.tsx`).
- Test con Testing Library al lado del componente.
