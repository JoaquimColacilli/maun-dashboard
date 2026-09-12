# 0015. Proyectos: el agregado que se guarda entero

Estado: aceptada, 2026-09-12. Es el tercer paso de la fase 2D: la pantalla más grande de la app.

## Contexto

Un proyecto con sus pagos y sus gastos son 1 + N + M filas en tres tablas. El formulario del sistema
viejo era su peor pantalla: en el celular directamente no se podía usar. Y Clientes (ADR 0014) dejó
el camino de escritura probado, pero para una sola fila por vez.

## El guardado va por un solo RPC transaccional

**`public.guardar_proyecto(p_proyecto jsonb, p_pagos jsonb, p_gastos jsonb)`**, en una transacción.
Encolar las filas por separado traía tres problemas: el orden importa por la foreign key, un fallo
parcial deja un proyecto con la mitad de sus pagos, y como la cola drena de a una, un rechazo
definitivo de cualquiera de ellas tapa a las demás. Además `supabase-js` no agrupa varias queries en
una transacción: para lógica multi-sentencia el camino soportado es una función llamada por `rpc()`,
con los arrays desarmados del lado de Postgres con `jsonb_to_recordset`.

Conceptualmente el proyecto es el agregado y los pagos y gastos viven adentro: no se guardan sueltos.
Eso simplifica el formulario —el usuario edita el conjunto y aprieta guardar una vez— y deja **un
solo ítem en la cola**, atómico e idempotente por el id del proyecto.

**`security invoker`**, a diferencia de `cobrar_proyecto`: esta función escribe solo columnas sobre
las que el cliente ya tiene grant, así que la RLS y los grants se aplican solos y no hay nada que
saltear. `00_estructura.sql` ya exigía que ninguna función expuesta por la API sea `security definer`.

Las cuatro cosas que respeta:

- **El mismo lock que `cobrar_proyecto`:** su primera sentencia bloquea el proyecto con `for update`.
  La guarda de pagos y gastos toma `for share` sobre esa misma fila, así que un cobro simultáneo se
  serializa: o la liquidación espera y suma los pagos nuevos, o este guardado espera y ve el proyecto
  ya liquidado, y entonces la guarda lo rechaza. No se inventó un esquema de bloqueo nuevo.
- **Un proyecto liquidado no deja tocar sus pagos ni sus gastos.** No hace falta una regla nueva: lo
  rechaza `private.validar_proyecto_abierto`, la guarda que ya existía, con `MN001` y su hint («Para
  corregirlo hay que reabrir el proyecto o registrar un ajuste»). Editarle las notas sí se puede: no
  tocan la distribución.
- **Conflicto por versión.** El pedido lleva la `version` que vio el cliente; si la fila del servidor
  cambió, se rechaza con `MN006` y un hint que dice qué hacer. La excepción es el reenvío de la cola:
  si la versión subió exactamente uno y la fila ya quedó igual a lo que se manda, es este mismo
  guardado que ya se aplicó y la respuesta se perdió, así que no se rechaza algo que salió bien.
- **Borrado de filas hijas: marcado de bajas, no reemplazo del conjunto.** Ver abajo.

**La edición manda la fila entera**, al revés que el resto de las mutaciones (ADR 0010). Ahí la regla
de «solo las columnas que cambiaron» existe para que un reenvío no pise lo que el servidor cambió en
el medio; acá el chequeo de versión es una garantía más fuerte, porque si el servidor cambió algo el
guardado se rechaza en vez de pisarlo en silencio.

### Por qué marcado de bajas y no reemplazo del conjunto

Las filas que el usuario sacó del formulario viajan marcadas con `borrado` en el mismo array, y solo
las que existían de verdad. La base nunca borra «todo lo que no vino en el pedido».

El reemplazo completo es más simple de escribir y **está mal** acá: `proyectos.version` no se mueve
cuando solo cambian sus hijos, porque un update que no cambia ninguna columna es un no-op
(`private.mantener_metadatos`). Entonces un guardado hecho sin señal sobre una versión vieja pasaría
el chequeo de versión y borraría en silencio un pago cargado desde otro lado — exactamente lo que ese
chequeo existe para impedir. Con el marcado, el guardado solo puede borrar una fila cuyo id el
usuario sacó de la pantalla.

Es además idempotente: volver a marcar una fila ya borrada no hace nada (`where deleted_at is null`)
y la primera marca se conserva. Y sigue siendo baja lógica, nunca física: un borrado físico es
invisible para el delta y le dejaría la fila para siempre a un cliente que estuvo desconectado
(ADR 0010).

### Lo que encontró el ensayo, y lo que encontró el e2e

Tres cosas que no se vieron leyendo el SQL:

- **`insert ... on conflict (id) do update` evalúa los `check` de la tabla sobre la fila propuesta
  antes de resolver el conflicto.** Guardar las notas de un proyecto cobrado proponía una fila con
  estado `cobrado` y la distribución en null, y eso choca contra
  `proyectos_liquidado_con_distribucion`. El alta y la edición pasaron a escribirse por separado.
