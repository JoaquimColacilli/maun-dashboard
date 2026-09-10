# @maun/web

React 19, Vite 8 y Tailwind 4, empaquetada como PWA. Hoy tiene el shell (router, TanStack Query con persistencia y PWA) y una pantalla técnica de verificación de tokens en `/`. Todavía no hay pantallas de negocio.

## Capas (FSD, ADR 0006)

```
src/
  main.ts      solo llama a arrancar()
  app/         arranque, providers, router y layout del shell
  pages/       una carpeta por ruta, finas: componen features y entidades
  features/    acciones del usuario (cobrar-proyecto, registrar-movimiento, convertir-lead)
  entities/    modelo, api y tarjetas de cada entidad (proyecto, cliente, movimiento, tesoro)
  shared/      config, lib, ui (re-export de @maun/ui) y api
```

- Solo se importa hacia capas de abajo, y un slice no importa a otro de su misma capa.
- Todo se importa por el `index.ts` del slice: `@/entities/proyecto`, nunca `@/entities/proyecto/model/calculo`.
- Esas dos reglas las impone `boundaries/dependencies` y rompen el lint.
- `@maun/ui` se importa solo desde `shared/ui`; el resto del código usa `@/shared/ui`.
- Supabase (`@maun/db`, `@supabase/supabase-js`) se importa solo desde `shared/api`.
- `@/` apunta a `src/`. Está definido en `tsconfig.app.json` y en `vite.config.ts`: si cambia, cambia en los dos.
- El estado del servidor vive en TanStack Query, dentro de `entities/*/api`. Las query keys llevan ids, nunca montos, porque un `bigint` no se puede hashear. El resto es estado local de React; no hay state manager global.

## Sistema de diseño

- Las pantallas se portan desde `design-reference/*.dc.html`, con el mismo markup y los mismos tokens. Cada pantalla tiene cuatro estados (cargando, vacío, con datos y error) y tres anchos (390, tablet y 1440).
- Solo se usan utilidades de tokens: `bg-ink`, `text-text-2`, `bg-hogar-tint`, `text-money-lg`, `rounded-panel`, `h-button`, `px-(--page-pad-mobile)`. Los colores y tamaños por defecto de Tailwind no existen, y no hay hex sueltos.
- Los componentes de `design-reference/src/components/app` conocen el dominio: van a `entities` o a `features`, no a `packages/ui`.
- `design-reference/src/lib/format.ts` calcula la cascada sobre el presupuesto: no se porta, se usa `@maun/domain`.

## Offline (ADR 0005)

- `app/providers/query-client.ts` configura `networkMode: 'offlineFirst'` y un `gcTime` de 7 días, igual al `maxAge` del persister.
- El cache se persiste en IndexedDB con structured clone (`app/providers/persister.ts`). No lo cambies por un persister JSON: rompe con `bigint`.
- Toda mutación que pueda quedar en cola necesita su propia `mutationKey` y su `mutationFn` registrada en `app/providers/mutaciones-persistibles.ts`. Si no, cuando vuelve la señal, `resumePausedMutations()` falla con "No mutationFn found". Antes de registrar la primera, resolvé el punto abierto de ADR 0005 sobre `networkMode` y `retry` en mutaciones.
- Nunca muestres "guardado" para una mutación en cola. Para el estado real usá `useEstadoSync` y `describirEstadoSync` de `@/shared/lib`.
- Si cambia la forma de los datos persistidos, subí `VERSION_CACHE`.
- El service worker precachea solo el shell: no agregues `runtimeCaching` para la API de Supabase.

## Entorno

- Las variables se validan con zod en `shared/config/env.ts`, al arrancar (`app/arranque.tsx`). Si falta una, la app muestra cuál y no monta.
- Para agregar una variable, sumala en tres lugares: el esquema, `.env.example` y el `env` de las tareas `build` y `e2e` en `turbo.json`. Turbo no les pasa a las tareas las variables que no están declaradas.
- `vite.config.ts` corta el build si una variable `VITE_` parece secreta: su nombre tiene `SECRET` o `SERVICE_ROLE`, o su valor es `sb_secret_...` o un JWT de service_role.

## Tests

- Vitest y Testing Library, al lado del archivo (`*.test.ts[x]`).
- Playwright en `e2e/`, con dos proyectos: celular (390) y escritorio (1440).
  - La primera vez hay que instalar chromium: `pnpm --filter @maun/web exec playwright install chromium`.
  - El dev server necesita `apps/web/.env`.
  - Flujos previstos: login, cargar un proyecto, y cobrarlo y ver la distribución.
