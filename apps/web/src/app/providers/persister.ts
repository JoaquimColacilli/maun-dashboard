import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client';
import { createStore, del, get, set } from 'idb-keyval';

const CLAVE = 'cache';

export function crearPersisterIndexedDb(): Persister {
  const store = createStore('maun', 'react-query');
  return {
    persistClient: (cliente: PersistedClient) => set(CLAVE, cliente, store),
    restoreClient: () => get<PersistedClient>(CLAVE, store),
    removeClient: () => del(CLAVE, store),
  };
}
