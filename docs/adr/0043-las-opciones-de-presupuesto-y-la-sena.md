# 0043. Las opciones de presupuesto son hijas del agregado, y la seña es un porcentaje

- Estado: aceptada
- Fecha: 2026-09-16
- Sigue al [0015](0015-proyectos-el-agregado-que-se-guarda-entero.md) (el proyecto se guarda entero) en
  cómo se escribe una hija nueva, al [0019](0019-seguimiento-el-contacto-es-la-misma-fila.md) (el
  contacto y el trabajo son la misma fila) en de dónde sale lo cobrado, al
  [0011](0011-dominio-cascada-estados-y-cobro.md) y al [0002](0002-importes-en-centavos.md) en dónde
  vive una cuenta que toca plata, y al [0016](0016-el-cobro-y-el-rechazo-que-encuentra-al-usuario.md)
  en cuándo algo lleva confirmación y cuándo lleva deshacer.

## Contexto

El dueño lo escribió en el tablero, con estas palabras:

> Una vez que presento el presupuesto, estaría bueno tener un cuadro para incorporar el valor del
> proyecto presupuestado (una caja de notas paralela a ese valor por si existen variantes.. o (tener la
> posibilidad de crear más de un valor / presupuesto para un mismo proyecto y que cuando aprueben se
> seleccione con un tilde cuál es el proyecto que se aprueba.
>
> Usualmente para confirmar un proyecto se hace mediante seña del 50% (puede ser otro monto pero este
> es el normal). Podríamos incluir que el sistema calcule solo, cuál sería esa seña en función del
> valor del presupuesto y que muestre también cuánto tiene que abonar para llegar a ese monto si
> previamente pagó el relevamiento técnico.

Ofrece dos caminos con un «o» en el medio: notas al lado del valor, o varias opciones con un tilde.
**Va la segunda, y no es una interpretación: ya lo está haciendo, forzando el sistema.**

Verificado contra producción antes de construir nada:

- El trabajo **«Escritorio»** del cliente **Alan Saul** está en `presupuesto_enviado` **ahora mismo**, con
  `presupuesto_centavos` en **$1.248.000**, y en sus notas dice, textual:
  `- 2026-09-10: Solo Escritorio Alan 1248000` y
  `- 2026-09-10: Los 2 Escritorios 2.300.000 (seña 1.200.000 / contra entrega 750.000 / 20 dias 350.000`.
  Son **dos variantes de presupuesto con su plan de pago**. En el sistema viejo estaban cargadas como
  dos insumos de diez centavos, porque no tenía dónde ponerlas; la migración las pasó a las notas con
  `--insumos-como-notas` (ADR 0017). Cargó una de las dos como «el» presupuesto y la otra quedó de texto.
- Hay **siete trabajos sin presupuesto** (seis en «a presupuestar» y el «Vanitory Chico» en
  «presupuesto enviado»), y la app ya los muestra con una raya y con el saldo en null (ADR 0020). El
  camino de «este trabajo todavía no tiene presupuesto» está abierto y funciona.

Así que esto no es una función especulativa: es darle lugar a algo que hace hoy a mano.

## Decisión

### 1. Las opciones son hijas del agregado, como los pagos y los gastos

`public.opciones_de_presupuesto` cuelga de `proyectos` con la foreign key compuesta
`(household_id, proyecto_id)`, y **se escribe por `guardar_proyecto`**, que ahora recibe un cuarto
parámetro. Misma transacción, mismo chequeo de versión, mismo marcado de bajas, **un solo ítem en la
cola**. No se armó un camino nuevo: el ADR 0015 ya resolvió este problema y la regla de que no hay
mutaciones sueltas de las hijas de un proyecto sigue valiendo.

El parámetro nuevo **lleva default** (`p_opciones jsonb default null`), que es lo que hace el cambio
retrocompatible: un bundle viejo servido por el service worker sigue llamando con tres argumentos, y
`null` quiere decir «no toques las opciones». Como la lista de argumentos cambia, la función va por
`drop` y `create`, no por `create or replace`, y se repiten el `revoke` y el `grant`.

### 2. Mientras no eligen, el trabajo no tiene presupuesto

Es la parte que había que pensar. Si hay tres opciones y ninguna aprobada, **ese número no existe**:
elegir una de las tres sería inventar. Y el precedente está y funciona, de hace dos días: siete
trabajos sin presupuesto, con la raya y el saldo en null.

- **Con opciones vivas**, el presupuesto del trabajo es el importe de la aprobada, o `null` si no hay
  ninguna aprobada.
- **Sin opciones**, el presupuesto se carga como hasta hoy. Un trabajo que nunca vio esta pantalla no
  cambia de comportamiento en nada.
- **A lo sumo hay una aprobada viva por trabajo**, y eso lo sostiene un índice único parcial
  (`where aprobada and deleted_at is null`). Sin él, «el presupuesto del trabajo» no sería una función.
- **Ese índice obliga a un orden de escritura.** Se evalúa fila por fila, apenas se escribe cada una,
  porque un índice no se puede diferir: solo un constraint puede, y un único parcial no puede ser un
  constraint. El upsert de las opciones toca todas las filas en una sola sentencia y **el orden entre
  ellas no está definido**, así que mover la aprobación de una opción a otra dejaba dos prendidas por
  un instante y cortaba con `23505`: un rechazo definitivo, sin traducción, que además tapa la cola.
  `guardar_proyecto` **apaga todas las aprobaciones del trabajo antes del upsert**
  (`20260916170000_una_aprobada_por_vez.sql`), y así el índice deja de depender del azar.

### 3. No puede haber dos caminos que escriban ese número, y lo garantiza la base

Esto se pidió explícito y es lo correcto: que no dependa de la disciplina de la pantalla.

Un `check` no sirve, porque no puede mirar otra tabla. Lo hace **un trigger de constraint diferido**
(`private.validar_presupuesto_aprobado`, sobre las dos tablas), que rechaza con `MN009` si un trabajo
con opciones vivas queda con un presupuesto que no es el de su opción aprobada.

**Es diferido a propósito, y no por comodidad.** Adentro de una misma transacción el proyecto se
escribe antes que sus hijas, porque la foreign key exige que el padre exista: a mitad de camino el par
todavía no cierra, y un trigger inmediato daría un falso rechazo al insertar la primera opción de un
trabajo que ya tiene presupuesto. Diferido, el chequeo corre cuando la transacción ya es coherente.

La consecuencia de elegir diferido es que **para verlo fallar adentro de un test hay que adelantarlo**
con `set constraints all immediate`, porque la suite de pgTAP termina siempre en rollback y nunca
llega a un commit. El test lo hace así.

`guardar_proyecto`, además, **deriva el presupuesto antes de escribir el proyecto**, sobre el conjunto
de opciones que va a quedar (las que ya están, más las que vienen, menos las marcadas de baja).
Corregirlo después con un segundo `update` habría subido la `version` una segunda vez, y el guardado
siguiente del cliente habría rebotado con `MN006`.

### 4. Aprobar no lleva confirmación, y lo que no eligieron no se borra

- **Aprobar, destildar y cambiar de opinión son reversibles**, así que van con deshacer y no con un
  «¿estás seguro?». Es la regla del ADR 0016: la fricción se escalona según el tamaño del desastre, y
  poner confirmación en todo entrena a apretar aceptar sin leer.
- **Las opciones que no eligieron no se borran.** Él guardó las dos a propósito, con su desglose, y si
  el cliente vuelve en tres meses quiere saber qué le ofreció. Se siguen viendo, con la aprobada
  destacada.

### 5. La seña es un porcentaje, con el del taller y el del trabajo

`ajustes.sena_bp` (5000, la mitad, que es lo que él llamó «lo normal») y `proyectos.sena_bp`, que lo
pisa cuando no es la de siempre. Los dos en puntos básicos enteros, con su `check` de rango, como el
diezmo y la tasa de Cocos (ADR 0002 y 0011).

La cuenta vive en `@maun/domain` (`calcularSena`), con sus tests y la cobertura del 100% que el paquete
exige. Devuelve una unión de tres situaciones y no números sueltos:

- **sin presupuesto**: no hay nada que calcular, y lo dice;
- **falta**: la seña esperada, lo cobrado y lo que falta;
- **cubierta**: la seña esperada, lo cobrado y cuánto de más, en vez de un cero o un negativo.

**Y lo que falta ya descuenta la visita del relevamiento sin ningún dato nuevo.** El contacto y el
trabajo son la misma fila y sus pagos viajan cuando se aprueba (ADR 0019), así que la plata que cobró
en la visita ya está adentro de lo cobrado. «Cuánto tiene que abonar si previamente pagó el
relevamiento técnico» es una resta sobre lo que ya hay.

**No tiene gemela en SQL y no la necesita**, como `resumenDelMes` y `sueldoDelMes`: nada en la base
consume la seña. La base guarda los dos porcentajes y su rango, nada más.

### 6. Ninguna pantalla ofrece escribir un presupuesto que se va a descartar

La base garantiza el número, pero una pantalla que deja tipear un importe que después la base ignora
es un segundo camino a medias: no cambia el dato y confunde cuando pasa. El criterio es el del
formulario: **con opciones vivas, no hay campo de presupuesto**. Había dos lugares más que lo ofrecían.

- **El pasaje** (`/proyectos/:id/aprobar`) pedía «Presupuesto aprobado» como campo obligatorio. Con
  opciones, en su lugar pregunta **qué opción aprobó**, con la aprobada ya elegida si la hay, y el
  presupuesto y el saldo salen de la elegida. Sin elegir no deja pasar, como antes no dejaba pasar sin
  importe.
  - **Si la elegida es la que ya estaba aprobada, el guardado no manda las opciones**: es un paso que
    solo mueve el estado y, sin la clave, la base no las toca.
  - **Si elige otra, la aprueba en el mismo guardado** (`aprobacionDeUnaOpcion`, la misma que usa la
    ficha): un solo ítem en la cola. Aprobarla antes con un guardado aparte dejaría la opción aprobada
    aunque después toque «Volver sin aprobar», que es justo lo que ese botón promete que no pasa.
- **«Mandé el presupuesto»** abría un formulario con «Cuánto presupuestaste». Con opciones cambia de
  etapa directo, sin pedir el importe: lo que mandó son las opciones. Este no estaba en la objeción que
  dejé abierta; apareció buscando en el código todo lo que escribe `presupuesto_centavos`.

Los demás caminos que escriben esa columna mandan el valor que ya tiene la fila
(`datosActualesDelProyecto`) y no le ofrecen a nadie escribirlo.

## Por qué un porcentaje y no un monto

Es la única parte donde el pedido se puede leer de dos maneras, y se discutió antes de escribir código.

Él dice «puede ser **otro monto**», y su propia nota escribe `seña 1.200.000` sobre un presupuesto de
`2.300.000`, que es el 52,17%. Eso parece pedir un monto fijo por trabajo, y así se planteó primero.

**Va el porcentaje**, por tres razones, y la tercera es la que decide:

1. Ese 52,17% no es una seña que alguien calculó: es la mitad de 2.300.000 (1.150.000) redondeada a un
   número cómodo. Nadie pide una seña del 52,17%.
2. Pidió textual «que el sistema **calcule solo** cuál sería esa seña **en función del valor del
   presupuesto**». Eso es un porcentaje: quiere la cuenta, no el número.
3. **Un monto fijo se queda viejo.** En un trabajo con opciones, aprobar otra cambia el presupuesto: una
   seña guardada como importe seguiría diciendo lo de la opción anterior. El porcentaje se recalcula
   solo. Con esta misma decisión de arriba, el monto fijo es directamente inconsistente.

Queda la objeción de abajo sobre lo que esto cuesta.

## Lo que NO entra

Su nota dice «seña 1.200.000 / contra entrega 750.000 / 20 días 350.000»: eso es un **plan de pago de
tres cuotas**, no solo una seña. Pidió la seña, así que es lo que va.

**Si la seña le sirve, el plan de pago es el paso natural siguiente, y su propia nota muestra la forma
que tendría**: una lista de tramos con concepto, importe y disparador (al confirmar, contra entrega, a
los N días). Cuando llegue, lo más probable es que sea otra hija del agregado, hermana de las opciones
y escrita por la misma función, y que la seña pase a ser el primer tramo en vez de una columna.

## Decidido por mi cuenta

- **La opción tiene descripción e importe, y no un título aparte.** Es lo que pedía el brief («su
  importe y su descripción») y es lo que él escribe hoy: «Los 2 Escritorios 2.300.000 (seña 1.200.000
  / contra entrega...)». Un campo más para llenar, para quien menos ganas tiene de llenar campos, no
  paga. El largo es 500, el mismo que el concepto de un pago.
- **Las opciones de un trabajo liquidado se pueden editar**, igual que su presupuesto y sus notas. La
  distribución congelada se calcula sobre lo cobrado menos los gastos, nunca sobre el presupuesto (ADR
  0003), así que tocar una opción no mueve un peso de un reparto cerrado. No se agregó una restricción
  nueva ni un rechazo nuevo por algo que no rompe nada.
- **`sena_bp` se escribe con el patrón de la clave presente**, como `vencimiento_presupuesto` y
  `visita_hecha` (ADR 0042): `guardar_proyecto` solo la toca si el pedido la trae, así que un bundle
  viejo no borra la seña propia de un trabajo.
- **`MN009` es un código nuevo**, y se suma a la tabla del ADR 0010. Ya no se reintenta sin tocar nada,
  porque `esRechazoDeNegocio` matchea `MN\d{3}`.
- **En el pasaje, sin presupuesto el saldo dice «—» y no «$ 0»**, con opciones y sin ellas. Es la regla
  del resto de la app para un trabajo sin presupuesto (ADR 0020), y con opciones sin elegir un «$ 0»
  diría que no queda nada por cobrar.
- **Si al pasar falta algo, el foco va a lo que falta**: la primera opción, o el campo del importe. El
  botón está al final del formulario y en el celular el aviso quedaba fuera de la pantalla: tocar
  «Pasar a Proyectos» parecía no hacer nada.

## Objeciones

- **El «Escritorio» real no se toca, y eso deja el trabajo a medias hasta que él lo haga.** Las dos
  variantes siguen en las notas y el presupuesto sigue en $1.248.000. Se decidió con el usuario no
  escribir una sola fila de su historial: pasarlas a opciones es un minuto desde la pantalla nueva, y
  una migración sobre datos reales por algo que él puede hacer en un minuto no se paga. El costo de la
  alternativa estaba medido: tocar 1 fila y subirle la `version`, lo que hace rebotar un guardado de
  ese trabajo que hubiera quedado sin señal en el teléfono.
- **Con el porcentaje, su ejemplo documentado no se puede expresar exacto.** Una seña de $1.200.000
  sobre $2.300.000 es 52,17%, y el porcentaje más cercano da $1.199.910: le erra $90. El argumento de
  arriba dice que ese número era un redondeo suyo y no una regla, y lo comparto, **pero si en el uso
  aparece escribiendo señas «redondas» que el porcentaje no da, lo que corresponde no es subir la
  precisión del porcentaje: es dejar pisar la seña con un importe en el trabajo, y recalcularla cuando
  cambia la opción aprobada.** Queda anotado como lo primero a revisar.
- **El trigger diferido no se ejerce en el camino real de la app.** La app siempre pasa por
  `guardar_proyecto`, que ya deriva el presupuesto: el trigger es la red para los otros caminos
  (PostgREST directo, un script, un bundle raro). Los tests lo fuerzan con `set constraints all
immediate`, que es un camino que la app no recorre nunca. Es una garantía probada, pero probada de
  costado.
- **Si el cliente aprueba un importe que no es el de ninguna opción, el pasaje no deja escribirlo.**
  Pasa cuando se negocia un descuento al aprobar. La regla del punto 6 lo manda a corregir la opción
  antes de pasar (la ayuda debajo de las opciones tiene el enlace al formulario), y a volver después.
  Es un rodeo, no un callejón, y no forcé nada para evitarlo: dejar editar el importe de la elegida ahí
  mismo sería otra forma de escribir una opción, fuera del formulario. Si el rodeo resulta frecuente,
  eso es lo que habría que hablar.
- **En la ficha de un contacto no hay un camino a la vista para cargar la primera opción.** Las
  opciones se cargan en el formulario grande, y desde la ficha del contacto el único enlace a ese
  formulario dice «Cargar otro pago o un gasto»; la sección de opciones de la ficha no aparece mientras
  no haya ninguna. En la ficha de una obra está «Editar». Es justo la etapa en la que él arma las
  variantes, así que es probable que no la encuentre sola.
- **El `23505` del índice lo destapó el e2e en el celular, después de pasar dos veces en pgTAP y una
  en escritorio.** El orden dentro de un upsert es azar, así que el mismo código fallaba o no según la
  corrida: el peor tipo de bug. El test que lo cubre ahora **no manda en el pedido la opción que
  estaba aprobada**, que es el caso que falla siempre y no a veces. Vale como recordatorio de que un
  test verde sobre una sentencia con orden indefinido no prueba nada.
- **Un `23505` le llega crudo al usuario.** La causa está removida, pero `traducirRechazo` no tiene
  entrada para ese código: si alguna vez aparece otro choque de unicidad, se va a ver el texto de
  Postgres en la pantalla, que es justo lo que el ADR 0016 prohíbe. No lo traduje en este paso porque
  no hay ningún camino conocido que lo produzca; si aparece uno, va con su traducción.
- **Una opción borrada no se puede recuperar desde la pantalla.** La baja es lógica y la fila queda,
  pero no hay un «ver las borradas». El deshacer del formulario cubre el error del momento; un borrado
  de la semana pasada, no.
- **`bloqueo.spec.ts:177` es intermitente, y no es de este cambio.** «Entrar con otra cuenta» con la
  cola vacía falló en dos de las cuatro corridas completas de la suite; aislado y repetido tres veces
  sobre el mismo código, pasó dos y falló una. Son siete observaciones sobre el mismo commit: cuatro
  en verde y tres en rojo, en un camino que este paso no toca (la pantalla de bloqueo y el cierre de
  sesión). El modo de falla cambia de corrida en corrida —a veces la URL que no llega a `/acceso`, a
  veces el encabezado que todavía no dice «Entrá al taller»— y tarda 5,7 s cuando falla contra 0,6 s
  cuando pasa: es una carrera entre la navegación del cierre de sesión y la aserción. Su test hermano
  de la línea 191 pasó 3 de 3. No lo arreglé acá porque no es de este paso; queda anotado para que el
  próximo que lo vea en rojo no lo busque en las opciones ni en la seña.
- **Nada se probó en un teléfono ni con un lector de pantalla de verdad**: se revisó el árbol de
  accesibilidad de Chromium y el recorrido con Tab.

## Alternativas descartadas

- **La caja de notas al lado del valor**, que es el primero de los dos caminos que él ofreció. No
  resuelve lo que ya está haciendo: seguiría sin poder tildar cuál aprobaron, y el presupuesto del
  trabajo seguiría siendo un número escrito a mano al lado de un texto.
- **Una mutación propia para las opciones.** Es lo que el ADR 0015 prohíbe explícitamente para las
  hijas de un proyecto: el orden de la foreign key, la atomicidad y la cola que drena de a una.
- **Un `check` en vez del trigger.** No puede mirar otra tabla.
- **Un trigger inmediato.** Da un falso rechazo a mitad de la transacción, cuando el proyecto ya se
  escribió y sus opciones todavía no.
- **Derivar el presupuesto con un segundo `update` después de escribir las opciones.** Sube la
  `version` dos veces y hace rebotar el guardado siguiente con `MN006`.
- **Elegir la opción más barata, o la primera, mientras no aprueban.** Es inventar un número que el
  cliente no eligió, y ese número alimenta el saldo y las métricas.
- **Guardar la seña como importe.** Ver arriba: se queda viejo al cambiar la opción aprobada.
- **Una columna `aprobada` en `proyectos` apuntando a la opción.** Sería una foreign key hacia una
  hija, y el invariante «hay a lo sumo una aprobada» ya lo da el índice único parcial sin esa vuelta.

## Consecuencias

- Una migración (`20260916120000_opciones_de_presupuesto_y_sena.sql`), aditiva: una tabla nueva, dos
  columnas (una nullable y una con default), y el reemplazo de `guardar_proyecto`, `bootstrap()`,
  `delta()` y la baja en cascada. **Ninguna fila existente cambia de valor.**
- **Una tabla nueva en la réplica rompe la sincronización de un bundle nuevo contra una base sin
  migrar** (`leerLote` exige la clave, ADR 0039): la migración se aplica antes de mergear.
- `ajustes.sena_bp` y `proyectos.sena_bp` llegan con `alter table`, que no mueve `updated_at`: un
  dispositivo no las ve por delta hasta el reconcile. Se leen tolerando la fila que no las trae, como
  `visita_hecha` (ADR 0042).
- Todo cambio en la seña se hace en el dominio, con sus tests. No hay gemela en SQL que mantener.
