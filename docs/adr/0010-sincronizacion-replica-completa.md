# 0010. Sincronización: réplica completa del household

Estado: aceptada, 2026-09-11. La base (ids, metadatos, bootstrap, delta, guardas) queda hecha en la fase 2A; la cola de salida y los indicadores, en la 2C.

## Contexto

El taller tiene mala señal: la app tiene que seguir andando sin conexión y lo que se cargue no se puede perder. Hay un usuario y un dataset chico. El brief estimaba "unos pocos miles de filas, bastante menos de un megabyte", y la medición lo corrige (ADR 0009): un año de datos son unas 2.400 filas del libro, y `bootstrap()` las devuelve en 1,2 MB de JSON, 96 KB comprimidos. Diez años son 10 MB, 950 KB comprimidos.

## Decisión

**Réplica completa, sin motor de sincronización.** El cliente guarda una copia entera del household en el cache persistido y la mantiene al día con dos funciones: `bootstrap()`, que trae todo, y `delta(cursor)`, que trae lo cambiado. PowerSync, ElectricSQL y Zero son la respuesta correcta para replicar en parte un dataset grande a muchos clientes; acá agregarían un servicio externo, sus reglas de sync y un SQLite en el navegador para un problema que no existe. **Se reevalúa si `bootstrap()` pasa de 1 MB comprimido o de 500 ms en la base (al ritmo estimado, a los diez años), o si aparece más de un escritor concurrente.**

**Los ids los genera el cliente.** UUIDv7, en el navegador, cuando el usuario toca guardar. La fila queda completa y referenciable estando offline, sin ids temporales que haya que reconciliar después. UUIDv7 es ordenado por tiempo, así que los inserts caen al final del índice. Postgres 17 no trae `uuidv7()` (llega en 18): el default de las columnas `id` es `private.uuidv7()`, una función propia, y es solo la red de seguridad.

**Metadatos que pone la base.** `updated_at` y `version` los mantiene `private.mantener_metadatos()`, nunca el cliente, que no tiene grant sobre esas columnas. `id` y `household_id` son inmutables. El `household_id` tampoco lo manda el cliente: su default es el household de la sesión, que sale de `household_members`.

**Cola de salida.** Toda mutación entra primero a una cola persistida en IndexedDB, se aplica de forma optimista al cache y se drena cuando vuelve la conexión. Se apoya en las mutaciones pausadas de TanStack Query, con `networkMode: 'online'` para las mutaciones (ADR 0005) y cada `mutationFn` registrada con `setMutationDefaults`.

- **Las liquidaciones también se aplican al cache**, con la distribución que calculó la app, y la cola las drena en orden.
- El motivo: el tope de fijos es mensual (ADR 0011). Si el cache no contara las liquidaciones pendientes, un segundo cobro del mismo mes hecho sin señal saldría con un acumulado viejo y rebotaría con `MN006`.

**La forma de cada mutación.**

- **Alta:** upsert de la fila completa por id (`insert ... on conflict (id) do update`). Si la respuesta se perdió y se reenvía, cae en la rama update con los mismos valores y no hace nada.
- **Edición:** `update ... where id = X` con **solo las columnas que cambió el usuario**, nunca la fila entera. Si el servidor cambió otra columna en el medio (una liquidación cambió el estado, otro dispositivo editó las notas), el reenvío no la pisa ni choca contra ella. `ajustes` solo se edita: no tiene alta desde el cliente.
- **Baja:** `update ... set deleted_at = T where id = X`, con `T` fijado **al encolar**, no al ejecutar. Borrar otra vez algo ya borrado conserva la primera marca y no hace nada.

**Idempotencia.** Drenar la cola dos veces no hace nada: un update que no cambia ningún valor no toca `updated_at` ni `version`, así que tampoco genera un delta. Las guardas de negocio también dejan pasar el reenvío idéntico de algo ya aplicado.

`cobrar_proyecto`, `cerrar_perdido`, `reabrir_proyecto` y `reactivar_perdido` reconocen su propio reenvío: la versión subió exactamente uno y los datos coinciden, y devuelven el proyecto sin rechazar. Si después de la operación hubo otra edición, el reintento rebota con `MN001`, que es verdad. Está probado en `supabase/tests/03_integridad.sql`, `07_cobro.sql` y `11_perdido.sql`.

**Borrados lógicos.** `deleted_at` en toda tabla, y no hay grant de `delete` para el cliente. `delta()` devuelve también las filas borradas para que el cliente las saque de su copia. Un borrado físico sería invisible para un cliente que estuvo desconectado y le dejaría la fila para siempre. Borrar un proyecto borra sus pagos y gastos con la misma marca de tiempo.

**Marca de agua con solape, más reconcile completo.** La trampa: si el cursor es un timestamp, una transacción que escribió antes del cursor pero commiteó después no aparece en ese delta, y el siguiente la saltea para siempre. Se mitiga con dos cosas:

