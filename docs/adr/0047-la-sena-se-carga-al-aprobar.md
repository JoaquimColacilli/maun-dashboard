# 0047. La seña se carga al aprobar, en el mismo guardado

Estado: aceptada, 2026-09-18.

## Contexto

La pantalla de pasar un contacto a Proyectos mostraba «Seña ya cobrada $ 0» como un dato de solo
lectura. Pero en la práctica la aprobación casi siempre viene con un pago, normalmente la mitad: el
cliente dice que sí y deja la seña en el mismo momento. Hasta ahora el dueño aprobaba, entraba a la
ficha, abría «Cargar pagos y gastos» y ahí recién anotaba la plata. Dos pantallas para un solo hecho.

## Decisión

**El importe de la seña se carga en la pantalla de aprobar, sugerido y editable.** El sugerido sale
de `calcularSena` del dominio: el porcentaje del taller (`ajustes.sena_bp`, la mitad por defecto) o el
propio del trabajo (`proyectos.sena_bp`) si tiene, aplicado sobre el presupuesto aprobado, **menos lo
que ya cobró**. No hay un porcentaje nuevo: es el mismo que muestra la ficha (ADR 0043).

**Va en la misma transacción que la aprobación**, como un pago más del agregado: el mismo
`guardar_proyecto` que cambia el estado, fija el presupuesto y aprueba la opción lleva el pago en su
array de pagos. No es una segunda llamada. Si la aprobación entra y el pago falla, queda un trabajo
sin su seña y nadie se entera; acá o entran las dos cosas o no entra ninguna.

**El pago toma la forma de pago y la fecha de inicio que ya están en esa pantalla.** Un campo menos:
no se vuelve a preguntar algo que está tres renglones más arriba y que el usuario acaba de elegir.

**Cargar la seña es opcional.** Vaciar el campo aprueba sin pago, que es lo que hacía hasta hoy.

**El resumen no cuenta nada dos veces.** La plata que cobró en la visita del relevamiento viaja con el
trabajo cuando se aprueba (ADR 0019: el contacto y el trabajo son la misma fila), así que el cuadro
muestra cuatro renglones distintos y nombrados: lo que ya había cobrado antes, lo que carga ahora, el
total, y el saldo. `resumenDelPasaje` es la única cuenta y está probada.

## Alternativas descartadas

- **Dejar el campo vacío y que él escriba el importe.** El porcentaje ya está configurado y ya se usa
  en la ficha; no sugerirlo es hacerle la cuenta a mano cada vez.
- **Una segunda mutación después de aprobar.** Es exactamente lo que el pedido descarta: dos
  operaciones donde el fracaso de la segunda es silencioso.
- **Preguntar de nuevo la forma de pago y la fecha del pago.** Dos campos más para repetir lo que ya
  eligió.
- **Frenar la aprobación si no cobró la seña.** El ADR 0038 ya decidió que lo que sigue se sugiere y
  no se impone, y el dueño pidió explícitamente poder avanzar sin haber cobrado.

## Consecuencias

- **El botón «Pasar a Proyectos» ahora crea un pago por defecto.** Es la contrapartida de sugerir: si
  él aprueba sin mirar, queda cargado un pago que no cobró. Lo atenúa que el importe está en el campo,
  en el resumen de abajo con su propio renglón y en la ficha después de aprobar, y que vaciarlo es un
  gesto. Queda anotado como la objeción de esta decisión: es el precio de que el caso común —aprobar
  cobrando— sea un solo gesto en vez de dos pantallas.
- Los e2e que aprobaban sin cobrar ahora vacían el campo antes de aprobar, y eso deja escrito en el
  recorrido que aprobar sin seña sigue siendo un camino de primera.
- El id del pago se genera una sola vez al montar la pantalla (`useState(uuidv7)`), así que un
  reintento de la cola no puede crear dos pagos.
