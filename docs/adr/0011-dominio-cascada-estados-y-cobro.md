# 0011. Dominio: la cascada, la máquina de estados y el cobro, en dos lugares que no pueden divergir

Estado: aceptada, 2026-09-11.

## Contexto

La regla central del negocio, la cascada que reparte la ganancia de un proyecto cobrado, se necesita en dos lugares:

- **En el cliente**, para mostrar la distribución antes de cobrar, también sin conexión.
- **En la base**, para congelar lo que queda registrado sin confiar en la cuenta que manda un celular.

Lo mismo pasa con las transiciones de estado: la app las usa para ofrecer solo los botones que tienen sentido, y la base las aplica para que un reenvío viejo de la cola no deje un proyecto en un estado imposible. Si las dos implementaciones pueden separarse en silencio, `packages/domain` pierde su razón de ser.

## Decisión

**Plata.** `Money` es un `number` entero de centavos con brand (ADR 0002). Toda operación verifica que el resultado siga siendo un entero seguro y corta con `RangeError` en vez de perder precisión.

**Porcentajes y redondeo.** Los porcentajes van en puntos básicos enteros (1000 = 10%). Aplicar un porcentaje redondea al centavo **mitad hacia arriba**, con aritmética entera: `floor((importe × bp + 5000) / 10000)`. Es la misma cuenta que hace SQL con `bigint`. En TypeScript la división entre doubles es exacta para todo producto seguro: la parte fraccionaria del cociente tiene resolución de 1/10000, más grande que el error de la división. Lo verifica un test contra `BigInt` en miles de casos, incluidos importes cerca del límite. SQL rechaza el mismo rango que TypeScript: nada por encima de `Number.MAX_SAFE_INTEGER`.

**La cascada** (`calcularDistribucion` en TypeScript, `private.cascada` en SQL):

1. `neta = cobrado − gastos`. Es sobre lo **cobrado** (la suma de los pagos vivos), no sobre el presupuesto.
2. Si `neta ≤ 0`: diezmo, sueldo y fijos en cero, y la pérdida entera en el remanente. Los escalones siempre suman la neta, que es lo que la base exige (`proyectos_distribucion_cuadra`).
3. Si no: el diezmo al 10%; el sueldo, topeado por lo que queda; los fijos, topeados por lo que queda; el remanente es lo que sobra.

**La máquina de estados.** `TRANSICIONES` en TypeScript y `private.transicion_valida` en SQL listan las transiciones que el usuario hace a mano:

- Dentro del seguimiento se va y viene entre sus cuatro estados.
- Un lead se convierte en obra (`en_curso`) o se pierde.
- Un perdido se reactiva como lead.
- La obra se entrega, se cae, o vuelve a presupuesto.
- Lo entregado puede volver al taller.

**Llegar a cobrado y salir de cobrado no son transiciones: son operaciones.** Cobrar solo desde `entregado`; reabrir vuelve a `entregado`. La base rechaza cualquier otro cambio de estado con `MN007`.

**El cobro es una función de la base.** `public.cobrar_proyecto` es un envoltorio `security invoker` sobre `private.cobrar_proyecto`, que es `security definer` porque escribe las columnas de la distribución, sobre las que el cliente no tiene grant. La app manda todo lo que le mostró al usuario: la `version` del proyecto, el total cobrado, el total de gastos, los topes, la fecha y la distribución que calculó `calcularDistribucion`. Pasos:

1. **Primera sentencia: bloquea el proyecto** con `for update`. La guarda de pagos y gastos toma `for share` sobre la misma fila, así que un pago y un cobro simultáneos se serializan: uno espera al otro.
2. Si es el **reenvío** de un cobro que ya se aplicó (versión exactamente una más, mismos datos congelados), devuelve el proyecto sin rechazar. La cola puede reintentar sin que el usuario vea un error por algo que salió bien.
3. Verifica pertenencia, estado y versión.
4. Suma pagos y gastos, en sentencias posteriores al lock.
5. Compara los totales, los topes y la fecha con los que mandó la app. Si algo cambió, rechaza con `MN006`. Se comparan los totales y no cada pago: la distribución congelada depende solo de los totales y los topes, así que es la misma que vio el usuario.
6. Calcula con `private.cascada` y **compara el resultado con la distribución que mandó la app**. Si difiere en un centavo, rechaza con `MN008`. Pasa si la app y la base aplican reglas distintas, por ejemplo con un bundle viejo servido por el service worker después de un cambio de regla. Un rechazo visible es mejor que congelar otra cosa.
7. Congela.

**La reapertura** (`reabrir_proyecto`) también bloquea, reconoce el reenvío y verifica la versión. Vuelve el proyecto a `entregado` sin distribución, **pero guarda los topes y la fecha del cobro original** (`reapertura_*`). El cobro siguiente usa esos topes y esa fecha en vez de los de hoy: corregir un gasto no reescribe el sueldo con los ajustes de este año ni mueve la distribución en el libro mayor (ADR 0003). La app arma la entrada de la cascada con `reapertura_* ?? ajustes` y la fecha con `reapertura_fecha_cobro ?? hoy`.

