# 0045. Los costos estimados son columnas, lo que hace falta es una tabla, y mover en la agenda escribe el trabajo

- Estado: aceptada
- Fecha: 2026-09-18
- Sigue al [0042](0042-lo-hecho-de-los-trabajos-y-las-marcas.md) en el umbral de «un conjunto chico y
  fijo de valores sobre un trabajo son columnas», al [0015](0015-proyectos-el-agregado-que-se-guarda-entero.md)
  y al [0043](0043-las-opciones-de-presupuesto-y-la-sena.md) en cómo se escribe una hija nueva, y al
  [0034](0034-la-agenda-calcula-lo-que-sale-de-los-trabajos.md) en qué sale de un trabajo y cómo se
  abre el día. Corrige al 0034 en el ancho de la capa del día: ver Objeciones.

## Contexto

El dueño marcó dos pantallas. Textual:

> Sobre la tarea Cotizar: se podrán desplegar algunas cajas para establecer costos estimados de Madera
> / Herrajes / Fletes / Ayudante.
>
> Últimamente me hago el listado de herrajes que voy a necesitar, lo hago en el momento del diseño y
> eso me ayuda a no colgar cuando hago el pedido. Se puede incluir como algo apartado en forma de
> ítems o algo así. Hago algo parecido con las herramientas.
>
> Estaría bueno poder arrastrar un elemento de la agenda a otra fecha, la vista general. Que cuando se
> clickee en un día se abra a la derecha la agenda hora a hora del día seleccionado.

**Nada de esto es especulativo: las cuatro cosas ya las hace a mano.** Verificado en producción antes
de escribir código, sobre su household (`01a0a097…`, «MAUN Muebles», 18 trabajos vivos):

- El trabajo **«Baulera Habitacion Huespedes»** tiene en las notas, textual:
  `Herrajes Necesarios. / 6 Bisagras / 3 Pistones / 3 Tiradores / Tarugos.` y
  `Herramientas Necesarias. / Sierra Circular / Lijadora de Banda / Multitool`. Y abajo, su cotización
  desglosada: `MITRE : Gris Arcilla - $197.863,53`, `Flete $100.000`, `MANO DE OBRA: $300.000`,
  `HERRAJES: $70000`.
- El **«Vanitory Chico»** tiene la misma cuenta con otras palabras: `43.300 - Mel Blanca`,
  `50.000 - Flete (Walter)`, `206.600 - Mano de obra`, y el total `$494.200`.

Las cuatro categorías que pidió son las cuatro que escribe. Es el mismo caso de las opciones de
presupuesto del ADR 0043: darle lugar propio a algo que ya hace en el campo libre.

## 1. Los costos estimados son cuatro columnas de `proyectos`

`costo_madera_centavos`, `costo_herrajes_centavos`, `costo_flete_centavos` y
`costo_ayudante_centavos`. `bigint` nullable, con su `check` de no negativo.

**Es el precedente de las cuatro tareas de presupuestar (0038) y de las tres marcas (0042):** un
conjunto chico y fijo de valores sobre un trabajo, uno de cada uno como mucho.

- **Null no es cero.** Null es «todavía no lo estimé» y cero es «este trabajo no lleva flete». La
  diferencia importa: el total de tres categorías cargadas no es el mismo número que el de cuatro con
  una en cero, pero sí es la misma plata, y el encabezado dice «3 de 4» o «4 de 4».
- **Las escribe un update de sus columnas solas**, como las marcas de la agenda, y **`guardar_proyecto`
  no las toca**. Así guardar el agregado desde el formulario grande no las pisa, y cargarlas no puede
  pisar nada del agregado. El grant es solo de `update`: ningún camino puede crear un trabajo con
  costos, así que no hay dos lugares que mantener.
- **Se guardan solas, con la demora de las notas** (900 ms sin escribir), y el estado del guardado se
  muestra al lado del título con `EstadoDeGuardado`, el mismo componente que ahora usan las notas.

**El umbral, para el próximo.** Vale mientras las categorías sean estas cuatro y haya una sola línea
por categoría. **Si aparece una quinta categoría, o si necesita varias líneas por categoría** («dos
fletes», «melamina de dos colores»), **no se agrega otra columna**: se pasa a una tabla de costos
estimados con clave `(household_id, proyecto_id, categoria)` y renglones libres, como las opciones de
presupuesto, y las cuatro columnas se migran a ella. El aviso de que llegó el momento es él escribiendo
dos importes de la misma categoría en las notas, que es exactamente lo que hace hoy con los herrajes
(`HERRAJES: $70000` y `$50000`).

### El margen es una resta, y no alimenta nada

