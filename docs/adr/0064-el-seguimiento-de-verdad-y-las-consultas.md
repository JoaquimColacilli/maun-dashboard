# 0064. El seguimiento de verdad: «por ahora no» con su próximo contacto, y el embudo se llama Consultas

- Estado: aceptada
- Fecha: 2026-09-23
- Cambia el nombre de la pestaña del [0019](0019-seguimiento-el-contacto-es-la-misma-fila.md) y del
  [0038](0038-el-embudo-del-seguimiento.md): el embudo pasa a llamarse Consultas. Lo que decidieron esos
  ADR sigue en pie. Se aparta de la letra del umbral del [0042](0042-lo-hecho-de-los-trabajos-y-las-marcas.md)
  (ver «Objeciones»).

## Contexto

El dueño, en el Miro: si un trabajo es rechazado se da por perdido y queda en Historial; si dijo «por
ahora no» o «lo vamos a hacer más adelante», tiene que entrar en un seguimiento de verdad, con un
diálogo que pregunte el próximo contacto y un evento en la agenda para volver a escribirle; ese día,
al registrar el contacto, reactivar, reasignar o dar por perdido.

Hasta acá, «Seguimiento» era el embudo previo al trabajo: contacto, estimativo enviado, relevamiento, a
presupuestar y presupuesto enviado. Un «por ahora no» quedaba ahí, con «Presupuesto enviado hace 13
días, sin respuesta», o se perdía.

## Decisión

**Los nombres.** El embudo se llama **Consultas**, la palabra del dueño («uno puede ser una consulta»),
en la pestaña, el menú, el botón central, los textos y los avisos. En el front, lo que decía
seguimiento para el embudo pasa a decir consultas (`ListaDeConsultas`, `features/avanzar-la-consulta`,
`RUTA_DE_CONSULTAS = '/consultas'`), en un commit sin lógica. Las rutas viejas `/seguimiento` y
`/seguimiento/nuevo` redirigen conservando búsqueda, hash y estado (`RutaVieja`). En la base no se
renombra nada. **Seguimiento** pasa a ser la pestaña de los «por ahora no»: Consultas · Seguimiento ·
Activos · Historial, en `/proyectos?etapa=seguimiento`. Debajo de 34rem de ancho la barra es de dos por
dos, así entran enteras en 360.

**El estado.** `en_seguimiento` es un valor nuevo del enum, en su propia migración: Postgres no deja
usar un valor en la transacción que lo crea. Se entra desde cualquier etapa de Consultas, con la fecha
obligatoria (atajos: una semana, un mes, tres meses) y una nota opcional de hasta 500 caracteres. Se
sale reactivando a cualquier etapa de Consultas (por defecto, la que tenía), dando por perdido por el
camino que ya existe, con lo que ya hace con la seña, o siguiendo con otra fecha. No se aprueba desde
seguimiento: una sola puerta para aprobar, donde se carga la seña. `TRANSICIONES` pasa de 28 a 38: las
diez nuevas van entre las cinco etapas de Consultas y `en_seguimiento`, en los dos sentidos. Perder
desde seguimiento es una operación de la base, como desde Consultas; revertir un perdido vuelve solo a
Consultas. El comparador cruza todos los pares de estados (transición, liquidación y reversión), así
que las diez entran solas.

**El próximo contacto** es una tabla, `proximos_contactos`: una fila por cada entrada en seguimiento o
cambio de fecha, con la fecha prevista, la nota y la etapa a la que vuelve (`etapa_previa`). Al
registrar el contacto se completa con el día en que se hizo (`hecho_el`), el resultado (`reactivado`,
`perdido`, `otra_fecha`) y lo que contestó, y queda como historia. Se escribe en `guardar_proyecto`,
en la misma transacción que el estado (`p_proximos`, con el patrón de la clave presente). La base
garantiza la regla: a lo sumo un pendiente por trabajo (índice único parcial) y un trabajo vivo está en
seguimiento si y solo si tiene uno (triggers de constraint diferidos al commit, `MN019`). Si sale por
otro lado, como un perdido desde la ficha, un trigger cierra el pendiente con ese resultado. Entra al
bootstrap, al delta y a los tombstones, con RLS y el índice `(household_id, updated_at)`.

**La etapa en que estaba** la pone la base al entrar: es el estado que tenía el trabajo en ese momento.

**En la agenda** es un evento derivado más, `seguimiento`: «Volver a escribirle a <cliente>», con su
color y su forma (un triángulo), en el filtro por tipo. Lo hecho queda tachado en el día en que se le
escribió; lo atrasado sigue pendiente y se ve atrasado. No se arrastra: cambiar el día es registrar el
contacto, y eso deja historia. Se registra desde la fila de la agenda y desde la ficha, con los botones
de llamar y de WhatsApp de las tarjetas.

**Alrededor.** En seguimiento no hay vencimiento de presupuesto ni «hace N días sin respuesta». El aviso
de la mañana suma «Volver a escribirle», prendido y para el mismo día, que se apaga como los demás; a las
preferencias guardadas con cuatro claves la base les completa la quinta al leerlas, sin reescribir la
fila, y un bundle viejo que guarda cuatro no rebota. La vista del cliente muestra la etapa en que estaba:
la función pública no devuelve el estado nuevo ni la nota. Las mutaciones nuevas están en
`mutaciones-persistibles.ts`.

## Decidido por mi cuenta

- **La etapa previa sale del estado al entrar**, no de la historia de cambios de etapa. Es el mismo
  dato, sin depender de que la historia esté completa.
- **«No va», desde el diálogo, guarda la respuesta y lleva al cierre del perdido**, que es donde se decide
  qué pasa con la seña. El pendiente lo cierra la base con la fecha del cierre.
- **Registrar «vuelve» manda la etapa elegida**; si no se elige, la que tenía.
- **La marca de importante del evento vive en la fila del contacto** (`proximos_contactos.importante`),
  con su propia mutación en la cola, como las anotaciones.
- **El botón «Cargar contacto» también está en la pestaña Seguimiento.** Sin él, la pantalla dejaba un
  hueco a la derecha que el test del reparto (0062) no acepta.

## Alternativas descartadas

- **Una anotación en vez de un evento derivado.** Las anotaciones son lo que el dueño escribe a mano;
  esto sale del trabajo.
- **Una columna `proximo_contacto` en `proyectos`.** No guarda la historia, y la historia se pidió.
- **Aprobar desde seguimiento.** Dos puertas para aprobar son dos lugares donde cargar la seña.

## Objeciones

- **El umbral del 0042 dice que un cuarto tipo de evento derivado lleva a una tabla de marcas.** El
  seguimiento es el cuarto y no se armó esa tabla: la marca de importante vive en la fila del contacto.
  Se respeta el espíritu del umbral (no sumar columnas a `proyectos` por cada tipo) pero no su letra. La
  razón: a diferencia de la visita o la entrega, cada contacto ya es una fila propia, con su id, en la
  réplica y por la cola, como una anotación; una tabla de marcas aparte sería una segunda fila por
  contacto. Si aparece un quinto tipo sin fila propia, el umbral vuelve a valer tal cual.
- **Lo atrasado dice «hace N días».** «Atrasado: le tocaba el lun 21 sep, hace 2 días» no es el «hace N
  días sin respuesta» de Consultas, que mide el silencio del cliente: mide un compromiso del dueño que
  se venció. Es lo que pide «lo atrasado sigue pendiente y se ve atrasado».
