# 0002. Importes en centavos como `bigint`

Estado: aceptada, 2026-09-10.

## Contexto

El sistema viejo guardaba importes como `number` con decimales. Las sumas de floats no son exactas, y mezclar el cálculo con el formateo esconde los errores hasta que alguien compara con el banco.

## Decisión

- Todo importe es un `bigint` en centavos. Nada de floats, nunca.
- En TypeScript, `Money` es un `bigint` con brand. No se puede sumar un importe con un número suelto por accidente: el compilador lo rechaza, y en runtime mezclar `bigint` con `number` tira `TypeError`.
- Los valores de este negocio están muy por debajo del límite seguro de JavaScript. Las sumas son exactas.
- La división por 100 pasa una sola vez, al formatear.
- Los porcentajes, como el 10% de diezmo o la tasa de Cocos, se representan como enteros (por ejemplo, puntos básicos), con una regla de redondeo explícita y testeada.
- En Postgres, las columnas de plata son `bigint` con sufijo `_centavos`.

## Alternativas descartadas

- **`number` con decimales.** Es inexacto: es el problema que se quiere eliminar.
- **`number` entero en centavos con brand.** Es exacto dentro de 2^53, pero en runtime nada impide multiplicarlo por `0.1`.
- **`numeric` en Postgres más una librería decimal en el cliente.** Suma una dependencia y trabajo para importes que siempre son enteros.

## Consecuencias

- JSON no serializa `bigint`, así que cada frontera JSON necesita una conversión explícita. `supabase-js` devuelve las columnas `bigint` como `number`, y los tipos generados las tipan igual. La conversión vive en un solo lugar: `packages/db`.
- TanStack Query hashea las query keys con `JSON.stringify`, así que las keys llevan ids y nunca montos.
- El cache persistido usa IndexedDB con structured clone, que soporta `bigint`. Un persister basado en JSON no sirve.
- El redondeo del diezmo es una regla de negocio: se define en `domain` y SQL lo replica exactamente.