`calcularMargen` vive en `@maun/domain` (`costos.ts`), con sus tests y la cobertura del 100%. Devuelve
una unión de tres situaciones, como `calcularSena`:

- **sin estimar**: no hay nada que mostrar, aunque haya presupuesto;
- **sin presupuesto**: solo el costo estimado total, y lo dice;
- **con margen**: costo estimado, presupuesto y la resta, que **puede ser negativa** y entonces la
  pantalla lo dice con todas las letras («Estás estimando más gasto que presupuesto»).

**Los costos estimados no alimentan el presupuesto, y eso se garantiza de tres maneras**: el formulario
no los manda (`datosDelFormulario` no los incluye), `guardar_proyecto` los ignora aunque vengan en el
pedido (`24_costos_herrajes_y_horas.sql` lo verifica mandándolos), y la pantalla no ofrece ningún botón
que los copie. El presupuesto es lo que le cobra al cliente e incluye su ganancia; derivarlo del costo
sería inventarle el margen.

**Cargar un costo no tilda «Cotizar».** Tildar es suyo: la tarea dice «ya coticé», no «ya escribí
números».

### Lo que NO entra, y que es el paso siguiente

**Comparar el estimado contra el gasto real.** El trabajo ya acumula gastos (`public.gastos`, con
fecha, descripción e importe), y esos son plata que salió de verdad. Comparar lo que calculó contra lo
que gastó al terminar un mueble es lo que hace que un taller sepa si ganó, y es el paso natural
siguiente. **La forma que tendría, anotada para no volver a pensarla:**

- Cada gasto llevaría una **categoría opcional** del mismo enum que los costos estimados (madera,
  herrajes, flete, ayudante, y un «otros» que hoy no existe en los estimados). Una columna nullable en
  `public.gastos`, con su grant, escrita por `guardar_proyecto` como el resto de las columnas de una
  hija. Los gastos viejos quedan sin categoría y entran en «otros».
- El dominio sumaría `gastoRealPorCategoria(gastos)` y una función
  `comparacionDeCostos(estimados, reales)` que devuelve, por categoría, lo estimado, lo gastado y la
  diferencia, más el total. Pura, con sus tests, sin gemela en SQL: la base no la consume.
- La pantalla sería una columna más en el mismo bloque «Costos estimados», que pasaría a llamarse
  «Costos», visible recién cuando el trabajo tiene gastos cargados.
- **Lo que hay que decidir antes de construirlo** es qué pasa con un gasto sin categoría en un trabajo
  que sí tiene estimados: mostrarlo aparte («$X sin clasificar») es honesto; repartirlo es inventar.

No se construye ahora porque el pedido era estimar, no comparar, y porque la comparación no sirve hasta
que haya trabajos terminados con las dos cosas cargadas.

## 2 y 3. Los herrajes y las herramientas son una sola tabla

Él los pidió como dos cosas distintas y pidió «una base de datos con las herramientas». **Son la misma
cosa y no hace falta ninguna base de datos nueva.**

Sus dos listas se diferencian en un detalle (los herrajes llevan cantidad y las herramientas no) y
coinciden en lo que importa: las dos son «lo que necesito para este trabajo», las dos se arman en el
momento del diseño y las dos se repiten entre trabajos.

**`public.necesidades`**, hija del agregado: `tipo` (`herraje` o `herramienta`), `nombre`, `cantidad`
opcional y `listo`. Foreign key compuesta `(household_id, proyecto_id)`, RLS, grants por columna,
`bootstrap()`, `delta()` y la baja en cascada, como `opciones_de_presupuesto`.

- **Se escribe por `guardar_proyecto`, con un quinto parámetro `p_necesidades` con default `null`.**
  Misma transacción, mismo chequeo de versión, mismo marcado de bajas, **un solo ítem en la cola**. No
  se armó un camino nuevo: la regla del 0015 (no hay mutaciones sueltas de las hijas de un proyecto)
  sigue valiendo.
- **`null` quiere decir «no toques lo que hace falta»**, como `p_opciones`. Es lo que hace que el
  pasaje a Proyectos, que guarda el agregado entero sin conocer estas filas, no las borre. La firma
  cambia, así que va por `drop` y `create` y se repiten el `revoke` y el `grant`.
- **La cantidad es opcional porque él escribe «Tarugos.» sin número**, y cuando la pone es al menos uno
  (`check`). Una cantidad en cero no vale: o es un número de verdad o no va ninguno.
- **Se cargan desde la ficha, no desde el formulario grande.** Es la diferencia con las opciones de
  presupuesto, y es deliberada: una opción es algo que se arma una vez y se revisa entero; un herraje
  se agrega de a uno mientras diseña. Mandarlo al formulario grande por cada bisagra no se paga. Cada
  alta, cada tilde y cada baja es un guardado del agregado, con la lista entera adentro.

