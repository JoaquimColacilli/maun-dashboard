# 0057. Las opiniones de los clientes: la primera vez que alguien de afuera escribe en la base

Estado: aceptada, 2026-09-21. Completa al [0024](0024-ajustes-en-el-celular-desde-el-avatar-de-inicio.md)
(la foto de Inicio pasa a abrir una hoja) y suma `MN011` a `MN015` a la tabla del
[0010](0010-sincronizacion-replica-completa.md). Completada el 2026-09-25 por el
[ADR 0071](0071-la-entrega-y-sus-fechas.md): la segunda escritura sin sesión, `responder_la_entrega`,
sigue el mismo molde (token, gemela en el dominio, reenvío idempotente) y suma `MN020` y `MN021`.

## Contexto

Cuando entrega un trabajo, el dueño quiere saber cómo le fue a su cliente: mandarle una encuesta por
WhatsApp y después leer lo que contestó, de a una y todas juntas. El diseño está en el showcase
«MAUN Opiniones»: Resultados, Preguntas, pedirla desde el trabajo, la encuesta que abre el cliente y
la hoja que abre la foto de Inicio.

Hasta acá, lo único que se podía hacer en esta base sin sesión era **leer**: la vista del cliente
(ADR 0046) y el título de su enlace (ADR 0049). La encuesta es la primera puerta por la que alguien
de afuera **escribe**. Casi todo lo que sigue se ordena alrededor de eso.

## Decisión

### El modelo

Cuatro tablas nuevas, todas en la réplica y todas con RLS por `household_id`, y una columna en
`ajustes`. La migración es aditiva: se ensayó en rollback comparando las filas existentes antes y
después, y ninguna cambió.

- **`preguntas`**: cada fila es una pregunta tal como se pregunta, con su texto, su tipo (los cinco
  del diseño y ninguno más: escala de cinco, sí / tal vez / no, una opción, varias, texto libre), su
  escala, sus opciones, si es obligatoria y su orden. Las de la encuesta base no tienen trabajo; las
  **propias** de un trabajo lo tienen puesto y se suman solo a esa encuesta.
- **`encuestas_enviadas`**: lo que se le mandó a cada trabajo. El enlace, cuándo se mandó, cuándo se
  recordó, si se dio de baja y **la foto de las preguntas base tal como estaban al mandarla**.
- **`respuestas`** y **`renglones_de_respuesta`**: una respuesta por enlace y un renglón por pregunta
  contestada, con el texto tal como lo leyó el cliente (`pregunta_texto`).
- **`ajustes.resena_link`**: el enlace de Google para dejar una reseña.

Todo taller arranca con la encuesta del diseño ya escrita, cinco preguntas: los que ya existían la
recibieron en la migración (filas nuevas en una tabla nueva) y los nuevos la reciben al crearse
(`private.crear_household`). La primera, «¿Qué tan conforme quedaste con el mueble?», es la
**titular**: su promedio es el número de arriba de Resultados. El dueño no tiene grant sobre esa
marca; cada versión nueva la hereda.

### Las versiones: cuándo una pregunta pasa a ser otra

Una pregunta es una **serie** de filas; la vigente es la de número más alto. Tres casos, y los decide
`comoGuardar` en `@maun/domain`:

- **Nadie la contestó y no salió en ninguna encuesta**: se cambia en el lugar.
- **Ya la contestaron y cambió el texto**: se pregunta, con las dos salidas del diseño. «Es la misma
  pregunta, solo la redacté mejor» la cambia en el lugar y las respuestas viejas siguen contando;
  «Empezar a contar de cero» la guarda como versión nueva de la misma serie. Las respuestas viejas
  cuelgan de la versión que se contestó, no de la vigente, y Resultados las muestra aparte («las de
  antes»).
- **Cambió cómo se contesta** (el tipo, la escala o las opciones) y ya salió o ya la contestaron:
  versión nueva sin preguntar. Una respuesta de otro tipo no se puede leer como si fuera de esta.

La base lo sostiene aunque la pantalla se equivoque: cambiar cómo se contesta una pregunta que ya
salió rebota con `MN013`, y solo se toca la versión vigente, así que dos aparatos que versionan la
misma pregunta sin señal no dejan dos «versión 2» (`MN014`).

