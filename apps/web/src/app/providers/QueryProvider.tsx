import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useState, type ReactNode } from 'react';

import { crearPersisterIndexedDb } from './persister';
import { crearQueryClient, DURACION_CACHE_MS, VERSION_CACHE } from './query-client';

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(crearQueryClient);
  const [persister] = useState(crearPersisterIndexedDb);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: DURACION_CACHE_MS, buster: VERSION_CACHE }}
      onSuccess={() => queryClient.resumePausedMutations()}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
