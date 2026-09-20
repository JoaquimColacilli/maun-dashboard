import { onlineManager, QueryClient } from '@tanstack/react-query';

import { CLAVE_DE_AVISOS } from '@/shared/lib';

import { registrarMutacionesPersistibles } from './mutaciones-persistibles';

export const DURACION_CACHE_MS = 7 * 24 * 60 * 60 * 1000;

export const VERSION_CACHE = '3';

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

  queryClient.setQueryDefaults(CLAVE_DE_AVISOS, {
    gcTime: Infinity,
    staleTime: Infinity,
  });

  registrarMutacionesPersistibles(queryClient);
  return queryClient;
}

export function crearQueryClientPublico(): QueryClient {
  sembrarEstadoDeConexion();

  return new QueryClient({
    defaultOptions: {
      queries: {
        networkMode: 'offlineFirst',
        gcTime: 0,
        staleTime: 0,
      },
    },
  });
}
