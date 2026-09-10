# 0001. Monorepo con pnpm workspaces, Turborepo y catalogs

Estado: aceptada, 2026-09-10.

## Contexto

La app reemplaza un HTML de ~880 líneas con todo en localStorage. La regla central del negocio, la cascada que reparte la ganancia de un proyecto cobrado, tiene que dar exactamente lo mismo en dos lugares: en el navegador, como proyección antes de cobrar, y en Postgres, como lo que queda registrado. Dos implementaciones sin nada que las ate se separan con el tiempo. Además, el sistema de diseño tiene que poder evolucionar sin arrastrar la app.

## Decisión

Monorepo con pnpm workspaces y Turborepo:

- `packages/domain`: lógica pura y testeada, que consumen la app y el test que la compara contra la implementación en SQL.
- `packages/ui`: el sistema de diseño. No puede importar la app, y esa dirección de dependencia es la que lo mantiene reusable.
- `packages/db` y `packages/config`: tipos de la base y configuración compartida.
- Versiones compartidas en un único catalog de `pnpm-workspace.yaml` (`catalogMode: strict`), para que React, TypeScript o Vite no drifteen entre paquetes.
- Turborepo orquesta lint, typecheck, test y build con cache local (`pnpm verify`).

## Alternativas descartadas

- **App única con carpetas.** Nada impide que la UI importe de la app ni que el dominio dependa de React: las fronteras quedan como convención escrita.
- **Nx.** Se justifica con varios equipos, generadores o ejecución distribuida. Acá sería más superficie que beneficio.
- **npm o yarn workspaces.** No tienen catalogs. Además, pnpm no deja importar lo que un paquete no declara, y eso ya es una frontera.

## Consecuencias

- Hay que mantener un `package.json` y un `tsconfig` por paquete, con project references entre ellos.
- Todo cambio de versión pasa por el catalog.
- Netlify y cada máquina de desarrollo necesitan un pnpm reciente para el protocolo `catalog:`. Se fija con `packageManager` en el `package.json` raíz.
- Los paquetes exponen su código fuente con la condición `@maun/source`. Vite, Vitest y el editor lo leen sin build previo, y `tsc -b` usa las declaraciones de cada referencia.
