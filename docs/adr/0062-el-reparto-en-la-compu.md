# 0062. En la compu, tres repartos: secciones en filas, principal y de apoyo, y tablero

- Estado: aceptada
- Fecha: 2026-09-22
- Corrige al [0020](0020-pulido-visual.md) en el molde: `Pagina` sigue siendo uno, pero su ancho
  máximo sale del reparto y en la app arranca junto al menú. Corrige al
  [0013](0013-shell-navegacion-e-inicio.md) en lo que la sidebar dejaba a cada pantalla: el contenido ya
  no se centra en el espacio que sobra. El reparto de Ajustes por temas, a izquierda y derecha, que
  anotaba `apps/web/CLAUDE.md`, queda reemplazado.

## Contexto

El dueño, sobre una captura de Ajustes en la compu:

> Acá en desktop, en /ajustes, hay una columna MUY VACÍA porque los elementos de esa pantalla están
> MAL distribuidos. Esto pasa en desktop, y en MUCHAS otras pantallas de desktop.

Ajustes partía sus secciones en dos columnas por tema. La del taller era mucho más larga, y «Versión de
la app» iba a la fila siguiente de la grilla, que empezaba donde terminaba la columna larga. Además, en
pantallas anchas el contenido tenía un tope de 1180 px centrado en el espacio que deja el menú, y eso
abría una franja vacía entre el menú y el contenido.

**La regla que manda.** Dos columnas se justifican en dos casos: cuando las dos tienen contenido del
mismo peso que se mira a la par, o cuando una acompaña a la otra y la sigue al scrollear. Partir en dos
una lista de secciones que no tienen que ver entre sí, para llenar el ancho, no es ninguno de los dos:
cada columna crece con sus datos y la más corta deja el hueco. El arreglo cambia cómo se reparte cada
pantalla, sin tocar lo que muestra: los mismos textos, en el orden que ya tenían en el celular.

## Lo que se midió antes de tocar nada

Un test nuevo (`e2e/reparto/hueco.spec.ts`, abajo) recorrió 29 pantallas en 768, 1024, 1280, 1440,
1920 y 2560 de ancho, con un taller chico y con uno cargado (una obra con 40 pagos, 40 gastos, 24 cosas
que hacen falta, 16 archivos y notas largas; 30 clientes; 150 movimientos; 40 anotaciones; 10
opiniones). Mide, en cada grilla o fila de más de una columna, la franja más alta sin nada visible
(texto, controles, cajas con fondo o borde) dentro de cada columna, entre el techo y el piso de la
grilla; cuántos píxeles quedan entre el menú y el primer texto del contenido; y si algo se ve antes
que lo que va primero en el DOM. Las capturas de cada pantalla entera se miraron a mano.

Lo peor de cada pantalla, en píxeles y en pantallas visibles, con el taller cargado:

| Pantalla                      | Cómo repartía                                               | Hueco, antes                            |
| ----------------------------- | ----------------------------------------------------------- | --------------------------------------- |
| Ajustes                       | dos columnas de temas desde 1280, «Versión» en la fila 3    | 1575 px (1,97) a 1280                   |
| Ficha de una obra             | dos columnas 1:1 desde 1024, las dos crecen                 | 2275 px (2,84) a 1280                   |
| Ficha de una obra entregada   | igual                                                       | 2793 px (3,64) a 1024                   |
| Ficha de un contacto          | igual                                                       | 831 px (0,92) a 1440                    |
| Proyecto nuevo                | datos a la izquierda, opciones, pagos y gastos a la derecha | 690 px (0,90) a 1024                    |
| Editar proyecto               | igual                                                       | 8622 px (11,23) a 1024                  |
| Lo que ve el cliente (app)    | 7/5 desde 1024, las dos crecen                              | 3910 px (5,09) a 1024                   |
| Lo que ve el cliente (enlace) | igual                                                       | 3855 px (5,02) a 1024                   |
| Finanzas                      | 7/5 desde 1280; en la tablet `order` invertía el DOM        | orden cambiado a 768–1279               |
| Diezmo                        | 7/5 desde 1280 con `col-start`/`row-start`                  | orden cambiado desde 1280               |
| Todas las del marco           | tope de 1180 centrado                                       | franja de 283 px a 1920 y 603 px a 2560 |