### `listo`: sí va, y por qué

El brief pedía evaluarlo. **Va, con una sola casilla para los dos tipos.** Su razón para tener la lista
es textual: «me ayuda a no colgar cuando hago el pedido». Una lista para no colgar mientras pedís es
una lista que se va tildando. Dos estados (pedido y comprado) sería inventar un proceso que él no
describió; uno solo cubre el caso y ya tiene forma en la app: se queda en la lista, tachado y en gris,
igual que una anotación tildada de la agenda (0034), con el mismo aria-label explícito («Listo: 6
Bisagras», «Lista: Sierra Circular») para no depender del gris.

### El catálogo no es una tabla

Lo que él llama «una base de datos con las herramientas» es, en los hechos, **la lista de nombres
distintos que ya usó**. Sale de la réplica con una consulta sobre las filas que ya están
(`catalogoDeNecesidades`, en `@maun/domain`): no necesita tabla, ni sincronización, ni pantalla de
administración, y funciona sin señal.

- **El orden es por lo más usado y, a igual uso, por lo más reciente**, y a igualdad de las dos, por
  orden alfabético para que la lista no baile. Elegido así y no solo por recencia porque en un taller
  hay un fondo de nombres que se repiten en casi todos los trabajos —bisagras, tarugos, la sierra
  circular— y son los que tienen que estar arriba; la recencia desempata para que algo que empezó a
  usar hace poco no quede sepultado.
- **Se compara sin acentos ni mayúsculas** (`claveDelNombre`), y lo que **empieza** con lo escrito va
  antes de lo que solo lo **contiene**.
- **No sugiere del otro tipo**, ni lo que este trabajo ya tiene cargado.
- **La primera vez no sugiere nada y eso está bien**: el catálogo se arma solo, usándolo.
- **Se muestra el nombre tal como lo escribió la última vez.** Si escribió «bisagras» y después
  «Bisagras», vale la segunda: es lo último que tipeó y es lo que espera ver.
- **Sin pantalla de administración.** Corregir un nombre mal escrito en todos lados es otra cosa: sería
  una operación de «renombrar en todo el taller» (un update por `nombre` dentro del household, con su
  confirmación y su deshacer) y **no se construyó**. Mientras tanto, un nombre mal escrito se corrige
  sacándolo del trabajo y volviéndolo a cargar bien; el viejo deja de sugerirse cuando no queda
  ninguna fila viva con ese nombre.

## 4. Mover en la agenda escribe la fecha donde vive

En la agenda hay dos clases de cosas y arrastrarlas **no es lo mismo**:

- Una **anotación** es una fila propia con su fecha. Arrastrarla cambia esa fecha.
- Una **visita, una entrega o un vencimiento no son filas**: salen de una fecha del trabajo (0034).
  Arrastrar una entrega del 24 al 18 **cambia `proyectos.entrega_estimada`**. No es un efecto
  colateral: es la operación, porque no hay otro lugar donde esa fecha pueda vivir.

`COLUMNA_DE_LA_FECHA` (en `packages/db/src/agenda.ts`, al lado de `COLUMNA_DE_LA_MARCA`) dice de qué
columna sale cada categoría derivada, y el arrastre escribe por `guardadoDeUnPaso`, el mismo camino que
usa la ficha: un solo ítem en la cola, aplicación optimista, y **el aviso con «Deshacer»** como
cualquier otra escritura de la agenda.

**Lo que trae de consecuencia, resuelto:**

- **El texto de la ficha del evento derivado quedaba obsoleto.** Decía «Sale de la entrega estimada del
  proyecto. Para moverla, cambiá la fecha ahí.» Ahora, donde hay grilla, dice «… Arrastrala en el mes
  para moverla, o cambiá la fecha ahí.», y en el celular sigue diciendo lo de antes, porque ahí no hay
  grilla. Lo decide `useAnchoDePantalla` dentro de la propia fila, sin pasar una prop por tres
  componentes.
- **Arrastrar un relevamiento no choca con la regla del 0042.** La regla («mover la visita a un día que
  todavía no llegó apaga `visita_hecha`») solo puede dispararse sobre una visita ya hecha, y **lo hecho
  no se arrastra**, así que el choque no existe. Igual el arrastre manda `visita_hecha` explícito
  (`visitaHecha(proyecto) && fecha <= hoy`) para que el invariante no dependa de eso: si algún día algo
  hecho se pudiera mover, seguiría valiendo. El e2e arrastra un relevamiento pendiente y comprueba
  que la visita cambia de día y sigue pendiente.
