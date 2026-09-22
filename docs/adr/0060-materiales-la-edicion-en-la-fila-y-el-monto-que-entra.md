# 0060. Los materiales, lo que hace falta se edita en la fila, y el monto entra en su tarjeta

- Estado: aceptada
- Fecha: 2026-09-22
- Corrige al [0045](0045-los-costos-estimados-lo-que-hace-falta-y-mover-en-la-agenda.md) en dos cosas:
  las herramientas pueden llevar cantidad, y un nombre mal escrito ya no se corrige sacándolo y
  volviéndolo a cargar. Sigue al 0045 en que lo que hace falta es una sola tabla con el tipo adentro,
  y al [0015](0015-proyectos-el-agregado-que-se-guarda-entero.md) en que sus filas se escriben por el
  guardado del agregado.

## Contexto

Tres pedidos del dueño sobre una captura de la ficha y de Inicio, con sus palabras:

1. «No me permite editar las cantidades de los items que ya cargue».
2. «También habría que hacer un segmento de "materiales" necesario (además de Herrajes y
   Herramientas), es más, debería ser el primero de los 3. Ahí anotaría los Cortes de Melamina, si el
   proyecto necesita algún tablón de madera natural para mesada, o si necesito pintura o laca o un caño
   estructural».
3. «Sacale los decimales, que calcule todo número redondo así no rompe las cajas».

## 1. La cantidad y el nombre se editan en la misma fila

**Son campos de la fila, siempre**: no hay un modo de edición ni un botón de guardar. Se guarda al
salir del campo o con Enter (que además cierra el teclado del celular), y Escape vuelve a lo que había.
La cantidad abre el teclado numérico (`inputMode="numeric"`, `pattern="[0-9]*"`). El nombre es un
`<textarea>` que crece con una copia invisible del texto (`aria-hidden`): un nombre largo baja de
renglón en vez de cortarse.

**Las reglas viven en el dominio** (`necesidades.ts`), y el alta usa las mismas:

- `cantidadEditada`: un entero mayor que cero, topeado en `CANTIDAD_MAXIMA`. Vacía o en cero vuelve a
  la de antes: para sacar un ítem está el tacho, no el número.
- `nombreEditado`: recortado, con los espacios de más juntados, cortado en `LARGO_MAXIMO_DEL_NOMBRE`
  (120) caracteres. En blanco vuelve al de antes.
- **El 120 es gemelo del `check` `necesidades_nombre_valido`** (`esNombreDeNecesidad`), y el comparador
  los ata (`compararNombreDeNecesidad`) con casos de 119, 120 y 121 caracteres, con acentos y con
  emojis. Se probó rompiéndolo: contando unidades de UTF-16 en vez de caracteres, el comparador cae con
  «120 caracteres 🔩…: SQL true, TS false». Antes el alta no tenía tope y un nombre de 121 rebotaba con
  un `23514`, que es definitivo y tapa la cola.

**Se escribe como el alta, el tilde y la baja: un guardado del agregado** (`guardadoDeLoQueHaceFalta`,
con la lista entera y la fila editada adentro). Mismo chequeo de versión (`MN006`), un ítem en la cola
por operación. No se agregó una mutación propia: el 0045 y el 0015 la prohíben, y la que se usa,
`MUTACION_DE_PROYECTO`, ya estaba registrada en `mutaciones-persistibles.ts`. **Editar no tilda ni
destilda**: `conUnaNecesidadEditada` manda el `listo` como estaba.

- **Tocar el nombre ya no tilda.** Antes toda la fila era la etiqueta del casillero; ahora el casillero
  tiene su zona de 44 px y tocar el texto lo edita. Es el costo de editar en la fila.
- **Cada campo dice de qué es**: «Cantidad de Bisagras Cazoleta 35», «Nombre de Bisagras Cazoleta 35»,
  con el nombre guardado, que no cambia mientras se escribe. La fila se recorre con Tab en orden:
  casillero, cantidad, nombre, tacho.
- **En un trabajo cerrado los campos son de solo lectura**: se leen, no se editan.

### Las herramientas también llevan cantidad

