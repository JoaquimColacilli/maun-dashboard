# 0006. Feature-Sliced Design acotado a cuatro capas

Estado: aceptada, 2026-09-10.

## Contexto

`apps/web` va a crecer por pantallas (Seguimiento, Proyectos, Clientes, Finanzas, Diezmo, Ajustes) que comparten entidades: proyecto, cliente, movimiento y tesoro. Sin una regla de dirección, las pantallas se importan entre sí y cada cambio toca todo.

## Decisión

En `src/`, FSD con dependencias solo hacia abajo:

| Capa        | Contenido                                                                          |
| ----------- | ---------------------------------------------------------------------------------- |
| `app/`      | Arranque, providers, router, query client y el layout del shell.                   |
| `pages/`    | Una carpeta por ruta. Son finas: componen features y entidades.                    |
| `features/` | Acciones del usuario: `cobrar-proyecto`, `registrar-movimiento`, `convertir-lead`. |
| `entities/` | Modelo, api y tarjetas de cada entidad.                                            |
| `shared/`   | `config`, `lib`, `ui` (el re-export de `@maun/ui`) y `api`.                        |

Cada slice expone su API pública en un `index.ts` y nadie importa por adentro. Un slice no importa a otro de su misma capa. No hay `widgets` ni `processes`: es más ceremonia de la que este proyecto sostiene.

El mecanismo de cumplimiento es el linter, no este documento. `eslint-plugin-boundaries` (regla `boundaries/dependencies`) hace fallar `pnpm verify` si se importa hacia arriba, entre slices de la misma capa o por un archivo interno. `no-restricted-imports` además obliga a que `@maun/ui` se use solo desde `shared/ui` y Supabase solo desde `shared/api`.

## Alternativas descartadas

- **Carpetas por tipo (`components/`, `hooks/`, `services/`).** No dicen quién puede depender de quién.
- **FSD completo, con `widgets` y `processes`.** Suma dos capas de decisiones que acá no tienen contenido.
- **Solo la convención, sin linter.** Se rompe en el primer apuro.

## Consecuencias

- Algo que usan dos features baja a `entities` o a `shared`; no se importa de costado.
- El estado del servidor vive en TanStack Query, dentro de `entities/*/api`. El resto es estado local de React. No hay state manager global.
