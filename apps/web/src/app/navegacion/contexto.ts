import { createContext, useContext } from 'react';

import type { Coordinador } from './coordinador';

export const ContextoDelCoordinador = createContext<Coordinador | null>(null);

export function useCoordinador(): Coordinador | null {
  return useContext(ContextoDelCoordinador);
}
