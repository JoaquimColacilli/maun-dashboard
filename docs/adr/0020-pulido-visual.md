# 0020. Pulido visual: tema oscuro, hojas, plata, avisos y un solo molde

- Estado: aceptada
- Fecha: 2026-09-12

## Contexto

Con todo lo funcional construido, el dueño recorrió la app y juntó dieciséis correcciones de forma y
tres cosas atadas a ellas. No hay funcionalidad de negocio nueva. Cinco decisiones técnicas vinieron
fijadas en el pedido; acá quedan cómo se implementaron, dónde se apartó la implementación y por qué, y
las objeciones que quedan.

## Decisiones

**1. Tema oscuro por tokens.** `theme.css` redefine las variables en `:root { @variant dark { … } }`;
ningún componente tiene `dark:`. Tres estados en `data-theme` de la raíz (`light`, `dark`, `system`,
que es el de arranque). Un script en línea en `index.html` lo pone antes del primer pintado, así que no
hay parpadeo; la elección vive en `localStorage` (`maun:tema`), por dispositivo, y sobrevive a cerrar
sesión. `color-scheme` va con el tema, y es lo que pone oscuro el selector de fecha nativo.

- **Se apartó:** el pedido decía `@variant dark` dentro de `@theme`. Tailwind 4 no lo acepta (solo
  variables y `@keyframes`). Se definió `@custom-variant dark` afuera, con los dos caminos:
  `data-theme="dark"` explícito, o `prefers-color-scheme: dark` cuando la raíz no dice `light`.
- **Las sombras pasan por variables** (`--sombra-*`): la utilidad compilada copiaba el color literal.
- **Los tesoros se recalcularon**, no se invirtieron: menos saturación y más luz, con contraste AA sobre
  `#121212`.
- **HOGAR en negativo.** En claro es una losa negra. En oscuro, invertida, sería una losa blanca: se lee
  como la tarjeta elegida y encandila. Pasa a un fondo rojo oscuro (`#3a1c19`) con borde de alerta,
  texto claro, el ícono de triángulo y la leyenda «en negativo». No depende del color: el ícono y la
  palabra dicen lo mismo en escala de grises.
- `elevado` es un token nuevo para el segmento elegido: `bg-paper` se hundía en oscuro.

**2. Hojas con CSS.** Toda hoja es `Hoja`, un `<dialog>` nativo con `showModal`. Entra y sale desde
abajo con `@starting-style` y `transition-behavior: allow-discrete` sobre `display` y `overlay`, el
velo se funde, las duraciones son `--dur-medium` y `prefers-reduced-motion` las lleva a cero. Para que
la salida se vea, `ConSalida` deja montada la hoja hasta `transitionend` (con un tope de 400 ms).
Inventario: movimiento (alta, edición y ficha), contacto nuevo, cliente (alta y edición), ordenar
Proyectos en el celular, y las dos confirmaciones de borrado (proyecto o contacto, y cliente), que
eran capas propias y pasaron a `Hoja` con `role="alertdialog"`. No son hojas el menú de «Cargar algo
nuevo», los avisos ni los paneles en línea.

**3. `MoneyInput` en `packages/ui`.** Entrega centavos enteros y formatea mientras se escribe: los
dígitos entran por la derecha con el cursor fijo al final (5, 50, 500, 5.000), el punto separa miles
y la coma abre los decimales. Pegar un importe con formato lo lee entero. Decide con
`InputEvent.inputType`. Todos los campos de plata lo usan; `parsearPesos` y `pesosEditables`
desaparecieron.

- **Se apartó:** `inputMode="decimal"` en vez de `numeric`. El teclado numérico de iOS no tiene coma,
  y sin coma no hay centavos.

**4. Link estirado en la tarjeta de Seguimiento.** La tarjeta es `relative`; el título lleva un
`::after` absoluto que la cubre. El nombre del cliente, Llamar y WhatsApp suben con `relative z-10`,
y el pie de las acciones es un área muerta con su propio padding, para que un toque al lado de un
botón no abra el trabajo.

- **Se apartó:** el contorno de foco sale de `has-[a[data-tarjeta]:focus-visible]`, no de
  `:focus-within`. Con `:focus-within` la tarjeta entera se marcaba también al enfocar el cliente o
  Llamar, y el contorno decía que el foco estaba en otro lado.

