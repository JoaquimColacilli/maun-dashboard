# 0004. RLS en todas las tablas, aislamiento por household

Estado: aceptada, 2026-09-10.

## Contexto

La app habla con Postgres a través de la API de Supabase usando la publishable key, que viaja en el bundle del navegador. La única barrera real entre un usuario y los datos de otro es Row Level Security. Hoy hay un solo usuario, pero agregar aislamiento cuando ya hay datos cuesta mucho más que diseñarlo desde el principio.

## Decisión

RLS activo en todas las tablas, sin excepción, con aislamiento por `household_id` desde el día uno. Reglas:

- Las funciones de auth van envueltas en subquery: `(select auth.uid())`. Así Postgres las evalúa una vez, como initPlan, y no por fila.
- Las funciones helper son `security definer stable` y viven en un schema que la API no expone (`private`), no en `public`.
- La pertenencia se chequea con `household_id in (select private.user_household_ids())`, no con un `exists` que dispare la RLS de la tabla del join.
- Hay un índice sobre toda columna que aparezca en una policy.
- Cada policy nombra sus roles en la cláusula `to`.
- El caso deslogueado está contemplado: `auth.uid()` es null y null nunca matchea.
- Los roles van en `app_metadata` o en una tabla, jamás en `user_metadata`, que el usuario puede editar.
- Las vistas sobre tablas protegidas usan `security_invoker = true`.

## Alternativas descartadas

- **Aislamiento solo en el cliente o en funciones.** La publishable key es pública: cualquiera puede hablarle a la API sin pasar por nuestro código.
- **Una base o un schema por usuario.** Multiplica migraciones y operación para un caso que RLS resuelve.
- **Postergar `household_id` hasta que haya un segundo usuario.** Obligaría a migrar datos y reescribir cada policy.

## Consecuencias

- Toda tabla nueva llega con su policy, sus índices y su test pgTAP, que incluye el caso deslogueado y el de otro household.
- Las consultas pagan el costo de RLS. Por eso importan el initPlan y los índices.
- No hay CI: `supabase db lint` y `supabase test db` se corren en local antes de pushear cualquier cambio en `supabase/`.
