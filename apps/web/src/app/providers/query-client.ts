import { onlineManager, QueryClient } from '@tanstack/react-query';

import { CLAVE_DE_AVISOS } from '@/shared/lib';

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

  // La bandeja de avisos no es cache de nada: es el registro de lo que la base rechazó y de las
  // liquidaciones que volvieron ajustadas, y se vacía cuando el usuario lo descarta. Sin el gcTime
  // infinito, el recolector se la lleva en cuanto ninguna pantalla la está mirando (ADR 0016).
  queryClient.setQueryDefaults(CLAVE_DE_AVISOS, {
    gcTime: Infinity,
    staleTime: Infinity,
  });

  registrarMutacionesPersistibles(queryClient);
  return queryClient;
}
