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

## Tema oscuro (ADR 0020)

- **Es por tokens, nunca con `dark:` en los componentes.** El bloque `:root { @variant dark { … } }` de `theme.css` redefine las variables, y todo lo que usa tokens cambia solo.
- Tres estados en la raíz: `data-theme="light"`, `"dark"` o `"system"` (el de arranque). El `@custom-variant dark` cubre los dos caminos: `data-theme="dark"` explícito, o `prefers-color-scheme: dark` cuando la raíz no dice `light`. **`@variant` no va adentro de `@theme`**: Tailwind 4 solo acepta variables y `@keyframes` ahí.
- `color-scheme` va en la raíz con el tema: es lo que pone oscuro el selector de fecha nativo y las barras de scroll.
- **Las sombras pasan por variables** (`--shadow-float: var(--sombra-float)` en `@theme inline`): la utilidad compilada copia el color literal, así que una sombra con el negro del modo claro no se podría cambiar después.
- Los tesoros del oscuro no son los del claro invertidos: bajan la saturación y suben la luz para leerse sobre `#121212`. Si agregás un color, agregá los dos.
- `elevado` es la superficie del segmento elegido: en claro es blanco sobre gris, en oscuro es un gris más claro que el fondo. No uses `bg-paper` para eso, que en oscuro se hunde.

## Molde de pantalla

- **`Pagina` es el único contenedor de pantalla**: ancho máximo, márgenes por ancho y padding vertical. La app no repite `max-w-content px-(--page-pad-*)` a mano.
- **El ancho máximo va con el reparto** (ADR 0062): `ancho="formulario"` (60rem), `"ficha"` (80rem), `"tablero"` (100rem) o `"lista"` (el `--content-max` de siempre, por defecto). Son `--ancho-*` en `:root` y `max-w-formulario`, `max-w-ficha` y `max-w-tablero` por `--container-*`. Los topes incluyen el padding, como `--content-max`.
- **Dónde arranca no lo decide `Pagina`**: su margen izquierdo es `--inicio-de-la-pagina`, que vale `auto` (centrada) y que el marco de la app pone en `0` para que arranque junto al menú. Así la vista del cliente se centra sola afuera de la app y se alinea con el resto adentro.

## Los tres repartos (ADR 0062)

- **`SeccionesEnFilas` + `SeccionEnFila`**: una lista de secciones que, con el contenedor `secciones` de 44rem o más, pone cada sección en una fila (título y bajada en 15rem a la izquierda, el cuerpo a la derecha). Por debajo es la sección de siempre: una columna de 560 con su línea arriba. En ese caso define `--campo-corto`, `--campo-medio` y `--campo-largo` para que los campos usen `max-w-(--campo-*)`; sin la variable, `max-width` queda en `none`.
- **`PrincipalYApoyo`**: dos columnas (22,5rem de apoyo y el resto) desde que el contenedor `apoyo` mide 52rem. El lado lo decide el orden del DOM (`apoyoPrimero`), nunca `order`. El apoyo se pega arriba solo si entra en lo visible (`entraALaVista`, con 20 px de aire arriba y abajo), medido con `ResizeObserver` contra el contenedor que scrollea.
- **`Tablero`**: tarjetas en filas con `tarjetaMinima` (auto-fill, o auto-fit con `completar`) o `enUnaFila` (todas en una fila desde 54rem). No toca la alineación: las tarjetas de una fila miden lo mismo, como en toda grilla. `CeldaAncha` pone una sola a todo el ancho.
- **Los tres contenedores existen solo desde `md`** (`md:@container/...`): por debajo de 768 no hay consulta que se cumpla y el celular queda igual. `container-type` ya no crea bloque contenedor para lo posicionado, pero igual cada fila y cada columna es `relative`.

La app consume `@maun/ui/theme.css` y `@maun/ui/fonts.css` (IBM Plex Sans 400/500/600 y Young Serif, self-hosted con Fontsource para que funcionen offline). `theme.css` declara `@source '..'`: Tailwind escanea las clases de este paquete desde cualquier app que lo importe.

## Componentes

- Props en inglés, valores en español (`variant="primario"`, `size="chico"`, `cargando`).
- `Campo` acepta `ref` (sus props extienden `ComponentPropsWithRef<'input'>`): es lo que React Hook Form necesita para registrar el input.
- `Campo` acepta `accesorio`, que va a la derecha de la etiqueta (por ejemplo «¿La olvidaste?»), y `sufijo`, que va adentro del campo y recibe el id del input. Siguen siendo tres hijos, así que el subgrid de abajo no cambia.
- **`CampoDeContrasena` es el único campo de contraseña** (ADR 0023). El botón está siempre, con `aria-pressed` y el nombre fijo «Mostrar la contraseña». No le saca el foco al input (así el teclado del celular no se cierra), conserva el cursor y vuelve a ocultar al enviar el formulario y al volver del bfcache. El `::-ms-reveal` y el `::-ms-clear` de Edge están escondidos en `theme.css`: si no, hay dos ojos, y el de Edge desaparece solo.
- `Button` tiene `size="grande"`, del alto de un campo (48 px), para el botón principal de las pantallas de sesión. **Los altos de los tres tamaños son mínimos** (`min-h-*`): una etiqueta que no entra en un renglón agranda el botón en vez de salirse (ADR 0033). No vuelvas a `h-*`.
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