**Archivar no borra.** «Dejar de preguntarla» pone `archivada_at`: la pregunta sale de la encuesta y
lo que ya contestaron queda, en Resultados, al final. Solo se borra la pregunta que **nadie vio**:
sin otra versión, fuera de la foto de toda encuesta y sin respuestas. Es el mismo botón y el mismo
aviso con «Deshacer»; lo que cambia es que un borrador que nunca salió no ensucia la lista de las
archivadas. La base no deja borrar ninguna otra, y la titular nunca.

### Lo que se mandó lleva su foto

El cliente contesta lo que se le preguntó, aunque el dueño edite la encuesta al otro día. La foto la
saca un trigger (`private.armar_la_encuesta`) al crear la fila; el dueño manda el id, el trabajo y
el enlace, y no tiene grant sobre la foto, la fecha ni los estados.

- **Se pide cuando el trabajo está entregado o cobrado.** Antes no hay nada que opinar, y la base lo
  rechaza con `MN015` (también si la encuesta base se quedó sin preguntas).
- **Ninguna encuesta sin trabajo**: `proyecto_id` es obligatorio y tiene foreign key compuesta. No
  hay enlace general.
- **Un solo enlace vivo por trabajo**, con un índice único parcial. Uno nuevo da de baja al anterior
  en su propia sentencia, antes de insertar, por lo que enseñó el ADR 0043.
- **Un cliente que ya contestó no recibe otra** (`MN012`).
- **Un solo recordatorio**, y la baja no se deshace: el trigger `private.cuidar_la_encuesta` conserva
  la primera marca de cada una.
- **Las preguntas propias** se leen vivas hasta que el cliente contesta, y desde ahí quedan como
  están (`MN012`). Mientras tanto se suman y se sacan, también con el enlace ya mandado, como en el
  showcase. Son hasta tres, de escala, sí / tal vez / no o texto, **nunca obligatorias** (una
  obligatoria nueva le rompería el envío a un cliente que ya tenía la encuesta abierta) y **nunca
  entran en el promedio general**. Si el dueño saca una mientras el cliente la tiene abierta, el
  envío rebota con `ajena`: la página trae la encuesta al día, se lo dice y lo que ya había marcado
  queda para mandarlo de nuevo.

### Las dos puertas del rol anónimo

`anon` ejecutaba dos funciones y ahora ejecuta cuatro: se suman exactamente las dos de la encuesta.

| Antes                            | Después                                  |
| -------------------------------- | ---------------------------------------- |
| `public.vista_compartida(text)`  | `public.vista_compartida(text)`          |
| `public.titulo_compartido(text)` | `public.titulo_compartido(text)`         |
|                                  | `public.encuesta_compartida(text)`       |
|                                  | `public.contestar_encuesta(text, jsonb)` |

`anon` sigue sin un solo grant sobre ninguna tabla. `00_estructura.sql` exige la lista exacta de lo
que `anon` ejecuta y de lo que es `security definer`: una quinta función alcanzable lo rompe.

**`encuesta_compartida(token)` devuelve la encuesta de un enlace**, enumerando clave por clave: el
nombre del taller, **la primera palabra** del nombre del cliente (para el «Gracias, Marcela»), el
título del trabajo, el enlace de reseña, las preguntas de ese enlace (la foto más las propias, cada
una con id, texto, tipo, escala, obligatoria, opciones y si es propia) y, si ya contestó, qué y
cuándo. Ningún importe, ni la etapa, ni la dirección, ni el teléfono, ni nada de otro trabajo. Es
`stable`: Postgres no le deja escribir nada, ni siquiera contar una visita.

**`contestar_encuesta(token, respuesta)` guarda la respuesta**, y lo único que hace es insertar.
Antes de escribir una sola fila valida del lado de la base:

- que el enlace exista y esté vivo. Inexistente, dado de baja, de un trabajo borrado o de uno
  perdido contestan exactamente lo mismo, `MN010`, como la vista del cliente;
- que la respuesta tenga la forma `{id, renglones}` y cada renglón `{pregunta, valor}`, y que no pase
  de 256 KB;
