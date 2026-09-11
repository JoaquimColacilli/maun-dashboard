# 0005. PWA offline-first con cache persistido

Estado: aceptada, 2026-09-10. Corregida el 2026-09-11: el `networkMode` de las mutaciones es `'online'`, no `'offlineFirst'` (ver Decisión). La sincronización se detalla en el ADR 0010.

## Contexto

El taller tiene mala señal y el dueño carga pagos y gastos desde el celular en el momento. La app vieja funcionaba sin red porque todo vivía en localStorage. La nueva no puede ser peor en eso.

## Decisión

- La app es una PWA instalable con `vite-plugin-pwa` (`generateSW`). El service worker precachea el shell: HTML, JS, CSS, fuentes e íconos. Los datos no pasan por el service worker.
- El cache de TanStack Query se persiste en IndexedDB (`idb-keyval`, structured clone) con `PersistQueryClientProvider`. Al restaurarlo se llama a `resumePausedMutations()`.
- `networkMode: 'offlineFirst'` para las queries: sin red, sirven lo que hay en el cache en vez de quedar esperando.
- `networkMode: 'online'` para las mutaciones. Verificado en el código de `@tanstack/query-core` 5.102.8: con `'offlineFirst'`, una mutación se ejecuta aunque no haya red, porque `canFetch` devuelve `true` para todo modo que no sea `'online'`. Como el `retry` por defecto de las mutaciones es 0, esa mutación falla en vez de quedar en pausa. Con `'online'`, sin red la mutación queda pausada, se persiste y se reanuda al volver la conexión.
- Mutaciones en cola: cada mutación que pueda quedar pendiente tiene su `mutationKey` y registra su `mutationFn` con `queryClient.setMutationDefaults()` al arrancar, en `app/providers/mutaciones-persistibles.ts`. Al persistir se serializa el estado de la mutación, no la función: sin el default registrado, `resumePausedMutations()` falla con "No mutationFn found".
- La UI muestra siempre el estado real: sin conexión, cambios pendientes o sincronizado. Nunca dice que guardó algo que está en cola.
- El service worker se actualiza con `registerType: 'prompt'`: la app avisa y el usuario decide cuándo recargar, para no cortar un formulario a medio cargar.

## Alternativas descartadas

- **Sin persistencia.** Cada apertura sin señal sería una pantalla vacía.
- **Persister JSON en localStorage.** localStorage es síncrono, chico (unos 5 MB) y bloquea el hilo principal al escribir. IndexedDB con structured clone no tiene esos límites.
- **Cachear la API de Supabase en el service worker.** Duplica el cache de TanStack Query, se desincroniza y puede servir datos de otra sesión.
- **Base local sincronizada** (PowerSync, ElectricSQL, PouchDB). Resuelve conflictos entre varios dispositivos, pero es mucha infraestructura para un solo usuario.
- **`autoUpdate` del service worker.** Recarga sola y puede cortar un formulario.

## Consecuencias

- Si cambia la forma de los datos persistidos, se sube `VERSION_CACHE` (el `buster`) y se descarta el cache viejo.
- El `gcTime` de las queries tiene que ser igual o mayor que el `maxAge` del persister (7 días). Si es menor, las queries se borran antes de persistirse.
- Conflictos: gana la última escritura, salvo en lo que toca plata, donde la base rechaza la escritura si la fila cambió desde la versión que vio el cliente (ADR 0010).
- La primera mutación real de la fase 2C llega con un test que simula la falta de red y verifica que queda en pausa, sobrevive a cerrar y reabrir la app, y se aplica al volver la conexión.
- Corrección del 2026-09-11: el brief de la fase 1 pedía `'offlineFirst'` también para las mutaciones. Estaba mal, por lo verificado en query-core que se cuenta arriba.