El resto (Inicio, Agenda, Seguimiento, Proyectos, Clientes, la ficha de un cliente, Opiniones,
Preguntas, Avisos, Aprobar, Compartir, Cobrar, las hojas, la encuesta y el acceso) no pasaba de 0,34
pantallas en ningún ancho. La tabla completa, pantalla por pantalla y ancho por ancho, antes y después,
está en el PR.

## Decisión

### Tres repartos, como componentes del sistema de diseño

Viven en `packages/ui` al lado de `Pagina`, porque no conocen nada del dominio, y la app los usa por
`@/shared/ui`. Ninguna pantalla arma su propia grilla de columnas.

**`SeccionesEnFilas` y `SeccionEnFila`**, para Ajustes y los formularios con secciones. Cada sección
ocupa todo el ancho: el título y, si la hay, una línea que explica, en 15rem a la izquierda; los
controles a la derecha. Una explicación larga va arriba de los controles, del lado derecho. Cada fila
mide lo que mide su sección, así que entre columnas no puede quedar un hueco. Donde no entran las dos
(el contenedor por debajo de 44rem), la sección es la de siempre: el título arriba, una columna de 560.

- **Los campos tienen el ancho de lo que llevan.** Con dos columnas la lista define `--campo-corto`
  (8rem, un porcentaje), `--campo-medio` (16rem, plata, un alias, un CUIT) y `--campo-largo` (24rem, un
  nombre, un CBU), y los campos usan `max-w-(--campo-*)`. Sin la variable el tope es `none`, así que en
  el celular nada cambia. El link de Mercado Pago, el de la reseña y las notas siguen a todo el ancho:
  llevan textos largos.
- **El formulario de proyecto usa la forma de una columna.** Sus listas (opciones, pagos, gastos) traen
  su propio encabezado, fijo al scrollear, y los datos del trabajo no tienen título: ponerles uno
  sería texto nuevo. Van como filas con el título arriba, en el orden del celular, y la barra de
  totales sigue fija abajo.

**`PrincipalYApoyo`**, para las fichas y lo que lleva un resumen al lado. En el principal va todo lo
que crece con los datos; en el de apoyo, lo corto y fijo. **Nada que crezca va al apoyo.**

- **El apoyo mide 22,5rem (360 px) y el principal, el resto.** Es el panel fijo de Material 3 para las
  ventanas anchas. En el ancho máximo de una ficha eso da 804 y 360 px, 69 % y 31 %, que es el 70/30
  que pide la guía de Android.
- **Se pega arriba al scrollear, 20 px debajo del borde, solo si entra en lo visible** con 20 px de aire
  arriba y abajo (`entraALaVista`, medido con `ResizeObserver` contra el contenedor que scrollea: el
  `<main>` en la app, la ventana en la vista pública). Si no entra, no se pega: pegado, su parte de abajo
  quedaría inalcanzable hasta el final de la página.
- **Donde no entran los dos (el contenedor por debajo de 52rem), van uno arriba del otro**, en el orden
  del DOM.

**`Tablero`**, para las tarjetas del mismo peso. Las columnas salen del ancho mínimo de la tarjeta
(`repeat(auto-fill, minmax(min(var(--tarjeta-minima), 100%), 1fr))`, o `auto-fit` con `completar`), o
van todas en una fila cuando entran (`enUnaFila`, desde 54rem: los tesoros, que son dos por fila o
cuatro, nunca tres y una sola). Las tarjetas de una fila miden lo mismo, como en cualquier grilla: el
tablero no les cambia la alineación. Una tarjeta mucho más alta que sus vecinas va en `CeldaAncha`, a
todo el ancho. Sin masonry.

### Qué decide si entran dos columnas: el área de contenido

Con consultas de contenedor de Tailwind 4 (`@container/nombre` y `@min-[…]/nombre:`), nunca con
`md:`/`lg:`/`xl:` de la ventana: el menú ocupa 76 px en la tablet y 232 en la compu, así que la misma
ventana deja áreas distintas. **Los contenedores existen solo desde 768** (`md:@container/secciones`,
`/apoyo` y `/tablero`): por debajo no hay consulta que se cumpla y el celular queda exactamente igual.

### El orden del DOM es el que se ve

En el celular y en la compu. Nada de `order`, `grid-auto-flow: dense` ni `col-start`/`row-start` para
ubicar algo en otro lugar. Las secciones quedan en el orden que tenían en el celular y la compu pasa a
usar el mismo. En `PrincipalYApoyo` el lado sale de ahí: si en el celular el apoyo va antes que el
principal, en la compu va a la izquierda (`apoyoPrimero`); si va después, a la derecha. El componente
arma la grilla en ese orden y no tiene forma de invertirlo.

