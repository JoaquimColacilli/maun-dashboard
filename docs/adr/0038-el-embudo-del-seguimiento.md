# 0038. El embudo del seguimiento: el estimativo es un estado, las tareas son tildes y el pago sugiere

- Estado: aceptada
- Fecha: 2026-09-15
- Completa al [0019](0019-seguimiento-el-contacto-es-la-misma-fila.md) (seguimiento) y al
  [0034](0034-la-agenda-calcula-lo-que-sale-de-los-trabajos.md) (el vencimiento del presupuesto).
  Respeta al [0011](0011-dominio-cascada-estados-y-cobro.md) en qué es una transición y al
  [0029](0029-el-estado-se-cambia-desde-la-ficha.md) en que el estado se cambia con acciones.

## Contexto

El dueño usó Seguimiento y pidió cuatro cosas: poder poner y corregir la fecha del relevamiento, que de
esa fecha salga el plazo para entregar el presupuesto, un presupuesto estimativo como camino propio, y
ordenar lo que hay adentro de «presupuestar» (diseñar, despiezar, cotizar, armar el PDF). Y una regla de
su trabajo: si relevó y cobró, sigue el presupuesto; si no cobró, un estimativo; pero quiere poder hacer
el presupuesto sin cobrar.

**Lo que había, antes de tocar nada.** La hoja «Editar el contacto» ya tenía el campo Visita, editable
en cualquier etapa: «no me permite modificar la fecha» no era literal. Lo que sí fallaba:

- «Ya fui a relevar» no preguntaba el día. Guardaba la fecha agendada aunque fuera futura: si la visita
  era el viernes y fue el miércoles, la ficha y la agenda seguían diciendo viernes.
- Corregir la fecha después no movía el vencimiento del presupuesto.
- La ficha mostraba la fecha sin ningún camino a corregirla, más que «Editar» arriba de todo.

## Decisión

**a) El día del relevamiento.** «Ya fui a relevar» abre un formulario en el panel «Qué falta»: qué día
fue (la visita si ya pasó, hoy si era para más adelante; no acepta un día futuro), hasta cuándo entregar
el presupuesto y, si el contacto no tiene pagos, cuánto le pagaron la visita (opcional, entra como la
seña). En la ficha, la fila pasa a llamarse «Relevamiento» y tiene «Cambiar», que abre la hoja con el
foco en la fecha. «Agendar la visita» también abre la hoja en la fecha.

**b) El plazo: cinco días hábiles, una semana de trabajo.** `DIAS_HABILES_PARA_PRESUPUESTAR` pasa de 3 a 5. Hábiles y no corridos por lo mismo que la entrega estimada: una visita del sábado vence el viernes, no
el sábado siguiente. Desde un lunes da el lunes siguiente, que es «una semana».

- **Se corre sola mientras no se la toque.** Al corregir el día, el vencimiento se recalcula si era el
  propuesto para el día anterior; si no, se lo puso a mano (se lo prometió para un día) y queda. Se
  decide comparando, sin una columna de «puesto a mano».
- **Viniendo de un estimativo, el plazo corre desde el día que pasa a presupuestar**, que es cuando pagó:
  el de la visita ya no dice nada.
- **La agenda no muestra el vencimiento de un estimativo enviado**, igual que el de un presupuesto
  enviado: los dos esperan al cliente.

**c) `presupuesto_estimativo`, entre contacto y relevamiento.** Significa «estimativo enviado», como
`presupuesto_enviado`: el estado es el resultado de una acción («Mandé el estimativo»). Que falte hacerlo
lo dice la sugerencia, no el estado.

- **Transiciones: 28** (antes 19). Dentro del seguimiento se va y viene entre las cinco etapas, que es
  la regla que ya tenían las cuatro; desde cualquiera se aprueba; la obra vuelve a «presupuesto enviado»
  y no a estimativo. Un estimativo se da por perdido, y un perdido se reactiva en estimativo.
- **Revisé cada transición nueva y ninguna tuvo que forzarse.** La que más dudé fue estimativo → obra:
  quedó porque contacto → obra ya existía, y el pasaje igual exige el presupuesto.
- **Dos migraciones.** Postgres no deja usar un valor de enum en la transacción que lo agregó, y el
  ensayo corre todo en una. La primera solo agrega el valor; la segunda cambia las tres funciones
  gemelas y la consulta de los avisos.
- **Ningún contacto cambia de estado.** Antes de aplicar, producción tenía 33 trabajos vivos en los ocho
  estados de siempre; el valor nuevo no toca ninguna fila.
- **El comparador cubre las 81 combinaciones** de transición, liquidación y reversión, y un escenario
  nuevo que cierra un estimativo con seña, lo reactiva en estimativo y lo vuelve a cerrar.

**d) Las tareas son tildes adentro de «a presupuestar», no estados.** Un estado se justifica para contar
cuántos trabajos hay en una fase; con cinco o diez contactos, lo que hace falta es saber qué le falta a
cada uno. Cuatro estados más serían decenas de combinaciones para el comparador sin cambiar ningún
comportamiento.