- **Lo que ya está hecho no se arrastra.** `puedeArrastrarse(evento)` es `!evento.hecha`, en el
  dominio. Una entrega entregada figura en el día en que estaba prometida (0042) y moverla sería
  reescribir historia; si la fecha estaba mal, se corrige desde el trabajo.
- **Arrastrar mueve una sola cosa.** Mover el relevamiento **no** corre el plazo del presupuesto,
  aunque la hoja del contacto sí lo haga al cambiar el día ahí (0038). En un calendario, arrastrar algo
  tiene que mover eso y nada más; el plazo es otro chip y se arrastra solo. Es una diferencia
  deliberada con la hoja, no un olvido.

### El gesto, sin librería

Eventos de puntero, captura del puntero y `document.elementFromPoint` para encontrar la celda de
destino (`useArrastreDeEventos`, en `entities/agenda`). No entró ninguna dependencia.

- **Con el mouse**, arranca a los 4 px de movimiento. **Con el dedo, a los 350 ms de presión
  sostenida**, y moverse más de 10 px antes de eso cancela la espera: eso es scrollear.
- **Los chips arrastrables llevan `touch-action: none`.** Es lo que pide la captura del puntero para
  que el navegador no se lleve el gesto como scroll. **El costo, dicho:** un deslizamiento vertical que
  empiece justo arriba de un chip no scrollea la página. Los chips miden 24 px de alto adentro de una
  celda de 96, así que la mayor parte de la celda scrollea normal, pero es un costo real.
- **Al soltar, el click se suprime** con `preventDefault`, para que el mismo toque no abra además el día
  (los chips de una anotación son invocadores del popover). La marca que lo suprime se pone en
  `pointerup` y se consume en el `click`, y se limpia en el `pointerdown` siguiente: si un gesto termina
  sin click, no se queda colgada tragándose el toque siguiente. Eso apareció probando a mano.
- **Sin ghost flotante.** El chip agarrado se atenúa y la celda de destino se marca con un anillo. Con
  el dedo encima del chip, lo que se lee es el destino, no el origen.

### El teclado, y la objeción sobre Enter

**El brief pedía «agarrar con Enter». Va con la barra espaciadora, y la objeción la repito acá.** En
esta grilla **Enter ya abre** el evento (el trabajo o el día), es el único camino sin arrastrar que
tiene el teclado, y está cubierto por `agenda.spec.ts` desde el ADR 0034. Tomárselo para agarrar
rompería justamente lo que el propio brief manda conservar: que el camino sin arrastrar siga visible y
alcanzable. La barra espaciadora no tenía uso en estos botones.

- **Barra** agarra, **flechas** mueven (±1 día de costado, ±7 arriba y abajo, dentro de la grilla del
  mes), **Enter o barra** sueltan, **Escape** cancela y deja el foco donde estaba.
- **Es la misma máquina de estados que el puntero**: `useArrastreDeEventos` tiene un solo estado
  (`{ evento, destino, conQue }`) y las mismas funciones `empezar`, `moverA`, `confirmar` y `cancelar`.
  Lo único que cambia es quién las llama. Eso es lo que impide que las dos se desincronicen.
- **Cada paso se anuncia** en un `role="status" aria-live="assertive"`: agarrado, sobre qué día,
  movido (diciendo que el aviso tiene Deshacer), cancelado, y «No hay día para ese lado» cuando el
  destino se sale del mes.
- La ayuda del gesto está una sola vez en la grilla y cada chip arrastrable la referencia con
  `aria-describedby`.
- **Al soltar, el foco sigue al chip hasta su día nuevo.** El chip se desmonta de la celda vieja y se
  monta en la de destino, así que el foco se caía al `body` y el que va con teclado quedaba obligado a
  tabular de nuevo desde arriba de la página. `devolverElFoco` lo busca por `data-evento` dentro de la
  celda de destino en los cuadros siguientes y se lo devuelve, y se abstiene si para entonces el foco
  está en otra cosa, para no robárselo a nadie. Escape ya lo dejaba bien; era solo el camino de Enter.

### La accesibilidad, y por qué sale barata

Desde WCAG 2.2, **todo lo que se opera arrastrando tiene que poder operarse con un solo puntero sin
arrastrar** (2.5.7, nivel AA), y es un criterio distinto del de teclado. **Esa alternativa ya existía y
no se tocó**: tocar el chip abre el día o el trabajo, y desde ahí se cambia la fecha. El arrastre es
una mejora sobre un camino que ya cumplía. Lo único que había que garantizar era que ese camino
siguiera visible y alcanzable, y por eso el click sigue abriendo, el texto del evento derivado lo
nombra y `agenda.spec.ts` y el e2e nuevo lo verifican.

