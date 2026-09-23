# 0062. En la compu, tres repartos: secciones en filas, principal y de apoyo, y tablero

- Estado: aceptada, corregida el 2026-09-22: el ancho vuelve a ser uno solo, el de siempre,
  centrado en todas las pantallas (ver «El ancho: uno solo, centrado»), y las pantallas de una
  columna angosta pasan a ocupar el ancho entero.
- Fecha: 2026-09-22
- Revisa el [0020](0020-pulido-visual.md) en el molde: `Pagina` sigue siendo uno, con el mismo ancho y
  centrado, y ninguna pantalla lo cambia. El reparto de Ajustes por temas, a izquierda y derecha, que
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
controles, en el resto. Una explicación larga va arriba de los controles, del lado derecho, con su
medida de lectura (42rem). Cada fila mide lo que mide su sección, así que entre columnas no puede
quedar un hueco. Donde no entran las dos (el contenedor por debajo de 44rem), la sección es la de
siempre: el título arriba, una columna de 560.

- **Los campos tienen el ancho de lo que llevan.** Con dos columnas la lista define `--campo-corto`
  (8rem, un porcentaje), `--campo-medio` (16rem, plata, un alias, un CUIT) y `--campo-largo` (24rem, un
  nombre, un CBU), y los campos usan `max-w-(--campo-*)`. Sin la variable el tope es `none`, así que en
  el celular nada cambia. El link de Mercado Pago, el de la reseña y las notas siguen a todo el ancho:
  llevan textos largos.
- **Los campos cortos que van juntos comparten renglón** (`CamposJuntos`, abajo): el nombre del taller y
  los cinco números del reparto y las metas, en dos renglones de tres; el alias con el CVU y el titular
  con el CUIT, del mismo ancho, así los dos renglones terminan en el mismo borde.
- **El formulario de proyecto usa la forma de una columna.** Sus listas (opciones, pagos, gastos) traen
  su propio encabezado, fijo al scrollear, y los datos del trabajo no tienen título: ponerles uno
  sería texto nuevo. Van como filas con el título arriba, en el orden del celular, y la barra de
  totales sigue fija abajo. Los datos del trabajo van en renglones de campos juntos, en el orden del
  celular: cliente y trabajo; presupuesto y seña; la forma de pago; las tres fechas; estado, dirección
  y comprobante; y las notas a todo el ancho.

**`CamposJuntos`**, para dos o tres campos que van juntos. No es un cuarto reparto de la pantalla: es
el renglón de campos, como `FilaDeAcciones` es el de botones. Los pone uno al lado del otro, en el
orden del DOM, **cuando entran todos** con su ancho mínimo cómodo (`campoMinimo`, 12, 14 o 16rem), y si
no, uno abajo del otro; con `deADos`, tres que no entran van de a dos antes de ir de a uno. Adentro
de un renglón, cada campo llena su celda, así los renglones terminan en el mismo borde. Lo decide su
propio contenedor (`md:@container/campos`), así que en el celular no cambia nada y en un lugar angosto
de la compu, como el estado vacío de Inicio, tampoco. Baymard
acepta dos o tres campos en un renglón cuando son parte de lo mismo. Casi todos los que se juntaron
acá lo son: los plazos de un trabajo, la cuenta a la que te transfieren, los números del taller, el
presupuesto con su seña. Dos renglones del formulario de proyecto no: cliente y trabajo, y estado,
dirección y comprobante. Van juntos porque el orden del celular los pone seguidos y moverlos cambiaría
el celular (ver «Objeciones»).

**`PrincipalYApoyo`**, para las fichas y lo que lleva un resumen al lado. En el principal va todo lo
que crece con los datos; en el de apoyo, lo corto y fijo. **Nada que crezca va al apoyo.**

- **El apoyo mide 22,5rem (360 px) y el principal, el resto.** Es el panel fijo de Material 3 para las
  ventanas anchas. En el ancho de la página eso da 704 y 360 px, 66 % y 34 %, cerca del 70/30 que
  pide la guía de Android. **El apoyo `amplio` pasa a 26rem (416 px) cuando el contenedor mide 64rem**
  (desde 1440 de ventana), que es el 412 dp de Material 3 para las ventanas más grandes: lo usan Inicio
  (el nombre de la entrega más próxima se cortaba a 360; debajo de 1440 pasa a dos renglones), Finanzas
  (el gráfico del mes achicaba su letra), Diezmo (para que la lista arranque en la misma columna que en
  Finanzas) y la vista del cliente (el recuadro de cómo pagar).
