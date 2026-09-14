# 0017 — Los datos del sistema viejo entran por un script, no por la app

Estado: **aceptada**. Fecha: 2026-09-12. Actualizada el mismo día (paso 12) con las ocho decisiones
que dejaba abiertas, tomadas con el dueño, y con el script construido.

## Contexto

El dueño viene usando `docs/referencia/Finanzas_MAUN_v3.html` hace meses. Sus clientes, proyectos,
pagos, insumos y movimientos están en el `localStorage` del Chrome de la PC del taller, bajo tres
claves: `maun3_p` (proyectos), `maun3_m` (movimientos) y `maun3_c` (configuración). El día que la app
nueva reemplace al HTML, o esos datos viajan, o el historial arranca de cero.

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
   de atrás puede dejar un proyecto `cobrado` con una distribución que no cuadra.
2. **Es una función que se usa una vez en la vida.** Queda para siempre en el bundle, en la superficie
   de ataque y en el mantenimiento.
3. **El script puede ser interactivo, con una persona que entiende del otro lado.** Puede frenar,
   preguntar, mostrar un informe y correr en una transacción que se confirma al final o no se
   confirma. Una pantalla en el celular, no.

## Las ocho decisiones

### 1. Clientes: nombre normalizado, y el script pregunta

`p.cliente` es texto libre adentro de cada proyecto. Se agrupa por el nombre **sin acentos, sin
distinguir mayúsculas, con los espacios colapsados y sin puntuación al final**. El script **no
decide solo**: muestra los grupos que armó, con el nombre exacto de cada proyecto y cuántos proyectos
tiene cada variante, y espera confirmación antes de escribir nada. Fusionar clientes no existe en la
app, así que un grupo mal armado se arregla a mano después y es caro.

Decisiones propias, dentro de esa regla:

- **La ñ no es un acento.** «Peña» y «Pena» quedan separados: son dos apellidos. Juntarlos sería
  normalizar de más. La diéresis sí se saca.
- **El cliente toma la variante con más proyectos**; si empatan, la primera que aparece. Solo se
  colapsan los espacios: no se cambian mayúsculas ni se saca puntuación del nombre que queda.
- **La salida de un grupo mal armado es `--separar "<nombre exacto>"`**, repetible: ese nombre queda
  como su propio cliente. Contestar que no a la confirmación no escribe nada y lo dice.

### 2. Movimientos: solo los cargados a mano

Sin cambios respecto de lo que este ADR ya decía. **Los movimientos con `proyId` no entran:**
`sincMovsProy()` los regenera enteros cada vez que se guarda un proyecto, y en la app nueva esos
asientos los arma la vista `libro_mayor` a partir de los pagos, los gastos y la distribución.
Importarlos sería contar todo dos veces.

| Tipo viejo       | Entra como                                                |
| ---------------- | --------------------------------------------------------- |
| `ingreso_hogar`  | `ingreso`, afuera → HOGAR                                 |
| `ingreso_maun`   | `ingreso`, afuera → MAUN                                  |
| `gasto_hogar`    | `gasto`, HOGAR → afuera                                   |
| `gasto_maun`     | `gasto`, MAUN → afuera                                    |
| `pago_diezmo`    | `pago_diezmo`, DIEZMO → afuera                            |
| `transfer_cocos` | `aporte_cocos`, MAUN → COCOS                              |
| `gasto_cocos`    | `gasto`, COCOS → afuera                                   |
| `cocos_a_maun`   | `transferencia`, COCOS → MAUN                             |
| `ajuste_cocos`   | `ajuste`: afuera → COCOS si suma, COCOS → afuera si resta |

`sueldo_hogar`, `diezmo_generado` y `fijos_maun` son derivados y se descartan, con o sin `proyId`.
`ajuste_hogar` y `ajuste_maun` son código muerto: **si aparece uno, el script corta**, porque algo
raro pasó y hay que mirarlo a mano. La categoría (`cat`) y el concepto viajan como categoría y
descripción.

### 3, 4 y 5. Los cobrados, el diezmo y la fecha de cobro: la variante de la opción tercera

**Lo verificado contra el esquema, antes de implementar.** El check
`proyectos_liquidado_con_distribucion` de `supabase/esquema.sql` dice:

```sql
(estado in ('cobrado', 'perdido')) = (fecha_cobro is not null)
and num_nulls(fecha_cobro, dist_cobrado_centavos, …, dist_liquidado_at) in (0, 16)
```