## 5. El día hora a hora

### Lo que había en el modelo, medido

- `anotaciones.hora` existe desde el ADR 0034: `time`, opcional. `EventoPropio` la lleva.
- **`EventoDerivado` no tenía hora en absoluto**, ni columna ni campo: `horaDe()` devolvía `null` para
  toda derivada por construcción del tipo.
- El orden de `eventosDeLaAgenda` **ya priorizaba la hora**: lo que tiene hora va antes de lo que no, y
  entre dos con hora gana la más temprana. Esa parte no hubo que inventarla.
- **En producción, su household tiene 4 anotaciones y 3 llevan hora** (15:00, 15:00 y 10:30), y **29
  eventos derivados de sus 18 trabajos, ninguno con hora, porque no había dónde ponerla**. Es lo
  contrario de lo que el brief suponía («él casi no la usa»): la usa en 3 de 4. La muestra es chica y
  conviene decirlo, pero apunta en la dirección de agregar la hora, no en la de evitarla.

### Qué lleva hora

**`proyectos.entrega_hora` y `proyectos.visita_hora`**, `time` nullable, escritas por
`guardar_proyecto` con el patrón de la clave presente, y leídas como texto para que un
`<input type="time">` vacío (que manda `""`) no corte la llamada con un `22007`, la misma lección del
ADR 0015.

**El vencimiento del presupuesto no lleva hora.** Es un plazo («antes del jueves»), no un momento; el
ADR 0034 y el 0038 ya lo tratan así, y una hora ahí sería una precisión falsa. Se carga la entrega en
el formulario grande y la visita en la hoja del contacto, al lado de su fecha; **si se borra la fecha,
la hora se va con ella**, porque una hora sin día no quiere decir nada.

### La pantalla

**La franja de «Todo el día» arriba y la grilla de horas abajo**, que es lo que hace cualquier
calendario y lo único que funciona con estos datos: si la grilla fuera lo único, hoy se abriría vacía
con todo amontonado arriba.

- **El rango es de 07:00 a 20:00**, catorce renglones. Un taller no arranca a las doce de la noche, y
  ese rango cubre las tres horas que él tiene cargadas hoy (08:30, 10:30 y 15:00). «Ver las demás
  horas» abre el reloj entero.
- **El rango se estira solo antes que esconder algo**: si hay algo a las 05:00, la grilla empieza a las
  05:00 aunque no se haya tocado el botón. Un evento invisible sería un bug, no un rango.
- **Se abre scrolleada a la primera hora con algo**, para que el día se lea sin buscar.
- **La hora en curso se marca** cuando el día que se abre es hoy.
- **Lo hecho**: lo que no tiene hora sigue la regla del 0034 (abajo de lo pendiente, dentro de la
  franja de todo el día); lo que tiene hora **se queda en su renglón**, tachado. En una línea de
  tiempo, la posición es la hora y no el estado; moverlo al final mentiría sobre cuándo fue.
- **En el celular va igual**, en la hoja del día: es el mismo componente y la hoja es de ancho
  completo, así que entra mejor que en la capa. No hacía falta decidir nada distinto para el celular.

### La capa del día tuvo que ensancharse: de dos columnas a tres

**Medido antes de tocar nada.** Con la capa de dos columnas (333 px a 1440), una entrega pendiente
dentro de la grilla de horas medía **244 px de alto y 216 px de ancho**: el título en tres renglones y
el botón «Abrir el proyecto» partido en dos líneas. Un solo evento se comía un cuarto de la altura.

La capa pasa a `max(22rem, anchor-size(--grilla-del-mes width) * 3 / 7 - 12px)`: **463 px a 1440 y 357
a 1024**. Lo que el brief manda no tocar no se tocó: **la grilla del mes sigue midiendo el área de
contenido entera** (1108 px a 1440, medido con la capa abierta y cerrada), **la capa sigue anclada al
día que se tocó** y **`position-try-fallbacks` la sigue dando vuelta sola**. Lo único que cambia es a
partir de qué columna se da vuelta, y eso lo recalcula el navegador.

El `- 12px` no es cosmético: es el margen entre la celda y la capa. Sin él, el jueves abría a la
derecha y se salía 27 px de la grilla, sobre el margen de la pantalla, porque el volteo mira la ventana
y no la grilla.

Medidas de los siete casos del ADR 0034 más el jueves, a 1440 × 900, con la capa mostrando la grilla de
horas (todas dentro de la ventana, dentro de la grilla y sin tapar su celda):

