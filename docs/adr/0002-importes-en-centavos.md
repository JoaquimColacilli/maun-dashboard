# 0002. Importes en centavos: `bigint` en Postgres, entero con brand en TypeScript

Estado: aceptada, 2026-09-10. Corregida el 2026-09-11: la primera versión era ambigua sobre qué es `bigint` en cada capa.

## Contexto

El sistema viejo guardaba importes como `number` con decimales. Las sumas de floats no son exactas, y mezclar el cálculo con el formateo esconde los errores hasta que alguien compara con el banco.

## Decisión

- **`bigint` es el tipo de la columna en Postgres.** Toda columna de plata es `bigint`, en centavos, con sufijo `_centavos`. Nada de `numeric`, `float` ni `real` para importes.
- **En TypeScript, los centavos son un `number` entero**, con el tipo branded `Money` encima. El brand impide sumar un importe con un número suelto por accidente; las operaciones de `Money` en `@maun/domain` validan que el resultado siga siendo un entero seguro.
- **Nada de `BigInt` de JavaScript en la capa de aplicación.** Rompe `JSON.stringify`, no entra en una query key de TanStack Query, y `supabase-js` devuelve las columnas `bigint` como `number` de todas formas (los tipos generados las tipan así).
- Los valores de este negocio están muy por debajo del límite seguro de los enteros de JavaScript (2^53 − 1 centavos, unos 90 billones de pesos). Las sumas de enteros en ese rango son exactas.
- La división por 100 pasa una sola vez, al formatear.
- Los porcentajes, como el 10% de diezmo o la tasa de Cocos, son enteros en puntos básicos (1000 = 10%), con una regla de redondeo explícita y testeada.

## Alternativas descartadas

- **`number` con decimales.** Es inexacto: es el problema que se quiere eliminar.
- **`BigInt` de JavaScript con brand.** Es exacto sin límite, pero no se serializa a JSON, no sirve de query key y obliga a convertir en cada frontera un valor que `supabase-js` ya entrega como `number`. Paga un costo real para cubrir un rango que este negocio no va a usar.
- **`numeric` en Postgres más una librería decimal en el cliente.** Suma una dependencia y trabajo para importes que siempre son enteros.

## Consecuencias

- En runtime nada impide multiplicar un `number` por `0.1`: lo impiden el brand, que obliga a pasar por las operaciones de `Money`, y los tests del dominio. Las operaciones que dividen (el diezmo) redondean con una regla definida en `@maun/domain` que SQL replica igual.
- Las query keys pueden llevar importes sin romper el hasheo, aunque por claridad llevan ids.
- El cache persistido guarda números comunes: no depende de que el persister soporte `bigint`.
- La conversión entre la fila de la base (`number`) y `Money` vive en un solo lugar, `packages/db`, y valida que el valor sea un entero seguro.
