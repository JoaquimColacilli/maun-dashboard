# 0011. Dominio: la cascada, la máquina de estados y el cobro, en dos lugares que no pueden divergir

Estado: aceptada, 2026-09-11. Actualizada el mismo día con los topes mensuales, el sueldo con tope por proyecto o por mes y el cierre de un perdido como liquidación, que resuelven las preguntas que este ADR dejaba abiertas. Actualizada el 2026-09-12 (paso 12) con las respuestas del dueño: la seña retenida paga diezmo y no paga sueldo, el tope de sueldo se queda por proyecto, y la barra "Sueldo del mes" mide lo que promete esa regla.

**Corregida el 2026-09-21 por el [ADR 0056](0056-el-sueldo-del-mes-se-mide-contra-un-sueldo.md)**, solo en la sección «La barra "Sueldo del mes"»: la barra vuelve a medir contra **un** sueldo por mes, que es la necesidad del hogar, y nombra el excedente cuando los cobros pagan más. La regla de reparto —el tope de sueldo por proyecto— queda como está.

**Corregida el 2026-09-25 por el [ADR 0072](0072-el-sueldo-se-topea-por-mes.md)**: el tope de sueldo pasa a ser por mes, como los fijos, en todos los talleres menos el seed. «El tope de sueldo se queda por proyecto» queda como historia de por qué no se hizo antes. «Pasar el sueldo a tope mensual» es lo que se hizo, y su costo sin conexión ya lo había resuelto el [ADR 0016](0016-el-cobro-y-el-rechazo-que-encuentra-al-usuario.md).

## Contexto

La regla central del negocio, la cascada que reparte la ganancia de un proyecto, se necesita en dos lugares:

- **En el cliente**, para mostrar la distribución antes de cobrar, también sin conexión.
- **En la base**, para congelar lo que queda registrado sin confiar en la cuenta que manda un celular.

Lo mismo pasa con las transiciones de estado: la app las usa para ofrecer solo los botones que tienen sentido, y la base las aplica para que un reenvío viejo de la cola no deje un proyecto en un estado imposible. Si las dos implementaciones pueden separarse en silencio, `packages/domain` pierde su razón de ser.

## Decisión

**Plata.** `Money` es un `number` entero de centavos con brand (ADR 0002). Toda operación verifica que el resultado siga siendo un entero seguro y corta con `RangeError` en vez de perder precisión.

**Porcentajes y redondeo.** Los porcentajes van en puntos básicos enteros (1000 = 10%). Aplicar un porcentaje redondea al centavo **mitad hacia arriba**, con aritmética entera: `floor((importe × bp + 5000) / 10000)`. Es la misma cuenta que hace SQL con `bigint`. En TypeScript la división entre doubles es exacta para todo producto seguro: la parte fraccionaria del cociente tiene resolución de 1/10000, más grande que el error de la división. Lo verifica un test contra `BigInt` en miles de casos, incluidos importes cerca del límite. SQL rechaza el mismo rango que TypeScript: nada por encima de `Number.MAX_SAFE_INTEGER`.

**La cascada** (`calcularDistribucion` en TypeScript, `private.cascada` en SQL):

1. `neta = cobrado − gastos`. Es sobre lo **cobrado** (la suma de los pagos vivos), no sobre el presupuesto.
2. Si `neta ≤ 0`: diezmo, sueldo y fijos en cero, y la pérdida entera en el remanente. Los escalones siempre suman la neta, que es lo que la base exige (`proyectos_distribucion_cuadra`).
3. Si no: el diezmo; el sueldo, topeado por lo que queda; los fijos, topeados por lo que queda; el remanente es lo que sobra.

La cascada no sabe de meses ni de estados: recibe los topes ya calculados.

**Los topes** (`topesDeLaLiquidacion` en TypeScript, `private.topes_de_la_liquidacion` en SQL) salen de los objetivos y de lo que el mes ya lleva liquidado por otros proyectos:

- **Fijos:** `max(0, objetivo − fijos ya liquidados en el mes)`.
- **Sueldo:** por proyecto (`ajustes.sueldo_tope_mensual = false`, el valor de hoy), el objetivo entero; por mes, la misma cuenta que los fijos.
- **El mes** es el mes calendario de la fecha de la liquidación, no el del inicio del proyecto.
- **Lo liquidado en el mes no se guarda:** se suma de las distribuciones congeladas (`liquidadoDelMes` en TypeScript, la suma dentro de `private.liquidar` en SQL).

