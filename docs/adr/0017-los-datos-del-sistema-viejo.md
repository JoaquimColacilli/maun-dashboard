# 0017 — Los datos del sistema viejo entran por un script, no por la app

Estado: **aceptada**. Fecha: 2026-09-12.

## Contexto

El dueño viene usando `docs/referencia/Finanzas_MAUN_v3.html` hace meses. Sus clientes, proyectos,
pagos, insumos y movimientos están en el `localStorage` del Chrome de la PC del taller, bajo tres
claves: `maun3_p` (proyectos), `maun3_m` (movimientos) y `maun3_c` (configuración). El día que la app
nueva reemplace al HTML, o esos datos viajan, o el historial arranca de cero.

**Ningún paso del plan lo contempla.** No es el trabajo de este paso resolverlo; sí es el momento de
anotarlo, porque cada paso que pasa agrega una tabla más que hay que poblar.

No sirve el CSV del botón «↓ Exportar CSV»: cubre **solo proyectos**, con los pagos y los insumos
embebidos como JSON adentro de dos celdas, y deja afuera los movimientos y la configuración entera.
Un backup hecho con ese botón pierde el libro mayor.

La entrada correcta es un JSON con las tres claves, sacado a mano desde la consola del navegador.

## Decisión

**Un script de migración en `packages/db`, corrido desde la terminal una sola vez.** No una pantalla
de importación en la app.

Los motivos, en orden de peso:

1. **Un importador dentro de la app es un upsert por id que se saltea las guardas.** Las escrituras
   de la app pasan por `guardar_proyecto`, por `cobrar_proyecto` y por la máquina de estados, que son
   las que hacen que una distribución congelada no se pueda pisar. Un archivo que entra por la puerta
   de atrás puede dejar un proyecto `cobrado` con una distribución que no cuadra, y el `check`
   `proyectos_distribucion_cuadra` recién lo frena cuando el dato ya está en la fila.
2. **Es una función que se usa una vez en la vida.** Queda para siempre en el bundle, en la superficie
   de ataque y en el mantenimiento.
3. **El script puede ser interactivo, con una persona que entiende del otro lado.** Puede frenar,
   preguntar, mostrar un diff y correr en una transacción que se confirma al final o no se confirma.
   Una pantalla en el celular, no.

El script va en `packages/db/scripts/`, se corre con `pnpm --filter @maun/db <script>` y usa la
conexión directa a Postgres que ya usan el comparador y los tests.

## Lo que ese script va a tener que resolver

No es la lista de tareas del script: es la lista de decisiones que hay que tomar **antes** de
escribirlo, porque ninguna es mecánica.

**1. Los clientes no existen en el sistema viejo.** `p.cliente` es texto libre adentro del proyecto.
Hay que sacar los nombres distintos, crear un cliente por cada uno y decidir qué se hace con las
variantes de escritura del mismo nombre. Normalizar de más junta dos clientes que son dos; normalizar
de menos deja duplicados, y fusionar clientes no existe en la app.

**2. Los catorce tipos de movimiento.** La sección 1 de `docs/paridad-con-el-sistema-viejo.md` ya dice
a qué mapea cada uno. Pero hay un corte anterior a ese mapeo, y es el que importa:

> **Los movimientos con `proyId` no se importan.** `sincMovsProy()` los **regenera enteros** cada vez
> que se guarda un proyecto: borra los de ese proyecto y los vuelve a escribir desde sus pagos, sus
> insumos y su distribución. En la app nueva esos asientos no se guardan: los arma la vista
> `libro_mayor` a partir de los pagos, los gastos y la distribución congelada. Importarlos sería
> contar todo dos veces.

De `maun3_m` entra solo lo cargado a mano: `ingreso_hogar`, `ingreso_maun`, `gasto_hogar`,
`gasto_maun`, `pago_diezmo`, `transfer_cocos`, `gasto_cocos`, `cocos_a_maun` y `ajuste_cocos`.
`ajuste_hogar` y `ajuste_maun` son código muerto y no van a aparecer nunca. `sueldo_hogar`,
`diezmo_generado` y `fijos_maun` son derivados y quedan afuera.

