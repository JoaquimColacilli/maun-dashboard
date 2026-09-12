import { useIsRestoring, type QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useEffect, useState, type ReactNode } from 'react';

import { claveDeTodaReplica } from '@/entities/replica';
import { escucharSesion } from '@/shared/api';
import {
  crearPersisterIndexedDb,
  esPersistible,
  limpiarDatosLocales,
  reanudarCola,
} from '@/shared/lib';
import { Cargando } from '@/shared/ui';

import { crearQueryClient, DURACION_CACHE_MS, VERSION_CACHE } from './query-client';

function hayDatosDeOtroUsuario(queryClient: QueryClient, usuarioId: string): boolean {
  return queryClient
    .getQueryCache()
    .findAll({ queryKey: claveDeTodaReplica() })
    .some((query) => {
      const dueño = query.queryKey[1];
      return typeof dueño === 'string' && dueño !== usuarioId;
    });
}

function useLimpiezaDeSesion(queryClient: QueryClient): void {
  useEffect(
    () =>
      escucharSesion((claims, cambio) => {
        if (cambio === 'cerrada') {
          void limpiarDatosLocales(queryClient);
          return;
        }
        if (claims && hayDatosDeOtroUsuario(queryClient, claims.usuarioId)) {
          void limpiarDatosLocales(queryClient);
        }
      }),
    [queryClient],
  );
}

function EsperandoElCache({ children }: { children: ReactNode }) {
  return useIsRestoring() ? <Cargando que="Abriendo la app" /> : children;
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(crearQueryClient);
  const [persister] = useState(crearPersisterIndexedDb);
  useLimpiezaDeSesion(queryClient);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: DURACION_CACHE_MS,
        buster: VERSION_CACHE,
        dehydrateOptions: {
          shouldDehydrateMutation: (mutacion) => esPersistible(mutacion.state),
        },
      }}
      onSuccess={() => {
        reanudarCola(queryClient);
      }}
    >
      <EsperandoElCache>{children}</EsperandoElCache>
    </PersistQueryClientProvider>
  );
}
