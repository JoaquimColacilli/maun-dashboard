# 0070. El camino tilda lo que pasó y deja en curso lo que falta

- Estado: aceptada
- Fecha: 2026-09-25
- Corrige al [0046](0046-la-vista-del-cliente-una-lista-blanca-en-la-base.md) (el ámbar ya no es el
  paso al que llegó el trabajo, y el titular deja de salir de un paso), al
  [0058](0058-el-estimativo-y-el-relevamiento-en-el-camino-del-cliente.md) (el estimativo nunca es el
  paso en curso) y al [0059](0059-la-nota-del-relevamiento-reemplaza-al-casillero.md) (la (i) sigue
  en el mismo paso, que ya no siempre es el que está en curso). Completa al
  [0067](0067-la-vista-antes-de-aprobar.md): la seña cubierta antes de aprobar no se vuelve a pedir.

## Contexto

El dueño miró «El camino de tu mueble» en la página de un trabajo con el presupuesto mandado y pidió,
con sus palabras: «si le pasás el presupuesto, el paso de "Te pasamos el presupuesto vie 25 sep"
debería estar en verde, no en amarillo, y el amarillo debería ser el "Cuando lo apruebes y dejes la
seña", me entendés? por una cuestión de timing en la timeline, porque si no cuando lo aprobás, pasa
de "Presupuesto enviado vie 25 sep" a "Lo estamos fabricando vie 25 sep" y se saltea el "Aprobado,
seña cobrada vie 25 sep"». Y que se fijara si había otro paso funcionando mal.

El camino pintaba en ámbar el paso al que había llegado el trabajo (`hitoActual`), con su fecha. Un
hecho ya pasado, «Te pasamos el presupuesto», se leía como algo en curso, y la aprobación, que es lo
que se estaba esperando, quedaba gris. Al aprobarlo, pasaba de gris a verde sin haber estado nunca en
curso: el salto que marcó el dueño.

## Lo investigado

Tres auditores miraron el camino por separado, cada uno con una mirada (los colores y el orden, las
fechas y los hechos, lo que se lee), corriendo el dominio real en más de ochenta combinaciones de
etapa, seña, pagos, visita y fechas, y las sucesiones de un trabajo típico día por día. Una síntesis
unió lo encontrado en una tabla de escenarios y un crítico buscó lo que faltaba. El mismo error
aparecía en cuatro lugares más:

- **El estimativo mandado** quedaba en ámbar con su día, igual que el presupuesto.
- **Aprobado con la seña, esperando arrancar**: «Recibimos la seña y ya estás en la cola del taller»
  en ámbar sobre el paso de la aprobación, con la fecha de la aprobación, y el arranque, que es lo que
  se espera, gris.
- **Aprobado sin la seña**: el paso decía «Lo aprobaste y falta la seña…» con la fecha de la
  aprobación, como si fuera un hecho.
- **Entregado con saldo**: «Ya está instalado en tu casa» en ámbar, y el saldo, que es lo que falta,
  gris.

Y tres cosas de la misma página que se contradecían:

- **Con la seña ya cubierta antes de aprobar** (la captura del dueño: $ 250.000 pagados de una seña de
  $ 250.000), arriba decía «Con lo que pagaste ya está cubierta la seña.» y el camino, «lo próximo» y
  «Para cuándo» le seguían pidiendo que la dejara.
- **Pagado entero antes de la entrega**, el último paso seguía diciendo «Cuando esté saldado».
- **Un inicio que todavía no llegó, o posterior a la entrega** (un inicio planeado que nadie
  corrigió), aparecía como el día en que se empezó a fabricar, en el paso ya tildado y en «Lo que fue
  pasando».

## Decisión

### Verde es un hecho, amarillo lo que se hace o se espera

