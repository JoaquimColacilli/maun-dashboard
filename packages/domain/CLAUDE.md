# @maun/domain

Lógica de negocio pura: la plata (`money.ts`), la cascada de distribución (`cascada.ts`), los topes y la liquidación (`liquidacion.ts`), la seña esperada (`sena.ts`), el margen contra los costos estimados (`costos.ts`), el catálogo de lo que hace falta (`necesidades.ts`), la máquina de estados del proyecto (`estados.ts`), las fechas (`fechas.ts`), el libro mayor (`libroMayor.ts`), el CUIT (`cuit.ts`), los datos para cobrar (`cobro.ts`), la agenda con lo que se avisa (`agenda.ts`) y la vista del cliente (`vistaCliente.ts`). Las decisiones están en el ADR 0011, las de la agenda en el 0034, las de la seña en el 0043, las de los costos, lo que hace falta y el día por horas en el 0045, las de la vista del cliente en el 0046 y las de los datos para transferir en el 0048.

## Pureza (la aplican las herramientas)

- ESLint rechaza cualquier import que no sea relativo. Los tests solo pueden importar además `vitest`.
- El tsconfig compila con `lib: ES2023` y `types: []`: no existen `window`, `document`, `fetch` ni los globals de Node.
- Nada de I/O, relojes ni aleatoriedad dentro de un cálculo: la fecha de hoy, el mes en curso, los ajustes, los feriados y los montos entran por parámetro. `new Date(numero)` y `Date.UTC` son cuentas; `Date.now()` y `new Date()` sin argumentos, no.
- Imports relativos con extensión `.ts` (`NodeNext` + `rewriteRelativeImportExtensions`), para que `dist` corra en Node y el código fuente pueda leerlo Deno.

## Plata

- `Money` es un `number` entero de centavos con brand (ADR 0002). Nada de decimales ni de `BigInt` de JavaScript. Toda operación corta con `RangeError` si el resultado deja de ser un entero seguro.
- Los porcentajes son `PuntosBasicos` enteros (1000 = 10%). `aplicarPorcentaje` redondea al centavo mitad hacia arriba: `floor((importe × bp + 5000) / 10000)`, la misma cuenta que SQL.
- Dividir por 100 pasa una sola vez, al formatear, y el formateo no vive acá.

## La cascada

`neta = cobrado − gastos` (lo cobrado, nunca el presupuesto). Si la neta es cero o negativa, todo en cero y la pérdida en el remanente. Si no: diezmo a DIEZMO, sueldo a HOGAR topeado por lo que queda, costos fijos a MAUN topeados por lo que queda, remanente en MAUN. La cascada no sabe de meses: recibe los topes.

No se replican los errores del sistema viejo: el sueldo que suma a HOGAR sin restar de MAUN, el pago de diezmo que no sale de ningún tesoro y la ganancia calculada sobre el presupuesto en vez de lo cobrado. `design-reference/src/lib/format.ts` (`despiece`) todavía calcula sobre el presupuesto: no se porta.

## La liquidación

`calcularLiquidacion` es lo que la app llama antes de cobrar o cerrar como perdido, y lo que la base tiene que congelar:

- `planDeLiquidacion` elige la fecha, el diezmo y los objetivos: los ajustes, la foto de una reapertura, o los parámetros del perdido (sin sueldo y con diezmo, por defecto).
- `liquidadoDelMes` suma lo que ya liquidaron los otros proyectos en el mes calendario de la fecha.
- `topesDeLaLiquidacion` saca los topes: los fijos, por lo que falta del mes; el sueldo, por proyecto o por mes.
- La app le pasa las liquidaciones que tiene replicadas, **incluidas las que todavía están en la cola**, sin el proyecto que se liquida.

`resumenDelMes` es lo que se muestra por mes: objetivo, liquidado y lo que falta, de sueldo y de fijos.

`sueldoDelMes` es lo que mide la barra «Sueldo del mes» de Inicio: el sueldo que pagaron los cobros del mes contra el que prometían. Con el tope por proyecto, que es la regla del dueño, cada cobro promete su propio sueldo, con el objetivo con el que se liquidó; con el tope mensual, el mes promete uno. Por eso `LiquidacionRegistrada` lleva `sueldoMensual` (ADR 0011). Ni `resumenDelMes` ni `sueldoDelMes` tienen gemela en SQL: nada en la base los consume.

## La seña

`calcularSena` es la resta que el dueño pidió: cuánto es la seña, cuánto cobró y cuánto falta. La seña es un porcentaje del presupuesto (`ajustes.sena_bp`, la mitad por defecto) y se puede pisar por trabajo (`proyectos.sena_bp`); `porcentajeDeLaSena` dice cuál manda. Devuelve una unión con tres situaciones, no números sueltos: **sin presupuesto no hay seña** y lo dice, y cuando ya la cubrió dice cuánto de más en vez de un negativo. Lo cobrado que recibe incluye la plata de la visita del relevamiento, porque el contacto y el trabajo son la misma fila (ADR 0019).

