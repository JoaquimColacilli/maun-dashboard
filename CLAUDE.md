@AGENTS.md

## Para Claude

- Antes de tocar un paquete, leé su `CLAUDE.md`: `apps/web`, `packages/domain`, `packages/db`, `packages/ui`.
- No hay CI. `pnpm verify` (lint, typecheck, test y build de todo el workspace) es el paso obligatorio antes de pushear: un cambio está terminado solo cuando pasa en verde. Si tocaste la app, además `pnpm e2e`.
- `design-reference/` es material de consulta local (ignorado por git): se lee, nunca se modifica ni se importa.
- No levantes Supabase local (`supabase start`) salvo que la tarea sea de base de datos: necesita Docker.
- Versiones de paquetes: consultá el registry (`pnpm view <pkg> version`), no las supongas. pnpm aplica `minimumReleaseAge` de un día: una versión publicada hace horas no instala.