**Entrega estimada.** A 21 días hábiles del inicio, contando de lunes a viernes. Los feriados entran por parámetro: el dominio no conoce el calendario, la lista la pasa la app.

## Lo que impide que las dos implementaciones diverjan

- **Antes de aplicar.** `pnpm --filter @maun/db db:ensayo` aplica las migraciones pendientes en una transacción, corre pgTAP y además `scripts/comparacion.ts`. Esa comparación cubre:
  - la cascada de TypeScript contra la de SQL, en más de 5.000 casos: redondeos de medio centavo, pérdidas, ceros, topes en cero e importes cerca del límite;
  - que las dos rechacen exactamente el mismo rango de importes;
  - `ESTADOS` contra el enum;
  - las 64 combinaciones de estados;
  - cobros reales, verificando que lo congelado sea `calcularDistribucion` con los mismos datos.

  Todo termina en rollback: una migración que hace divergir las dos implementaciones no llega a `db push`.

- **Después de aplicar.** La misma comparación corre en `pnpm verify` (`tests/dominio-vs-sql.test.ts`).
- **En producción.** El `MN008` de `cobrar_proyecto` rechaza cualquier divergencia que se haya escapado.
- **Los locks** (`tests/concurrencia.test.ts`, dos conexiones reales, todo en rollback, corre después del push):
  - el cobro espera a un pago en curso **sin haber tomado ningún lock sobre pagos ni gastos**, es decir, sin haber sumado;
  - el cobro espera incluso a una sesión que solo tiene `for key share`: su lock es `for update`;
  - una edición de pago espera al cobro. Es un update que no dispara la foreign key, así que la espera sale de la guarda.

  Cada test falla si falta el lock que prueba. Lo que no se prueba contra la base real es la rama commiteada (el pago que, después de esperar, ve el proyecto cobrado y rebota con `MN001`), porque exigiría commitear en producción. La cubre `03_integridad.sql` en una sola transacción, más la semántica de READ COMMITTED.

- `packages/domain` tiene cobertura del 100%, exigida por la configuración de Vitest.

## Objeciones y preguntas abiertas

- **El tope de sueldo es por proyecto, no por mes.** El brief dice "el sueldo al hogar topeado por lo que queda", y el sistema viejo usaba el sueldo mensual como tope en cada proyecto. Implementé eso. La consecuencia: si dos proyectos se cobran el mismo mes, cada uno aporta hasta un sueldo completo. Si la regla es "un sueldo por mes", el tope de cada cobro tiene que ser lo que falta del sueldo de ese mes. El esquema ya lo soporta sin migración: congela el tope que se aplicó. Queda para decidir con el dueño.
- **Un proyecto perdido con pagos nunca se distribuye.** Un lead que dejó una seña y se cae pasa a `perdido`, y la seña queda en MAUN sin generar diezmo ni sueldo. Opciones: (a) permitir cobrar un perdido con pagos, que congela la seña con la misma cascada; o (b) no dejar pasar a perdido mientras haya pagos vivos, lo que obliga a registrar primero la devolución. No lo cambié: es una regla de negocio y hoy no se pierde ni se inventa plata, solo falta el reparto. Queda para decidir con el dueño.

## Alternativas descartadas

- **La cascada solo en TypeScript, y la base guarda lo que manda el cliente.** La base confiaría en la cuenta de un celular. Un bug o una versión vieja de la app congelaría importes equivocados para siempre.
- **La cascada solo en SQL.** Sin proyección offline: el usuario no vería la distribución antes de cobrar.
- **`BigInt` en el dominio.** Descartado en el ADR 0002.
- **Redondeo bancario (mitad al par).** Es más justo en promedio sobre muchas operaciones. Acá hay una por proyecto y la regla que se espera es la comercial.
- **La máquina de estados solo en el cliente.** Un reenvío viejo de la cola podría dejar un proyecto en un estado imposible.
- **Reabrir y volver a cobrar con los ajustes de hoy.** Reescribiría el sueldo y la fecha de un cobro viejo por corregir un gasto.

## Consecuencias

- Todo cambio en la cascada, el redondeo o las transiciones se hace en los dos lugares en el mismo PR. Si no, el ensayo lo frena.
- Cambiar una regla de la cascada deja rechazando con `MN008` a las apps que no se actualizaron. Es el comportamiento buscado, y la app tiene que ofrecer recargar.
- El test de concurrencia usa el proyecto entregado del seed (`5eed…020002`) como dato commiteado que las dos sesiones ven. Si se borra el seed, el test falla con un mensaje que dice cómo recargarlo.
- La cobertura del 100% en `packages/domain` es un umbral de Vitest: agregar código sin test rompe `pnpm verify`.