**La máquina de estados.** `TRANSICIONES` en TypeScript y `private.transicion_valida` en SQL listan las 19 transiciones que el usuario hace a mano:

- Dentro del seguimiento se va y viene entre sus cuatro estados.
- Un lead se convierte en obra (`en_curso`).
- La obra se entrega o vuelve a presupuesto.
- Lo entregado puede volver al taller.

**Liquidar y revertir no son transiciones: son operaciones.** Llegar a `cobrado` o a `perdido` congela la distribución, y salir la descongela. `puedeLiquidar`/`private.liquidacion_valida` y `puedeRevertir`/`private.reversion_valida` dicen desde dónde:

| Operación           | Desde                                        | Hacia                                 |
| ------------------- | -------------------------------------------- | ------------------------------------- |
| `cobrar_proyecto`   | entregado                                    | cobrado                               |
| `cerrar_perdido`    | los cuatro estados de seguimiento o en curso | perdido                               |
| `reabrir_proyecto`  | cobrado                                      | entregado                             |
| `reactivar_perdido` | perdido                                      | el estado de seguimiento que se elija |

La base rechaza con `MN007` cualquier otro cambio de estado, y con `MN001` el cambio de estado de un liquidado editándolo.

**Liquidar es una función de la base.** `cobrar_proyecto` y `cerrar_perdido` son envoltorios `security invoker` sobre una sola función, `private.liquidar`. Es `security definer` porque escribe las columnas de la distribución, sobre las que el cliente no tiene grant. Los dos envoltorios reciben lo mismo: la `version` del proyecto, el total cobrado, el total de gastos, los topes, la fecha y la distribución que calculó `calcularLiquidacion`. `cerrar_perdido` recibe además el diezmo que vio el usuario, porque en un perdido es un dato de los ajustes y no una regla. Pasos:

1. **Primer lock: el proyecto**, con `for update`. La guarda de pagos y gastos toma `for share` sobre la misma fila, así que un pago y una liquidación simultáneos se serializan.
2. **Reenvío.** Si es una liquidación que ya se aplicó (mismo destino, versión exactamente una más, mismos datos congelados), devuelve el proyecto sin rechazar. La cola puede reintentar sin que el usuario vea un error por algo que salió bien.
3. **Validaciones:** pertenencia, borrado, estado de origen y versión.
4. **Segundo lock: la fila de `ajustes`** del household, con `for no key update` (ver (a)).
5. **Fecha, diezmo y objetivos** (gemela de `planDeLiquidacion`):
   - un cobro usa la fecha que manda la app y los ajustes;
   - un cobro reabierto usa la fecha, los objetivos y el modo del cobro original;
   - un cierre como perdido usa la fecha que manda la app y los parámetros del perdido (ver más abajo).
6. **Sumas.** Suma lo que el mes ya lleva liquidado por otros proyectos, calcula los topes y suma pagos y gastos, todo en sentencias posteriores a los dos locks.
7. **Comparación con lo que vio el usuario.** Si los totales, los topes, la fecha o, en un perdido, el diezmo no coinciden, rechaza con `MN006`: son datos que cambiaron. Después calcula la cascada y la compara con la distribución que mandó la app: si difiere en un centavo, rechaza con `MN008`. Eso pasa con una app desactualizada que aplica otra regla, por ejemplo un bundle viejo servido por el service worker.
8. **Congela.**

**Revertir** es `private.revertir_liquidacion`, detrás de `reabrir_proyecto` y de `reactivar_perdido`. Toma los mismos dos locks, reconoce el reenvío y verifica la versión.

- **Reabrir un cobro** guarda la fecha, los objetivos y el modo del cobro original (`reapertura_*`), y el cobro siguiente los usa. Así, corregir un gasto no reescribe el sueldo con los ajustes de hoy ni mueve la distribución de mes (ADR 0003).
- **Reactivar un perdido** no guarda nada (ver "El perdido se liquida al pasar a perdido").

**Qué se congela.** Además de la fecha, los totales, el diezmo, los topes y los cuatro escalones, cada liquidación congela:

