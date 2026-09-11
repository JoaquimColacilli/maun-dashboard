import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client';
import { clear, createStore, del, get, set, type UseStore } from 'idb-keyval';

const BASE = 'maun';
const ALMACEN = 'react-query';
const CLAVE = 'cache';

let almacen: UseStore | undefined;

function store(): UseStore {
  almacen ??= createStore(BASE, ALMACEN);
  return almacen;
}

export function crearPersisterIndexedDb(): Persister {
  return {
    persistClient: (cliente: PersistedClient) => set(CLAVE, cliente, store()),
    restoreClient: () => get<PersistedClient>(CLAVE, store()),
    removeClient: () => del(CLAVE, store()),
  };
}

export async function borrarCacheLocal(): Promise<void> {
  await clear(store());
}
