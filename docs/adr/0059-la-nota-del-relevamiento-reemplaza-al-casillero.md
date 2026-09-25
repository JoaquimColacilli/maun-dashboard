# 0059. La nota del relevamiento reemplaza al casillero

Estado: aceptada, 2026-09-22. Corrige la parte del casillero del
[0058](0058-el-estimativo-y-el-relevamiento-en-el-camino-del-cliente.md); el resto de ese ADR (el
estimativo como paso, «lo próximo», la lista blanca y la entrada desde la app) sigue igual.
Corregida el mismo día: la (i) va al lado de la fecha del paso, no después del rótulo. Corregida el
2026-09-25 por el [ADR 0070](0070-el-camino-tilda-lo-que-paso.md): sigue en el mismo paso
(`nota.hito`, el `hitoActual`), pero ese paso ya no siempre es el que está en curso: con el
estimativo o el presupuesto mandado está tildado.

## Contexto

El dueño miró el casillero «Relevamiento técnico» colgado del paso del presupuesto y no le gustó el
diseño. Pidió, con una especificación cerrada, que el relevamiento no sea un hito ni una casilla: una
(i) con una nota, en el rótulo del paso en curso, y el resumen visible sin abrir nada en la línea
de abajo del titular.

## Decisión

- **Una sola (i) en toda la pantalla, a la derecha de la fecha del paso en curso**, en la línea de
  abajo del rótulo. Si el paso todavía no tiene fecha (el presupuesto en preparación), va sola en esa
  línea, alineada con el texto. Primero iba después de la última palabra del rótulo, pero en la PC
  las columnas miden unos 110 px: no entraba, bajaba sola a otro renglón corrida por su margen y el
  dueño la vio mal. La línea de la fecha usa también el espacio entre columnas, para que «mar 22 sep»
  y la (i) entren juntas. El titular grande no lleva otra.
- **Existe solo en los pasos del presupuesto** (el estimativo y el presupuesto): desde que se aprueba
  ya no condiciona nada. Dos estados, con el texto que escribió el dueño: «El número todavía puede
  cambiar», con el día que quedamos en ir, y «El número ya está tomado de las medidas reales», con el
  día que fuimos. Debajo del titular: «Número estimado, falta ir a medir» o «Medido el 10 sep».
- **Lo decide el dominio**, como todo lo que ve el cliente: `notaDelRelevamiento(vista, formatos)`
  devuelve la nota armada, o null. La pantalla elige el ícono y dónde se abre, nada más.
  `relevamientoDelTrabajo` quedó como el dato crudo, estado y día; sus textos del casillero se fueron.
- **En el celular abre una hoja desde abajo** (un `<dialog>` modal: un tooltip no existe en pantalla
  táctil) que se cierra con «Entendido», tocando afuera o con Escape. **En la PC, un popover anclado
  al paso**, que abre al tocar y al pasar el mouse, y se cierra al salir del paso, tocando afuera o
  con Escape. El corte es el mismo de toda la app: 768 px.

Tres lugares donde el texto pedido no era cierto, y cómo quedaron:

- **Sin estimativo y sin medir, no hay (i).** «Lo que te pasamos es un estimado» sería falso: no se
  le pasó ningún número. «Lo próximo» ya le dice que falta ir a medir.
- **Con el presupuesto ya mandado**, la nota de lo medido dice «Con esas medidas armamos el
  presupuesto final.» en vez de «estamos cerrando», que ya pasó. Y una visita nueva agendada después
  de mandarlo no vuelve a decir que el número es un estimado.
- **Una visita marcada sin día** dice «Ya fuimos a medir.», sin inventar una fecha.

## Objeciones

- **Falta «Coordinar la visita» por WhatsApp.** La base no guarda el teléfono del taller: sin él, el
  enlace no tiene a quién escribirle. Hace falta un campo en Ajustes y sumarlo a la lista blanca, que
  es un cambio de datos y queda para otro PR.
- **Nada se probó en un teléfono de verdad**: las capturas son de Chromium emulando celular y PC.

## Verificación

- Dominio: `vistaCliente.test.ts` dice, en el caso de cada etapa, si hay nota y cuál, y cubre las
  variantes de arriba.
- App: `VistaDelCliente.test.tsx` (una sola (i), pegada al rótulo, la hoja en el celular, el popover
  en la PC con el mouse y Escape, y el resumen del titular) y `AyudaDeLaVista.test.tsx`.