- el objetivo de sueldo y el de fijos con los que se calculó;
- cuánto sueldo y cuántos fijos llevaba liquidados el mes en ese instante, sin contar este proyecto;
- si el sueldo se topeó por proyecto o por mes;
- el instante de la liquidación, que ordena las liquidaciones de un mismo mes.

`proyectos_topes_del_mes` ata esos datos al tope congelado, así que cada liquidación se explica sola. Por ejemplo, el placard del seed dice: "objetivo $250.000, el mes ya llevaba $28.800, tope $221.200".

La reversión no necesita el acumulado del instante: revertir es sacar lo que aportó el proyecto, y con la suma al vuelo ni siquiera eso, porque un proyecto descongelado sale solo de la suma. El acumulado sirve para explicar y verificar el tope. Después de una reapertura en el mismo mes deja de coincidir con la suma actual, y está bien: es lo que era cierto en ese instante.

**Entrega estimada.** A 21 días hábiles del inicio, contando de lunes a viernes. Los feriados entran por parámetro: el dominio no conoce el calendario, la lista la pasa la app.

## Qué es un error y qué es una política

Los dos topes estaban documentados como "por proyecto" en el HTML viejo: el del sueldo decía "Lo que se transfiere al tesoro HOGAR por proyecto cobrado", y el de los fijos, "Se descuenta al cobrar cada proyecto". No son un descuido como los tres errores que corrigió el ADR 0003. Igual se separan:

- **Los costos fijos por proyecto son un error, y pasan a ser mensuales.** Son un costo del período, no del trabajo. Toparlos en cada cobro los cuenta una vez por proyecto: con cuatro cobros en septiembre, la distribución dice que se cubrieron cuatro veces los fijos del mes.
  - **El motivo de la decisión es información falsa, no pérdida de plata.** La plata que se evaporaba era la del HTML, que descontaba esa diferencia de MAUN sin mandarla a ningún tesoro.
  - En esta base eso no pasa: los fijos no generan asientos (ADR 0003) y ningún saldo quedaba mal. Lo que quedaba mal era el reparto: el escalón de fijos exageraba lo cubierto y el remanente escondía lo que el taller ganó de verdad.
  - El HTML traía el valor en 0, así que no hay historia que cambie.
- **El sueldo por proyecto es una política, y se queda como está.** Es una transferencia real, que el dueño elige hacerse en cada trabajo. "Cada trabajo me paga un retiro" es una regla legítima sobre su plata, aunque la teoría contable prefiera el tope mensual. **El dueño lo confirmó: se queda por proyecto** (ver "El tope de sueldo se queda por proyecto").
- **El perdido con seña no tenía comportamiento previo.** El HTML no tenía estados de prospecto ni de perdido.

## (a) Concurrencia: el acumulado se calcula bajo un lock, no se guarda

Cada liquidación y cada reversión bloquea primero el proyecto y después la fila de `ajustes` del household, con `for no key update`. Recién entonces suma lo liquidado en el mes. Dos liquidaciones del mismo household se serializan: la segunda espera y, como suma después de esperar, ve la primera commiteada.

- **El lock es por household, más grueso que por mes.** Con un usuario y unos pocos cobros por mes no cuesta nada. Si aparece más de un escritor concurrente (el umbral del ADR 0010), se cambia por un advisory lock por household y mes, dentro de las mismas dos funciones.
- **`for no key update` no choca con las foreign keys**, pero sí con otra liquidación y con una edición de los ajustes. Así tampoco se liquida con un objetivo que está cambiando en ese momento.
- **Es la convención del repo.** La liquidación lee de esa fila los objetivos, y una guarda que lee otra fila para decidir, la bloquea.

Se descartó una tabla de períodos con el acumulado:

- **Sería una segunda copia** de lo que ya está congelado en `proyectos`, mantenida a mano por cuatro funciones. Es la tabla derivada que se desfasa, la que descartó el ADR 0003.
- **Revertir pasaría a ser código que resta**, y ese código puede estar mal. Con la suma, revertir es automático.
- **Habría que replicarla.** La app necesita el acumulado para mostrar la distribución sin conexión, y la suma la saca de los proyectos que ya replica. Una tabla de acumulados habría que sumarla al bootstrap, al delta, a la RLS y a los grants.
- **Lo único que ahorraría** es sumar unas pocas filas por mes, con el índice parcial `proyectos_liquidados_por_mes`.