- **Postgres le da `execute` a `anon` en toda función nueva de `public`**, por las default privileges
  de Supabase: el `revoke from public` no alcanza, hay que nombrar también a `anon`. Lo cazó
  `00_estructura.sql`, que ya lo exigía.
- **`jsonb_to_recordset` castea todas las columnas de todas las filas antes de que el `where` filtre
  nada.** Una baja que viajaba con `"fecha": ""` —lo que devuelve un `<input type="date">` vacío—
  cortaba la llamada entera con `22007`, un rechazo definitivo sin mensaje que tapa la cola. Se
  arregló de los dos lados: la baja manda solo su id (el tipo lo hace irrepresentable) y la función
  lee la fecha de las filas hijas como texto y la castea recién donde la usa. Esto lo encontró el
  e2e, no el pgTAP: la suite mandaba bajas con una fecha válida.

## No se agregó una librería de tablas

Clientes ya tenía listas ordenables a mano. Lo que había quedó atado a esa pantalla, así que se
extrajo a `shared/lib/orden.ts` y ahora lo usan las dos: un `Criterio` es un id, una etiqueta, un
tipo (`texto`, `numero`, `fecha`), cómo leer el valor y con qué sentido arranca.

El trabajo está en los comparadores por tipo, como decía el brief: texto con la collation del
español (`Intl.Collator('es', { sensitivity: 'base' })`), plata como entero de centavos, y fechas
como texto ISO, que ordenado alfabéticamente ya queda cronológico. Dos decisiones propias:

- **Lo que falta va al final en los dos sentidos.** Un proyecto sin fecha de entrega no es ni el más
  urgente ni el menos, y al invertir el orden no tiene que saltar al principio.
- **El desempate es estable**, por un id, así la lista no baila al reordenar.

Cada columna arranca con el sentido que tiene sentido para su tipo: la plata de mayor a menor, las
fechas de la más próxima a la más lejana, el texto de la A a la Z. El caso de Proyectos no resultó
materialmente más complejo que el de Clientes: son siete columnas contra tres, la misma maquinaria.

## Fechas con el input nativo

`<input type="date">`, sin librería, como pedía el brief.

**El cálculo de la entrega estimada cuenta solo días de semana.** `entregaEstimada(inicio, feriados)`
acepta una lista de feriados por parámetro —el dominio es puro y no conoce el calendario (ADR 0011)—
pero **ningún llamador del repo le pasa una lista**, así que hoy la estimación salta sábados y
domingos y nada más. No se cambió: queda anotado, como pidió el brief.

## El control segmentado es ruta, no estado local

`Seguimiento · Activos · Historial` arriba de Proyectos. No es un capricho de diseño: el dueño
describió su flujo con esas tres palabras y quiere que las fichas «se pasen de una pestaña a la otra
cuando cambian de estado».

Cada pestaña es una ruta (`/seguimiento`, `/proyectos`, `/proyectos?etapa=historial`) y no estado
interno, por dos razones: en escritorio Seguimiento es un destino propio de la sidebar (ADR 0013), y
`destinoResaltado` tiene que poder marcar bien la navegación en cada ancho. `pages/seguimiento` se
borró: el router monta `ProyectosPage` en las dos rutas y la pantalla decide la pestaña. Seguimiento
todavía no existe y lo dice con esas palabras.

## El despiece es un componente compartido con el cobro

`entities/proyecto` expone `despieceDelProyecto` y `DistribucionDespiece`. Un proyecto liquidado
muestra lo que quedó congelado; el resto, la proyección atenuada de a dónde iría cada peso.

La proyección se calcula con `calcularLiquidacion` del dominio, con los mismos ajustes, la misma
reapertura y las mismas liquidaciones del mes que va a usar el cobro: lo que cambia entre las dos
pantallas es el modo, no la cuenta. **No se portó el `despiece` del diseño**, que reparte sobre el
presupuesto en vez de sobre lo cobrado (ADR 0003 y 0011).

`liquidacionesDeLaReplica` ahora acepta un proyecto a excluir, que es la misma exclusión que hace
`private.liquidar`: el tope del mes sale de lo que ya llevan los otros.

## El chunk de vendor

Separado, como estaba recomendado en el ADR 0014. No baja un byte del primer arranque —los dos chunks
están en el precache y entran con `modulepreload`, así que no aparece ningún spinner y la decisión
del aterrizaje no se toca— pero la app es una PWA que precachea el shell.

Medido sobre el build de este paso: **el chunk de aplicación queda en 157,5 kB (43,2 kB con gzip) y
el de vendor en 736,5 kB (215,9 kB con gzip)**. Antes era uno solo de 887,9 kB (258,7 kB con gzip).
Cambiar una pantalla ahora son 43 kB comprimidos en vez de 259 kB. El precache subió de 1018,9 KiB a
1020,5 KiB, que es el costo del chunk extra del runtime.