Un proyecto está cobrado o perdido **si y solo si** tiene fecha de cobro y las dieciséis columnas de
la distribución. Y no es la única guarda: `private.validar_proyecto` rechaza con `MN007` crear un
proyecto `cobrado` sin fecha de cobro, y `private.validar_proyecto_abierto` rechaza con `MN001` un
pago o un gasto contra un proyecto liquidado. **La opción tercera, tal como estaba escrita (cobrados
sin distribución), no se puede implementar** sin relajar el check, que es lo que este ADR descartaba.

**Aplica la variante: los cobrados entran con la distribución recalculada con las reglas de hoy, y el
asiento de apertura absorbe la diferencia** contra lo que el sistema viejo mostraba. Los cuatro
saldos quedan como el dueño los recuerda, cada proyecto se explica solo, el check pasa y no se relaja
ninguna garantía.

Cómo entra un cobrado, y por qué es la puerta de adelante:

1. Se inserta como `entregado`, con sus pagos y sus gastos.
2. Se cobra con **`public.cobrar_proyecto`, el mismo RPC que usa la app**, mandando la distribución
   que calcula `calcularLiquidacion` y el acumulado del mes. La base la recalcula y rechaza con
   `MN008` si difiere en un centavo. El script además compara lo congelado contra el dominio, campo
   por campo, y corta si no coincide.
3. Los cobros van en orden de fecha: cada uno ve a los anteriores del mismo mes, y el tope de costos
   fijos se reparte como si hubieran pasado en ese orden.

**Todo el script escribe como el titular del household**, con el rol `authenticated` y sus claims,
igual que el comparador cuando lee el seed. Pasa por la RLS, los grants por columna, los triggers y
las guardas. No hay un solo `update` a una columna de la distribución: esas las escribe
`private.liquidar`.

Lo que la variante resuelve y lo que no:

- **El DIEZMO con la convención invertida deja de importar.** El dueño pasa el saldo como lo muestra
  el sistema viejo (`pagado − generado`, positivo es superávit) y el script lo invierte antes de
  calcular la apertura. En la base, positivo es lo que falta pagar.
- **La fecha de cobro vuelve a hacer falta.** Una distribución congelada necesita `fecha_cobro`: es
  la fecha de los asientos de diezmo y de sueldo, y define el mes del tope de fijos. Se usa **la del
  último pago**, que es lo que este ADR ya proponía como la mejor aproximación. El informe lo dice en
  cada cobro. Sin pagos, sale de la entrega estimada, del inicio, del alta o del corte, en ese orden,
  y avisa.
- **`dist_liquidado_at` es el instante del script, no el histórico.** Solo ordena las liquidaciones de
  un mismo mes, y como los cobros se hacen en orden de fecha, el orden es el correcto.

Una tercera variante considerada y descartada: **meter los cobrados como `entregado` y no cobrarlos.**
Pasa el check, pero cambia el estado de trabajos que el dueño sabe cerrados, los pone en «Pendiente de
cobro» en Inicio y deja el cobro para hacerlo a mano desde la app, con la fecha de hoy.

**La apertura.** El dato de entrada son los cuatro saldos que el dueño lee en la app vieja el día del
corte. El script **los recibe como parámetro; no los deduce**. Después de escribir todo, lee los
saldos de `libro_mayor` y agrega un `ajuste` por tesoro por la diferencia, con la categoría
«Apertura» y la fecha del corte. Verifica que los cuatro saldos finales sean exactamente los leídos.

**Corregido por el ADR 0020.** La apertura cae en el mes del corte y, tal como estaba, Inicio y Finanzas
la sumaban a «Entró al hogar» o «Gastó el hogar» de ese mes. Ahora las cifras del mes excluyen todo
`ajuste` (`resumenMensual`): la apertura mueve el saldo pero no es plata del mes. El script no cambia.

Aparte, el script calcula los saldos que daba el sistema viejo con ese mismo JSON (la suma de
`calcTesoros`) y los pone al lado de los leídos. No los usa para nada. Si difieren en más de 50
centavos, que es el redondeo a pesos de la pantalla vieja, lo marca en el informe y en la terminal:
es la forma de detectar un saldo mal leído o un JSON sacado otro día.

### 6. Importes: `Math.round(x * 100)`, y corta si no es un redondeo