**5. La hoja se abre encima de la pantalla.** `shared/lib/hojas.ts` tiene las hojas por ruta y su
fondo por defecto. El link manda `state={conFondo(location)}`; `Marco` renderiza las pantallas con esa
ubicación y las hojas en su capa. Cerrar con fondo es `navigate(-1)`, así que el botón atrás del
navegador la cierra. Entrando directo por la URL, cae en el fondo por defecto (Finanzas, Seguimiento).
Los `volverA` encontrados: el de `rutas.ts` y el de `MovimientoSheetPages` se borraron, y Diezmo manda
el fondo en el `state`. Los de `shared/api/sesion.ts` son la URL de vuelta de los mails de Supabase,
no navegación, y quedan. `volverALiquidar` y `volverAlDuenio` no tienen nada que ver.

**Por mi cuenta:** la acción rápida «Movimiento» también abre la hoja encima de donde estés, en vez
de mandarte a Finanzas.

## Correcciones y mejoras

- **Un solo molde de pantalla:** `Pagina`. Diezmo y Ajustes tenían un ancho propio centrado; ahora
  arrancan donde arrancan las otras cinco.
- **Ajustes** deja de listar las tablas de la réplica y dice la fecha de la última sincronización.
- **Formulario de proyecto en escritorio:** la barra de arriba y la de totales quedan fijas, los
  números de abajo son más grandes, y los títulos de Pagos y Gastos, con su ayuda, quedan pegados
  debajo de la barra. Los campos llevan `scroll-margin` para que el teclado no los deje debajo de una
  barra, y el rechazo de la base se mueve adentro de la barra de totales para que se vea.
  - **En el celular los títulos no son fijos**, a propósito: con el teclado abierto quedan unos 350 px
    y un bloque fijo de dos líneas taparía el campo que se está escribiendo.
- **Avisos al guardar.** El suscriptor del `MutationCache` (`avisos-de-la-cola.ts`) lee
  `meta.avisos` de cada mutación. Con señal, «Movimiento guardado.» recién con la respuesta; sin señal,
  «Movimiento anotado sin señal: se guarda solo cuando vuelva.», y cuando drena, «Movimiento guardado.
  Estaba anotado sin señal.». Un error dice qué no se guardó y por qué, con la operación y el nombre.
  Lo transitorio va en un `role="status"`; cada error en su `role="alert"` y no se va solo. Cada tono
  tiene ícono y verbo propios. La bandeja de rechazos que ya existía (ADR 0016) se mantiene y vive en
  el mismo contenedor.
- «Registrar diezmo», y el logo lleva a Inicio con «MAUN, ir a Inicio» como nombre.

## Lo atado

- **El mensaje del mes** lee lo mismo que la barra (`faltaDelSueldo`). Resuelve la objeción del ADR 0011.
- **`saldo` es `null` sin presupuesto.** Cero diría «ya pagó todo», y en verde. «—» dice que no hay con
  qué comparar. No cuenta como entregado con saldo, y en el orden por saldo va al final.
- **La apertura fuera de las cifras del mes:** `resumenMensual` excluye todo `ajuste`.
  - Por qué el tipo y no otra marca: `ajuste` no se carga desde el formulario manual; lo escriben la
    migración y la corrección de Cocos, y ninguno de los dos es plata que entró o se gastó. «Facturó el
    taller» ya contaba solo pagos.
  - Descartado **fecharla el día anterior**: solo sirve si el corte es un día 1, y el libro diría una
    fecha que no pasó.
  - Descartado **una columna que la marque**: pedía una migración sobre una tabla con datos, por algo
    que el tipo ya dice.
  - Queda: `estadoDelDiezmo` cuenta la apertura del DIEZMO en «generado» o «pagado». El saldo está
    bien; la barra «Diezmo pagado» puede verse corrida. No se tocó: no es una cifra del mes.

## Objeciones

- **El cursor fijo al final** hace imposible corregir un dígito del medio sin borrar hasta ahí. En el
  celular es lo esperable; en la PC, con mouse, molesta. Se implementó como se pidió.
- **Entrar por URL a una hoja** muestra el fondo por defecto, no la pantalla desde la que se había
  abierto: esa información solo existe en el historial de esa pestaña.
- **`@starting-style`** pide Safari 17.5 o más. En uno más viejo la hoja se abre y se cierra igual,
  sin animación. Nada se probó en un iPhone de verdad, solo en viewport emulado.

## Consecuencias

- Un color nuevo lleva sus dos valores en `theme.css`; un campo de plata nuevo es un `MoneyInput`; una
  hoja nueva es un `Hoja` en `ConSalida`, y si va por ruta, una entrada en `HOJAS_POR_RUTA`.
- Una mutación que merece confirmación lleva `meta: metaDeAvisos(...)`. Sin meta no avisa nada.
- En el e2e, `getByRole('status')` solo ya no sirve: `indicadorDeSync` y `avisosEnPantalla`.
