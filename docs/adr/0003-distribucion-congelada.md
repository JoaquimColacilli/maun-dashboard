# 0003. Distribución congelada y libro mayor como vista

Estado: vigente. Es una propuesta a validar en la fase 2.

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

## Qué evidencia de la fase 2 la confirma o la tira abajo

- **La confirma** si:
  - los saldos por tesoro salen de la vista con una sola query sobre volúmenes realistas (años de movimientos);
  - el test que compara la cascada en TypeScript contra la de SQL da igual en todos los casos;
  - el cobro parcial y la reapertura se modelan sin excepciones ad hoc.
- **La tira abajo** si:
  - reabrir o corregir proyectos cobrados resulta frecuente y congelar obliga a flujos manuales engorrosos;
  - la vista necesita lógica que solo rinde materializada y termina siendo una tabla con triggers;
  - el cobro en cuotas exige distribuir por pago en vez de por proyecto.