| Caso                   | Lado       | x   | Ancho |
| ---------------------- | ---------- | --- | ----- |
| Lunes 14               | derecha    | 445 | 463   |
| Miércoles 9            | derecha    | 761 | 463   |
| Jueves 24              | derecha    | 919 | 463   |
| Viernes 11             | izquierda  | 433 | 463   |
| Sábado 12              | izquierda  | 591 | 463   |
| Domingo 13             | izquierda  | 750 | 463   |
| Primera fila, martes 1 | derecha    | 603 | 463   |
| Última fila, miérc. 30 | der/arriba | 761 | 463   |

**Lo que cambió en la última fila, y hay que decirlo.** Antes, con una capa corta, el borde de abajo se
pegaba al de la celda. Con la grilla de horas la capa es más alta que el espacio que queda arriba del
día, así que no puede pegarse: toma el alto de la ventana (de y = 16 a 900 a 1440 × 900) y sigue sin
salirse, sin tapar la celda y con la punta apuntando al día. El test de la capa pasó a aceptar las dos
cosas —pegada al día cuando entra, o el alto de la ventana cuando no— en vez de exigir solo la
primera.

## Decidido por mi cuenta

- **Un `BloquePlegable` en `shared/ui`**, hecho con `<details>/<summary>` nativo. La ficha ya era larga
  y las tres secciones nuevas la alargan más. Nativo porque trae el teclado, el lector de pantalla y el
  estado abierto/cerrado sin código. **Qué queda abierto:** los costos estimados, abiertos salvo en un
  trabajo liquidado; lo que hace falta, abierto mientras el trabajo está en seguimiento o en curso, y
  cerrado en uno entregado, cobrado o perdido. Es lo que pedía el brief: un contacto a presupuestar
  quiere los herrajes a la vista; una obra entregada, no.
- **`EstadoDeGuardado` en `shared/ui`.** El indicador de «Guardando… / Guardado / Sin señal» estaba
  escrito a mano adentro de `NotasDelProyecto`; los costos estimados necesitaban el mismo. Se extrajo y
  lo usan los dos.
- **Los costos estimados aparecen una sola vez por ficha.** En «a presupuestar» cuelgan de la tarea
  «Cotizar», como él lo dibujó; en cualquier otro estado son su propia sección, al lado de la seña. Si
  no, el margen —que es la razón por la que alguien carga esos números— desaparecería justo cuando el
  presupuesto existe.
- **El margen cambia de nombre según la etapa**: «Te queda, si te lo aprueban» mientras el trabajo está
  en seguimiento y «Te queda» cuando ya es obra. El número es el mismo; lo que cambia es si ya está
  cerrado. Decir «Te queda» sobre un presupuesto que todavía no aprobaron sería mentir.
- **Las dos listas hablan en su género.** «Agregar el herraje» y «Agregar la herramienta», «Listo: 6
  Bisagras» y «Lista: Sierra Circular», «3 de 6 listos» y «2 de 3 listas». Son textos que lee un
  lector de pantalla y que lee él: «agregar el herramienta» es un error, no un detalle.
- **La hora no se muestra en el chip de la celda del mes.** La celda responde qué hay ese día, no
  cuándo; con tres chips de 24 px, agregarle la hora a cada uno deja el título en dos palabras. La hora
  se ve al abrir el día, que es la pantalla que se agregó para eso.
- **`MN` no creció.** Nada de lo nuevo necesitó un código de rechazo de negocio: los tres rechazos que
  agrega la base (`22004` por un tipo o un nombre que falta, `23514` por una cantidad en cero o un
  costo negativo) son de datos que la interfaz no deja escribir, y el tipo de TypeScript los hace
  irrepresentables.

## Objeciones

- **La capa del día tapa una columna más que antes.** Pasó de dos columnas a tres, y con la grilla de
  horas casi siempre llega al alto de la ventana. Sigue siendo mejor que la franja fija que el ADR 0034
  descartó —está anclada al día, se da vuelta sola y solo aparece cuando se abre un día—, pero es
  honesto decir que el día hora a hora cuesta pantalla. **Si molesta, volver a dos columnas es una
  línea de CSS**; lo que se pierde es la legibilidad de una entrega adentro de un renglón.
- **Arrastrar con el dedo cuesta el scroll vertical que empiece arriba de un chip.** Es el precio de
  `touch-action: none`, que es lo que la captura del puntero necesita. No encontré forma de tener las
  dos cosas sin librería. Si en el uso resulta molesto, la salida es dejar el arrastre solo para mouse
  y teclado: es una condición en un solo lugar.