El 0045 decidió que no, porque él escribía «Sierra Circular» sin número. El pedido dice que la
cantidad se edita «en herrajes, en herramientas y en el segmento nuevo», y hay herramientas que se
cuentan («4 sargentos»). Es opcional, como en los herrajes, y la base ya lo permitía: no hizo falta
tocar el esquema.

### El caso raro del catálogo, contado en vez de resuelto

El catálogo de «los que ya usaste» elige la forma en que se muestra un nombre y desempata el orden con
el `created_at` de cada fila, y **editar el nombre no mueve el `created_at`**. Dos consecuencias:

- **Una corrección puede no verse en las sugerencias.** Con dos filas «bisagras», una del 1/9 y otra
  del 5/9, corregir la del 1/9 a «Bisagras» deja la sugerencia en «bisagras», porque la del 5/9 sigue
  siendo la más nueva. Se ve bien recién cuando se corrigen las dos.
- **El nombre viejo deja de sugerirse cuando no queda ninguna fila viva con él**, que es la regla del 0045. Si la fila editada era la única, desaparece en el acto.

No inventé una regla. Las dos salidas que veo son del dueño: usar `updated_at`, aceptando que tildar
también cuenta como «lo usé hace poco», o una columna propia que marque cuándo se escribió el nombre.
Tampoco se impide editar un nombre al de otra fila de la misma lista: la base lo permite (el 0045 no
puso índice único) y el catálogo lo cuenta dos veces, como ya pasaba cargándolo a mano.

## 2. Los materiales, primero de los tres

**`material` es el tercer valor de `tipo_de_necesidad`**, en su propia migración y solo
(`20260922120000`): Postgres no deja usar un valor de enum en la transacción que lo crea. La siguiente
(`20260922120100`) reemplaza `guardar_proyecto`, que validaba el tipo contra una lista escrita a mano
(`'herraje', 'herramienta'`) y habría rebotado un material con `22004`. **Ahora valida contra
`enum_range`**: un cuarto tipo se agrega al enum y al dominio, y la función no se vuelve a tocar. Las
dos son aditivas; ninguna fila cambió (medido, ver Verificación).

**El orden vive en un solo lugar: `TIPOS_DE_NECESIDAD`**, en el dominio: material, herraje,
herramienta. `segmentosDeLoQueHaceFalta` arma los tres en ese orden, con sus ítems y sus listos, y
`cuentaDeLoQueHaceFalta` es la suma de los segmentos: el «1 de 9» del encabezado y el «4 cosas» de
cada subsección no pueden decir otra cosa. La ficha pinta los segmentos que le da el dominio, y los
textos de cada lista son un `Record` por tipo (`TEXTOS_DE_CADA_LISTA`): un cuarto tipo no compila
hasta tener los suyos. El valor va al final del enum a propósito, para que el orden no viva también
ahí; un test de `@maun/db` ata `TIPOS_DE_NECESIDAD` con el enum generado.

- **Sin unidades**: la medida va en el nombre, «3 placas de melamina blanca 18 mm».
- **Las sugerencias son por segmento**: `catalogoDeNecesidades` ya filtraba por tipo; hay tests nuevos
  con materiales, herrajes y herramientas que empiezan con la misma letra.
- **Los textos**: «Materiales necesarios», como los otros dos; «Agregar el material», «Cuántos
  materiales». La bajada de la sección nombra los tres: «Los materiales y los herrajes que hay que
  pedir, y las herramientas que hay que tener el día que lo hagas. Se te sugieren los que ya usaste.»
- **Un bundle viejo** no muestra los materiales, los cuenta en el encabezado y, al guardar, los reenvía
  tal cual con el resto de la lista (`comoViajan`): no los borra ni los cambia. Se verificó corriendo
  el e2e de `main` contra la base migrada con un material cargado.

## 3. El monto que se salía de la tarjeta

**Objeción al pedido, como estaba escrita: no se redondea.** Es la plata de su taller y se sigue
mostrando entera, `$ 1.506.291,84`. Lo que había que arreglar es que el número entre.