- que cada renglón conteste una pregunta **de ese enlace** (la foto más las propias de su trabajo),
  sin repetir ninguna;
- que el valor sea del tipo y del rango que pide su pregunta, que ningún texto venga vacío ni pase de
  2000 caracteres, y que estén todas las obligatorias.

Lo que no cumple se rechaza **entero** con `MN011`, con el motivo en el `detail` (`forma`, `ajena`,
`repetida`, `tipo`, `rango`, `vacio`, `largo`, `obligatoria`): no queda media respuesta guardada.
Devuelve `{estado}` y nada más.

**Una respuesta por enlace, y la segunda no pisa la primera.** La unicidad es de la base, contando las
borradas. Un segundo envío con otro id contesta `ya_contestada`; el mismo envío que vuelve porque la
respuesta del primero se perdió en la red contesta `guardada`, así que reintentar es seguro.

**Dos envíos a la vez dejan una respuesta.** La función toma `for share` sobre la fila de la encuesta
(dar de baja el enlace, borrar el trabajo o mandar otra encuesta esperan a que termine) y el segundo
envío espera en el índice único al primero. `concurrencia.test.ts` lo prueba con conexiones reales.

**La lista blanca tiene su test que se rompe solo**, como la de la vista del cliente:
`27_encuesta_publica.sql` clasifica cada columna de las ocho tablas que leen las dos funciones
(`preguntas`, `encuestas_enviadas`, `respuestas`, `renglones_de_respuesta`, `proyectos`, `clientes`,
`households` y `ajustes`) en «viaja» o «no viaja», y falla apenas aparece una columna nueva en
cualquiera de ellas hasta que alguien decida.

**La validación tiene gemela.** `private.validar_respuesta` y `validarRespuesta` de `@maun/domain`
revisan en el mismo orden, y el comparador las ata caso por caso, con emojis, espacios duros y los
bordes de 2000 y 2001 caracteres. La encuesta usa la de TypeScript para decirle al cliente qué le
falta antes de mandar; la que decide es la de la base.

### El enlace, igual que el de la vista del cliente

Veinticuatro bytes aleatorios en base64url generados en el navegador, el sha256 en `token_hash` y el
token en claro para que el dueño vea la dirección en todos sus aparatos, con el check que ata uno al
otro (ADR 0052). La ruta es `/o/:token`.

**Crear y dar de baja el enlace necesitan señal** y no van en la cola, por la razón del ADR 0046: un
enlace que no está en la base no funciona, y mandarlo sería mentir. «Pedírsela por WhatsApp» es un
enlace a `wa.me` con el mensaje armado, y el mismo toque crea el enlace en la base. Sin señal no abre
WhatsApp y lo dice. El token se guarda en el aparato (`maun:enlaces`) hasta que la base confirma: si
WhatsApp se abrió y la creación falló, «Reintentar» lo crea con **el mismo** token, y el enlace que
ya le llegó al cliente empieza a andar sin mandarle nada de nuevo.

### Lo que lee el dueño sincroniza como todo lo demás

Las cuatro tablas viajan en `bootstrap()` y `delta()`, con sus borrados lógicos, ids del cliente y
versiones. Lo que escribe el dueño va por la cola, optimista: las preguntas, la marca de leída y el
recordatorio. Las respuestas no las escribe él (no tiene grant de `insert`): llegan con la próxima
sincronización. Leída o sin leer es suyo (`leida_at`).

Todos los cálculos salen de la réplica, en el aparato: Resultados anda sin señal.
`resumenDeOpiniones` arma todo lo que muestra la pantalla.

**La versión de `main` sigue sincronizando contra la base migrada**: `leerLote` ignora las claves que
no conoce.

### Los umbrales viven en un solo lugar

`packages/domain/src/opiniones.ts`, portados de la librería del diseño:

- **Hasta 11 respuestas, un punto por persona; desde 12, la barra repartida** (`UMBRAL_BARRAS`). La
  barra repartida es para las preguntas con polos (escala y sí / tal vez / no); las de opciones se
  muestran siempre contadas por opción. La decisión es `modoDeMostrar`, y la pantalla lee el modo que
  ya viene calculado.
