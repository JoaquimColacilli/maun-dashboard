import type { ReactNode } from 'react';

import { ContextoDeLaPuerta } from '@/shared/lib';

import { useCoordinador } from './contexto';

export function ProveedorDeLaPuerta({ children }: { children: ReactNode }) {
  const coordinador = useCoordinador();
  if (!coordinador) return children;
  return <ContextoDeLaPuerta value={coordinador}>{children}</ContextoDeLaPuerta>;
}