## (b) Reabrir un mes cerrado no lo reescribe

Reabrir un cobro, o reactivar un perdido, descongela solo ese proyecto: sale de la suma del mes, y las otras liquidaciones del mes quedan como estaban. No se recalculan.

Si el mes queda con fijos sin cubrir, es costo fijo sub-absorbido: una situación normal y aceptada, que se muestra. La liquidación siguiente de ese mes toma a lo sumo lo que falta.

Ejemplo, con fijos de 500.000 en agosto:

1. P1 se cobra primero y toma 500.000. P2 se cobra después, con tope 0.
2. Se reabre P1. Agosto queda con 0 cubierto: 500.000 sin cubrir, a la vista.
3. P1 se vuelve a cobrar, en agosto, con una neta corregida que solo alcanza para 350.000. Agosto termina con 150.000 sin cubrir, y P2 sigue en 0.

Dónde se ve: `resumenDelMes`, en el dominio, devuelve por mes el objetivo, lo liquidado y lo que falta, de sueldo y de fijos, sobre los proyectos replicados.

- El objetivo de fijos de un mes cerrado es el de su liquidación más reciente, y el de sueldo, el de su última liquidación que pagó sueldo: un cobro, o un perdido cerrado con `perdido_con_sueldo` prendido. Un perdido sin sueldo lleva objetivo en cero y no cuenta.
- El del mes en curso es el de los ajustes, que es el que va a usar la próxima liquidación.

## El perdido se liquida al pasar a perdido

Un anticipo de cliente es un pasivo mientras el trabajo puede pasar: plata que entró, pero que todavía no es ganancia porque no se entregó nada. Cuando el trabajo termina formalmente y la seña queda retenida, se reconoce como ingreso. La transición a perdido es ese evento.

- **No se bloquea el pase a perdido.** Si el sistema no deja cerrar un presupuesto que no prosperó porque cobró la visita, el usuario inventa un workaround.
- **Hay una sola implementación.** `cerrar_perdido` es hermana de `cobrar_proyecto`: mismos locks, misma cascada, mismos rechazos, y los mismos parámetros más el diezmo que vio el usuario. Lo único que cambia es el objetivo que recibe.
- **La base es la seña retenida menos los gastos cargados contra el lead.** La nafta de la visita es un gasto real. Puede dar negativo, y la cascada ya lo contempla.
- **Por defecto, la seña retenida paga diezmo y no paga sueldo:**
  - **Diezmo**, porque es ingreso reconocido y sigue la misma regla que cualquier otro (`ajustes.perdido_con_diezmo`, prendido).
  - **Sueldo no**, porque "cada trabajo me paga un retiro" habla de trabajos, y un lead que no prosperó no es uno. Reusar la cascada tal cual mandaría una seña de $200.000 casi entera al hogar sin dejar nada en el taller: es un efecto colateral, no la regla. Se implementa como objetivo de sueldo en cero para esa liquidación (`ajustes.perdido_con_sueldo`, apagado), no como una segunda cascada.
  - **Los dos son parámetros, y el dueño confirmó los valores de hoy** (2026-09-12): la seña retenida paga diezmo y no paga sueldo. Para el sueldo, el fundamento es el de arriba y es el correcto: "cada trabajo me paga un retiro" habla de trabajos, y un presupuesto que no prosperó no es uno.
- **Liquida siempre, tenga pagos o no.** Sin pagos, la neta es menos los gastos: todo en cero, la pérdida en el remanente y ningún asiento de distribución. Así la regla es una sola: un proyecto está cobrado o perdido si y solo si tiene la distribución congelada (`proyectos_liquidado_con_distribucion`).
- **Reactivar un perdido no guarda nada.** Un lead que revive vuelve a estar vivo, la seña vuelve a ser un anticipo, y un cierre posterior es un evento nuevo, con su fecha. Por lo mismo, cerrar como perdido ignora la foto de una reapertura.
- **Un perdido queda cerrado como un cobrado.** Sus pagos y gastos no se tocan (`MN001`). Si la nafta se carga tarde, se reactiva y se vuelve a cerrar. El rechazo lo dice en el hint: "Para cargarlo hay que reactivar el perdido y volver a cerrarlo".
- **Lo liquidado no se borra si tiene pagos o gastos vivos**, porque borrarlo sacaría plata del libro mayor. Un perdido sin pagos ni gastos, que es el caso común, se borra como antes. Para un cobrado es una relajación: uno sin pagos ni gastos ahora se puede borrar.