- **Acompaña al scrollear, siempre.** Si entra en lo visible con 20 px de aire arriba y abajo
  (`entraALaVista`, medido con `ResizeObserver` contra el contenedor que scrollea: el `<main>` en la
  app, la ventana en la vista pública), se pega arriba, a 20 px del borde. **Si no entra, se pega por
  abajo** (`topeDelApoyo`: el tope es lo visible menos su alto menos 20, un número negativo): sube con la
  página hasta que se ve su final, y ahí se queda. Así nunca queda una parte inalcanzable mientras se
  baja (lo de arriba se leyó al empezar, y lo de abajo queda a la vista), y el apoyo no deja la columna
  vacía al lado de un principal largo.
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
`/apoyo`, `/tablero` y `/campos`): por debajo no hay consulta que se cumpla y el celular queda
exactamente igual.

### El orden del DOM es el que se ve

En el celular y en la compu. Nada de `order`, `grid-auto-flow: dense` ni `col-start`/`row-start` para
ubicar algo en otro lugar. Las secciones quedan en el orden que tenían en el celular y la compu pasa a
usar el mismo. En `PrincipalYApoyo` el lado sale de ahí: si en el celular el apoyo va antes que el
principal, en la compu va a la izquierda (`apoyoPrimero`); si va después, a la derecha. El componente
arma la grilla en ese orden y no tiene forma de invertirlo.

### El ancho: uno solo, centrado

**Todas las pantallas usan el mismo molde, `Pagina`, con el ancho de siempre (`--content-max`, 1180 px
con el padding) y centrado** en el espacio que deja el menú; la vista del cliente por el enlace, que
no tiene menú, en la ventana. El formulario de proyecto, que no usa `Pagina` porque tiene su barra de
arriba y la de totales, usa el mismo ancho y el mismo centrado en las tres partes. Así el borde
izquierdo y el derecho del contenido son los mismos en todas las pantallas, y los márgenes de los
costados son iguales entre sí. Los repartos trabajan **adentro** de ese ancho, y ninguna pantalla lo
cambia.

**Y adentro, el contenido llega a los dos bordes.** Cinco pantallas angostaban su contenido a 720 px
contra la izquierda (`[&>*]:max-w-[720px]`: Aprobar, Compartir, Cobrar, Dar por perdido y Avisos) y
dejaban 388 px vacíos a la derecha del molde. Ya no lo hacen: Compartir pasa a principal y de apoyo
(el enlace y sus acciones al apoyo, qué ve el cliente al principal), Aprobar junta sus campos en
renglones, y las otras tres ocupan el ancho con lo que ya tenían (el trío de importes, los campos del
pago final en un renglón, la distribución y los ajustes de los avisos). Lo que sigue angosto es el
texto corrido, que conserva su medida de lectura (520 a 560 px).

**Corregido el 2026-09-22.** La primera versión de este ADR le dio a cada reparto su ancho
máximo (formulario 60rem, ficha 80rem, tablero 100rem) y pegó el contenido al menú, para sacar la franja
vacía que el dueño había visto entre el menú y el contenido. En la compu eso dejó un espacio blanco
grande a la derecha de todas las pantallas, distinto en cada una según su reparto: Ajustes terminaba en
1150 px de una ventana de 1882, Clientes en 1375, Opiniones en 1349. El hermano del dueño lo pidió
así: los márgenes de los costados como antes, iguales en todas las pantallas, y lo de adentro mejor
repartido, sin huecos. Se sacaron `ancho`, `--ancho-*` y `--inicio-de-la-pagina`. La franja que queda a
los costados en una pantalla ancha (254 px de cada lado a 1920, 574 a 2560) es el margen de siempre,
igual de los dos lados: no es un hueco del reparto.