- **Nada del arrastre se probó en un teléfono de verdad.** Lo que sí se hizo: el gesto con el dedo se
  ejerció con toques reales del protocolo de DevTools (`Input.dispatchTouchEvent`) en Chromium, a 1024
  px, y pasa —la presión sostenida agarra, el dedo lo lleva, el toque corto sigue abriendo el día—.
  Eso no es lo mismo que un Samsung: no prueba el scroll del navegador real, ni la respuesta táctil, ni
  el menú contextual de la presión sostenida en Android. Esa prueba es suya.
- **N altas sin señal son N ítems en la cola, no uno.** Cada alta, tilde o baja de un herraje es un
  guardado del agregado: uno solo por operación, con la lista entera adentro, atómico e idempotente.
  Cargar cuatro herrajes en modo avión deja cuatro ítems, que drenan en orden y terminan con las
  cuatro filas. «Un solo cambio» vale por operación, no por sesión.
- **El catálogo ordena por cantidad de filas, no por cantidad de trabajos.** Si un mismo trabajo tuviera
  dos filas con el mismo nombre, contaría dos veces. La pantalla no deja cargar dos veces el mismo
  nombre en el mismo trabajo (el autocompletado lo filtra y no se ofrece), pero la base sí lo permite.
  No le puse un índice único: no es un invariante que valga la pena sostener con un rechazo definitivo
  que tapa la cola.
- **Un nombre mal escrito queda en el catálogo hasta que no quede ninguna fila viva con él.** No hay
  forma de corregirlo en todos lados. Ver arriba.
- **`proyectos` tiene ahora 55 columnas.** Seis las agrega este PR. Cada una se justifica por el
  precedente del 0042, pero el precedente no es infinito y conviene decir que la tabla es ancha. Lo que
  la haría estrecha de nuevo es exactamente lo que este ADR deja anotado: la tabla de costos con
  categoría, que también se llevaría los cuatro `costo_*`.
- **Nada se probó con un lector de pantalla de verdad**: se revisó el árbol de accesibilidad que expone
  Chromium y el recorrido con Tab.

## Alternativas descartadas

- **Una tabla de costos estimados desde ya.** Cuatro categorías fijas con un importe cada una son el
  precedente de las tareas y de las marcas; la tabla suma RLS, réplica, una hija más en
  `guardar_proyecto` y una pantalla de filas dinámicas por algo que hoy no crece.
- **Derivar el presupuesto del costo estimado, aunque sea como sugerencia.** Es inventarle el margen.
  El dueño decide su ganancia; la app no tiene con qué proponerla.
- **Dos tablas, una de herrajes y una de herramientas.** Es la lectura literal del pedido y duplica
  todo —tabla, RLS, réplica, parámetro, pantalla— para distinguir dos cosas que se diferencian en una
  columna nullable.
- **Una tabla de catálogo de herrajes y herramientas.** Es lo que él pidió con esas palabras, y es
  trabajo que no hace falta: los nombres distintos salen de las filas que ya están, sin
  sincronización, sin pantalla de administración y sin señal. Una tabla de catálogo además obliga a
  decidir qué pasa cuando se borra una entrada que un trabajo usa.
- **Una mutación propia para las necesidades.** Lo que el ADR 0015 prohíbe para las hijas de un
  proyecto: el orden de la foreign key, la atomicidad y la cola que drena de a una.
- **Guardar los eventos derivados en una tabla para poder moverlos.** Es lo que el ADR 0034 descarta
  entero. Arrastrar escribe la fecha donde vive, que es el trabajo.
- **Que arrastrar el relevamiento corra también el plazo del presupuesto**, como hace la hoja del
  contacto. Mover una cosa tiene que mover una cosa.
- **Una librería de arrastre.** El bundle está bajo la lupa y el repo ya resuelve gestos a mano (el
  recortador de fotos, tirar para actualizar). Un chip que se mueve entre celdas de una grilla son
  eventos de puntero y una consulta de qué hay debajo. No entró ninguna dependencia.
- **Un ghost flotante que sigue al puntero.** Con el dedo encima del chip, lo que hace falta ver es a
  dónde va, no qué se está moviendo. Marcar la celda de destino es más legible y mucho menos código.
- **Poner la grilla de horas en una pantalla aparte, o al costado de la grilla del mes.** El pedido fue
  que el día se abra donde se toca. La capa anclada ya resolvía eso; lo que hizo falta fue una columna
  más de ancho.
- **Hora en el vencimiento del presupuesto.** Es un plazo, no un momento.

## Consecuencias

- Una migración (`20260917120000_costos_herrajes_y_horas.sql`), **aditiva**: seis columnas nullable, un
  enum nuevo, una tabla nueva, y el reemplazo de `guardar_proyecto`, `bootstrap()`, `delta()` y la baja
  en cascada. **Ninguna fila existente cambia de valor** (cero sentencias de datos en la migración).