**No tiene gemela en SQL y no la necesita**, como `resumenDelMes` y `sueldoDelMes`: nada en la base consume la seña. La base sí guarda los dos porcentajes, con su `check` de rango.

## El margen y lo que hace falta (ADR 0045)

- `calcularMargen` es la otra resta que pidió el dueño: el presupuesto menos lo que calcula gastar. Las cuatro categorías son fijas (`CATEGORIAS_DE_COSTO`: madera, herrajes, flete, ayudante) y **null no es cero**: null es «todavía no lo estimé» y cero es «este trabajo no lleva flete». Devuelve una unión de tres situaciones, no números sueltos, y **el margen puede ser negativo**: eso es justamente lo que hay que ver. **No hay ninguna función que vaya del costo al presupuesto**, y no la agregues: el presupuesto incluye la ganancia, que la decide él.
- `catalogoDeNecesidades` arma el catálogo de nombres desde las filas que ya existen: no hay tabla de catálogo. Ordena por lo más usado, después por lo más reciente y después alfabético, para que la lista no baile. `claveDelNombre` compara sin acentos ni mayúsculas, y `sugerenciasDeNecesidad` pone adelante lo que **empieza** con lo escrito y descarta lo que ya está escrito igual.

## La vista del cliente (ADR 0046)

`vistaDelCliente(trabajo, hoy)` es el único cálculo de la pantalla que ve el cliente: el camino de
cinco hitos, la línea de tiempo curada, hace cuánto que está en esta etapa, qué sigue, y **qué se lee
primero**. Recibe el payload que armó la base y no puede filtrar nada, porque lo que no puede ver no
le llega.

- **El foco se invierte solo y no es configurable**: hasta la entrega manda la etapa y el saldo va
  completo en la fila de abajo; desde la entrega con saldo pendiente, manda el saldo. Es
  `foco: 'saldo' | 'estado'` y sale de `hitoIndex >= entregado && saldo > 0`.
- **Los hitos que faltan no llevan fecha**: prometer un día de «pagado» sería inventarlo.
- **Los eventos no llevan el importe adentro del texto**: va en `monto`, y el formateo no vive acá.
- **Sin porcentajes de avance**: nadie sabe si un mueble está al 60%.
- **La vista del cliente no dice nunca cuánto hace que pasó algo** (corrección del ADR 0046). Ni «Hace N días», ni «hace N días que no hay novedades»: el cliente ve la fecha y qué sigue. Los «hace N días» son de la app del dueño, que los usa para su lista de pendientes. `vistaCliente.test.ts` lo exige sobre el JSON entero de `vistaDelCliente`.
- **`cobro` son los datos para transferirle al taller** (alias, CBU o CVU, titular y CUIT, ADR 0048): llegan del payload, y `hayComoTransferir` dice si alcanza para mostrar el bloque. El titular y el CUIT solos no alcanzan: con eso no se transfiere.
- **No tiene gemela en SQL**, como `calcularSena`: la base arma el payload, no la presentación.

## El CUIT

`revisarCuit` **avisa, no bloquea** (ADR 0014). Devuelve cuatro estados y no un booleano, porque el caso del módulo 11 que da 10 no tiene una convención única: `verificadorDeCuit` devuelve `null` ahí en vez de elegir entre "inválido" y "mapearlo a 9", y `revisarCuit` lo llama `ambiguo`. El prefijo y el verificador que no cierra también son advertencias. Lo único que la app frena es el largo, y no por el checksum: es el `check` de formato de la base, y un rechazo definitivo tapa la cola.

## Gemelos en SQL

- `private.cascada` y `private.transicion_valida`, en la migración `20260911200100_cascada_estados_y_cobro.sql`.
- `private.topes_de_la_liquidacion`, `private.liquidacion_valida`, `private.reversion_valida` y el bloque de objetivos y la suma del mes de `private.liquidar`, en `20260911210000_topes_mensuales_y_perdido.sql`.
- **`asientosDelLibro` y `saldosPorTesoro` contra la vista `public.libro_mayor`**, que es el estado vivo del esquema (`supabase/esquema.sql`), no el archivo de la migración: los dos difieren y el archivo está desactualizado (ADR 0013 y 0014).

`lineasDelLibro` **no tiene gemela en SQL y no la necesita**: es la forma sin partir de lo mismo, y
`asientosDelLibro` es literalmente `lineasDelLibro(...).flatMap(asientosDeLaLinea)`. Nada en la base
consume una línea —la vista existe para sacar saldos, y los saldos siguen saliendo de los asientos—,
así que la comparación contra `libro_mayor` la cubre por construcción: si una línea estuviera mal, sus
asientos estarían mal. Una línea es una operación (una transferencia es **una**, con origen y
destino); un asiento es un lado (ADR 0018).

**Todo cambio acá lleva el cambio en SQL, con una migración nueva, en el mismo PR.** `packages/db/tests/dominio-vs-sql.test.ts` los compara contra la base y falla si divergen en un solo caso.