### El ancho y dónde arranca

**Cada reparto tiene su ancho máximo**, con el padding incluido, como el `--content-max` de antes:
formulario 60rem (960 px, 888 de contenido: 240 de títulos, 48 de aire y 600 de controles), ficha
80rem (1280) y tablero 100rem (1600). Lo demás (listas, la agenda, Opiniones) conserva los 1180 de
siempre. `Pagina` recibe `ancho` y los topes viven en `theme.css` (`--ancho-*`).

**El contenido arranca junto al menú**, con el margen de la página, y lo que sobra queda a la
derecha. `Pagina` toma su margen izquierdo de `--inicio-de-la-pagina`, que vale `auto` y que el
`<main>` de `Marco` pone en `0`. Así todas las pantallas de la app se alinean con el mismo borde, y la
vista pública, que no tiene menú, se sigue centrando en la ventana. Se eligió así por tres motivos: el
dueño describió la franja entre el menú y el contenido como el problema; la vista va del menú al
contenido, y a 2560 centrar la separaba 603 px; y la guía de Apple pide poner lo importante cerca del
borde de arriba y del lado de inicio de la ventana.

### Cómo quedó cada pantalla

| Pantalla                       | Reparto                        | Qué va dónde                                                                                                     |
| ------------------------------ | ------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Ajustes                        | secciones en filas             | las trece secciones en filas, en el orden del celular; formulario                                                |
| Formulario de proyecto         | secciones en filas             | una columna: datos, opciones, pagos, gastos; la barra de totales sigue fija; formulario                          |
| Ficha de una obra              | principal y de apoyo           | apoyo a la izquierda: seña, qué falta, cobrar o perder. Totales y el pedido de opinión arriba, a lo ancho; ficha |
| Ficha de un contacto           | principal y de apoyo           | apoyo a la izquierda: llamar y WhatsApp, y el paso siguiente; ficha                                              |
| Ficha de un cliente            | principal y de apoyo           | apoyo a la izquierda: contacto, cómo llegó, facturación. Notas e historial al principal; ficha                   |
| Finanzas                       | principal y de apoyo           | apoyo a la izquierda: el mes contra el anterior; el libro al principal; ficha                                    |
| Diezmo                         | principal y de apoyo           | apoyo a la izquierda: el estado y lo generado y pagado; el historial al principal; ficha                         |
| Lo que ve el cliente (los dos) | principal y de apoyo           | apoyo a la izquierda: «Tu mueble». Camino, lo que pasó, pagos, fotos, datos y cómo pagar al principal; ficha     |
| Inicio                         | tablero + principal y de apoyo | tesoros en una fila; el mes al principal, los accesos y Cocos al apoyo; tablero                                  |
| Proyectos y Seguimiento        | tablero                        | tarjetas de 19rem como mínimo; la tabla de la compu sigue igual; tablero                                         |
| Opiniones                      | tablero (los comentarios)      | tarjetas de 27rem como mínimo; el resto, una columna como antes                                                  |

Sin cambios de reparto, con motivo: la agenda (la grilla del mes ocupa todo el ancho y el día se abre
en una capa: desparejo por naturaleza, ADR 0034); Clientes, Preguntas, Avisos, Aprobar, Compartir,
Cobrar y Dar por perdido (ya eran una columna); las hojas (sus pares de campos cortos y de lo mismo,
como teléfono y zona o CUIT y razón social, son la excepción que Baymard y NN/g aceptan); la encuesta
(una columna); y el acceso (ver «Dónde se aparta del pedido»).

### El test del hueco, en `pnpm verify`

`e2e/reparto/hueco.spec.ts`, con su config (`playwright.reparto.config.ts`), corre en `pnpm verify`
después del arnés del aviso: los dos usan la cuenta de prueba y el arnés vacía el taller, así que no
pueden ir a la vez. Siembra el taller chico y el cargado, recorre las pantallas en los seis anchos y
falla si:

- **una columna deja más de media pantalla visible vacía**. Media pantalla es lo que el dueño vería en
  blanco de ese lado al llegar al final de la columna corta: más ya se lee como hueco. Menos deja pasar
  lo que no lo es: dos tarjetas de alto distinto en una fila (275 px en Seguimiento a 1280, 0,34
  pantallas) o el aire de una sección. La captura del dueño eran 1,97 pantallas.