| Etapa                                              | Tildados                  | En curso    | Texto del paso en curso                                                           |
| -------------------------------------------------- | ------------------------- | ----------- | --------------------------------------------------------------------------------- |
| Contacto, relevamiento, a presupuestar             | el estimativo, si lo hubo | presupuesto | «Estamos preparando tu presupuesto»                                               |
| Estimativo enviado                                 | el estimativo             | presupuesto | «Te vamos a pasar el presupuesto»                                                 |
| Presupuesto enviado                                | hasta el presupuesto      | aprobación  | «Cuando lo apruebes y dejes la seña», o «Cuando lo apruebes» con la seña cubierta |
| Aprobado con la seña en falta                      | hasta el presupuesto      | aprobación  | «Cuando dejes la seña»                                                            |
| Aprobado con la seña o sin presupuesto, en la cola | hasta la aprobación       | fabricación | «Vamos a empezar a fabricarlo»                                                    |
| En fabricación                                     | hasta la aprobación       | fabricación | «Lo estamos fabricando», con el día de inicio                                     |
| Entregado con saldo                                | hasta la entrega          | pago        | «Cuando esté saldado»                                                             |
| Saldado o cobrado                                  | todos                     | ninguno     | (el último dice «Listo, está saldado»)                                            |

- **Tildado** lleva su etiqueta de siempre y la fecha del hecho, o ninguna si no hay registro: no se
  inventa un día.
- **En curso** no lleva fecha, salvo la fabricación ya arrancada, que lleva el día de inicio porque es
  un hecho. Uno solo, y lleva `aria-current="step"`: el ámbar se veía y no se oía.
- **Futuro** no lleva fecha y dice qué va a pasar. El último, con el trabajo aprobado y ya pagado
  entero antes de la entrega, dice «Ya está pagado» en vez de pedir el saldo, y se tilda al entregar
  (la ayuda ya decía «Primero sale del taller»). Antes de aprobar no hay saldo (0067), así que ahí
  sigue diciendo «Cuando esté saldado».
- **El ámbar avanza de a un paso**: preparando, esperando que lo apruebe, en la cola, fabricando,
  esperando el saldo, completo. Pasan de gris a verde sin estar en curso solo los hechos que se
  registran juntos: la entrega con el fin de la fabricación, la aprobación con el arranque cuando el
  inicio es de ese día, la aprobación directa desde una consulta, y el pago entero anterior a la
  entrega, que se tilda el día que se entrega.

`pasoEnCurso(etapa, seña)` decide cuál es. **No es `hitoActual`**, que sigue siendo el paso al que llegó
el trabajo y del que salen el titular, «lo próximo», la nota y el dibujo: con el presupuesto mandado
el titular sigue diciendo «Te pasamos el presupuesto». El titular pasa a ser un campo de la vista,
`titular`, con los mismos textos, y `hitoIndex` se va: apuntaba al paso verde y era la próxima trampa.

### La seña cubierta antes de aprobar

El paso en curso dice «Cuando lo apruebes», «lo próximo» dice «Lo próximo es que lo apruebes.» y «Para
cuándo» dice «Cuando lo apruebes, coordinamos la fecha de entrega.» o «Si lo aprobás antes del …,
podríamos tenerlo listo para el …». `textoDeLaProyeccion` recibe la situación de la seña. Con la seña
en falta o sin presupuesto, los textos que el dueño marcó en verde en el 0067 quedan palabra por
palabra.

### La fecha de la fabricación

El día de inicio cuenta como el día en que se empezó solo si ya llegó y no es posterior a la entrega
(`inicioDeLaFabricacion`). Lo usan el paso y el evento «Empezamos a fabricarlo», así no puede quedar
«Empezamos» después de «Lo llevamos».

### El presupuesto que se vuelve a preparar

Si el trabajo vuelve de «Presupuesto enviado» a una etapa anterior, la base sigue mandando el día en
que se mandó. El paso ahora queda en curso y sin fecha, y «Lo que fue pasando» tampoco dice «Te pasamos
el presupuesto» mientras se prepara de nuevo: se lo decían a la vez, en la misma página, y la ayuda
promete que volver atrás no deja ninguna línea. Si se vuelve a mandar, reaparece con la primera fecha
(0046).

### La (i) del relevamiento

`notaDelRelevamiento` dice de qué paso cuelga (`hito`, que es `hitoActual`) y `CaminoDeHitos` la pone
ahí. Queda en el mismo paso que antes; lo que cambia es que ese paso puede estar tildado. Mientras el
trabajo está en «Estimativo enviado» va al lado del día del estimativo; cuando pasa a relevamiento o a
presupuestar, en el presupuesto en curso, sin fecha; con el presupuesto mandado, al lado del día del
presupuesto.

