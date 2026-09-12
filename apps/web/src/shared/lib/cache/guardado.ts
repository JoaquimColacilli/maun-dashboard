import {
  persistQueryClientSave,
  type PersistedQueryClientSaveOptions,
} from '@tanstack/react-query-persist-client';

let opciones: PersistedQueryClientSaveOptions | undefined;
let ultimo: Promise<void> = Promise.resolve();

export function registrarGuardado(nuevas: PersistedQueryClientSaveOptions): () => void {
  opciones = nuevas;
  return () => {
    if (opciones === nuevas) opciones = undefined;
  };
}

export function guardarCacheAhora(): Promise<void> {
  const actuales = opciones;
  if (!actuales) return Promise.resolve();

  const guardar = () => persistQueryClientSave(actuales);
  ultimo = ultimo.then(guardar, guardar);
  return ultimo;
}