**La reserva de la barra de scroll va a los dos lados** (`scrollbar-gutter: stable both-edges` en el
`<main>` de `Marco`). Con la reserva de un solo lado, en una pantalla que no scrollea el margen derecho
quedaba 15 px más ancho que el izquierdo, y la revisión de las capturas lo marcó. El costo es que lo que
va de borde a borde adentro del `<main>` (las barras del formulario de proyecto) arranca 15 px después
del menú en la compu con barras de scroll clásicas.

### Cómo quedó cada pantalla

| Pantalla                       | Reparto                        | Qué va dónde                                                                                                       |
| ------------------------------ | ------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Ajustes                        | secciones en filas             | las trece secciones en filas, en el orden del celular; los números del taller y la cuenta en campos juntos         |
| Formulario de proyecto         | secciones en filas             | una columna: datos (en renglones de campos juntos), opciones, pagos, gastos; la barra de totales fija              |
| Ficha de una obra              | principal y de apoyo           | apoyo a la izquierda: el pedido de opinión, seña, qué falta, cobrar o perder. Los totales arriba, a lo ancho       |
| Ficha de un contacto           | principal y de apoyo           | apoyo a la izquierda: llamar y WhatsApp, y el paso siguiente                                                       |
| Ficha de un cliente            | principal y de apoyo           | apoyo a la izquierda: contacto, cómo llegó, facturación. Notas e historial al principal                            |
| Finanzas                       | principal y de apoyo (amplio)  | apoyo a la izquierda: el mes contra el anterior; el libro al principal, con los filtros en dos grupos              |
| Diezmo                         | principal y de apoyo (amplio)  | apoyo a la izquierda: el estado y lo generado y pagado; el historial al principal                                  |
| Lo que ve el cliente (los dos) | principal y de apoyo (amplio)  | apoyo a la derecha: los datos del trabajo y cómo pagar. Tu mueble, camino, lo que pasó, pagos y fotos al principal |
| Compartir con el cliente       | principal y de apoyo           | apoyo a la izquierda: el enlace y sus acciones. Cómo te paga y qué archivos ve al principal                        |
| Aprobar un presupuesto         | una columna, campos juntos     | presupuesto y seña; la cuenta, en cifras en fila; la forma de pago; las fechas; dirección y comprobante            |
| Cobrar y Dar por perdido       | una columna                    | lo de siempre, a todo el ancho: el trío, el pago final en un renglón, la distribución                              |
| Avisos                         | una columna                    | lo de siempre, a todo el ancho                                                                                     |
| Inicio                         | tablero + principal y de apoyo | tesoros en una fila; el mes al principal, los accesos y Cocos al apoyo (amplio)                                    |
| Proyectos y Seguimiento        | tablero                        | tarjetas de 19rem como mínimo; la tabla de la compu sigue igual                                                    |
| Opiniones                      | tablero (los comentarios)      | tarjetas de 27rem como mínimo; el resto, una columna como antes                                                    |

Sin cambios de reparto, con motivo: la agenda (la grilla del mes ocupa todo el ancho y el día se abre
en una capa: desparejo por naturaleza, ADR 0034); Clientes y Preguntas (ya eran una columna a todo el
ancho); las hojas (sus pares de campos cortos y de lo mismo, como teléfono y zona o CUIT y razón social,
son la excepción que Baymard y NN/g aceptan); la encuesta (una columna angosta y centrada, pensada
para el celular del cliente); y el acceso (ver «Dónde se aparta del pedido»).

### El test del hueco, en `pnpm verify`

`e2e/reparto/hueco.spec.ts`, con su config (`playwright.reparto.config.ts`), corre en `pnpm verify`
después del arnés del aviso: los dos usan la cuenta de prueba y el arnés vacía el taller, así que no
pueden ir a la vez. Siembra el taller chico y el cargado, recorre las pantallas en los seis anchos y
falla si:

- **una columna deja más de media pantalla visible vacía**. Media pantalla es lo que el dueño vería en
  blanco de ese lado al llegar al final de la columna corta: más ya se lee como hueco. Menos deja pasar
  lo que no lo es: dos tarjetas de alto distinto en una fila (275 px en Seguimiento a 1280, 0,34
  pantallas) o el aire de una sección. La captura del dueño eran 1,97 pantallas.