- **quedan más de 64 px entre el menú y el primer texto**: el margen de la página es 36, y 64 deja lugar a
  un ícono o a una sangría.
- **algo se ve antes que lo que va primero en el DOM**: más arriba, o a la izquierda en la misma banda.

Una columna de apoyo pegada no cuenta como hueco: acompaña al principal. Las excepciones van una por
una, con su motivo, en `EXCEPCIONES`: la fila de una sección (título y controles son una sola cosa) y la
marca de las pantallas de sesión. Con `CAPTURAS_DEL_REPARTO=<carpeta>` guarda además la captura
entera de cada pantalla en cada ancho y en 390.

## Dónde se aparta del pedido

- **Inicio no es un tablero puro.** Los tesoros sí (cuatro tarjetas del mismo peso en una fila). Lo de
  abajo no son tarjetas del mismo peso sino el mes (el mensaje, las tres cifras y las barras) y, al
  costado, accesos cortos y la proyección de Cocos: es un principal con su apoyo, que es lo que ya
  hacía el 7/5 de antes. Se resolvió con el reparto que más se acerca, sin inventar un cuarto.
- **En la vista del cliente el apoyo es «Tu mueble», no el recuadro de cobros.** Lo corto y fijo de la
  página son dos bloques: arriba, el trabajo, la etapa y cuánto falta; abajo, los datos del trabajo y
  cómo pagar. El de abajo medía 925 px con link y efectivo, a los 443 px de ancho que tenía (a 360
  es más alto): no entra en lo visible de una laptop (800 a 900), así que no podría ir pegado, y suelto al lado de un principal largo es el mismo hueco
  (3855 px con fotos y pagos). «Tu mueble» mide unos 350, entra siempre y es lo que conviene tener a la
  vista. Todo lo de cobros sigue en la columna derecha, debajo de los datos del trabajo, como pidió el
  dueño en el ADR 0054.
- **En la ficha de una obra, los totales y el pedido de opinión siguen a lo ancho, arriba.** Con ellos
  adentro, apilados a 360 px, el apoyo de una obra entregada se iba, estimado y no medido, por encima de
  lo que entra en una laptop. Afuera, el apoyo (la seña, qué falta y cobrar o perder) mide entre 380 y
  430 px, medido, y entra siempre.
- **El formulario de proyecto no lleva el título a la izquierda** (ver arriba): sus secciones traen su
  propio encabezado y la primera no tiene título.
- **La marca de las pantallas de sesión queda como estaba**, y es la única excepción de orden. Desde
  1024 la frase «Un taller, cuatro tesoros.» va abajo y el lema al medio, al revés que en el DOM. Son
  tres textos fijos sin controles, así que el teclado no pasa por ahí y el sentido no cambia. Ponerlos
  en el orden del DOM cambia el diseño de la pantalla de entrada, y ponerlos en el orden visual cambia
  el celular.
- **Las filas de pagos y gastos del celular siguen poniendo el tacho arriba a la derecha**
  (`col-start-3 row-start-1` por debajo de 32rem de fila). Es un orden visual distinto del DOM, pero
  solo por debajo de 768 en la práctica, y el celular no se toca en este cambio. En la tablet y la compu
  la fila entra en un renglón y el orden coincide. Queda anotado.
- **Dos premisas del pedido estaban desactualizadas.** `container-type: inline-size` ya no crea un
  bloque contenedor para lo posicionado ni un contexto de apilamiento (el CSSWG lo sacó en 2024, y
  Chrome, Safari y Firefox lo cambiaron); igual cada fila y cada columna lleva su `relative`, por la
  lección del ADR 0054. Y Material 3 no reparte el panel de apoyo por porcentaje: lo fija en 360 dp en
  ventanas anchas (412 en las más grandes). Android sí dice 70/30 y mitad y mitad; el ancho fijo da los
  dos en la práctica.

## Alternativas descartadas

- **Masonry nativo (`display: grid-lanes`).** A hoy es estable solo en Safari 26.4. En Chrome 154, que
  salió hoy, sigue detrás de un flag, y el dueño usa Chrome y un Samsung. Aunque estuviera, pone cada
  tarjeta en la pista más corta: cuando una sección cambia de alto mientras se edita, las de abajo
  saltan de columna. Además, el orden de lectura y de teclado sigue al DOM mientras el ojo sigue otro, y
  `reading-flow`, que lo arreglaría, en Chromium no se aplica a `grid-lanes`.
