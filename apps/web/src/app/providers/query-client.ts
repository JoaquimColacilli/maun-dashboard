import { onlineManager, QueryClient } from '@tanstack/react-query';

import { registrarMutacionesPersistibles } from './mutaciones-persistibles';

export const DURACION_CACHE_MS = 7 * 24 * 60 * 60 * 1000;

export const VERSION_CACHE = '2';

// onlineManager arranca en `true` fijo y solo cambia con los eventos online/offline de window:
// nunca lee navigator.onLine (verificado en query-core 5.102.8). Abrir la app con el celular ya en
// modo avión —la mañana en el taller— la dejaba creyendo que hay red: el indicador decía
// "sincronizando" en vez de "sin conexión", y las mutaciones salían a fallar en vez de quedar en
// cola. Sembrarlo al arrancar es lo único que falta; los eventos lo mantienen al día después.
export function sembrarEstadoDeConexion(): void {
  onlineManager.setOnline(navigator.onLine);
}

export function crearQueryClient(): QueryClient {
  sembrarEstadoDeConexion();

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        networkMode: 'offlineFirst',
        gcTime: DURACION_CACHE_MS,
        staleTime: 60 * 1000,
      },
      mutations: {
        networkMode: 'online',
      },
    },
  });
  registrarMutacionesPersistibles(queryClient);
  return queryClient;
}