La estimación del ADR 0014 («un cambio de código son 20 kB») quedó corta: el chunk de aplicación
incluye ahora todo el código propio, que creció bastante en este paso.

## Otras decisiones de la pantalla

- **El combobox de clientes encaja sin cambios.** Era la pieza sin llamador que dejó el ADR 0014 y
  este es su llamador: se montó tal cual.
- **El formulario no se cierra hasta saber qué pasó.** Con señal espera la respuesta, porque un
  rechazo (una versión vieja, un proyecto ya cobrado) tiene que verse con todo lo que el usuario
  escribió todavía en pantalla. Sin señal la mutación queda pausada y nunca resuelve, así que ahí el
  formulario se cierra igual: es lo que hace que se pueda cargar un proyecto en modo avión.
- **El select de estado ofrece solo transiciones válidas.** Un estado inválido rebota con `MN007`,
  que es definitivo y tapa la cola: la misma disciplina que el formato del CUIT en Clientes.
- **Quitar una fila con datos ofrece deshacer, no un diálogo.** En el celular, con una mano, un
  deshacer de un toque es mejor que confirmar cada borrado; una fila vacía se va sin preguntar.
- **El foco de una fila nueva lo pone `shouldFocus` de `useFieldArray`.** Poner además un foco propio
  en un `requestAnimationFrame` compite con ese y puede llegar tarde, en medio de lo que el usuario
  ya está escribiendo. Lo encontró el e2e, con el monto escrito adentro del campo de concepto.
- **El catálogo de tesoros bajó a `shared/lib`.** Lo necesitan Inicio (por `entities/tesoro`) y el
  despiece (por `entities/proyecto`), y un slice de `entities` no puede importar a otro.
  `entities/tesoro` lo re-exporta, así que su API pública no cambió: el mismo movimiento que hizo el
  ADR 0014 con las claves de la réplica.
- **`totalesPorProyecto` vive en `packages/db`**, en un solo lugar: son los dos números que la app le
  manda a `cobrar_proyecto`, y si divergen de la suma de la base el cobro rebota con `MN006`. El
  comparador los verifica por el camino real (`bootstrap()` → réplica → `totalesDelProyecto`).
- **Borrar un cliente**, que quedó pendiente del ADR 0014, ya tiene botón, con su confirmación y el
  mensaje de la base cuando rechaza con `MN003`.

## Objeciones

- **`guardar_proyecto` no tiene gemela en TypeScript, así que el comparador no la compara «a ella».**
  Lo que se agregó al comparador es lo que sí puede diverger en silencio: que lo que escribe la
  función sea exactamente lo que la app lee de su réplica, y que el libro mayor salga igual armado
  por ese camino. Se verificó que puede fallar: sumándole un centavo a `totalesPorProyecto`, la
  comparación se pone en rojo con `cobrado: SQL 60000000, TS 60000002` en los cuatro escenarios.
  Igual es una comparación más floja que la de la cascada, y conviene decirlo.

- **El teclado del celular no se probó en un celular.** Chromium no abre un teclado de verdad: el
  e2e emula el alto que deja achicando el viewport, y con eso verifica que el botón de guardar sigue
  entero y alcanzable. Que el campo enfocado no quede tapado en un iPhone real sigue sin probarse.
  El contenedor se ancla arriba y toma su alto de `visualViewport`, que es la variante que mejor se
  porta con el layout viewport que iOS no achica, pero es un razonamiento, no una medición.

- **El rechazo por versión se ve solo si el formulario sigue abierto.** Si la mutación quedó en cola
  y rebota horas después, lo único que queda es el indicador global y la lista de Ajustes, sin lo que
  el usuario había escrito. Es el mismo límite que tiene toda la cola desde el ADR 0012, pero en un
  formulario de diez campos duele más que en uno de un movimiento.

- **El household del e2e no se puede vaciar del todo si aparece un proyecto liquidado.** `vaciarTaller`
  saltea los cobrados y perdidos, porque un liquidado con pagos o gastos no se borra (`MN001`). Hoy
  nada de la suite los crea; cuando exista la pantalla de cobro, el vaciado va a tener que reabrirlos
  antes, o la suite va a empezar a fallar en el borrado de clientes con `MN003`.

## Alternativas descartadas

- **Encolar el proyecto, los pagos y los gastos como mutaciones separadas.** Es el problema que este
  ADR resuelve: orden, atomicidad y una cola que se tapa.
- **Reemplazo completo del conjunto de filas hijas.** Ver arriba: borra en silencio lo que el cliente
  no vio.
- **TanStack Table.** Unos 15 kB comprimidos sobre un bundle que ya está bajo la lupa, y dos patrones
  de ordenamiento conviviendo o Clientes reescrito.
- **Una librería de fechas.** El input nativo abre el selector del sistema operativo en el celular y
  pesa cero.
- **`useOptimistic` para el agregado.** Ya descartado en el ADR 0013: es local al componente y
  revierte al terminar la transición; una mutación encolada vive horas y sobrevive a cerrar la app.
