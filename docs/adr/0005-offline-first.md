# 0005. PWA offline-first con cache persistido

Estado: aceptada, 2026-09-10. Tiene un punto abierto sobre mutaciones (ver Consecuencias).

## Contexto

El taller tiene mala señal y el dueño carga pagos y gastos desde el celular en el momento. La app vieja funcionaba sin red porque todo vivía en localStorage. La nueva no puede ser peor en eso.

## Decisión

- La app es una PWA instalable con `vite-plugin-pwa` (`generateSW`). El service worker precachea el shell: HTML, JS, CSS, fuentes e íconos. Los datos no pasan por el service worker.
- El cache de TanStack Query se persiste en IndexedDB (`idb-keyval`, structured clone) con `PersistQueryClientProvider`. Al restaurarlo se llama a `resumePausedMutations()`.
- `networkMode: 'offlineFirst'` por defecto, en queries y en mutaciones.
- Mutaciones en cola: cada mutación que pueda quedar pendiente tiene su `mutationKey` y registra su `mutationFn` con `queryClient.setMutationDefaults()` al arrancar, en `app/providers/mutaciones-persistibles.ts`. Al persistir se serializa el estado de la mutación, no la función: sin el default registrado, `resumePausedMutations()` falla con "No mutationFn found".
- La UI muestra siempre el estado real: sin conexión, cambios pendientes o sincronizado. Nunca dice que guardó algo que está en cola.
- El service worker se actualiza con `registerType: 'prompt'`: la app avisa y el usuario decide cuándo recargar, para no cortar un formulario a medio cargar.

## Alternativas descartadas

- **Sin persistencia.** Cada apertura sin señal sería una pantalla vacía.
- **Persister JSON** (localStorage o el serializador por defecto de `query-async-storage-persister`). JSON no serializa `bigint` (ADR 0002), y localStorage es síncrono y chico.
- **Cachear la API de Supabase en el service worker.** Duplica el cache de TanStack Query, se desincroniza y puede servir datos de otra sesión.
- **Base local sincronizada** (PowerSync, ElectricSQL, PouchDB). Resuelve conflictos entre varios dispositivos, pero es mucha infraestructura para un solo usuario.
- **`autoUpdate` del service worker.** Recarga sola y puede cortar un formulario.

## Consecuencias

- Si cambia la forma de los datos persistidos, se sube `VERSION_CACHE` (el `buster`) y se descarta el cache viejo.
- El `gcTime` de las queries tiene que ser igual o mayor que el `maxAge` del persister (7 días). Si es menor, las queries se borran antes de persistirse.
- No hay resolución de conflictos entre dispositivos: gana la última escritura. Con un solo usuario se acepta; si aparecen conflictos reales, se decide en un ADR nuevo.
- **Punto abierto**, verificado en el código de `@tanstack/query-core` 5.102.8:
  - Con `networkMode: 'offlineFirst'`, una mutación se ejecuta aunque no haya red, porque `canFetch` devuelve `true` para todo modo que no sea `'online'`.
  - Como el `retry` por defecto de las mutaciones es 0, esa mutación falla en vez de quedar en pausa: solo se pausan los reintentos.
  - Para que una mutación quede en cola sin señal, hay que darle `networkMode: 'online'` o reintentos.
  - Se decide con la primera mutación real de la fase 2, junto con un test que simule la falta de red.
