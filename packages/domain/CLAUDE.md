# @maun/domain

Lógica de negocio pura: la plata (`money.ts`), la cascada de distribución (`cascada.ts`), los topes y la liquidación (`liquidacion.ts`), la máquina de estados del proyecto (`estados.ts`) y las fechas (`fechas.ts`). Las decisiones están en el ADR 0011.

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

## Gemelos en SQL

- `private.cascada` y `private.transicion_valida`, en la migración `20260911200100_cascada_estados_y_cobro.sql`.
- `private.topes_de_la_liquidacion`, `private.liquidacion_valida`, `private.reversion_valida` y el bloque de objetivos y la suma del mes de `private.liquidar`, en `20260911210000_topes_mensuales_y_perdido.sql`.

**Todo cambio acá lleva el cambio en SQL, con una migración nueva, en el mismo PR.** `packages/db/tests/dominio-vs-sql.test.ts` los compara contra la base y falla si divergen en un solo caso.

## Estados

`TRANSICIONES` lista solo lo que el usuario cambia a mano: 19 transiciones, ninguna hacia ni desde un estado liquidado. Llegar a `cobrado` o a `perdido` y salir de ahí son operaciones de la base, no transiciones:

- `puedeLiquidar` (`puedeCobrar`, `puedeCerrarPerdido`) dice desde dónde se llega.
- `puedeRevertir` (`puedeReabrir`, `puedeReactivar`) dice a dónde se vuelve.

## Tests

Vitest, al lado del archivo (`*.test.ts`), con **cobertura del 100%** exigida por `vitest.config.ts`: código sin test rompe `pnpm verify`. Para propiedades sobre muchas entradas se usa un generador determinístico con semilla fija dentro del test (no hay dependencias de testing más allá de Vitest).
