# @maun/db

Tipos generados de Postgres (`src/database.types.ts`), `crearClienteMaun` (la factory del cliente de Supabase) y las herramientas de base en `scripts/`: el runner de pgTAP, el ensayo de migraciones, el snapshot del esquema, la generación de tipos y el seed.

## Supabase CLI

No es una dependencia del repo: el paquete de npm baja un binario en el postinstall en cada instalación, incluidos los deploys de Netlify. Se instala en la máquina:

- Windows: `scoop bucket add supabase https://github.com/supabase/scoop-bucket.git` y `scoop install supabase`
- macOS/Linux: `brew install supabase/tap/supabase`

Versión fijada: **2.117.0**. No hay CI que la imponga: mantené la local en esa versión (`supabase --version`) y, si se sube, actualizá este número en el mismo PR.

**No hay Docker** (ADR 0008). Andan `db push`, `migration list`, `gen types --linked` y `db lint --linked`: entran con un rol de login temporal, sin contraseña. No andan `start`, `db diff`, `db pull`, `db reset`, `db dump` ni `test db`.

**El CLI se corre con `pnpm --filter @maun/db sb <comando>`** (por ejemplo `sb db push`, `sb migration list --linked`, `sb db advisors --linked`). El wrapper carga `SUPABASE_ACCESS_TOKEN` de `supabase/.env` en el entorno del proceso: la sesión global de la máquina se pisa con otra cuenta y no se usa. Si aparece un 403, el token del repo dejó de valer: avisale al usuario.

## Un solo proyecto, y es producción

- Los tests corren siempre en una transacción que termina en rollback. Lo garantiza el runner: un archivo de `supabase/tests/` no puede tener `begin`, `commit` ni `rollback`.
- El seed vive en el household `5eed0000-0000-7000-8000-000000000001`. `db:seed` lo carga (y antes lo borra), `db:seed:borrar` lo borra. Nada de `truncate` ni de `delete` sin `where`.
- **Antes de aplicar una migración destructiva sobre una tabla con datos, se frena y se consulta al dueño.** Destructiva: `drop`, renombrar, achicar un tipo o un enum, agregar `not null` o `check` a una columna existente, `update` o `delete` de datos.

## Cambiar el esquema

1. Escribí una migración nueva en `supabase/migrations/<AAAAMMDDhhmmss>_<nombre>.sql`. Chica y legible: nadie la genera, así que la revisión del SQL es la red. Una migración aplicada no se edita nunca.
2. Toda tabla nueva llega con RLS, sus policies (roles en `to`), grants explícitos por columna, el trigger `private.mantener_metadatos()`, `household_id`, un índice `(household_id, updated_at)`, índices para sus foreign keys y sus tests. `00_estructura.sql` falla si falta algo de eso. Si la tabla es sincronizable, sumala a `bootstrap()`, `delta()` y a `tables_are` en ese mismo test.
3. `pnpm --filter @maun/db db:ensayo` aplica las migraciones pendientes, corre toda la suite de pgTAP y compara `@maun/domain` contra sus gemelas de SQL (`scripts/comparacion.ts`), todo en una transacción contra la base real que termina en rollback. Corre con `node --conditions=@maun/source` para leer el dominio desde su código fuente. Tiene dos variantes:
   - **`-- --seed`** carga también el seed antes de los tests.
   - **`-- --recargar-seed`** borra el seed antes de migrar y lo recarga después, y verifica cada liquidación del seed contra el dominio. Es el ensayo de la secuencia `db:seed:borrar` → `db push` → `db:seed`, la que se usa cuando una migración agrega invariantes que el seed viejo no cumple. Esa secuencia solo vale mientras no haya más datos que el seed.
4. `pnpm --filter @maun/db sb db push`.
5. `pnpm --filter @maun/db gen:types` y `pnpm --filter @maun/db db:esquema`. Commiteá `src/database.types.ts` y `supabase/esquema.sql`: ninguno de los dos se edita a mano.
6. `pnpm --filter @maun/db sb db advisors --linked` y `pnpm verify`.

`supabase/esquema.sql` es la vista del estado final del esquema. `tests/esquema.test.ts` lo compara contra la base viva: si falla, o faltó el paso 5 o alguien cambió la base por fuera del repo. Nunca se toca el esquema desde el SQL Editor del dashboard.