**Una interpretación, anotada.** "Corta si alguno se aleja más de un centavo del entero", al pie de la
letra, no cortaría nunca: la distancia de `x × 100` al entero más cercano es a lo sumo medio centavo.
Se implementó lo que la regla quiere decir: **`x × 100` tiene que estar a menos de una milésima de
centavo de un entero**. Eso deja pasar el ruido de float (`14500.300000000001` son 1.450.030
centavos) y corta cualquier fracción real de centavo (`400000.505`), con la fila y el importe en el
mensaje:

> maun3_p[0] «Placard 3 puertas con interior en melamina» (id 1752600000000-a1b2c), pago 2: el importe
> 400000.505 tiene fracciones de centavo. Es un dato sucio, no un redondeo: corregilo en el JSON.

Lo que corta, además, y el script lo junta todo en una sola pasada:

- un tipo de movimiento muerto o desconocido;
- un estado que no es de los cuatro;
- una fila de plata sin fecha válida;
- un pago en cero o negativo, o un gasto negativo;
- un texto más largo que su columna;
- dos proyectos con el mismo id.

Lo que no corta pero queda en los avisos del informe:

- un insumo sin monto, que no entra (el sistema viejo tampoco lo contaba);
- una forma de pago desconocida;
- un proyecto sin estado o sin presupuesto;
- un derivado de un proyecto que ya no está en `maun3_p`.

### 7. Estados: mapeo directo, ninguno perdido

| Sistema viejo   | Entra como                                                                        |
| --------------- | --------------------------------------------------------------------------------- |
| `presupuestado` | `presupuesto_enviado`                                                             |
| `en_curso`      | `en_curso`                                                                        |
| `entregado`     | `entregado`                                                                       |
| `cobrado`       | `cobrado`, por `cobrar_proyecto` (entra como `entregado` y se cobra en el script) |

`presupuestado` tenía presupuesto obligatorio, así que es un presupuesto enviado. Entra en Seguimiento
con `ultimo_contacto` en el día que se cargó en el sistema viejo, que sale del id: el HTML arma los ids
con `Date.now()`. Sin eso, todos dirían «Presupuesto enviado hoy» (ADR 0019).

### 8. Si se corre dos veces: se niega

Si el household tiene una sola fila en `clientes`, `proyectos`, `pagos`, `gastos` o `movimientos`,
**contando las borradas**, corta antes de escribir nada. También se niega si el titular pertenece a
más de un household, porque `private.household_actual()` elige el household de cada fila con un
`limit 1`.

## El script

```sh
pnpm --filter @maun/db db:migrar --archivo <json> --household <id> \
  --hogar=<saldo> --maun=<saldo> --diezmo=<saldo> --cocos=<saldo> \
  [--corte AAAA-MM-DD] [--separar "<nombre exacto>"]... [--informes <carpeta>] [--escribir]
```

- **Sin `--escribir` es un ensayo.** Hace exactamente lo mismo que la escritura, adentro de una
  transacción que termina en rollback, y deja el informe completo. Es la misma pasada, no una
  simulación: la base valida todo lo que validaría de verdad.
- **Con `--escribir`**, muestra los grupos de clientes y pregunta antes de tocar nada. Después hace
  todo, guarda y muestra el informe, y pide escribir `confirmo`. Confirma o no confirma, y reescribe
  el informe con el desenlace.
- **El informe va a un archivo Markdown**, al lado del JSON o en `--informes`. Es la única evidencia
  de qué entró y cómo. Trae:
  - el SHA-256 del JSON;
  - los saldos por tesoro, separados en lo que aportan los proyectos, lo cargado a mano y la apertura,
    contra lo leído y contra lo que daba el sistema viejo;
  - las verificaciones;
  - los datos sucios y los avisos;
  - los grupos de clientes;
  - los proyectos por estado y uno por uno;
  - cada cobro recalculado, al lado de lo que el sistema viejo había registrado para ese proyecto;
  - los movimientos que entran y los descartados, por motivo;
  - los asientos de apertura y la configuración.
- Los saldos negativos van con `=` (`--diezmo=-196.350`), para que no se lean como otra opción.
- Los tests están en `packages/db/tests/migracion.test.ts`, con un JSON armado a mano en
  `packages/db/tests/datos/sistema-viejo.json`, y corren en rollback como el resto de la suite.

## Lo que no se probó

- **La CLI contra la base.** Los tests corren `migrar()` en rollback, sobre un household creado en la
  misma transacción: la escritura entera, los cobros, la apertura, la negativa a correr dos veces y
  el agrupado sin confirmar. Las preguntas de la terminal, el `commit` final y el reescrito del
  informe con el desenlace no corrieron nunca: correrlos es escribir en la única base, que es
  producción. La CLI sí se corrió con un JSON sucio, que corta antes de conectarse.
