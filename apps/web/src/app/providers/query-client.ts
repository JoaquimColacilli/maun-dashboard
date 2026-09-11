import { QueryClient } from '@tanstack/react-query';

import { registrarMutacionesPersistibles } from './mutaciones-persistibles';

export const DURACION_CACHE_MS = 7 * 24 * 60 * 60 * 1000;

export const VERSION_CACHE = '1';

export function crearQueryClient(): QueryClient {
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