## Tests de Vitest que tocan la base

- `tests/pgtap.test.ts`: la suite de pgTAP, un archivo por transacción, siempre en rollback.
- `tests/esquema.test.ts`: `supabase/esquema.sql` contra la base viva.
- `tests/dominio-vs-sql.test.ts`: la misma comparación que corre el ensayo (`scripts/comparacion.ts`), ahora contra la base ya migrada, todo en rollback. Cubre:
  - la cascada, los topes, los rangos, los estados, las transiciones, las liquidaciones y las reversiones;
  - las liquidaciones reales paso a paso, calculadas como las calcula la app;
  - cada liquidación del seed.
- `tests/concurrencia.test.ts`: conexiones reales, y todo lo que escriben termina en rollback. Prueban que:
  - la liquidación toma `for update` sobre el proyecto antes de leer pagos o gastos;
  - la guarda de un pago espera a la liquidación;
  - dos liquidaciones del mismo household se esperan en la fila de ajustes;
  - una liquidación espera a una edición de los ajustes.

  Cada test falla si falta el lock que prueba. Usan proyectos del seed (`5eed…020002` entregado, `5eed…020011` en contacto) como datos commiteados que las sesiones ven. Solo corren contra migraciones ya aplicadas: otra sesión no ve DDL sin commitear.

## Conexión

Los scripts y los tests se conectan con `pg` al pooler (`supabase/.temp/pooler-url`, lo escribe `supabase link`) usando `SUPABASE_DB_PASSWORD` de `supabase/.env`, que está en el `.gitignore`. `SUPABASE_DB_URL` en el entorno la reemplaza entera. Sin eso, `pnpm verify` falla con un mensaje que dice qué falta.

## RLS (ADR 0004)

- RLS activo en todas las tablas, sin excepción, con aislamiento por `household_id`.
- `(select auth.uid())`, nunca `auth.uid()` suelto.
- Helpers `security definer stable` en el schema `private`, que la API no expone. Pertenencia: `household_id = any (array(select private.user_household_ids()))`. No `in (select ...)`: en una policy no entra en el índice (`06_planes.sql` lo verifica).
- El `household_id` lo pone el default `private.household_actual()`: el cliente no tiene grant sobre esa columna.
- Índice sobre toda columna que aparezca en una policy. Cada policy nombra sus roles en `to`.
- Roles en `app_metadata` o en una tabla, nunca en `user_metadata`.
- Vistas sobre tablas protegidas con `security_invoker = true`.
- Postgres da `execute` a `public` en toda función nueva: revocalo en la misma migración.

## Convenciones de SQL

- Plata en `bigint` con sufijo `_centavos`. Nada de `numeric` ni `float` para importes.
- `comment on table` y `comment on column` para todo lo que no sea obvio: es metadata real de la base.
- Un `check` que evalúa a null pasa. Si la condición puede dar null, envolvela en `coalesce(..., false)`.
- Los cuerpos de función van entre `$$`, no con `begin atomic`: el runner busca `begin`, `commit` y `rollback` sueltos, y el `end` de un `begin atomic` lo confundiría.
- Ninguna migración ni el seed controlan la transacción: el ensayo los corre todos en la suya y los rechaza si traen `begin` o `commit`.
- El ensayo corre todas las migraciones pendientes en una sola transacción: agregar un valor a un enum y usarlo en una migración posterior falla en el ensayo aunque `db push` ande. En ese caso, ensayá en dos tandas.
- Una guarda que lee otra fila para decidir (el proyecto de un pago, el cliente de un proyecto, los ajustes de una liquidación) la bloquea antes de leerla: sin eso, una operación concurrente pasa con el estado viejo. La liquidación bloquea el proyecto y después los ajustes, en ese orden.
- Rechazos de negocio con SQLSTATE de la clase `MN` (tabla en ADR 0010). Si el usuario puede hacer algo para destrabarlo, el `hint` lo dice: la app lo muestra.
- `supabase-js` devuelve `bigint` como `number` y los tipos generados lo tipan así: la conversión a `Money` (entero con brand, ADR 0002) se hace acá, en un solo lugar.