- **La evolución en el tiempo necesita 12 respuestas y medio año de historia**, las dos cosas
  (`UMBRAL_EVOLUCION`, `UMBRAL_MESES`). Con menos, sería inventar una tendencia.
- **Un porcentaje nunca va solo**: «53% (9 de 17)». Un promedio lleva siempre su cuenta y un decimal
  solo si hace falta; un promedio de dos respuestas se muestra como lo que es.
- Hasta 8 preguntas en la encuesta y 3 propias por trabajo.

### La encuesta que abre el cliente

`/o/:token` es hermana de `/v/:token` y sigue sus reglas (ADR 0050): afuera de `Shell`, sin `Marco`,
sin sesión, con su propio `<main>` y el documento que scrollea. **Le pregunta a la base siempre como
`anon`**, con el cliente anónimo, aunque en ese navegador esté abierta la sesión del dueño. No
registra el service worker (lo registra `Shell`), el service worker la tiene en su `denylist`, el
arranque de `index.html` le saca el manifiesto, y no queda nada guardado en el navegador del
cliente. No se indexa, por las tres capas de siempre.

Una sola columna, sin pasos ni barra de progreso. Arriba dice que no es anónima: «el taller va a
saber que esto lo contestaste vos». Radios y casillas nativos agrupados en `fieldset` con su
`legend`, botones grandes, cada escala con carita y palabra, y se contesta sin escribir salvo el
comentario. Si falta algo, dice cuántas, marca cada una con su mensaje asociado y lleva el foco a la
primera. Estados: abriendo, sin señal, el enlace no funciona (igual para uno dado de baja que para
uno que nunca existió), no se pudo abrir con «Probar de nuevo», la encuesta, las gracias y «ya nos
contaste», que muestra lo que puso sin dejar editarlo.

**La vista previa del enlace** la arma la misma función de borde de la vista del cliente (ADR 0049),
que ahora cubre `/o/*` también: «Encuesta de {taller}» y una descripción fija. Sin el nombre del
cliente, sin el título del trabajo y sin importes. Si la consulta falla o tarda más de un segundo,
etiquetas genéricas.

### La reseña de Google se le pide a todos por igual

