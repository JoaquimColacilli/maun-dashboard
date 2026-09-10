# @maun/ui

Sistema de diseño portado desde `design-reference/`. Los tokens, la escala tipográfica, el espaciado y los estados ya están resueltos ahí: se portan, no se reinventan.

## Frontera

`@maun/ui` no importa nada del monorepo (ni la app, ni `domain`, ni `db`), ni librerías de datos (`@supabase/*`, `@tanstack/*`), ni router. Lo impone ESLint. Los datos entran por props y las acciones salen por callbacks. Los componentes que conocen el dominio (`TesoroCard`, `DistribucionDespiece`, `EntregaBadge`, `ClienteCombobox`, `BottomNav`) no van acá: van en `apps/web/src/entities` o en `features`.

## Tokens (Tailwind 4, CSS-first)

La única fuente es `src/styles/theme.css`, portado 1:1 de `design-reference/src/styles/tokens.css` con los mismos nombres de variables:

- `@theme static`: los tokens cuyo nombre ya es un namespace de Tailwind (`--color-*`, `--text-*`, `--radius-*`, `--shadow-*`, `--leading-*`, `--font-*`, `--ease-*`). Generan utilidades (`bg-ink`, `text-text-2`, `text-money-lg`, `rounded-panel`, `shadow-float`) y quedan siempre como variables CSS.
- `@theme inline static`: alias de Tailwind a variables de `:root` (`bg-hogar`, `bg-hogar-tint`, `h-button`, `min-h-tap`, `max-w-content`).
- `:root`: el resto de los tokens con su nombre original (`--tesoro-hogar`, `--dur-fast`, `--page-pad-mobile`), para que el markup de los `.dc.html` se porte sin cambios.

Los colores, tamaños de texto, radios y sombras por defecto de Tailwind están reseteados: `bg-blue-500` o `text-sm` no existen. No hay hex sueltos en componentes. Si falta un token, se agrega en `theme.css`. El tema oscuro se agrega redefiniendo las variables en `[data-theme="dark"]`, sin tocar componentes.

La app consume `@maun/ui/theme.css` y `@maun/ui/fonts.css` (IBM Plex Sans 400/500/600 y Young Serif, self-hosted con Fontsource para que funcionen offline). `theme.css` declara `@source '..'`: Tailwind escanea las clases de este paquete desde cualquier app que lo importe.

## Componentes

- Props en inglés, valores en español (`variant="primario"`, `size="chico"`, `cargando`).
- Área táctil mínima de 44px (`--tap-min`), foco visible y estados de carga, vacío y error según `Tokens.dc.html`.
- Imports relativos con extensión (`./Button.tsx`).
- Test con Testing Library al lado del componente.