- El cursor lo pone el servidor (`now()` de la consulta), y `delta()` pide desde **cinco minutos antes** del cursor. El solape lo aplica la base, así que el cliente no lo puede olvidar. `updated_at` se marca con `clock_timestamp()`, lo más cerca posible del commit. Las filas repetidas por el solape el cliente las descarta comparando `version`.
- Cada tanto (al iniciar sesión y una vez por día) el cliente hace un **reconcile completo**: llama a `bootstrap()` y reemplaza su copia. Cubre lo que el delta no puede ver: borrados físicos (como el del seed), cambios de membresía y cualquier fila que se haya escapado de la ventana. Hoy cuesta unos 100 KB por día. Cuando se cruce el umbral de arriba, el reconcile pasa a checksums: una función devuelve, por tabla, la cantidad de filas y un hash de los pares `(id, version)`, y el cliente vuelve a pedir solo las tablas que no coinciden.

La alternativa de un contador asignado en el commit es más exacta, pero pide un secuenciador serializado o leer el LSN, y a esta escala no rinde.

**Conflictos.**

- **Por defecto, gana la última escritura**, y es una decisión, no un descuido: hay un solo usuario, y lo peor que pasa es que una edición de texto pise a otra.
- **Para lo que toca plata, no alcanza.** Liquidar un proyecto (cobrarlo o cerrarlo como perdido) congela su distribución (ADR 0003) y se hace con `cobrar_proyecto` o `cerrar_perdido`. Las dos reciben la `version` que vio el cliente, los totales, los topes, la fecha y la distribución que calculó. Si algo de eso no coincide con la base, la escritura se rechaza y se le avisa al usuario (ADR 0011):
  - con `MN006` si lo que difiere son los datos, incluido un tope que cambió porque otra liquidación del mismo mes llegó antes, o el diezmo de un perdido que cambió en los ajustes;
  - con `MN008` si lo que difiere es la distribución.

  Reabrir y reactivar funcionan igual con la versión.

- **Una vez liquidado, el proyecto queda cerrado.** Sus pagos y gastos no se pueden crear, editar, mover ni borrar, y el proyecto no cambia de estado editándolo. Tampoco se borra si tiene pagos o gastos vivos. Si una mutación encolada offline llega después de la liquidación, la base la rechaza. Perder un cobro por una reconexión no es aceptable: preferimos un rechazo visible a una distribución desfasada.
- **Los locks.** La guarda de pagos y gastos bloquea el proyecto (`for share`) antes de mirar su estado. `private.liquidar` lo bloquea con `for update` como primera sentencia, y después la fila de `ajustes` del household.
  - Un pago y una liquidación simultáneos se esperan: el pago ve el proyecto ya liquidado y se rechaza, o la liquidación ve el pago y lo suma.
  - Dos liquidaciones del mismo household también se esperan, así que la segunda suma el mes con la primera adentro.
  - `packages/db/tests/concurrencia.test.ts` prueba con conexiones reales que cada lado espera al otro. La rama commiteada no se prueba contra la base real, porque exigiría commitear en producción (ADR 0011).

**Rechazos de negocio con código propio.** La base rechaza con SQLSTATE de la clase `MN`. La cola no reintenta esos rechazos ni el `42501`: se los muestra al usuario y saca la mutación de la cola. Todo lo demás (red, timeouts, 5xx) se reintenta.

| Código  | Significa                                                                                                                                                                                                                                     |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MN001` | El proyecto está liquidado (cobrado o perdido): sus pagos y gastos no se tocan, su estado no cambia editándolo y, si tiene pagos o gastos, no se borra. El hint dice cómo seguir.                                                             |
| `MN002` | El proyecto está borrado: no le entran pagos ni gastos y no revive. Si llega al reenviar algo que la baja en cascada ya se llevó, la mutación quedó superada.                                                                                 |
| `MN003` | El cliente tiene proyectos vivos: no se puede borrar.                                                                                                                                                                                         |
| `MN004` | Se intentó cambiar el `id` o el `household_id` de una fila.                                                                                                                                                                                   |
| `MN005` | El cliente está borrado: no se le crean ni se le reasignan proyectos.                                                                                                                                                                         |
| `MN006` | La versión del proyecto, el total cobrado, el de gastos, los topes, la fecha o el diezmo de un perdido no son los que vio el usuario, por ejemplo porque otra liquidación del mismo mes llegó antes: la app vuelve a mostrar la distribución. |
| `MN007` | Transición de estado inválida, o liquidar o revertir desde un estado que no corresponde.                                                                                                                                                      |
| `MN008` | La distribución que calculó la app no es la que calcula la base: la app está desactualizada y tiene que recargarse.                                                                                                                           |
| `42501` | El usuario no tiene household asignado, o no tiene permiso.                                                                                                                                                                                   |

**La UI no miente.** Tres estados, visibles y siempre correctos: sin conexión, N cambios pendientes, sincronizado. Nunca "guardado" para algo que está en la cola.

## Alternativas descartadas

- **PowerSync, ElectricSQL, Zero.** Ver arriba: resuelven un problema de escala que acá no existe, a cambio de un servicio y una cuenta más.
- **Ids generados por la base.** Una fila creada offline no tendría id hasta volver la red, y habría que reconciliar ids temporales en todas las referencias.
- **Borrado físico.** Invisible para el delta.
- **Solo marca de agua, sin reconcile.** Deja sin cubrir los borrados físicos y los cambios de visibilidad.