- **Cuatro columnas booleanas** (`presupuesto_diseno`, `_despiece`, `_cotizacion`, `_pdf`), no un array:
  cada tilde es un update de su columna sola, así dos dispositivos que tildan tareas distintas sin señal
  no se pisan (ADR 0010). `guardar_proyecto` no las escribe, así que mandar el presupuesto no las borra.
- **Van por la cola** (`MUTACION_DE_TAREAS`), optimistas y en silencio: solo avisa si la base rechaza.
- **Tildar no es contactar al cliente:** no mueve el último contacto.
- **Con las cuatro, la app sugiere «Mandé el presupuesto».** No cambia el estado: lo cambia él.

## La sugerencia, y por qué no es una regla

`situacionDelContacto` recibe lo cobrado y las tareas, y devuelve qué sigue; `pasosDelContacto` arma los
botones. El primero es el sugerido; los demás siguen ahí.

| Situación                                   | Qué falta                                         | Botones                                             |
| ------------------------------------------- | ------------------------------------------------- | --------------------------------------------------- |
| Contacto                                    | Falta agendar la visita                           | Agendar la visita · Mandé un estimativo · Aprobó    |
| Estimativo enviado, sin visita              | Si avanza, falta agendar la visita                | Agendar la visita · Aprobó                          |
| Estimativo enviado, visita pasada, sin pago | Falta que apruebe el estimativo y pague la visita | Pasar a presupuestar (pide el pago) · Aprobó        |
| A presupuestar, visita cobrada              | Falta presupuestar                                | Mandé el presupuesto · Aprobó                       |
| A presupuestar, sin cobrar                  | Falta el estimativo: la visita no está cobrada    | Mandé el estimativo · Mandé el presupuesto · Aprobó |
| A presupuestar, alguna tarea tildada        | Falta presupuestar: N de 4 tareas hechas          | Mandé el presupuesto · Aprobó                       |
| A presupuestar, las cuatro tildadas         | Ya está armado: falta mandar el presupuesto       | Mandé el presupuesto · Aprobó                       |

**El pago decide qué se sugiere, nunca qué se puede.** No hay un `check`, una guarda, un botón
deshabilitado ni un paso que se esconda por no haber cobrado. El dueño lo pidió con estas palabras: «que
igual me permita hacer el presupuesto si por alguna razón decido hacerlo sin cobrar el relevamiento».
Endurecerlo sería construir el mismo muro que el ADR 0011 evitó con el perdido: el usuario inventa un
rodeo (cargar un pago falso para destrabar) y los números dejan de ser verdad. **Si en el futuro alguien
quiere volverlo obligatorio, primero lo habla con el dueño: esta decisión es suya, no técnica.**

Tildar una tarea sin haber cobrado cambia la sugerencia a «Falta presupuestar»: si está diseñando, está
haciendo el presupuesto completo, y seguir pidiéndole el estimativo sería insistir.

## Decidido por mi cuenta

- La etiqueta del estado es «Estimativo enviado», no «Presupuesto estimativo»: dice que ya salió.
- «Mandé el estimativo» no pide monto. `presupuesto_centavos` es el del presupuesto, y guardar ahí el
  estimativo haría que el pasaje proponga el número aproximado como aprobado.
- El pago de la visita se puede anotar en el mismo paso de relevar y al pasar de estimativo a
  presupuestar, con el concepto de la seña. Sin eso, la sugerencia no tenía cómo enterarse sin ir a Editar.

## Objeciones

- **La app no guarda que ya se mandó un estimativo antes de relevar.** En el camino consulta →
  estimativo → visita sin cobrar, «a presupuestar» vuelve a sugerir un estimativo. Es la regla del pedido
  tal cual, y se sigue con un toque («Mandé el presupuesto») o tildando una tarea. Una columna con la
  fecha del estimativo lo resolvería, pero obliga a cambiar `guardar_proyecto`; no lo hice sin que haga
  falta.
- **Los vencimientos propuestos antes de este cambio (a tres días) cuentan como puestos a mano:** corregir
  el día del relevamiento no los mueve. Afecta a los contactos que ya estaban a presupuestar.
- **La función de borde de los avisos importa el dominio al desplegarse.** Hasta volver a desplegarla, no
  avisa la visita de un contacto en estimativo.
- **Nada se probó en un teléfono.**

## Verificación

- Dominio: `estados.test.ts` (las 28, el estimativo como etapa optativa, perdido y reactivación),
  `fechas.test.ts` y `agenda.test.ts`, con cobertura del 100%.
- App: `seguimiento.test.ts` (cada fila de la tabla de arriba, y que cada paso ofrecido es una transición
  válida), `tareas.test.ts`, `relevamiento.test.ts` y los dos `vencimiento.test.ts`.
- Base: `20_embudo_del_seguimiento.sql` (18) y el comparador con el escenario del estimativo perdido.
- e2e, en celular y escritorio (`seguimiento.spec.ts`): relevar con el día de verdad y corregirlo, el
  camino con estimativo de punta a punta, el camino sin cobrar que igual manda el presupuesto, y tildar y
  destildar las tareas hasta la sugerencia.
