import { useIsRestoring, type QueryClient } from '@tanstack/react-query';
import {
  PersistQueryClientProvider,
  type PersistedQueryClientSaveOptions,
  type Persister,
} from '@tanstack/react-query-persist-client';
import { useEffect, useState, type ReactNode } from 'react';

import { claveDeTodaReplica } from '@/entities/replica';
import { escucharSesion } from '@/shared/api';
import {
  crearPersisterIndexedDb,
  esPersistible,
  guardarCacheAhora,
  limpiarDatosLocales,
  reanudarCola,
  registrarGuardado,
} from '@/shared/lib';
import { Cargando } from '@/shared/ui';

import { crearQueryClient, DURACION_CACHE_MS, VERSION_CACHE } from './query-client';

const OPCIONES_DE_DESHIDRATACION: PersistedQueryClientSaveOptions['dehydrateOptions'] = {
  shouldDehydrateMutation: (mutacion) => esPersistible(mutacion.state),
};

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

function useGuardadoInmediato(queryClient: QueryClient, persister: Persister): void {
  useEffect(() => {
    const olvidar = registrarGuardado({
      queryClient,
      persister,
      buster: VERSION_CACHE,
      dehydrateOptions: OPCIONES_DE_DESHIDRATACION,
    });
    const alIrse = () => {
      void guardarCacheAhora();
    };
    window.addEventListener('pagehide', alIrse);
    document.addEventListener('visibilitychange', alIrse);
    return () => {
      window.removeEventListener('pagehide', alIrse);
      document.removeEventListener('visibilitychange', alIrse);
      olvidar();
    };
  }, [queryClient, persister]);
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(crearQueryClient);
  const [persister] = useState(crearPersisterIndexedDb);
  useLimpiezaDeSesion(queryClient);
  useGuardadoInmediato(queryClient, persister);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: DURACION_CACHE_MS,
        buster: VERSION_CACHE,
        dehydrateOptions: OPCIONES_DE_DESHIDRATACION,
      }}
      onSuccess={() => {
        reanudarCola(queryClient);
      }}
    >
      <EsperandoElCache>{children}</EsperandoElCache>
    </PersistQueryClientProvider>
  );
}