**Requisito para la interfaz (2C en adelante).** Cuando el usuario carga un gasto o un pago contra un perdido cerrado, la app no puede quedarse en el rechazo: tiene que ofrecer ahí mismo el camino de reactivar, cargar y volver a cerrar. Un "no" sin salida deja al usuario trabado y lo empuja al workaround que esta decisión quiere evitar.

## El tope de sueldo se queda por proyecto

Decisión del dueño, 2026-09-12. `ajustes.sueldo_tope_mensual` sigue apagado y no se prende, y el cliente sigue sin grant para prenderlo.

Este ADR se inclinaba para el otro lado: presentaba el tope mensual como lo que prefiere la teoría contable y dejaba armado el camino para pasarse. Queda escrito por qué no:

- **El sistema viejo lo hacía así y lo documentaba en su propia pantalla de configuración**: "Lo que se transfiere al tesoro HOGAR por proyecto cobrado". Fue una decisión, no un descuido.
- **La regla de este proyecto es que la app nueva sea al menos tan funcional como la que el dueño usa hoy.** Cambiarle una regla sobre su propia plata porque la teoría contable prefiere otra cosa no entra ahí.
- **Los costos fijos fueron distintos, y por eso sí se cambiaron.** Ahí el reparto **afirmaba algo falso**: que se habían cubierto cuatro veces los fijos del mismo mes. Un sueldo cobrado cuatro veces no es falso: es una política.

Lo que sí estaba mal era la pantalla, y se arregló (ver "La barra "Sueldo del mes"").

La sección que sigue queda como descripción del mecanismo, por si algún día el dueño cambia de opinión. No es un plan.

## Pasar el sueldo a tope mensual

El mecanismo que se construyó para los fijos sirve igual para el sueldo:

- **El cambio:** poner `ajustes.sueldo_tope_mensual` en `true`. El dominio, SQL y la comparación ya cubren los dos modos.
- **El efecto:** desde ese momento, cada liquidación toma a lo sumo lo que falta del sueldo del mes. Lo que ya está congelado no cambia.
- **El costo en plata:** con varios cobros en un mes, HOGAR recibe un sueldo en vez de uno por cobro. El resto queda en MAUN, como fijos o como remanente.
- **A mitad de mes:** lo que ya se liquidó por proyecto ese mes cuenta para el tope, y puede dejar en cero el resto del mes. Conviene cambiarlo al empezar un mes.
- **El lock pasa a proteger plata.** Con los fijos, lo único en juego es cómo se reparte la ganancia entre fijos y remanente. Con el sueldo mensual, dos cobros simultáneos se llevarían dos veces el mismo sueldo, y esa plata sí sale de MAUN hacia HOGAR. El lock ya está en los dos casos.
- **El cliente no tiene grant para prenderlo.** Se habilita en el mismo cambio que resuelva lo que sigue.

### El costo más caro: la liquidación sin conexión deja de ser determinista

Con tope por proyecto, una liquidación depende solo del proyecto: la app la calcula sin conexión y la base la acepta al sincronizar. Con tope mensual depende de las otras liquidaciones del mes.

Si la app no las vio, llega con un acumulado viejo, el tope no coincide y la base rechaza con `MN006`. Pasa, por ejemplo, si el cobro se hizo en la PC del taller y el celular estaba sin señal. Como la cola no reintenta los `MN00x`, al usuario le queda "rehacé el cobro". Y cobrar sin señal es justamente lo que el taller necesita.

**Esto ya pasa con los fijos, sin prender el interruptor.** El tope de fijos es mensual desde este cambio, así que el rebote es posible hoy.