- **la pantalla no está adentro del molde común**: su `[data-pagina]` no está centrado en su espacio
  (más de 1,5 px de diferencia entre el margen izquierdo y el derecho) o no mide lo que miden todas en
  ese ancho (1180, o el espacio entero si es más angosto).
- **el contenido no llega al borde derecho del molde**: lo último que se ve a la derecha queda a más de
  64 px del borde de adentro del molde. Es lo que dejaban las cinco pantallas de 720 px.
- **algo se ve antes que lo que va primero en el DOM**: más arriba, o a la izquierda en la misma banda.

Una columna de apoyo pegada no cuenta como hueco: acompaña al principal. Las excepciones van una por
una, con su motivo: en `EXCEPCIONES`, la fila de una sección (título y controles son una sola cosa) y
la marca de las pantallas de sesión; con `sinMarco`, las tres hojas (se abren como panel, con su
ancho), la encuesta y la pantalla de entrada (su propio diseño). Con `CAPTURAS_DEL_REPARTO=<carpeta>`
guarda además la captura entera de cada pantalla en cada ancho y en 390.

La primera versión fallaba con más de 64 px entre el menú y el primer texto. Esa regla es la que empujó
el contenido contra el menú y se reemplazó por las dos del molde.

## Dónde se aparta del pedido

- **No hay un ancho por reparto.** El primer pedido decía «cada reparto tiene su ancho máximo, más
  angosto para los formularios y más ancho para el tablero». Así se hizo, y la corrección lo sacó a
  pedido: un solo ancho, el de siempre, centrado (ver «El ancho: uno solo, centrado»). Lo que el
  primer pedido buscaba con eso, que un formulario no se estire y que el tablero aproveche el ancho, lo
  hacen ahora los campos con su ancho y `CamposJuntos`, y el tablero con sus columnas.
- **Inicio no es un tablero puro.** Los tesoros sí (cuatro tarjetas del mismo peso en una fila). Lo de
  abajo no son tarjetas del mismo peso sino el mes (el mensaje, las tres cifras y las barras) y, al
  costado, accesos cortos y la proyección de Cocos: es un principal con su apoyo, que es lo que ya
  hacía el 7/5 de antes. Se resolvió con el reparto que más se acerca, sin inventar un cuarto.
- **En la vista del cliente el apoyo son los datos del trabajo y cómo pagar, a la derecha**, como pidió
  el dueño en el ADR 0054 («todo lo de cobros en la columna derecha, debajo de los datos del trabajo»).
  La primera versión puso ahí «Tu mueble» y mandó cómo pagar al final del principal: con 40 pagos y 16
  archivos quedaba a unos 7700 px de arriba, siete pantallas más abajo que antes. Lo encontró la
  revisión de las capturas. El recuadro puede no entrar en lo visible (925 px con link y efectivo), y
  por eso se pega por abajo.
- **En la ficha de una obra entregada, el pedido de opinión va arriba del apoyo.** La primera versión lo
  dejaba a todo el ancho, arriba: los botones se estiraban a 530 px al lado de un texto de 560, el
  contador de «Algo puntual» quedaba suelto en el borde derecho y el apoyo arrancaba 450 px más abajo que
  en las otras fichas. En el orden del celular va antes que la seña, así que va primero en el apoyo, y
  el apoyo, que ya no entra en una laptop, se pega por abajo. Los totales siguen a lo ancho, arriba.
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
- **Un apoyo que no entra, suelto** (sin pegar), como decía el primer pedido. Al lado de un principal
  largo deja la columna vacía, que es el hueco que se vino a sacar. Y achicarlo para que entre, que es
  lo que hizo la primera versión, llevó cómo pagar al fondo de la vista del cliente.
- **Pegar el contenido al menú, con el espacio sobrante a la derecha.** Fue la primera versión: deja
  todas las pantallas corridas a la izquierda, con un blanco grande a la derecha, y cada una termina
  en otro lugar. Se volvió a centrar.
- **Un ancho distinto por reparto** (formulario, ficha y tablero). También fue la primera versión: el
  borde de las pantallas saltaba al ir de una a otra.
- **Centrar una columna angosta dentro del molde** para las pantallas de 720 px. Deja los márgenes
  iguales en esa pantalla, pero distintos de los de todas las demás.
