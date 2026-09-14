# 0029. El estado se cambia desde la ficha, con acciones y no con un selector

- Estado: aceptada
- Fecha: 2026-09-14
- Completa al [0019](0019-seguimiento-el-contacto-es-la-misma-fila.md), que resolvió los pasos del
  contacto, y respeta al [0011](0011-dominio-cascada-estados-y-cobro.md) y al
  [0016](0016-el-cobro-y-el-rechazo-que-encuentra-al-usuario.md) en qué es una transición y qué es
  una operación.

## Contexto

En la ficha de un proyecto la insignia «En curso» no hacía nada: para cambiar de estado había que
entrar a Editar. La ficha del contacto ya lo resolvía con pasos escritos en el idioma del taller
(«Mandé el presupuesto», «Ya lo aprobó»). El dueño pidió lo mismo para las obras, en el celular y en
la PC, y que el cambio pase por la cola.

## Decisión

**Acciones, no un selector ni un toque que cicla.** La insignia sigue siendo pasiva. Debajo del trío
de importes va un panel «Qué falta» con el próximo paso escrito y un botón por destino. Es
`PanelDePaso` (`shared/ui`), el mismo que usa ahora la ficha del contacto: las dos se ven iguales
porque son el mismo componente.

**Los destinos salen de la máquina de estados del dominio.** `cambiosDeEstado(desde)` recorre
`TRANSICIONES[desde]` y solo le pone el texto a cada destino. Si mañana cambia una transición, el
panel la ofrece o la saca sin tocar la pantalla. El test lo compara estado por estado contra la
tabla del dominio, y la etiqueta es un `switch` exhaustivo: un estado nuevo no compila sin su texto.

**Cobrar y dar por perdido no están, y no pueden llegar a estar.** `TRANSICIONES` no tiene destinos
liquidados (ADR 0011), y además `cambiosDeEstado` los filtra por tipo (`EstadoSinLiquidar`): aunque
alguien agregara uno al dominio, el panel no lo ofrecería. Los botones de cobrar y de dar por perdido
siguen donde estaban, afuera del panel, y llevan a sus pantallas, donde la confirmación es el
despiece.

**Aprobar un contacto sigue siendo la pantalla del pasaje** (ADR 0019): el destino `en_curso` desde
seguimiento viene con `camino: 'pasaje'` y navega en vez de guardar.

**Por la cola, como cualquier otra escritura.** `guardadoDeUnPaso` arma el agregado entero con la
versión que se vio, `pagos: []` y `gastos: []`, y pasa por `MUTACION_DE_PROYECTO`. La ficha del
contacto usa la misma función, así que los dos pasan por `ultimoContactoAlGuardar`.

Lo que ofrece hoy, verificado en el e2e en los dos anchos:

| Estado              | Panel                                                         |
| ------------------- | ------------------------------------------------------------- |
| En curso            | «Ya lo entregué» y, aparte, «Volvió a presupuesto»            |
| Entregado           | «Volvió al taller» (cobrar sigue afuera, con su pantalla)     |
| Cobrado y perdido   | Nada: se reabren o se reactivan con su botón                  |
| Contacto            | «Agendar la visita», «Ya lo aprobó» y la etapa (ficha propia) |
| Relevamiento        | «Ya fui a relevar», «Ya lo aprobó» y la etapa                 |
| A presupuestar      | «Mandé el presupuesto», «Ya lo aprobó» y la etapa             |
| Presupuesto enviado | «Lo aprobó: pasar a Proyectos» y la etapa                     |

## Decidido por mi cuenta

- **«Ya lo entregué» anota la entrega de hoy si no tenía fecha, y «Volvió al taller» la borra.** Si
  volvió, la entrega no quedó hecha, y la próxima anota su propio día. La base no tiene un `check`
  sobre `fecha_entrega`, así que no hay rechazo definitivo posible.
- **Lo que retrocede va aparte, a la derecha.** Al tocar «Ya lo entregué» el panel pasa a ofrecer
  «Volvió al taller». Si ocupara el mismo lugar, un doble toque desharía el paso. Con avanzar a la
  izquierda y volver a la derecha, el segundo toque cae en vacío. Se prefirió a deshabilitar los
  botones mientras viaja el pedido, que los pintaba de gris en cada toque.
- **La ficha del contacto también deriva de la máquina** sus etapas y «Ya lo aprobó»
  (`puedeCambiarEstado`). Con las transiciones de hoy muestra exactamente lo mismo que antes.
- El aviso es propio: «Cambio de estado guardado.»

## Alternativas descartadas

- **Tocar la insignia para pasar al estado siguiente.** La máquina no es un ciclo: ofrecería destinos
  que la base rechaza con `MN007`, un rechazo definitivo que tapa la cola.
- **Hacer de la insignia un menú.** Es el «cambio de estado en un desplegable perdido» que ya
  descartó el ADR 0019, y un menú no dice qué pasa con las fechas.
- **Poner el botón de cobrar adentro del panel.** Cobrar congela un reparto; su confirmación es el
  despiece, no un paso rápido (ADR 0016).

## Objeciones

- **«Volvió a presupuesto» manda la obra a Seguimiento sin preguntar.** Es reversible («Lo aprobó:
  pasar a Proyectos» vuelve por el pasaje, con el presupuesto cargado) y por eso no lleva un «¿estás
  seguro?» (ADR 0016). Si en el uso aparece tocado por error, lo que corresponde es un deshacer en el
  aviso, no una confirmación.
- **El doble toque se evita por posición, y eso no se probó con un dedo.** En 390 px los dos botones
  de una obra en curso no entran en un renglón y el de volver baja al segundo, a la derecha.

## Verificación

- `cambios-de-estado.test.ts`: los destinos contra `TRANSICIONES` en los ocho estados, nunca un
  liquidado, el pasaje desde seguimiento, las fechas de entrega, el pedido y lo que falta en una obra.
- `estado-desde-la-ficha.spec.ts`, en `celular` y `escritorio`: las acciones exactas de una obra en
  curso y entregada, que el panel no tiene ningún botón de cobrar ni de perdido mientras esos botones
  siguen afuera, que la base queda en cada estado con su fecha de entrega, volver a presupuesto hasta
  la ficha del contacto, los cuatro estados de seguimiento, un cobrado sin panel y el cambio hecho sin
  señal que llega a la base al volver.