## Estados

`TRANSICIONES` lista solo lo que el usuario cambia a mano: 28 transiciones, ninguna hacia ni desde un estado liquidado. Dentro del seguimiento (cinco etapas desde el ADR 0038, con `presupuesto_estimativo` entre contacto y relevamiento) se va y viene, y desde cualquiera se aprueba. Llegar a `cobrado` o a `perdido` y salir de ahí son operaciones de la base, no transiciones:

- `puedeLiquidar` (`puedeCobrar`, `puedeCerrarPerdido`) dice desde dónde se llega.
- `puedeRevertir` (`puedeReabrir`, `puedeReactivar`) dice a dónde se vuelve.

## La agenda (ADR 0034)

- **`eventosDeLaAgenda(datos, rango)` calcula lo que sale de los trabajos; nada de eso se guarda.** Entrega con `entregaEstimada`: pendiente si la obra está `en_curso`, hecha si está `entregado` o `cobrado`. Visita con `fechaVisita`: pendiente mientras el trabajo está en seguimiento, hecha con `visitaHecha`, en cualquier estado. Presupuesto si está en seguimiento, ni en `presupuesto_enviado` ni en `presupuesto_estimativo` (los dos esperan al cliente), con `vencimientoPresupuesto`. Suma las anotaciones del rango y ordena por fecha, lo que tiene hora primero, la hora, el peso de la categoría y el texto.
- **Todo evento lleva `hecha` e `importante`, propio o derivado** (ADR 0042). **`hecha` sale de un hecho, nunca de la posición en el embudo**: la entrega, del estado, porque entregar y volver al taller mueven el estado de verdad; la visita, de `visitaHecha`, que cambiar de etapa no toca. Si agregás un derivado, decidí primero de qué hecho sale su `hecha`.
- **Todo evento lleva `hora`, propio o derivado** (ADR 0045). La entrega y la visita salen de `proyectos.entrega_hora` y `proyectos.visita_hora`; el vencimiento del presupuesto es un plazo y nunca lleva. El orden ya ponía lo que tiene hora antes de lo que no.
- **`diaPorHoras(eventos, rango)` parte un día en la franja de todo el día y los renglones por hora.** El rango por defecto es `HORARIO_DEL_TALLER` (07 a 20) y **se estira solo para que nada quede escondido**: si hay algo a las cinco, la grilla empieza a las cinco. `TODO_EL_RELOJ` es el reloj entero.
- **`puedeArrastrarse(evento)` es `!evento.hecha`.** Lo hecho figura en el día en que estaba prometido y moverlo sería reescribir lo que pasó.
- **`eventosParaAvisar(datos, hoy, preferencias)` usa la misma función.** La anticipación es una ventana, de hoy a N días, no un día exacto. Salen lo inactivo y lo hecho.
- `vencimientoDelPresupuesto` son `DIAS_HABILES_PARA_PRESUPUESTAR` (5, una semana de trabajo) días hábiles (ADR 0038). `sumarDias` y `diasEntre` cuentan en UTC sobre fechas `AAAA-MM-DD`: sin librería de fechas y sin `Temporal`.
- **No tiene gemela en SQL: la base no calcula eventos.** La función de borde de los avisos importa este código fuente con Deno, que es otra razón para los imports relativos con `.ts`.

## Tests

Vitest, al lado del archivo (`*.test.ts`), con **cobertura del 100%** exigida por `vitest.config.ts`: código sin test rompe `pnpm verify`. Para propiedades sobre muchas entradas se usa un generador determinístico con semilla fija dentro del test (no hay dependencias de testing más allá de Vitest).

## Los datos para transferir (ADR 0048)

`cobro.ts` revisa lo que el dueño carga en Ajustes para que su cliente le transfiera.

- **`revisarCbu` valida los dos dígitos verificadores**, con el algoritmo del BCRA («clave 10 con el ponderador 9713», t.o. SNP): el primero sobre las siete posiciones del banco y la sucursal, el segundo sobre las trece de la cuenta. El `(10 - resto) % 10` del final importa: cuando el resto da cero el verificador es **0, no 10**, y hay un caso de test que lo ejercita.
- **Un CVU se valida igual que un CBU**: la norma dice que tiene el mismo formato. Lo que cambia es el prefijo, `000`, que es lo único que los distingue (`esClaveVirtual`).
- **Los verificadores no dicen que la cuenta exista**: una entidad inventada como `999` pasa el algoritmo. Lo que agarran es el error de tipeo, que es para lo que están.
- **`revisarAlias` es la lista del BCRA y nada más**: 6 a 20 caracteres, letras, números, punto y guion medio. El guion bajo **no** entra, aunque medio internet diga que sí. Lo que la norma no dice —si puede empezar con un separador, si admite dos seguidos— sale como `aviso`, no como error: acá no se frena por una regla que no está escrita.
- **Los números de los tests son sintéticos**, construidos aplicando el algoritmo. Ninguno es la cuenta de nadie.