- No mueve plata, pero el usuario ve el rechazo igual.
- Solo ocurre si otra liquidación del mismo mes se hizo en otro dispositivo y el que cobra no la sincronizó.
- Con un solo dispositivo no pasa si la app cuenta en el acumulado las liquidaciones que todavía están en la cola. Eso es un requisito para el 2C: la cola aplica cada liquidación al cache de forma optimista, con su distribución, y las drena en orden.

**Propuesta para cuando se prenda, y para los fijos antes de que exista la pantalla de cobro: que la base resuelva el acumulado del mes.**

- **Qué manda la app:** además de lo de hoy, el acumulado que vio.
- **Si coincide con el de la base,** todo sigue como hoy, con `MN006` y `MN008` estrictos.
- **Si no coincide** (es la única entrada que la app no podía conocer):
  - la base recalcula los topes con su acumulado, congela eso y devuelve la liquidación marcada como ajustada;
  - la app le muestra la diferencia al usuario: "el sueldo quedó en $X: otro cobro de septiembre ya había cubierto una parte".

Por qué esta y no las otras dos opciones:

- **Liquidar siempre en línea** ata la operación más importante del taller a la red, y el cobro pasa en lo del cliente, donde no hay señal.
- **Que la app mande la cascada sin el tope aplicado y la base calcule todo** pierde el `MN008`, que es lo que detecta una app desactualizada que aplica otra regla.
- **La propuesta conserva los dos:** el `MN008` sigue estricto cuando las entradas coinciden, y solo se acepta una diferencia que la app no podía prever, siempre a la vista.

Lo que cuesta:

- la firma de `cobrar_proyecto` y `cerrar_perdido` suma el acumulado visto;
- la respuesta suma la marca de ajuste, y la app, el aviso;
- cambia un contrato: "se congela lo que viste" pasa a ser "se congela lo que viste, salvo lo que otra liquidación del mes ya se llevó, y te avisamos".

## La barra "Sueldo del mes"

El diseño mostraba "Sueldo del mes — $X de $1.800.000". Medía contra un objetivo mensual, pero la distribución topea el sueldo por proyecto. Con dos cobros en el mes decía "$3.600.000 de $1.800.000": llena, y sin decir nada que no pareciera un error.

**Se arregló lo que muestra, no la regla** (2026-09-12). La barra mide lo que la regla promete: **cada cobro del mes espera su propio sueldo**, con el objetivo con el que se liquidó.

- Con dos cobros enteros dice "$3.600.000 de $3.600.000", y abajo "2 cobros este mes, y cada uno paga su propio sueldo."
- Si a uno de los dos no le alcanzó la ganancia, dice "$2.700.000 de $3.600.000" y queda al 75%.
- Sin cobros espera un sueldo, el de los ajustes, como antes.

Por qué así:

- **Nunca pasa del 100% y sigue diciendo algo** con cualquier cantidad de cobros. Lo que falta es sueldo que un trabajo no llegó a pagar, que es lo que al dueño le sirve ver.
- **Es la regla del dueño puesta en la pantalla**: "cada trabajo me paga un retiro" cuenta trabajos, no meses.
- **Con el tope mensual**, si algún día se prende, el mes espera un solo sueldo, como antes. `sueldoDelMes` lo distingue por `dist_sueldo_mensual`, que ahora viaja en `LiquidacionRegistrada`.

`sueldoDelMes` vive en el dominio al lado de `resumenDelMes` y no tiene gemela en SQL: nada en la base la consume.

Descartadas:

- **Dejar el objetivo mensual y escribir "cubierto" cuando se pasa.** Tapa el síntoma y deja la barra midiendo contra una regla que no existe.
- **Una barra partida en un tramo por cobro.** Dice lo mismo con más dibujo, y para un lector de pantalla es la misma frase.

**Objeción que queda.** El mensaje de arriba de la barra ("El sueldo de septiembre ya está cubierto", "Faltan $X para cubrir el sueldo") sigue leyendo el mes contra **un** sueldo, que es la necesidad del hogar. Con un cobro entero y otro a medias, el mensaje dice "cubierto" y la barra dice 75%. Las dos cosas son ciertas y miden cosas distintas. Se dejó así porque el mensaje viene del sistema viejo ("¡Sueldo del mes cubierto!") y es lo que el dueño está acostumbrado a leer.

