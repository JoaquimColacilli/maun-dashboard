# 0007. Esquema declarativo y migraciones generadas

Estado: **reemplazada** por [0008](0008-migraciones-a-mano-sin-docker.md) el 2026-09-11. El flujo declarativo necesita una shadow database en Docker, y en esta máquina no hay Docker.

## Contexto

Leer el estado actual de una base a partir de decenas de migraciones es lento y propenso a errores. Pero las migraciones son lo que efectivamente se aplicó en cada entorno, y eso no se puede perder.

## Decisión

- `supabase/schemas/*.sql` describe el estado final deseado: tablas, enums, constraints, vistas, policies y helpers. Es el lugar donde se lee el esquema completo.
- Las migraciones versionadas en `supabase/migrations/` se generan con `supabase db diff` a partir de esos archivos. Siguen siendo el registro de verdad de lo aplicado.
- Nunca se edita a mano nada en `supabase/migrations/`.
- Nunca se hacen cambios desde el SQL Editor del dashboard: `db diff` compara contra los archivos, no contra la base viva, así que un cambio hecho a mano no aparece y se pierde o choca.
- La integración de GitHub de Supabase despliega las migraciones de `main`.

## Alternativas descartadas

- **Migraciones escritas a mano.** No hay un lugar donde leer el estado completo y los errores de orden aparecen en producción.
- **Cambios desde el dashboard.** No quedan versionados y rompen `db diff`.
- **Un ORM que genera el esquema.** Suma una capa entre el SQL y las policies de RLS, que se escriben mejor en SQL directo.

## Consecuencias

- Cada cambio de esquema es un par: el archivo declarativo y la migración generada, revisados juntos en el PR.
- Hay casos que `db diff` no captura bien, como renombres o migraciones de datos. Esos se escriben como migración explícita y se documentan en el PR.
- El branching con entorno de preview por PR requiere plan Pro. Hasta entonces, las migraciones se validan en local (`supabase db lint`, `supabase test db`) antes de llegar a `main`: no hay CI.
