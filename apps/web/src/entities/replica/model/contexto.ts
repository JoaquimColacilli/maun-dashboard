import { createContext, use } from 'react';

import type { Replica } from '@/shared/api';

export const ContextoDeReplica = createContext<Replica | undefined>(undefined);

export function useReplicaDelTaller(): Replica {
  const replica = use(ContextoDeReplica);
  if (!replica) {
    throw new Error('Falta ProveedorDeReplica: las pantallas del taller se montan adentro suyo.');
  }
  return replica;
}