**3. Las distribuciones viejas se calcularon con los cinco errores.** `calcProy()` reparte sobre el
**presupuesto** y no sobre lo cobrado, el sueldo suma a HOGAR sin salir de MAUN, el pago de diezmo no
sale de ningún tesoro, los fijos se evaporan sin destino, y con ganancia neta negativa los escalones
no suman la neta (ADR 0003 y la sección 5 de la tabla de paridad). Hay tres caminos y hay que elegir
uno:

- **Recalcular** cada proyecto cobrado con la cascada de hoy y congelar el resultado nuevo. Los saldos
  quedan bien, pero **no son los que el dueño vio** durante meses: abre la app el primer día y los
  números no son los que recuerda.
- **Congelar lo que el sistema viejo mostró**, tal cual. Respeta la historia, pero mete
  distribuciones que no cuadran y el `check` las rechaza. Habría que relajarlo para las filas
  importadas, que es justo lo que ese `check` existe para impedir.
- **Importar los proyectos cobrados con sus pagos y sus gastos pero sin distribución**, y un asiento
  manual de apertura por la diferencia entre el saldo que el sistema viejo mostraba y el que sale de
  la cascada nueva.

La recomendación es la tercera y está sin decidir. La primera reescribe la historia; la segunda rompe
la garantía central del ADR 0003.

**4. El saldo de DIEZMO viene con la convención de signo contraria.** `calcTesoros()` calcula
`diezmoSaldo = diezmoPagado − diezmoAcum`: positivo es superávit. La base de hoy acumula
`generado − pagado`: positivo es lo que falta pagar. Y no es solo el signo: el sistema viejo **nunca
descontaba** el pago de ningún tesoro, así que esa plata nunca salió de ninguna caja. Al importar, los
pagos de diezmo van a descontar de DIEZMO por primera vez y el saldo va a cambiar de valor, no solo de
signo. Hay que calcularlo antes y mostrárselo al dueño antes de confirmar.

**5. Las distribuciones viejas no tienen fecha de cobro.** `sincMovsProy()` fecha el diezmo, el sueldo
y los fijos con `hoy()`: el día en que se guardó el proyecto por última vez, no el día del cobro. El
sistema viejo no guarda una fecha de cobro en ningún lado. Para un proyecto cobrado hay que elegir
una, y la del último pago es la mejor aproximación disponible. El reporte del script tiene que decir
que es una aproximación: de esa fecha depende en qué mes cae el tope de costos fijos.

**6. Los importes son floats en pesos.** `presupuesto`, `monto` y los insumos salen de `parseFloat`.
Pasar a centavos es `Math.round(x * 100)`, y el script tiene que cortar si alguno se aleja más de un
centavo del entero: eso es un dato sucio, no un redondeo.

**7. No hay estados de prospecto ni de perdido.** El sistema viejo tiene cuatro (`presupuestado`,
`en_curso`, `entregado`, `cobrado`) y la app tiene la máquina completa del ADR 0011. El mapeo es
directo, y ningún proyecto viejo va a entrar como `perdido`.

**8. Qué pasa si se corre dos veces.** O el script es idempotente, o se niega a correr sobre un
household que ya tiene datos. Lo segundo es más barato y más seguro.

## Alternativas descartadas

- **Importación de CSV en la app**, como la del sistema viejo. Es la puerta de atrás del punto 1, y
  encima ese CSV no trae ni los movimientos ni la configuración.
- **Copiar el `localStorage` a mano, proyecto por proyecto, desde la app.** Es lo que va a pasar si no
  escribimos el script, y con meses de historial no va a pasar completo: se pierde el libro mayor.
- **Una función de importación en la base.** Mueve el problema a SQL sin resolver ninguna de las ocho
  decisiones de arriba, y deja una función con grant en producción para siempre.

## Consecuencias

- Queda pendiente y sin agendar. **Es bloqueante para la entrega**: el día que el dueño empiece a usar
  la app nueva es el día que deja de usar el HTML, y los dos no pueden convivir sin que los saldos se
  separen.
- Las ocho decisiones hay que tomarlas **con el dueño delante**, no por nuestra cuenta: tres de ellas
  cambian números que él conoce de memoria.
- El insumo es un JSON con `maun3_p`, `maun3_m` y `maun3_c`, sacado de la consola del navegador de esa
  PC. Conviene pedirlo ya y guardarlo aparte: si ese Chrome pierde el `localStorage`, no hay migración
  que hacer. Es la única copia que existe.
