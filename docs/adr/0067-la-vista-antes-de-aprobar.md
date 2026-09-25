# 0067. La vista del cliente antes de aprobar: lo que se ve es lo que pasó

- Estado: aceptada
- Fecha: 2026-09-24
- Corrige al [0046](0046-la-vista-del-cliente-una-lista-blanca-en-la-base.md) en qué viaja y desde
  cuándo, y al [0053](0053-como-te-paga-cada-trabajo-y-el-qr-del-enlace.md) en lo que se lee arriba
  antes de aprobar. Termina lo que el [0043](0043-las-opciones-de-presupuesto-y-la-sena.md) decía
  de la seña: ahora tiene su gemela en SQL con nombre propio.
- Completada el 2026-09-25 por el [ADR 0070](0070-el-camino-tilda-lo-que-paso.md): con la seña ya
  cubierta antes de aprobar, ni el camino, ni «lo próximo», ni «Para cuándo» la vuelven a pedir; y el
  paso de la aprobación con la seña en falta queda en curso («Cuando dejes la seña»), sin fecha.

## Contexto

El dueño le mostró a un cliente la página de un trabajo con el presupuesto mandado y sin aprobar, y
la página prometía cosas que nadie había acordado: «Entrega pautada para el sáb 10 oct», la tarjeta
con la dirección, el día de inicio, la entrega y la seña, «Recibimos tu seña y quedó aprobado» y
«Empezamos a fabricarlo en el taller». Marcó en rojo lo que no tenía que estar y en verde lo que sí:
«Lo próximo es que lo apruebes y dejes la seña.» y el pago del relevamiento con su nombre.

La regla que se pidió: **un campo cargado no es un hecho, y menos un acuerdo.** La página muestra lo
que pasó, no lo que está cargado: un hito existe si hay un registro con fecha de que pasó. Y cada dato
tiene una etapa desde la que es cierto; antes, no existe.

### Lo que decía el diagnóstico

- **La seña era el primer pago**, en tres lugares: la fila «Seña» de la tarjeta (`pagos[0]`), el texto
  del primer evento y la fecha de respaldo del paso «Aprobado». Ningún dato la marcaba: el concepto de
  un pago es texto libre y el código no lo leía.
- **«Empezamos» y «Lo llevamos» salían de que un campo no fuera null**: `fecha_inicio`, aunque fuera
  futura, y `fecha_entrega`. La base mandaba las dos en cualquier etapa.
- **Las fechas falsas vienen del sistema viejo**: la migración inicial copió el inicio y la entrega de
  cada proyecto sin mirar la etapa. En producción, de 11 trabajos sin aprobar, 8 tienen inicio o
  entrega cargados, 3 dirección y 4 pagos. Ninguno tenía un enlace vivo.
- **`cambios_de_estado` existe desde el 2026-09-18**, así que ninguno de los 9 trabajos aprobados tiene
  registrada la aprobación.

## Decisión

### La base manda cada dato desde la etapa en que es cierto

`public.vista_del_cliente()` sigue siendo la lista blanca, y ahora además decide desde cuándo:

| Dato                                      | Viaja desde                     | Antes                                     |
| ----------------------------------------- | ------------------------------- | ----------------------------------------- |
| `direccion`                               | aprobado (en curso en adelante) | `''`: la clave queda para un bundle viejo |
| `fechas.inicio`, `fechas.entrega_pautada` | aprobado                        | null                                      |
| `fechas.aprobado`                         | aprobado                        | null, aunque haya registro                |
| `fechas.entregado`                        | entregado o cobrado             | null                                      |
| `precio_centavos`                         | presupuesto enviado             | null: a presupuestar es un borrador       |
| `sena_centavos` (nueva)                   | con presupuesto mandado         | null                                      |
| `fechas.vale_hasta` (nueva)               | solo presupuesto enviado        | null                                      |

Y antes de aprobar el saldo no existe: si la seña ya está cubierta, `pago` no pide nada. Un trabajo
que vuelve a presupuesto vuelve a no estar aprobado, aunque el registro de la aprobación quede.

### La seña es un importe, no un pago

La seña es un porcentaje del presupuesto. **No hay pago que sea «la seña»**: ningún dato la marca, ni el
nombre ni el orden. `private.sena_esperada(precio, sena_bp)` es la gemela de `calcularSena().esperada`
y la usan `pagos_por_delante` y la clave nueva `sena_centavos`; el comparador las ata con los casos de
la seña y 500 al azar. Lo pagado antes de aprobar, el relevamiento incluido, **cuenta a cuenta de la
seña, no encima**: el «te quedan $ X» de arriba es literalmente `pago.monto_centavos`, el mismo número
que muestra «Cómo pagar». No se agregó un tipo de pago ni se reescribió ninguna fila vieja.

### El dominio: una unión por etapa

`vistaDelCliente(trabajo, hoy)` devuelve `VistaAntesDelPresupuesto`, `VistaEsperandoLaSena` o
`VistaAprobada`, y la pantalla hace `switch` por `etapa`. La de «esperando la seña» no tiene tarjeta
ni entrega: no están en el tipo. Cada pago es «Recibimos tu pago», salvo el que salda. El evento de la
aprobación sale de su registro y solo aprobado; «Empezamos» solo aprobado y con el día ya llegado; «Lo
llevamos» solo entregado. El paso «Aprobado» perdió su fecha de respaldo del primer pago.

