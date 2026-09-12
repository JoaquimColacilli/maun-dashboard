import type { ReactNode } from 'react';

import type { Replica } from '@/shared/api';

import { ContextoDeReplica } from '../model/contexto';

export function ProveedorDeReplica({
  replica,
  children,
}: {
  replica: Replica;
  children: ReactNode;
}) {
  return <ContextoDeReplica value={replica}>{children}</ContextoDeReplica>;
}