**Medido antes de tocar nada** (`montos-en-las-tarjetas.spec.ts`, el rango exacto del texto del monto
contra el ancho útil de cada caja que lo contiene hasta la tarjeta):

| Tarjetas de Inicio | 320 px              | 360 px             | 390 px              |
| ------------------ | ------------------- | ------------------ | ------------------- |
| `$ 1.506.291,84`   | 114,1 de 107: +7,1  | entraba (16 px)    | 156,9 de 142: +14,9 |
| `$ 12.345.678,90`  | 123,7 de 107: +16,7 | entraba (16 px)    | 170,1 de 142: +28,1 |
| `-$ 12.345.678,90` | 130,2 de 105: +25,2 | 130,2 de 125: +5,2 | 179,0 de 140: +39,0 |

A 390 px la letra saltaba a 22 px por una consulta de contenedor que miraba el ancho de la tarjeta y
no el del número. La misma medición encontró otras cinco cajas rotas: el estado del Diezmo (40 px fijos,
+45 a +69 px en 320), el bloque de la seña (tres columnas fijas, hasta +49 px), la proyección de Cocos
(+14 a +54 px), las cifras del mes a 390 px (tres columnas de 98 px, un número montado sobre el otro) y
el saldo de la vista del cliente (+5,3 px en 320). En la computadora, a 1024 y 1440, no se salía nada.

**La decisión: la letra sale del ancho de la caja y del largo del monto.** `text-monto-que-entra`, en
`@maun/ui`, es `clamp(13px, 100cqi / (N × 0,53), máximo)`: `cqi` es el ancho del contenedor más
cercano, N los caracteres del monto y 0,53 lo que ocupa como mucho cada carácter en IBM Plex Sans
semibold con cifras tabulares (medido: 0,509 a 0,515 em). `MontoQueEntra` la aplica. **En la fila de
Inicio, N es el del monto más largo de las cuatro**, para que las cuatro tarjetas lleven la misma letra.

- **Por el contenedor**: `min-w-0` en la tarjeta y en su columna; padding de 12 px en vez de 14 solo
  cuando la fila de tarjetas mide menos de 20rem (el celular de 320); la etiqueta «en negativo» baja de
  renglón en vez de salirse, que también pasaba y la medición de montos no miraba.
- **Las otras cajas**: el Diezmo usa la misma regla con tope de 40 px; la seña pasa a tres columnas
  recién desde 28rem y antes va en renglones; la proyección de Cocos se apila por debajo de 24rem; las
  cifras del mes van en tres columnas desde 28rem y no desde 19rem; el saldo de la vista del cliente
  usa la regla con tope de 40 px.
- **El formato no se tocó**: sigue saliendo de `formatearPesos` (`shared/lib/plata.ts`; el dominio no
  formatea, ADR 0002), con el espacio duro entre el signo y el número y todo en un renglón.

**Después**, con los mismos tres montos: cero desbordes en 320, 360 y 390 px, en claro y en oscuro, en
Inicio, Diezmo, Finanzas, las fichas de un trabajo, de un contacto y de un cliente, el cobro y la vista
del cliente; y en 1024 y 1440 en la computadora. La letra que quedó en las tarjetas de Inicio:

| Tarjetas de Inicio | 320 px  | 360 px  | 390 px  | 1440 px |
| ------------------ | ------- | ------- | ------- | ------- |
| `$ 1.506.291,84`   | 15,0 px | 17,1 px | 19,1 px | 26 px   |
| `$ 12.345.678,90`  | 14,0 px | 16,0 px | 17,9 px | 26 px   |
| `-$ 12.345.678,90` | 13,0 px | 14,7 px | 16,5 px | 26 px   |

**El test mide texto, no controles**: además del monto contra cada caja, recorre todo el texto de las
tarjetas de plata contra su ancho útil. Se probó que falla con lo que había: da los desbordes de la
tabla de arriba, y «en negativo» saliéndose 11,8 px a 320 px.

## 4. Una mutación sin registrar

Buscando el registro para la edición apareció que **`MUTACION_DE_COSTOS` no estaba en
`mutaciones-persistibles.ts`**: los costos estimados cargados sin señal morían al reabrir la app, con
el mismo «No mutationFn found» del PR 31. Se registró, y un test nuevo recorre las mutaciones que
exporta cada slice y falla si alguna no tiene su `mutationFn` registrada; la primera vez que corrió
nombró a esa.