- **Datos reales.** El JSON de prueba lo armé a mano leyendo el HTML. El primer JSON verdadero puede
  traer una forma que el HTML no deja ver, por ejemplo filas cargadas con la importación de CSV. Para
  eso está el ensayo.

## El archivo real (2026-09-14)

Pasó lo que el punto anterior temía. El JSON verdadero no vino de la línea de la consola: trae
`proyectos`, `movimientos` y `config`, con las listas ya parseadas, en vez de `maun3_p`, `maun3_m` y
`maun3_c`. Adentro, cada proyecto, pago, insumo y movimiento tiene los mismos campos que el HTML.

**El lector tomaba una clave ausente como una clave vacía**, que es un aviso y no un dato sucio. Con
ese archivo el ensayo habría dado cero proyectos y cero movimientos sin cortar, y la apertura habría
cargado los cuatro saldos enteros. La única pista era la diferencia contra el sistema viejo, que con
cero movimientos también daba cero.

Se corrigió así:

- **El script acepta los dos formatos.** Las claves que leyó van en el informe, y la ubicación de cada
  fila usa el nombre de la clave del archivo (`proyectos[3]`).
- **Una clave que falta es un dato sucio.** Una clave presente en `null` sigue siendo «vacía», porque
  eso es lo que devuelve `localStorage.getItem` cuando nunca se guardó.
- **Mezclar claves de los dos formatos también es un dato sucio**: no hay forma de saber cuál manda.

Se descartó copiar el archivo con las claves renombradas. La huella del informe dejaría de ser la del
archivo que llegó, y el agujero de la clave ausente seguiría abierto para el próximo.

Dos decisiones del dueño sobre el archivo real, tomadas después de leer la vista previa:

- **Un presupuestado con presupuesto de $1 entra sin presupuesto y en `a_presupuestar`.** Es relleno:
  el sistema viejo no dejaba guardar sin presupuesto (el `alert` del ADR 0019). Siete de los diez
  presupuestados del archivo son así, y como `presupuesto_enviado` habrían dicho «presupuesto enviado»
  por $1. Es una regla y no una opción porque nadie presupuesta un peso, y solo mira los presupuestados:
  un proyecto aprobado con $1 sería un dato raro, no relleno.
- **`--insumos-como-notas <id viejo>`, repetible**, pasa el texto de los insumos de ese proyecto a sus
  notas, y no entran como gastos. En el archivo, un presupuestado tenía dos «insumos» de $0,10 que eran
  el detalle del presupuesto. Es una opción y no una regla, como `--separar`. «Los insumos de un
  presupuestado son notas» contradiría la decisión del ADR 0019 (la nafta de la visita es un gasto
  real), y el importe no distingue una nota de un gasto chico. No se acepta sobre un cobrado: le
  cambiaría la distribución.

## Alternativas descartadas

- **Importación de CSV en la app**, como la del sistema viejo. Es la puerta de atrás del punto 1, y
  encima ese CSV no trae ni los movimientos ni la configuración.
- **Copiar el `localStorage` a mano, proyecto por proyecto, desde la app.** Con meses de historial no
  va a pasar completo: se pierde el libro mayor.
- **Una función de importación en la base.** Mueve el problema a SQL, y deja una función con grant en
  producción para siempre.
- **Congelar la distribución que mostraba el sistema viejo.** El check la rechaza; habría que relajarlo
  para las filas importadas, que es justo lo que existe para impedir (ADR 0003).
- **Hacer el script idempotente.** Negarse sobre un household con datos es más barato y más seguro.
- **Escribir como el dueño de la base, con `update` directos, como el seed.** Es la puerta de atrás del
  punto 1 dentro del propio script.

## Consecuencias

- Deja de ser bloqueante para la entrega: está listo y ensayado. Lo corre el dueño con el archivo
  real, primero en ensayo.
- **El JSON y los informes tienen los datos del taller.** Van fuera del repo: el informe se guarda al
  lado del JSON, y `.gitignore` ignora `informe-migracion-*.md` por las dudas.
- Conviene pedir el JSON ya y guardarlo aparte: si ese Chrome pierde el `localStorage`, no hay
  migración que hacer. Es la única copia que existe.
- El script depende de `cobrar_proyecto` y de `calcularLiquidacion`: si cambia la regla del cobro,
  cambia lo que congela, y el comparador de siempre lo cubre.
