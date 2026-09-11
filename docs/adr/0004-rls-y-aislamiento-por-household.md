# 0004. RLS en todas las tablas, aislamiento por household

Estado: aceptada, 2026-09-10.

## Contexto

La app habla con Postgres a través de la API de Supabase usando la publishable key, que viaja en el bundle del navegador. La única barrera real entre un usuario y los datos de otro es Row Level Security. Hoy hay un solo usuario, pero agregar aislamiento cuando ya hay datos cuesta mucho más que diseñarlo desde el principio.

## Decisión

RLS activo en todas las tablas, sin excepción, con aislamiento por `household_id` desde el día uno. Reglas:

- Las funciones de auth van envueltas en subquery: `(select auth.uid())`. Así Postgres las evalúa una vez, como initPlan, y no por fila.
- Las funciones helper son `security definer stable` y viven en un schema que la API no expone (`private`), no en `public`.
- La pertenencia se chequea con `household_id = any (array(select private.user_household_ids()))`, no con un `exists` que dispare la RLS de la tabla del join. Corregido en la fase 2A: la versión original decía `household_id in (select ...)`. En una policy, ese `in (subconsulta)` queda como un filtro de hash que Postgres no puede usar como condición de índice, y cada consulta lee las filas de todos los households. El array se calcula una vez por consulta y `= any` sí entra en el índice. Lo verifica `supabase/tests/06_planes.sql` con `explain` bajo RLS.
- Hay un índice sobre toda columna que aparezca en una policy.
- Cada policy nombra sus roles en la cláusula `to`.
- El caso deslogueado está contemplado: `auth.uid()` es null y null nunca matchea.
- Los roles van en `app_metadata` o en una tabla, jamás en `user_metadata`, que el usuario puede editar.
- Las vistas sobre tablas protegidas usan `security_invoker = true`.

Agregado en la fase 2A (2026-09-11):

- **Grants explícitos, por columna.** El proyecto tiene apagado "Automatically expose new tables": ninguna tabla sale por la API sin su `grant`. `anon` no tiene ninguno. `authenticated` tiene `select` y `insert`/`update` solo sobre las columnas que el usuario escribe: nunca `household_id`, `created_at`, `updated_at`, `version` ni la distribución congelada. No hay `delete` para nadie: los borrados son lógicos. Postgres da `execute` a `public` en toda función nueva, así que cada migración lo revoca y lo concede solo a quien lo necesita.
- **Un household activo por usuario** (índice único parcial en `household_members`). El household de la sesión no es ambiguo y es el default de `household_id` en todas las tablas: el cliente nunca lo manda. Si hace falta que alguien vea dos talleres, se levanta el índice y se revisa `private.household_actual()`.
- **Las hijas llevan `household_id` y una foreign key compuesta** `(household_id, padre_id)` hacia `(household_id, id)` del padre. Garantiza que el household de un pago coincida con el de su proyecto sin depender de un trigger, y cierra el canal lateral de una foreign key simple, que dejaría averiguar si existe el id de un proyecto ajeno.
- Los households y las membresías se crean con `private.crear_household()`, que solo ejecuta el dueño de la base.

## Alternativas descartadas

- **Aislamiento solo en el cliente o en funciones.** La publishable key es pública: cualquiera puede hablarle a la API sin pasar por nuestro código.
- **Una base o un schema por usuario.** Multiplica migraciones y operación para un caso que RLS resuelve.
- **Postergar `household_id` hasta que haya un segundo usuario.** Obligaría a migrar datos y reescribir cada policy.

## Consecuencias

- Toda tabla nueva llega con su policy, sus índices y su test pgTAP, que incluye el caso deslogueado y el de otro household.
- Las consultas pagan el costo de RLS. Por eso importan el initPlan y los índices.
- No hay CI. La suite de pgTAP corre dentro de `pnpm verify` con el runner de `packages/db`, contra la base real y siempre en rollback (ADR 0008). `supabase/tests/00_estructura.sql` exige RLS, policies, grants e índices para toda tabla de `public`, incluidas las que se agreguen después.