- **El botón de cobrar al costado de la distribución, y la nota de Avisos al costado de lo demás**
  (principal y de apoyo, con el apoyo a la derecha). Se probó: el apoyo mide 100 a 150 px y deja casi
  toda la columna derecha en blanco debajo, que es lo primero que el dueño marcó. Esas pantallas van en
  una columna a todo el ancho.
- **Estirar o rellenar para tapar los huecos.** Deja el reparto igual y el hueco vuelve con los datos.

## Objeciones

- **El apoyo pegado deja aire debajo suyo, en lo visible.** En una ficha larga el panel de 400 px queda
  arriba y abajo de él hay blanco mientras se leen los pagos. Es el costo de que acompañe, y es el caso
  que la regla acepta; en la captura de la página entera parece un hueco, porque ahí no hay scroll. Las
  capturas en tres alturas de scroll muestran cómo se ve de verdad.
- **Un apoyo pegado por abajo tapa su parte de arriba mientras se baja.** En la vista del cliente con
  link y efectivo, a mitad de página se ve el final de cómo pagar y no los datos del trabajo. Para
  volver a verlos hay que subir. Es lo que hacen los paneles laterales largos, y es mejor que las dos
  alternativas: el recuadro al fondo del principal o una columna vacía al lado.
- **Con muchos pagos, lo que se edita en la ficha de una obra queda abajo**: los costos, lo que hace
  falta, la entrega, las notas y los archivos van después de las listas de pagos y de gastos, como en
  el celular. Antes, con las dos columnas de temas, estaban arriba a la derecha. Moverlos adelante
  cambiaría el orden del celular.
- **Media pantalla es un umbral.** Seguimiento con muchos contactos deja 275 px (0,34) entre dos
  tarjetas de alto distinto en una fila, y pasa. Si el dueño lo nota, el umbral se baja o esas tarjetas
  van en `CeldaAncha`.
- **En Inicio, el título de la entrega más próxima se corta antes** («Placard de tres puertas
  corredi…»): el apoyo mide 360 y antes esa columna medía entre 390 y 460. Ya estaba hecho para
  cortarse con puntos suspensivos.
- **El test del reparto hace más largo `pnpm verify`**: corre después del arnés del aviso, porque los
  dos usan la misma cuenta de prueba, y suma su tiempo entero.
- **En una pantalla muy ancha vuelve la franja de los costados** que el dueño había visto: 247 px de
  cada lado a 1920 y 567 a 2560. Es el margen de siempre y es parejo, como se pidió en la corrección.
  Si molesta en la compu del taller, lo que se toca es `--content-max`, uno solo para todas.
- **Dos renglones de campos juntos del formulario de proyecto no son de lo mismo**: cliente con
  trabajo, y estado con dirección y comprobante. Baymard mide menos errores cuando los campos que van en
  un renglón son parte de lo mismo. Se juntaron para que el formulario no deje la mitad derecha vacía,
  y siguen el orden del celular, que es también el del teclado.
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

### De la corrección

- **El molde, medido.** Con los dos talleres y en los seis anchos, todas las pantallas del taller y la
  vista del cliente miden lo mismo en cada ancho (662, 918, 1018 y 1178 px de 768 a 1440, por la
  reserva de la barra de scroll, y 1180 desde 1920), con el mismo margen a los dos lados (254 px a 1920
  y 574 a 2560 adentro de la app; 370 y 690 en la vista pública, que no tiene menú), y el contenido
  llega al borde derecho del molde en todas. El mismo test, sobre la versión publicada antes de la
  corrección, falla: a 1920 hay 21 pantallas corridas a la izquierda (Ajustes, con 0 px de un lado y 728
  del otro), 13 con otro ancho (960, 1280 o 1600) y 5 que terminan 388 px antes del borde. Lo peor que
  queda en una columna son 271 px (0,34 pantallas, dos tarjetas de alto distinto en Seguimiento a
  1280, con el taller cargado).