- **`columns: 2`.** Llena de arriba hacia abajo y equilibra el alto: un cambio de alto mueve secciones
  de una columna a la otra, y el teclado baja por toda la primera antes de subir a la segunda.
- **Repartir a mano las secciones entre dos columnas**, que era lo que había. Queda parejo el día que se
  arma y se desarma con los datos: con muchos pagos la ficha dejaba 2275 px vacíos, y cada sección nueva
  obliga a volver a elegir columna. Ajustes necesitó `grid-rows-[auto_1fr]` y `row-start` para
  sostenerlo, y aun así dejó la captura del dueño.
- **Pegar el apoyo por abajo cuando no entra** (el borde de abajo a la vista, lo de arriba tapado). Evita
  el hueco, pero el pedido dice que un apoyo que no entra no va pegado, y no hizo falta: en cada
  pantalla se eligió un apoyo que entra.
- **Centrar el contenido en el espacio que deja el menú.** Es lo que había, y deja la franja entre el
  menú y el contenido que el dueño marcó.
- **Estirar o rellenar para tapar los huecos.** Deja el reparto igual y el hueco vuelve con los datos.

## Objeciones

- **El apoyo pegado deja aire debajo suyo, en lo visible.** En una ficha larga el panel de 400 px queda
  arriba y abajo de él hay blanco mientras se leen los pagos. Es el costo de que acompañe, y es el caso
  que la regla acepta; en la captura de la página entera parece un hueco, porque ahí no hay scroll. Las
  capturas en tres alturas de scroll muestran cómo se ve de verdad.
- **Media pantalla es un umbral.** Seguimiento con muchos contactos deja 275 px (0,34) entre dos
  tarjetas de alto distinto en una fila, y pasa. Si el dueño lo nota, el umbral se baja o esas tarjetas
  van en `CeldaAncha`.
- **En Inicio, el título de la entrega más próxima se corta antes** («Placard de tres puertas
  corredi…»): el apoyo mide 360 y antes esa columna medía entre 390 y 460. Ya estaba hecho para
  cortarse con puntos suspensivos.
- **El test del reparto hace más largo `pnpm verify`**: corre después del arnés del aviso, porque los
  dos usan la misma cuenta de prueba, y suma su tiempo entero.
- **Nada de esto se miró en la pantalla del dueño.** Las medidas y las capturas son de Chromium, sin
  zoom. Su captura estaba muy alejada; 2560 de ancho es lo más cerca que se probó.

## Fuentes

Consultadas el 2026-09-22.

- Baymard Institute, «Form Field Usability: Avoid Extensive Multicolumn Layouts», 31/10/2023,
  <https://baymard.com/blog/avoid-multi-column-forms>: «single-column layouts resulted in fewer skipped
  fields, misinterpreted fields, and errors compared to multicolumn layouts», y la excepción: «having 2–3
  inputs on a single line didn't cause issues when they logically belonged to the same single entity —
  and so long as the rest of the overall form layout only consisted of a single column». El «16 %» del
  título es de sitios que usan esos formularios, no de usuarios que se equivocan.
- Baymard, 31/08/2010, <https://baymard.com/blog/form-field-usability-matching-user-expectations>:
  «adjust the width of your form fields so it matches the length of the expected input». NN/g,
  <https://www.nngroup.com/articles/web-form-design/>: «Text fields should be about the same size as the
  expected input».
- Android, «Canonical layouts» (actualizada el 2026-08-04),
  <https://developer.android.com/develop/ui/compose/layouts/adaptive/canonical-layouts>: lista y detalle,
  feed y supporting pane; «For medium width, split the display space equally between the main and
  supporting content. For expanded width, give 70% of the space to the main content, 30% to the
  supporting content», y en ventanas angostas el apoyo «below the main content or inside a bottom
  sheet».
- Material 3, supporting pane y breakpoints, <https://m3.material.io/foundations/layout/canonical-examples/supporting-pane>
  y <https://m3.material.io/foundations/layout/breakpoints/expanded>: el apoyo fijo en 360 dp en
  expanded y 412 en large; «the secondary content is only meaningful in relation to the primary
  content».
- Apple HIG, «Layout», <https://developer.apple.com/design/human-interface-guidelines/layout>: «place the
  most important items near the top and leading side of the window or display».