## Decidido por mi cuenta

- Las herramientas con cantidad opcional (arriba).
- El nombre se edita con el mismo gesto que la cantidad, y Enter guarda y cierra el teclado.
- Un solo tamaño de letra para las cuatro tarjetas de Inicio, el del monto más largo.
- La letra mínima de un monto en tarjeta es 13 px, la del nombre de la tarjeta («Maun»): más chica, la
  cifra principal queda por debajo de su propio título.
- Los centavos no van en un cuerpo menor: ganaban un 5 % de ancho, obligaban a partir el texto que
  arma `formatearPesos`, y en las tarjetas no hacía falta.
- El arreglo de la seña, la proyección de Cocos, las cifras del mes, el Diezmo y la vista del cliente,
  que el pedido no nombraba pero la medición encontró.

## Objeciones

- **A 320 px, un Hogar en negativo de cien millones o más, con centavos, no entra con 13 px.**
  «-$ 123.456.789,01» son 17 caracteres: mide 113,6 px y la tarjeta tiene 109 px útiles, así que se
  saldría 4,6 px. Para entrar necesitaría 12,5 px, menos que el título de la tarjeta. En positivo,
  «$ 169.753.084,89» entra a 320 px (109 de 111), y en negativo entra desde 360 px (121,2 de 125). Si
  alguna vez pasa, las salidas son bajar el mínimo o que la fila de tarjetas pase a una columna en ese
  ancho; no se recorta.
- **Un monto largo achica las cuatro tarjetas**, no solo la suya. Es el precio de que se lean parejas.
- **El 0,53 es de esta letra.** Si cambia la tipografía de los números, hay que volver a medirlo; el
  test de desborde lo detectaría.
- **Tocar el nombre ya no tilda**: el casillero sigue teniendo 44 px, pero la fila entera ya no lo es.
- **Nada se probó en un teléfono de verdad**: las medidas y las capturas son de Chromium emulando el
  celular, con la letra que viene con la app. El teclado numérico y el Enter que cierra el teclado se
  prueban en el teléfono.

## Alternativas descartadas

- **Redondear los montos, o esconder los centavos.** Es la plata de su taller.
- **Cortar con `overflow` o puntos suspensivos.** Esconde justamente lo que se salía.
- **Medir el texto con JavaScript y achicarlo hasta que entre.** Anda con cualquier letra, pero es
  código que corre en cada tarjeta y en cada cambio de ancho para algo que CSS resuelve con una cuenta.
- **Un selector de unidades para los materiales.** Más toques y conversiones para quien anota de parado
  en el taller; la medida en el nombre alcanza.
- **Un modo de edición con un lápiz por fila.** Un toque más y un ícono más por renglón, para lo mismo.

## Verificación

- **Base**: las dos migraciones, cada una ensayada en rollback con la suite entera de pgTAP y el
  comparador, en dos tandas (la del enum sola; después la función con los tests que usan el valor). Una
  huella (`count` y `md5` de cada fila) de las 20 tablas de `public` y `private`, 72.343 filas, tomada
  antes y después de aplicar cada una dentro de la transacción: ninguna cambió.
  `28_materiales_y_la_edicion_en_la_fila.sql` (19): los tres tipos del enum, un material con y sin
  cantidad, una herramienta con cantidad, el tipo inválido y el que falta, el catálogo de materiales,
  y editar nombre y cantidad sin tocar el tildado ni crear otra fila.
- **Dominio**: los segmentos, la cuenta, las reglas de la edición y el catálogo por segmento, con la
  cobertura del 100 %. **App**: `FilaDeNecesidad.test.tsx` (21) y `mutaciones-persistibles.test.ts`
  (la edición sin señal que sobrevive a cerrar y reabrir, el mismo camino sin registro, y el registro
  completo). **e2e**: `lo-que-hace-falta.spec.ts` y `montos-en-las-tarjetas.spec.ts`, celular y
  escritorio.