**Resuelta por el ADR 0020.** El dueño pidió alinearlos: el mensaje ahora lee lo mismo que la barra (`faltaDelSueldo`, sobre `sueldoDelMes`). Con un cobro entero y otro a medias dice "Faltan $X para cubrir el sueldo", igual que el 75% de abajo.

## La devolución

Queda fuera de este cambio. Cuando llegue, se modela como un pago con importe negativo, porque es la reversión de un ingreso y no un gasto del trabajo. Como gasto daría la misma neta, pero la contaría como materiales en el libro mayor.

- **La restricción es barata de levantar.** `pagos_monto_positivo` (`monto > 0`) se cambia por `monto <> 0`:
  - todas las filas existentes la cumplen, así que no hay datos que migrar;
  - agregada con `not valid` y validada aparte, ni siquiera bloquea la tabla mientras se valida;
  - nada de lo que agrega este cambio depende de que los pagos sean positivos: la liquidación suma pagos, y la suma anda igual con negativos.
- **Lo que hay que agregar ese día:**
  - una guarda para que lo cobrado de un proyecto no quede negativo, porque hoy la cascada lo rechazaría con un 22023 genérico, que no es un mensaje para el usuario;
  - el concepto por signo en el libro mayor, para que una devolución no se lea como "cobro".
- **Mientras tanto, el único camino para un lead con seña es retenerla.** Si la seña se devolvió de verdad, no hay forma de registrarlo: el cierre la liquida como retenida.

## El diezmo tendría que ser configurable (no en este cambio)

Hoy el diezmo es una constante: `DIEZMO = 1000` puntos básicos en `packages/domain/src/cascada.ts` y `c_diezmo_bp constant integer := 1000` en `private.liquidar`. Son gemelas y por eso no divergen, pero es una regla del negocio de un taller y no del sistema. Con el registro abierto y auto-servicio (ADR 0012), cada usuario que se crea su taller trae su propia decisión, y "diezmo cero" es una respuesta legítima.

Lo que implicaría, para cuando se haga:

- **Un parámetro más en `ajustes`:** `diezmo_bp integer not null default 1000` con check `between 0 and 10000` y grant de update para `authenticated`, al lado del sueldo y los fijos.
- **La cascada no cambia.** Ya recibe `diezmoBp` como entrada: lo que cambia es quién se lo pasa. `calcularDistribucion` y `private.cascada` quedan intactas, y con ellas la comparación de más de 5.000 casos que las ata.
- **`planDeLiquidacion` y su gemela adentro de `private.liquidar`** leen el valor de los ajustes en vez de la constante, igual que ya leen el sueldo y los fijos. El perdido ya hace media parte: `perdido_con_diezmo` elige entre la constante y cero, y pasaría a elegir entre el ajuste y cero.
- **Lo congelado no se toca.** `proyectos.dist_diezmo_bp` guarda el porcentaje de cada liquidación: cambiar la tasa no reescribe ninguna, y cada distribución se sigue explicando sola (ADR 0003).
- **El libro mayor y los tesoros tampoco.** El asiento de diezmo sale del importe congelado, no de la tasa. Con tasa en cero no hay asiento, que es exactamente lo que hoy pasa con un perdido sin diezmo.
- **Lo que sí hay que decidir es la pantalla.** El tesoro DIEZMO y `Diezmo.dc.html` están dibujados asumiendo que existe: con la tasa en cero hay que elegir entre esconderlo o mostrarlo vacío.

## Lo que impide que las dos implementaciones diverjan

- **Antes de aplicar.** `pnpm --filter @maun/db db:ensayo` aplica las migraciones pendientes en una transacción, corre pgTAP y además `scripts/comparacion.ts`, que cubre:
  - la cascada de TypeScript contra la de SQL, en más de 5.000 casos: redondeos de medio centavo, pérdidas, ceros, topes en cero e importes cerca del límite;
  - los topes, en más de 2.000 casos, en los dos modos del sueldo;
  - que las dos rechacen exactamente el mismo rango de importes, en la cascada y en los topes;
  - `ESTADOS` contra el enum, y las 64 combinaciones de estados para transiciones, liquidaciones y reversiones;
  - liquidaciones reales paso a paso, calculadas como las calcula la app a partir de lo que hay en la base. Cubren dos cobros del mismo mes y uno de otro mes, el sueldo mensual, perdidos con y sin seña y con los dos parámetros, reabrir y volver a cobrar con los ajustes cambiados, y reactivar y volver a cerrar. Cada paso compara lo congelado, campo por campo, contra `calcularLiquidacion`.

  Todo termina en rollback: una migración que hace divergir las dos implementaciones no llega a `db push`. Con `-- --recargar-seed` borra el seed antes de migrar, lo recarga después y verifica cada liquidación del seed contra el dominio.

