# 0003. Distribución congelada y libro mayor como vista

Estado: aceptada, 2026-09-11, con la evidencia de la fase 2 (ver al final). La cascada, el cobro y la reapertura se detallan en el ADR 0011.

## Contexto

El sistema viejo borraba y regeneraba los movimientos derivados de un proyecto en cada guardado. De ahí salieron sus tres errores:

- El sueldo sumaba a HOGAR y nunca restaba de MAUN, así que la plata se duplicaba.
- El pago de diezmo no salía de ningún tesoro.
- La ganancia se repartía sobre el presupuesto y no sobre lo cobrado.

Hay además un problema de historia. Si el sueldo configurado cambia el año que viene, recalcular distribuciones ya cerradas reescribe el pasado.

## Decisión

- Cuando un proyecto pasa a cobrado, se congela su distribución. Se guardan los importes calculados en ese momento (diezmo, sueldo, costos fijos y remanente) junto con los parámetros usados. La base es lo efectivamente cobrado menos los gastos del proyecto.
- El libro mayor es una vista (`security_invoker = true`) que une los movimientos manuales con los derivados de las distribuciones congeladas. Hay una sola fuente de verdad, la historia es inmutable y no existe un job de sincronización que se desfase.
- Todo movimiento tiene contrapartida: si algo entra en un tesoro, sale de otro o de afuera, de forma explícita.

## Alternativas descartadas

- **Regenerar los movimientos en cada guardado.** Es lo que hacía el sistema viejo y fue la fuente de sus bugs.
- **Una tabla de movimientos derivados mantenida por triggers.** Es un segundo lugar que sincronizar, y se desfasa.
- **Calcular siempre al vuelo sin congelar.** La historia cambiaría cada vez que cambian los ajustes.

## Consecuencias

- Corregir una distribución cerrada es una operación explícita: reabrir el proyecto o registrar un ajuste. Nunca es un efecto colateral de editar.
- Se guarda redundancia a propósito: los importes congelados y sus parámetros.

## Cómo quedó en la base (fase 2A)

- **Movimientos con contrapartida explícita.** Cada fila de `movimientos` tiene `tesoro_origen` y `tesoro_destino`, y null en un lado significa "afuera". Un ingreso es `(null → hogar)`, un gasto `(maun → null)`, un aporte a Cocos `(maun → cocos)`. Una transferencia es una sola fila, no dos que se pueden desfasar. Un check por tipo fija qué lados lleva cada uno.
- **`movimientos` guarda solo lo cargado a mano.** Lo derivado de proyectos no se guarda: la vista `libro_mayor` lo arma desde `pagos` (entran a MAUN), `gastos` (salen de MAUN) y la distribución congelada (el diezmo pasa de MAUN a DIEZMO y el sueldo de MAUN a HOGAR; los fijos y el remanente se quedan en MAUN y no generan filas).
- **El campo que distingue lo manual de lo derivado vive en la vista** (`libro_mayor.origen`: `manual`, `pago`, `gasto_proyecto`, `distribucion`), no en la tabla. El brief lo pedía como columna de `movimientos`. Guardar ahí los derivados sería volver a regenerarlos en cada guardado, que es justo lo que esta decisión elimina. `movimientos.proyecto_id` existe para un movimiento manual atribuible a un proyecto, como el ajuste que corrige una distribución cerrada.
- **La vista es un libro mayor de verdad**: una fila por cada tesoro que toca un asiento, con importe con signo. El saldo de un tesoro es `sum(monto_centavos) where tesoro = X`.
- **La distribución congelada son columnas de `proyectos`**: `fecha_cobro`, lo cobrado y los gastos sobre los que se calculó, el porcentaje de diezmo y los topes de sueldo y fijos aplicados, y los cuatro escalones. Dos checks: cobrado si y solo si la distribución está completa, y los escalones suman exactamente la ganancia neta.
- **Ganancia negativa:** diezmo, sueldo y fijos en cero, y la pérdida entera en el remanente, que es el único escalón que puede ser negativo. Así la suma siempre cierra. Lo confirma o lo corrige el dominio en la fase 2B.
- **Las columnas de la distribución no tienen grant para el cliente.** Las escribe `cobrar_proyecto` (fase 2B), que calcula la cascada en SQL y rechaza el cobro si la versión del proyecto, los totales, los topes, la fecha o la distribución no son los que vio el cliente. Su primera sentencia bloquea el proyecto con `for update`, y recién después, en otra sentencia, suma pagos y gastos. Del otro lado, la guarda de pagos y gastos toma `for share` sobre el mismo proyecto: entre las dos, un pago que llega en el mismo instante que el cobro queda adentro de la distribución o se rechaza, nunca afuera en silencio.
- Una vez cobrado, los pagos y gastos del proyecto no se tocan (`MN001`) y el proyecto no se borra. Corregir es reabrir o registrar un ajuste, como dice arriba.

## Evidencia de la fase 2

- **Saldos en una sola consulta sobre volúmenes realistas: confirmado.** 6 ms con un año de datos, 23 ms con diez años y 100 ms con 100.000 filas, medido en la base real (ADR 0009).
- **TypeScript y SQL dan igual en todos los casos: confirmado.** `packages/db/tests/dominio-vs-sql.test.ts` compara las dos cascadas en más de 5.000 casos, y compara lo que congela `cobrar_proyecto` contra `calcularDistribucion`.
- **Cobro parcial y reapertura sin excepciones ad hoc: confirmado.**
  - Los pagos se acumulan en el proyecto y la distribución se calcula sobre su suma al cobrar.
  - Reabrir es una función que descongela y guarda los topes y la fecha del cobro original. Cobrar de nuevo recalcula con esos topes y esa fecha, no con los ajustes de hoy: corregir un gasto no reescribe el sueldo de un cobro viejo.
  - Ninguna de las dos necesitó un caso especial en la vista.
- **Lo que la tiraría abajo** sigue en observación: que reabrir resulte frecuente, o que el cobro en cuotas exija distribuir por pago en vez de por proyecto. Con el uso real se ve.

## Qué evidencia de la fase 2 la confirma o la tira abajo

- **La confirma** si:
  - los saldos por tesoro salen de la vista con una sola query sobre volúmenes realistas (años de movimientos);
  - el test que compara la cascada en TypeScript contra la de SQL da igual en todos los casos;
  - el cobro parcial y la reapertura se modelan sin excepciones ad hoc.
- **La tira abajo** si:
  - reabrir o corregir proyectos cobrados resulta frecuente y congelar obliga a flujos manuales engorrosos;
  - la vista necesita lógica que solo rinde materializada y termina siendo una tabla con triggers;
  - el cobro en cuotas exige distribuir por pago en vez de por proyecto.
