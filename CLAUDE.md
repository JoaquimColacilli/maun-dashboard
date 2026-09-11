@AGENTS.md

## Para Claude

- Antes de tocar un paquete, leé su `CLAUDE.md`: `apps/web`, `packages/domain`, `packages/db`, `packages/ui`.
- No hay CI. `pnpm verify` (lint, typecheck, test y build de todo el workspace) es el paso obligatorio antes de pushear: un cambio está terminado solo cuando pasa en verde. Si tocaste la app, además `pnpm e2e`.
- `design-reference/` es material de consulta local (ignorado por git): se lee, nunca se modifica ni se importa.
- No hay Docker: `supabase start`, `db diff`, `db pull`, `db reset`, `db dump` y `test db` no andan. El flujo de base sin Docker está en `packages/db/CLAUDE.md` (ADR 0008).
- `pnpm verify` corre la suite de pgTAP contra la base real: necesita red y `SUPABASE_DB_PASSWORD` en `supabase/.env`.
- El CLI de Supabase se corre siempre con `pnpm --filter @maun/db sb <comando>`, que carga el token del repo (`SUPABASE_ACCESS_TOKEN` en `supabase/.env`). La sesión global de la máquina es de otra cuenta y no se usa. Si igual aparece un 403, avisale al usuario: el token del repo dejó de valer.
- Versiones de paquetes: consultá el registry (`pnpm view <pkg> version`), no las supongas. pnpm aplica `minimumReleaseAge` de un día: una versión publicada hace horas no instala.