### La ayuda del dueño

Las frases de «Cómo lo ve tu cliente» que dejaban de ser ciertas cambiaron: el estimativo aparece
tildado, la (i) dice en qué paso aparece según la etapa, el paso 2 queda en curso desde que se manda
el presupuesto, el 3 desde que se tilda el 2, el 5 desde la entrega, y el pago entero antes de
entregar dice «Ya está pagado» desde que el trabajo pasa a Proyectos. Los títulos de las filas son las
etiquetas del camino y no cambian.

## Desvíos del pedido

- **En la captura del dueño el ámbar dice «Cuando lo apruebes», no «Cuando lo apruebes y dejes la
  seña».** En esa captura la seña ya estaba cubierta por un pago a cuenta, y la misma página lo decía.
  Con la seña pendiente dice exactamente lo que él pidió.

## Objeciones

Quedaron afuera a propósito, porque no son del tiempo del camino o piden una decisión del dueño:

- **Con el presupuesto vencido**, «lo próximo» sigue siendo que lo apruebe y deje la seña, y «Cómo
  pagar» sigue pidiendo la seña, al lado de «Este presupuesto venció». Es la objeción que dejó el 0067:
  hay que resolver las dos juntas.
- **Un trabajo cobrado con saldo sin registrar** tiene el camino completo («Listo, está saldado») y
  arriba «Te falta pagar». Si cobrado cierra la cuenta para el cliente o le sigue debiendo lo tiene que
  decidir el dueño.
- **Con seña 0** el paso dice «Aprobado, seña cobrada» y el titular «Recibimos la seña», sin que haya
  habido seña. Solo el dibujo lo contempla (no pone la plata encima).
- **Al aprobar, el pase a Proyectos propone la fecha de inicio cargada aunque sea vieja.** Muchos
  trabajos traen un inicio del sistema anterior; si el dueño no lo cambia, el cliente ve «Lo estamos
  fabricando» con un día anterior a la aprobación. El camino muestra lo que se confirmó; el arreglo
  está en el pase.
- **El paso 3 ya tildado dice «En fabricación»**, con el día en que se empezó. Una etiqueta en pasado
  obligaba a cambiar la ayuda por un texto que el dueño ya aprobó.
- **«Aprobado, seña cobrada» lleva el día de la aprobación**, aunque la seña se haya completado después.
- **Un estimativo mandado después de un presupuesto** queda antes en el camino con una fecha
  posterior: las fechas quedan (0046).

## Alternativas descartadas

- **Tildar el pago antes de la entrega** si se pagó todo antes: el camino tendría un verde después de
  un gris, y la ayuda ya decía que primero sale del taller.
- **«Si seguimos adelante, te pasamos el presupuesto»** como paso en curso del estimativo: en la PC
  las columnas miden unos 110 px y en negrita ocupaba cuatro renglones, y «lo próximo», justo abajo,
  ya empieza con «Si seguimos adelante».
- **Mudar la nota hecha al paso del presupuesto** mientras el trabajo está en el estimativo: cambiaba
  una decisión del 0059 que el pedido no tocaba.
- **La fecha de «seña cobrada» por importes acumulados**: el crítico encontró que con seña 0 daba el día
  del primer pago, y que un paso ya tildado cambiaba de fecha días después.

## Consecuencias

- Una etapa nueva de la vista se suma a `pasoEnCurso` y a los casos del test «qué ve el cliente en cada
  etapa del trabajo», que ahora dicen el paso en curso y el titular por separado.
- El titular se lee de `vista.titular`, nunca del texto de un paso.

## Cómo se verificó

- `vistaCliente.test.ts`: cada etapa con su camino y su titular, el ámbar que avanza de a un paso
  (contacto, presupuesto mandado, aprobado con inicio hoy), la seña cubierta antes de aprobar, aprobado
  sin la seña y sin presupuesto, el pago entero antes de entregar, el inicio posterior a la entrega, el
  presupuesto vuelto a preparar, la (i) en su paso y «Para cuándo» con cada seña.
- `VistaDelCliente.test.tsx`: el presupuesto tildado con su día y la aprobación con `aria-current`,
  la seña cubierta sin que nada la pida, y la entrega tildada con el saldo en curso.
