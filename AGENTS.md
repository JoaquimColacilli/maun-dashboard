# MAUN dashboard

App de finanzas y proyectos de un taller de muebles a medida en Argentina. Reemplaza un HTML con localStorage. La usa una sola persona, desde la PC del taller y desde el celular con mala señal: es offline-first. Un usuario hoy, pero el aislamiento multi-tenant por `household_id` existe desde el día uno.

## Estructura

| Carpeta           | Qué es                                                                 |
| ----------------- | ---------------------------------------------------------------------- |
| `apps/web`        | React + Vite + Tailwind 4, PWA. Feature-Sliced Design en cuatro capas. |
| `packages/domain` | Lógica de negocio pura: Money, cascada, estados. Cero dependencias.    |
| `packages/db`     | Tipos generados de Postgres y factory del cliente de Supabase.         |
| `packages/ui`     | Sistema de diseño: tokens y componentes. No importa nada del monorepo. |
| `packages/config` | tsconfig y ESLint compartidos.                                         |
| `supabase/`       | Proyecto del CLI. Esquema declarativo en `supabase/schemas/`.          |
| `docs/adr/`       | Decisiones de arquitectura. Leé el ADR antes de reabrir una decisión.  |

Las dependencias van en una sola dirección: `apps/web` usa `ui`, `domain` y `db`; `db` puede usar `domain`; `ui` y `domain` no usan nada del monorepo. Cada paquete tiene su `CLAUDE.md` con las reglas locales: el más cercano al archivo que editás es el que manda.

## Comandos (desde la raíz)

```sh
pnpm install
pnpm dev                          # levanta apps/web
pnpm verify                       # turbo: lint, typecheck, test y build (obligatorio antes de pushear)
pnpm e2e                          # Playwright (una vez: pnpm --filter @maun/web exec playwright install chromium)
pnpm format                       # prettier --write
pnpm --filter @maun/<paquete> <script>
```

## Reglas que valen en todo el repo

- Plata: `bigint` en centavos con el tipo `Money`. Nunca `number` con decimales ni float (ADR 0002).
- TypeScript estricto. `any`, `@ts-ignore` y `eslint-disable` para esquivar una frontera no se aceptan: si una regla estorba, se discute con un ADR.
- No hay CI: el repo es privado y no usa GitHub Actions. `pnpm verify` es la verificación obligatoria antes de pushear.
- Las fronteras entre paquetes y entre capas las aplica ESLint y hacen fallar `pnpm verify`. No son una sugerencia.
- Versiones de dependencias solo en el catalog de `pnpm-workspace.yaml`; los `package.json` usan `catalog:`.
- Sin comentarios explicativos en el código TypeScript. El porqué va a un ADR o al PR. Los `comment on` de SQL sí van: son metadata de la base.
- El esquema de la base se cambia en `supabase/schemas/` y se genera la migración con `supabase db diff`. Nunca se edita `supabase/migrations/` a mano ni se toca el esquema desde el dashboard (ADR 0007).
- En el cliente solo existen `VITE_SUPABASE_URL` y la publishable key. La secret key y la service_role no entran al repo ni al bundle.

## Git

- Los agentes no commitean ni pushean salvo que el usuario lo pida; si no lo pide, dejan los comandos listos para que los corra él. Cuando lo pide: nunca sobre `main` (se trabaja en una rama `feature/NN-descripcion` y el PR se abre a mano), con la identidad ya configurada en git (sin `--author`) y con `pnpm verify` en verde antes del push.
- `git add` por ruta explícita, archivo por archivo. Nunca `git add .`, `-A` ni `-p`.
- Commits atómicos. Mensaje de una línea, en minúscula, en español simple, sin prefijos tipo `feat:`, sin trailers (`Co-Authored-By`, "generated with", "assisted by") y sin mencionar a una IA.
- El pre-commit corre lint-staged solo sobre lo staged y no modifica ni agrega archivos: si falla, corré `pnpm format` o arreglá el lint y volvé a agregar esos archivos.
