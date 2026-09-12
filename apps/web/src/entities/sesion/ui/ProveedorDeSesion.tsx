import type { ReactNode } from 'react';

import { ContextoDeSesion, type SesionActiva } from '../model/contexto';

export function ProveedorDeSesion({
  sesion,
  children,
}: {
  sesion: SesionActiva;
  children: ReactNode;
}) {
  return <ContextoDeSesion value={sesion}>{children}</ContextoDeSesion>;
}
