# @maun/db

Tipos generados de Postgres (`src/database.types.ts`) y `crearClienteMaun`, la factory del cliente de Supabase. Todavía no hay esquema: los tipos son el placeholder vacío con la forma que genera el CLI.

## Supabase CLI

No es una dependencia del repo: el paquete de npm baja un binario en el postinstall en cada instalación, incluidos los deploys de Netlify. Se instala en la máquina:

- Windows: `scoop bucket add supabase https://github.com/supabase/scoop-bucket.git` y `scoop install supabase`
- macOS/Linux: `brew install supabase/tap/supabase`

Versión fijada: **2.117.0**, la que generó `supabase/config.toml`. No hay CI que la imponga: mantené la local en esa versión (`supabase --version`, `scoop update supabase`) y, si se sube, actualizá este número en el mismo PR.

Sin CI, antes de pushear cualquier cambio en `supabase/` corré en local `supabase db lint --level warning --fail-on warning` y `supabase test db` (necesitan Docker).

## Esquema y migraciones (ADR 0007)

1. Editá el estado deseado en `supabase/schemas/*.sql`.
2. `supabase db diff -f <nombre_en_snake_case>` genera la migración en `supabase/migrations/`. Revisala, no la edites.
3. `supabase db reset` para aplicarla desde cero con el seed, y `supabase test db` para correr pgTAP.
4. `pnpm --filter @maun/db gen:types` regenera `database.types.ts` (con la base local levantada). Nunca se edita a mano.

Nunca se cambia el esquema desde el SQL Editor del dashboard: `db diff` compara contra los archivos, no contra la base viva. La integración de GitHub de Supabase despliega las migraciones de `main`. El branching por PR requiere plan Pro: no hay entorno de preview.

## RLS (ADR 0004)

- RLS activo en todas las tablas, sin excepción, con aislamiento por `household_id`.
- `(select auth.uid())`, nunca `auth.uid()` suelto.
- Helpers `security definer stable` en el schema `private`, que la API no expone. Pertenencia: `household_id in (select private.user_household_ids())`.
- Índice sobre toda columna que aparezca en una policy. Cada policy nombra sus roles en `to`.
- Roles en `app_metadata` o en una tabla, nunca en `user_metadata`.
- Vistas sobre tablas protegidas con `security_invoker = true`.
- Cada policy tiene su test pgTAP, incluido el caso deslogueado.

## Convenciones de SQL

- Plata en `bigint` con sufijo `_centavos`. Nada de `numeric` ni `float` para importes.
- `comment on table` y `comment on column` para todo lo que no sea obvio: es metadata real de la base.
- `supabase-js` devuelve `bigint` como `number` y los tipos generados lo tipan así: la conversión a `Money` se hace acá, en un solo lugar, al leer y al escribir.
