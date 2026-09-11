# @maun/domain

Lógica de negocio pura: la plata (`money.ts`), la cascada de distribución (`cascada.ts`), la máquina de estados del proyecto (`estados.ts`) y la entrega estimada (`fechas.ts`). Las decisiones están en el ADR 0011.

## Pureza (la aplican las herramientas)

- ESLint rechaza cualquier import que no sea relativo. Los tests solo pueden importar además `vitest`.
- El tsconfig compila con `lib: ES2023` y `types: []`: no existen `window`, `document`, `fetch` ni los globals de Node.
- Nada de I/O, relojes ni aleatoriedad dentro de un cálculo: la fecha de hoy, los ajustes, los feriados y los montos entran por parámetro. `new Date(numero)` y `Date.UTC` son cuentas; `Date.now()` y `new Date()` sin argumentos, no.
- Imports relativos con extensión `.ts` (`NodeNext` + `rewriteRelativeImportExtensions`), para que `dist` corra en Node y el código fuente pueda leerlo Deno.

## Plata

- `Money` es un `number` entero de centavos con brand (ADR 0002). Nada de decimales ni de `BigInt` de JavaScript. Toda operación corta con `RangeError` si el resultado deja de ser un entero seguro.
- Los porcentajes son `PuntosBasicos` enteros (1000 = 10%). `aplicarPorcentaje` redondea al centavo mitad hacia arriba: `floor((importe × bp + 5000) / 10000)`, la misma cuenta que SQL.
- Dividir por 100 pasa una sola vez, al formatear, y el formateo no vive acá.

## La cascada

`neta = cobrado − gastos` (lo cobrado, nunca el presupuesto). Si la neta es cero o negativa, todo en cero y la pérdida en el remanente. Si no: 10% a DIEZMO, sueldo a HOGAR topeado por lo que queda, costos fijos a MAUN topeados por lo que queda, remanente en MAUN.

No se replican los errores del sistema viejo: el sueldo que suma a HOGAR sin restar de MAUN, el pago de diezmo que no sale de ningún tesoro y la ganancia calculada sobre el presupuesto en vez de lo cobrado. `design-reference/src/lib/format.ts` (`despiece`) todavía calcula sobre el presupuesto: no se porta.

## Gemelos en SQL

La cascada existe también en `private.cascada`, y las transiciones en `private.transicion_valida` (migración `20260911200100_cascada_estados_y_cobro.sql`). **Todo cambio acá lleva el cambio en SQL, con una migración nueva, en el mismo PR.** `packages/db/tests/dominio-vs-sql.test.ts` los compara contra la base y falla si divergen en un solo caso.

## Estados

`TRANSICIONES` lista solo lo que el usuario cambia a mano. Llegar a `cobrado` (`puedeCobrar`: solo desde `entregado`) y salir de `cobrado` (`puedeReabrir`) son operaciones de la base, `cobrar_proyecto` y `reabrir_proyecto`, no transiciones.

## Tests

Vitest, al lado del archivo (`*.test.ts`), con **cobertura del 100%** exigida por `vitest.config.ts`: código sin test rompe `pnpm verify`. Para propiedades sobre muchas entradas se usa un generador determinístico con semilla fija dentro del test (no hay dependencias de testing más allá de Vitest).