- **Una tabla nueva en la réplica rompe la sincronización de un bundle nuevo contra una base sin
  migrar** (`leerLote` exige la clave, ADR 0039): la migración se aplica antes de mergear. Se aplicó.
- `entrega_hora`, `visita_hora` y los cuatro `costo_*` llegan con `alter table`, que no mueve
  `updated_at`: un dispositivo no las ve por delta hasta el reconcile. Se leen tolerando la fila que no
  las trae (`horaDeLaEntrega`, `horaDeLaVisita`, `costoGuardado`), como `visita_hecha` (0042).
- `guardar_proyecto` pasa a cinco parámetros. El quinto lleva default, así que un bundle viejo servido
  por el service worker sigue llamando con cuatro.

## Verificación

- **Dominio**: `costos.test.ts`, `necesidades.test.ts` y `agenda.test.ts` (la hora de cada derivado, el
  orden con y sin hora, el rango que se estira, el día por horas y qué se puede arrastrar), con la
  cobertura del 100% que el paquete exige. **236 tests.**
- **Base**: `24_costos_herrajes_y_horas.sql` (34): los costos con su check, que `guardar_proyecto` los
  ignora aunque vengan, las horas con la clave presente y con la hora vacía, lo que hace falta con y
  sin cantidad, el tipo inválido y el nombre en blanco con su mensaje, la cantidad en cero, la baja
  marcada, sin la clave no se toca, y la baja en cascada. Más `02_aislamiento.sql` (otro taller no ve
  lo que hace falta acá), `00_estructura.sql` y `04_sincronizacion.sql`. **El ensayo en rollback pasó
  en verde con la suite entera y el comparador antes del `db push`.**
- **App**: `costos.test.ts` y `necesidades.test.ts` de `entities/proyecto`, más los de siempre.
- **e2e** (`costos-herrajes-y-arrastre.spec.ts`, celular y escritorio): los cuatro costos cargados y
  recargados sin tocar el presupuesto ni la tarea; el margen con y sin presupuesto y en contra; los
  herrajes y las herramientas cargados en un contacto, tildados, y todavía ahí después del pasaje a
  obra; el autocompletado entre trabajos y que no mezcla los dos tipos; la franja de todo el día y los
  renglones por hora, con el rango de 14 y el reloj entero de 24; **la grilla del mes midiendo lo mismo
  con el día abierto y cerrado (1108 px las dos, y la capa 462,8)**; arrastrar una anotación y
  deshacerlo; arrastrar una entrega y ver la fecha en la base; que lo hecho no se arrastra; el teclado
  entero con sus anuncios; que Enter sigue abriendo el día; el arrastre con el dedo por toques del
  protocolo de DevTools y el toque corto que abre; y sin señal, un herraje y un arrastre que quedan
  pendientes, sobreviven a cerrar la app y se sincronizan al volver.
- **Dos bugs que encontró el e2e, no la lectura del código:**
  - **El botón de agregar un herraje perdía lo escrito.** Al tocarlo, el campo perdía el foco y
    `downshift` borraba lo tipeado antes de que llegara el click: se agregaba una fila vacía, o sea
    nada. Se arregló de dos lados (un `stateReducer` que conserva lo escrito al salir del campo, y un
    `preventDefault` en el `mousedown` del botón, que además deja el cursor adentro para el ítem
    siguiente). Apareció en el proyecto `celular` después de pasar en `escritorio`.
  - **El día por horas se había llevado puestas las listas «Lo pendiente» y «Hecho»** del panel del
    día, que el ADR 0034 y el 0042 fijan. Lo encontró la suite entera, no el spec nuevo: doce tests de
    `agenda.spec.ts` y de `hecho-y-marcado.spec.ts` en rojo. Las dos listas volvieron adentro de la
    franja de todo el día, con sus nombres de siempre.
  - **La hoja del día del celular pasó a ser alta**, y su entrada deslizándose hacia arriba tardaba lo
    suficiente como para que dos medidas seguidas de un test cayeran en cuadros distintos, con una fila
    aparentemente arriba de otra. `abrirElDia` ahora espera a que la hoja se quede quieta antes de
    devolverla. No era un problema de orden en el DOM: el árbol de accesibilidad estaba bien.
  - **El Enter del teclado del arrastre dejaba colgada la marca que suprime el click.** El teclado no
    genera un click, así que la marca se quedaba puesta y se tragaba el toque siguiente: después de
    mover algo con el teclado, el primer click en un chip no abría el día. Se arregló poniendo la marca
    solo en el camino del puntero y limpiándola en cada `pointerdown`.