- **Después de aplicar.** La misma comparación corre en `pnpm verify` (`tests/dominio-vs-sql.test.ts`), y ahí incluye siempre el seed.
- **En producción.** El `MN008` rechaza cualquier divergencia que se haya escapado.
- **Los locks** (`tests/concurrencia.test.ts`, conexiones reales, todo en rollback, corre después del push):
  - el cobro espera a un pago en curso **sin haber tomado ningún lock sobre pagos ni gastos**, es decir, sin haber sumado;
  - el cobro espera incluso a una sesión que solo tiene `for key share`: su lock es `for update`;
  - una edición de pago espera al cobro;
  - dos liquidaciones de proyectos distintos del mismo household se esperan en la fila de ajustes, y la segunda todavía no sumó el mes (no leyó `proyectos`) ni pagos ni gastos;
  - una liquidación espera a una edición de los ajustes en curso.

  Cada test falla si falta el lock que prueba. Que la suma del mes venga después del lock de ajustes sí se prueba: mientras espera, la segunda sesión no tiene ningún lock de lectura sobre `proyectos`. Lo que no se prueba contra la base real es la rama commiteada (lo que ve la segunda sesión después de esperar), porque exigiría commitear en producción. La cubren pgTAP en una sola transacción y la semántica de READ COMMITTED.

- `packages/domain` tiene cobertura del 100%, exigida por la configuración de Vitest.

## Alternativas descartadas

- **La cascada solo en TypeScript, y la base guarda lo que manda el cliente.** La base confiaría en la cuenta de un celular. Un bug o una versión vieja de la app congelaría importes equivocados para siempre.
- **La cascada solo en SQL.** Sin proyección offline: el usuario no vería la distribución antes de cobrar.
- **`BigInt` en el dominio.** Descartado en el ADR 0002.
- **Redondeo bancario (mitad al par).** Es más justo en promedio sobre muchas operaciones. Acá hay una por proyecto y la regla que se espera es la comercial.
- **La máquina de estados solo en el cliente.** Un reenvío viejo de la cola podría dejar un proyecto en un estado imposible.
- **Reabrir y volver a cobrar con los ajustes de hoy.** Reescribiría el sueldo y la fecha de un cobro viejo por corregir un gasto.
- **Una tabla de períodos con el acumulado del mes.** Ver (a).
- **Recalcular los otros cobros del mes al reabrir uno.** Reescribiría un período cerrado.
- **Bloquear el pase a perdido mientras haya pagos vivos.** Empuja a un workaround para cerrar un lead que cobró la visita.
- **Una cascada propia para el perdido.** Dos implementaciones de la misma regla; el sueldo del perdido es un objetivo en cero, no otra cuenta.

## Consecuencias

- Todo cambio en la cascada, los topes, el redondeo o los estados se hace en los dos lugares en el mismo PR. Si no, el ensayo lo frena.
- Cambiar una regla deja rechazando con `MN008` a las apps que no se actualizaron. Es el comportamiento buscado, y la app tiene que ofrecer recargar.
- Una liquidación hecha sin conexión puede rebotar con `MN006` si otro dispositivo liquidó en el mismo mes (ver la propuesta de arriba).
- El 2C tiene que aplicar las liquidaciones encoladas al cache, para que el acumulado del mes las cuente.
- La interfaz tiene que ofrecer reactivar y volver a cerrar cuando rebota un pago o un gasto contra un perdido.
- Los tests de concurrencia usan proyectos del seed (`5eed…020002` entregado y `5eed…020011` en contacto) como datos commiteados que las sesiones ven. Si se borra el seed, fallan con un mensaje que dice cómo recargarlo.
- La cobertura del 100% en `packages/domain` es un umbral de Vitest: agregar código sin test rompe `pnpm verify`.