Si el dueño carga el enlace en Ajustes, las gracias lo ofrecen a **todos** los que contestaron,
contesten lo que contesten. No es una elección de diseño que se pueda revisar: **pedirle la reseña
solo a los que quedaron contentos va contra las políticas de Google.** La política de contenido de
Google Maps enumera, entre lo que un comercio no puede hacer, «Discourage or prohibit negative
reviews, or selectively solicit positive reviews from customers», y el contenido que la viola se
saca de Maps
([Prohibited & restricted content](https://support.google.com/contributionpolicy/answer/7400114)).
Filtrar según lo que opinó pone en riesgo las reseñas del taller, incluidas las buenas.

El código no lo deja hacer sin querer: el bloque de las gracias recibe el enlace y nada de lo que se
contestó. El enlace se valida contra una lista de hosts de Google, en la base (`check`) y en el
dominio (gemela, atada por el comparador), porque se vuelve un enlace en una página pública.

### La navegación

- **En el celular la barra inferior no se toca.** La foto del encabezado de Inicio abre una hoja con
  Opiniones (con «N nuevas» cuando hay algo sin leer), Diezmo, Agenda y, bajo «La app», Ajustes y
  Cerrar sesión. Es la hoja que el ADR 0024 anticipó para cuando apareciera un segundo destino sin
  lugar en la barra: Ajustes deja de ser un ícono suelto.
- **Una línea en Inicio**, en todos los anchos, cuando hay una opinión sin leer, con la frase del
  cliente. Desaparece cuando se lee.
- **En tablet y en escritorio, Opiniones va en el riel y en la barra lateral**, entre Finanzas y
  Diezmo, con sus dos pestañas: Resultados y Preguntas.
- **Desde el trabajo entregado**, el bloque para pedirla con sus cuatro estados: sin pedir, pedida,
  ya le recordaste y contestada.

## Dónde la construcción se aparta del diseño

- **«Lo lee Fabián, el dueño del taller»** quedó en «Lo lee el dueño del taller». Para escribir el
  nombre, la función pública tendría que devolver el nombre de una persona, que hoy no está en su
  lista blanca; sumarlo es una decisión del dueño, no de la pantalla.
- **«Escribirle al taller»** no está en las gracias ni en «ya nos contaste»: el taller no tiene un
  teléfono guardado. Es la misma falta que dejó el ADR 0046 en la vista del cliente.
- **La hoja de la foto no tiene «Exportar tus datos» ni «Ayuda»**: no hay pantallas detrás, y exportar
  quedó afuera de este trabajo.
- **Resultados no tiene estado de carga ni de error**, que el showcase sí dibuja: sale de la réplica
  (ADR 0013) y no espera a la red. Sin señal muestra lo último sincronizado y lo dice arriba.
- **«Dar de baja este enlace»** no está en el showcase del trabajo; lo pide el brief, y se construyó
  como el de la vista del cliente: confirmación y señal.
- **El editor del showcase abre «¿Se lo recomendarías a alguien?» convertida en «Una sola opción»**
  con tres opciones. Acá conserva su tipo, sí / tal vez / no: convertirla cambiaría cómo se contesta y
  obligaría a empezar una versión nueva.
- **Con un cambio de tipo o de opciones, «Es la misma pregunta, solo la redacté mejor» queda
  deshabilitada** y el aviso explica por qué: ver las versiones, arriba.
- **Las preguntas de opciones se muestran contadas por opción**, con un punto por persona, a cualquier
  cantidad: no tienen polos que repartir. El showcase no trae ningún ejemplo de ese tipo en
  Resultados.
- **Las archivadas tienen su lugar al final de Resultados** («Las que ya no preguntás»). En el
  showcase, Preguntas manda a Resultados para ver sus respuestas, pero Resultados no las muestra.
- **El aviso del recordatorio dice «Queda anotado que se lo recordaste»**, no «Le mandamos el
  recordatorio»: la app no manda nada, lo manda él desde WhatsApp, y lo que la app sabe es que tocó.
- **Borrar o archivar**: ver arriba. El showcase siempre archiva.
- **El enlace de la reseña se carga en una sección nueva de Ajustes**: el showcase no dice dónde.
- **Pedirla necesita señal** y la pantalla lo dice; el showcase no dibuja ese caso.
- **Resultados y Preguntas tienen el mismo ancho y el mismo encabezado** (`PaginaDeOpiniones`), a
  pedido de Joaquim después de usarlas: en el showcase Preguntas es más angosta y, en el celular,
  sus pestañas van al lado del título mientras que las de Resultados bajan, así que cambiar de
  pestaña movía los márgenes y las pestañas. Ahora las dos miden lo que Resultados, las pestañas van
  siempre debajo del título en el celular y a la derecha desde tablet, y el formulario de una
  pregunta tiene su propio tope para no estirarse. `opiniones.spec.ts` mide que al cambiar de
  pestaña no se mueva nada.
- **Toda fila de dos botones es una `FilaDeAcciones`** (ADR 0033): entran los dos a lo ancho o bajan
  los dos, cada uno a ancho completo. El showcase los deja con el ancho de su texto, uno al lado del
  otro o partidos: «Agregar una pregunta» y «Verla como la ve el cliente», «Guardar la pregunta» y
  «Cancelar», los dos botones del estado vacío de Resultados y los del pedido en el trabajo.
- **En escritorio, «Así la ve tu cliente» va centrada.** El showcase la dibuja con la esquina de
  arriba a la izquierda en el centro de la pantalla y cortada abajo, pero su propio código pide
  `left:50%; top:50%; transform:translate(-50%,-50%)`: la animación de entrada pisa ese
  `transform`. Se construyó lo que el código pide, no lo que se ve.
- **La hoja de la foto no tiene la agarradera de arriba** del showcase: ninguna hoja de la app se
  cierra arrastrando, y una agarradera promete ese gesto. Tampoco dice «opinaron esta semana»: dice
  quiénes, y el «esta semana» sería cierto solo a veces.
- **Tokens nuevos en `theme.css`**: los tres colores de las opiniones (dos tintas y un gris; ninguno es
  un color de tesoro), siete tamaños de texto y el radio del marco de teléfono de la vista previa. El
  showcase usaba esos valores sueltos.

## Objeciones

Se implementó lo pedido. Estas quedan anotadas:

1. **Promediar una escala de caritas.** La escala es ordinal: de «Nada conforme» a «Poco conforme» no
   hay necesariamente la misma distancia que de «Conforme» a «Muy conforme», y un 4,5 sale igual de
   doce clientes entre conformes y muy conformes que de un taller que divide aguas. Se mitigó: el
   promedio va siempre con su cuenta y al lado de la distribución, que es la que dice la verdad. Lo
   que haría: poner primero «9 de 12 quedaron conformes o muy conformes» y el promedio después.
2. **El recordatorio se anota al tocar, no al mandarse.** La app no puede saber si el mensaje salió
   de WhatsApp. Si toca «Recordárselo una vez» y se arrepiente, el trabajo queda como recordado y no
   hay segundo recordatorio. Preguntarle «¿Se lo mandaste?» cada vez agrega un paso a todos para
   cubrir un caso raro. Queda así.
3. **Lo contestado se le muestra a quien abra el enlace.** «Ya nos contaste» enseña las respuestas y
   el comentario, y el enlace es la única credencial: si el cliente lo reenvía, el que lo recibe lee
   su opinión. No hay plata ni datos del trabajo, pero es la opinión de una persona con su nombre de
   pila arriba. Lo que haría: mostrar solo que ya contestó, o lo contestado durante unos días.
4. **La encuesta no es anónima, y eso infla las notas.** Lo dicen el diseño y el brief, y la encuesta
   lo avisa arriba, que es lo honesto. La consecuencia es que los promedios van a dar más altos que lo
   que la gente piensa: conviene leerlos sabiéndolo, sobre todo al compararlos con otra cosa.

## Alternativas descartadas

- **Una respuesta como un `jsonb` suelto.** La base no podría atar cada valor al tipo y a las opciones
  de su pregunta con una foreign key y un check; quedaría todo en una función, y los cálculos serían
  más difíciles.
- **Validar en una función de borde.** Otro runtime, otro deploy y la misma validación escrita de
  nuevo. La base ya sabe hacerlo, y es la que guarda (el mismo argumento del ADR 0046).
- **Dejar cambiar cómo se contesta una pregunta que ya salió.** Las respuestas viejas quedarían
  ilegibles, o leídas como si fueran de otra pregunta.
- **Una tercera función anónima solo para la vista previa**, que devuelva el nombre del taller y nada
  más. Serían tres puertas nuevas, y el brief pide dos. La vista previa usa `encuesta_compartida`, que
  es `stable`, y la función de borde descarta todo salvo `taller`: lo demás no sale del servidor.
- **Crear el enlace por la cola.** Un enlace que todavía no está en la base no funciona.
- **Un enlace general, sin trabajo.** Fuera de alcance, y rompería «un enlace es de un trabajo».

## Consecuencias

- `anon` ejecuta cuatro funciones. `00_estructura.sql` exige la lista exacta.
- Una columna nueva en cualquiera de las ocho tablas que leen las funciones públicas rompe
  `27_encuesta_publica.sql` hasta que alguien la clasifique. Es a propósito.
- `MN011` a `MN015` se suman a la tabla de rechazos del ADR 0010.
- Borrar un trabajo se lleva su encuesta, lo que contestó el cliente y sus preguntas propias, en
  borrado lógico. Lo hace `private.borrar_las_opiniones_del_trabajo`, que es `security definer`
  porque el dueño no tiene grant para borrar respuestas, y que no hace nada si el trabajo está vivo.
- La titular es siempre la primera de fábrica y sus versiones. Si algún día quiere otra, es una
  migración.
- Con un taller que entrega un par de trabajos por mes y la mitad que contesta, las 12 respuestas
  llegan en un año largo: la evolución y las barras repartidas van a tardar en aparecer. Es lo que
  pide el diseño y está bien que tarde.
- Un bundle nuevo contra una base sin migrar no sincroniza (`leerLote` exige las cuatro claves). La
  migración ya está aplicada.
