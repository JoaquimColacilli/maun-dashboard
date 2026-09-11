# @maun/domain

Lógica de negocio pura. Hoy está vacío a propósito: el diseño sale de los tests de la fase 2.

## Pureza (la aplican las herramientas)

- ESLint rechaza cualquier import que no sea relativo. Los tests solo pueden importar además `vitest`.
- El tsconfig compila con `lib: ES2023` y `types: []`: no existen `window`, `document`, `fetch` ni los globals de Node.
- Nada de I/O, relojes ni aleatoriedad dentro de un cálculo: la fecha de hoy, los ajustes y los montos entran por parámetro.
- Imports relativos con extensión `.ts` (`NodeNext` + `rewriteRelativeImportExtensions`), para que `dist` corra en Node y el código fuente pueda leerlo Deno.

## Plata

- `Money` es un `number` entero de centavos con brand (ADR 0002). Nada de decimales ni de `BigInt` de JavaScript. Los porcentajes son enteros en puntos básicos (1000 = 10%), nunca float.
- El redondeo del 10% de diezmo es una regla de negocio: se define una vez, se testea y SQL la replica igual.
- Dividir por 100 pasa una sola vez, al formatear, y el formateo no vive acá.

## La cascada

`ganancia neta = total cobrado − gastos del proyecto`, y cada escalón come del anterior: 10% a DIEZMO, sueldo a HOGAR (topeado por lo que quedó), costos fijos a MAUN (topeado), remanente en MAUN. Todo movimiento tiene contrapartida.

No se replican los errores del sistema viejo: el sueldo que suma a HOGAR sin restar de MAUN, el pago de diezmo que no sale de ningún tesoro y la ganancia calculada sobre el presupuesto en vez de lo cobrado. `design-reference/src/lib/format.ts` (`despiece`) todavía calcula sobre el presupuesto: no se porta.

La misma cascada existe en SQL. Todo cambio acá lleva una migración nueva en `supabase/migrations/` y el test que compara las dos implementaciones.

La base ya fija dos invariantes de la distribución congelada (`proyectos_distribucion_cuadra`): los cuatro escalones suman exactamente la ganancia neta, y solo el remanente puede ser negativo, cuando hubo pérdida. El redondeo del diezmo lo define este paquete.

## Tests

Vitest, al lado del archivo (`*.test.ts`). Casos obligatorios de la cascada: ganancia cero, ganancia negativa, ganancia menor al sueldo y proyecto cobrado parcialmente. Cuando entre el primer test, sacá `--passWithNoTests` del script `test`.