- Masonry: chromestatus 5149560434589696 (dev trial, flag `css-grid-lanes-layout`, actualizada el
  2025-12-13); notas de Safari 26.4, «Added support for CSS display: grid-lanes»; borrador de CSS Grid
  3 del 2026-09-02, «placing each item … into the "shortest" track available»; código de Chromium,
  `layout_box.cc`, «TODO(almaher): Add reading flow support for grid-lanes».
- Tailwind CSS 4, <https://tailwindcss.com/docs/responsive-design#container-queries>: `@container`,
  contenedores con nombre (`@container/{name}`, `@sm/{name}`) y tamaños arbitrarios (`@min-[475px]`).
- CSS Conditional 5, <https://drafts.csswg.org/css-conditional-5/#container-type>: `inline-size`
  «Applies style containment and inline-size containment», y la resolución del CSSWG del 24/07/2024,
  «container-type does not force layout containment».
- WCAG 2.2, 1.3.2 y 2.4.3, <https://www.w3.org/TR/WCAG22/>, y la técnica C27,
  <https://www.w3.org/WAI/WCAG22/Techniques/css/C27>: «ensure that the order of content in the source
  code is the same as the visual presentation of the content». CSS Display 3: «The order property does
  not affect ordering in non-visual media (such as speech)».
- CSS Positioned Layout 3, <https://drafts.csswg.org/css-position-3/#stickypos-insets>, y el issue 2558
  del CSSWG: un sticky más alto que lo visible deja su exceso tapado «until scrolling all the way to the
  other side of it's containing block».

## Verificación

- **El test del reparto**, con los dos talleres y en los seis anchos, falla sobre `main` (Ajustes a 1280:
  1575 px, 1,97 pantallas; la franja de 283 px a 1920 y de 603 a 2560; el orden de Finanzas en la
  tablet y el de Diezmo y Ajustes en la compu) y pasa en esta rama. Con el taller cargado, lo peor
  que queda en cualquier pantalla y ancho son 275 px (0,34 pantallas, Seguimiento a 1280, dos tarjetas
  de alto distinto en una fila); las fichas bajaron de 2275, 2793 y 831 px a 162, 28 y 46; el
  formulario de edición, de 8622 a 126; la vista del cliente, de 3910 a 49; Ajustes, de 1575 a 0.
  Ninguna pantalla deja franja junto al menú en 1920 ni en 2560.
- **El apoyo pegado** (ficha de obra, entregada y contacto, Finanzas y la vista del cliente, a
  1280×800 y 1440×900, arriba, en el medio y al final del scroll): se queda a 20 px del borde de
  arriba y su borde derecho termina 44 px antes de que empiece el principal: no tapa nada.
- **El teclado**, en Ajustes y en la ficha de una obra a 1440: Tab recorre de arriba abajo, y en la
  ficha primero la columna de apoyo y después la principal, que es el orden en que se ven.
- **El celular no cambió.** Las dos versiones, `main` y esta rama, sobre los mismos datos y a 390 de
  ancho, comparadas píxel por píxel en las 28 pantallas con el taller chico y con el cargado: iguales
  salvo el logo de Mercado Pago (su placa blanca, sin correr nada), el número de versión en Ajustes
  y diferencias de datos entre las dos corridas (la dirección del enlace lleva el puerto de cada
  servidor, la primera corrida abrió la página del cliente antes de que la segunda fotografiara
  Compartir, y miniaturas de archivos de prueba que todavía no habían terminado de cargar).
- `pnpm e2e`: 458 pasaron y 87 se saltearon por proyecto, sin fallas. Tests: dominio 494, `@maun/ui`
  64, la app 946, la base 187.
- El bundle suma 2,1 kB de JS (1,3 kB con gzip) y 1,4 kB de CSS (0,45 kB con gzip). El chunk de vendor
  no cambió.
- Nada en `supabase/` ni en `packages/db`: ni migraciones ni la función pública.

## Consecuencias

- Toda pantalla nueva usa uno de los tres repartos y se suma a `PANTALLAS` del test. `apps/web/CLAUDE.md`
  lo dice en «El reparto en la compu».
- Una pantalla que quiera algo distinto de lo que da su reparto consulta el contenedor por su nombre
  (`@min-[52rem]/apoyo:`), no la ventana.
- Un apoyo que no entra en lo visible no va al costado: se achica, no se deja suelto.