### La proyección vive en una sola función

`proyeccionDeLaEntrega(valeHasta, hoy)` es la única que la calcula: sin fecha, vencida o vigente, y la
vigente es `entregaEstimada(valeHasta)`, **la misma cuenta de 21 días hábiles de la entrega estimada,
contada desde la fecha límite y no desde hoy**. Cuando el taller tome trabajos pautados con meses de
anticipación y haga falta una cola, cambia esta función y nada más.

### Hasta cuándo vale el presupuesto

`proyectos.presupuesto_vale_hasta` (nullable) y `ajustes.presupuesto_vale_dias` (15 por defecto, de 1
a 365). **No es `vencimiento_presupuesto`**, que es el día límite del dueño para mandarlo; este es el
del cliente para señar. La app pone la fecha cuando el presupuesto se manda, que es entrar a
«presupuesto enviado» desde una etapa anterior (`seMandaElPresupuesto`): en el paso del contacto y en
el formulario grande. Volver de seguimiento, reactivar un perdido o «Volvió a presupuesto» no la
renuevan. Se cambia en la hoja del contacto, desde la fila «Vale hasta» de la ficha, y
`guardar_proyecto` la escribe solo si viene la clave. Pasada la fecha (`vencioElPresupuesto`, el mismo
criterio en las dos puntas) el cliente lee que venció, y Consultas y la ficha se lo avisan al dueño.

## Desvíos del pedido

- **Las fechas del ejemplo son del calendario de 2025**: «vie 3 de octubre» y «sáb 8 de noviembre».
  En 2026 el 3 de octubre es sábado, y la entrega estimada nunca cae en un fin de semana. Los tests
  usan fechas de 2026.
- **Aprobado sin la seña completa**, el paso dice «Aprobado» y no «Aprobado, seña cobrada», y lo
  próximo es «Lo próximo es que dejes la seña.». El pedido no lo nombraba, pero la etiqueta vieja
  afirmaba un cobro que no pasó.
- **Sin eventos, la sección no se muestra**: el camino de arriba ya dice qué sigue.

## Objeciones

- **La proyección no cuenta feriados.** `entregaEstimada` los acepta, pero nadie le pasa la lista, y
  una proyección se lee como una promesa: cerca de un feriado queda uno o dos días corta.
- **«Antes del vie 9» con una vigencia que incluye el 9.** El día mismo todavía vale. El texto es el
  pedido; «hasta el» sería exacto.
- **Con el presupuesto vencido, «Cómo pagar» sigue pidiendo la seña**, con un precio que el taller
  puede querer actualizar. Quedó fuera del alcance; lo que correspondería es no ofrecer el pago.
- **Los 9 trabajos aprobados de antes no muestran la aprobación**: su fecha salía del primer pago, y
  sin registro ahora no está. Es lo que pide la regla, y deja más pobre la historia de los viejos.
- **La app del dueño sigue llamando «Seña cobrada» a la plata de antes de aprobar**, en la ficha, en
  Consultas y en la hoja del contacto, y el concepto por defecto del pago de la visita es «Seña de la
  visita». La página del cliente ya no. Y **el formulario grande muestra inicio y entrega en un
  contacto**, que es donde viven las fechas falsas. No se tocaron.
- **El arreglo de fondo es un registro de hechos.** `cambios_de_estado` fecha las etapas, pero
  «empezó a fabricarse» sigue saliendo de `fecha_inicio <= hoy`, que es una fecha planeada y no un
  registro. Lo correcto es anotar el hecho cuando pasa, como se anota un pago.

## Alternativas descartadas

- **Un tipo de pago (relevamiento, seña, saldo) con valor nuevo en un enum.** Obliga a clasificar 18
  pagos viejos de texto libre o a dejarlos sin tipo, y la seña sigue siendo un porcentaje: el tipo
  diría qué pago fue la seña, no cuánto era.
- **Que la pantalla esconda la tarjeta y la base siga mandando todo.** Es lo que el 0046 descartó: lo
  que no viaja no se filtra por error.
- **Proyectar desde hoy.** La fecha cambiaría según el día que el cliente abre la página.
- **Poner la vigencia por defecto con un trigger.** Cubriría un bundle viejo, pero la fila optimista
  quedaría sin fecha hasta sincronizar y la regla viviría en dos lados. Vive donde el vencimiento.

## Consecuencias

- Un dato nuevo de la vista del cliente declara su etapa: antes, la base manda null o vacío.
- La proyección se toca en `proyeccionDeLaEntrega` y en ningún otro lado.
- `calcularSena` y `private.sena_esperada` cambian juntas; el comparador falla si divergen.
- `32_la_vista_antes_de_aprobar.sql` fija lo que viaja en cada etapa con un trabajo que tiene todo
  cargado, y los tests del dominio y de la pantalla hacen lo mismo en cada capa.