- **La revisión de las capturas.** Ocho revisores miraron las 29 pantallas en 1024, 1280 y 1920 con
  los dos talleres, contra las de antes del reparto. Lo que encontraron se arregló: cómo pagar al fondo
  de la vista del cliente, Opiniones y Preguntas 28 px más angostas que el resto (tenían un tope propio
  de 1080), la opinión de la obra entregada a todo el ancho, la columna de títulos de Ajustes y los
  campos desparejos, la caja de la dirección 24 px más abajo que sus vecinas en el formulario, la
  tabla de Proyectos 5 px más ancha que el molde, los botones de las tarjetas de Seguimiento a alturas
  distintas, los filtros de Finanzas partidos, el gráfico del mes con letra chica, el nombre de la
  entrega cortado en Inicio y los 15 px de diferencia entre los márgenes por la barra de scroll.
  Una segunda revisión, sobre las capturas finales, no encontró nada grave, y de lo que marcó se
  arregló: el nombre de la entrega en Inicio por debajo de 1440 (ahora baja a dos renglones), los
  números de Ajustes de a uno a 1024 (ahora de a dos), los campos de la cuenta que no llegaban al borde
  de su renglón, el selector de tema estirado, el texto de Cocos sin su medida de lectura, el resumen
  de Aprobar estirado a lo ancho (ahora son cifras en fila, como la barra de totales), la caja del
  cliente más alta que la del trabajo, el apoyo de Diezmo más angosto que el de Finanzas y los botones
  del enlace en Compartir con dos tamaños de letra.
- **Lo que quedó como estaba**, anotado: en Cobrar y Dar por perdido a 1920, el nombre de cada parte
  de la distribución queda lejos de su monto (las líneas finas guían); en la obra entregada el apoyo no
  entra en una laptop y «Cobrar el saldo» se ve al bajar un poco; una sola foto en la vista del cliente
  ocupa media grilla; las rayas de las barras del formulario de proyecto arrancan 15 px después del
  menú, por la reserva de la barra de scroll a los dos lados. Y detalles que ya estaban antes: el
  gráfico «En el tiempo» de Opiniones recostado a la izquierda, la X de «Cancelar» 16 px adentro del
  borde, los filtros de Seguimiento a 1024, el primer día de Finanzas pegado al buscador, la etapa del
  contacto en 2 + 2 + 1 y el formulario de entrada arrimado a la izquierda de su mitad.
- **El apoyo pegado**, con el taller cargado, a 1280×800, 1440×900 y 1920×1080, arriba, en el medio y
  al final: donde entra queda a 20 px del borde de arriba; donde no (la obra entregada con su opinión,
  984 px, y la vista del cliente, 928 a 967 px, en 1280 y 1440) queda con su final 20 px arriba del
  borde de abajo. Siempre a 44 px del principal: no tapa nada.
- **El teclado**, a 1440, en Ajustes, el formulario de edición, Aprobar, Compartir y la ficha de una
  obra: Tab no vuelve para atrás en ninguna (la única vuelta es la del final de la página al principio).
- **El celular no cambió.** `main` y la corrección, sobre los mismos datos y a 390 de ancho, píxel por
  píxel en las 28 pantallas con los dos talleres: iguales salvo el número de versión en Ajustes y el
  puerto de cada servidor en el enlace de Compartir. Avisos salió 30 px más alta en una corrida y más
  baja en otra, siempre en el aire de abajo que se mide para lo que flota: es el momento de la captura,
  no el cambio.
- El bundle suma 2,6 kB de JS (0,67 kB con gzip) y 1,8 kB de CSS (0,14 kB con gzip) sobre `main`. El
  chunk de vendor no cambió. `pnpm verify` en verde (18 tareas en 7 min 44 s; el test del reparto,
  2,0 min) y `pnpm e2e`: 458 pasaron y 87 se saltearon por proyecto, sin fallas. Tests: dominio 494,
  `@maun/ui` 65, la app 946, la base 187.
- Nada en `supabase/` ni en `packages/db`.

### De la primera versión

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
- Un apoyo que no entra en lo visible se pega por abajo solo: no hace falta achicarlo. Lo que sí sigue
  valiendo es que nada que crezca va al apoyo.
- Ninguna pantalla cambia el ancho de `Pagina` ni dónde arranca. Si su contenido es angosto, lo
  reparte (uno de los tres repartos, o `CamposJuntos`) hasta llegar a los dos bordes del molde; el
  test falla si queda a más de 64 px del derecho.
