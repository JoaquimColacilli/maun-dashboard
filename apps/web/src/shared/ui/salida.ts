import { createContext, useContext } from 'react';

export interface Salida {
  saliendo: boolean;
  alTerminar: () => void;
  despuesDeSalir: (accion: () => void) => void;
}

export const ContextoDeSalida = createContext<Salida | null>(null);

export const RESPALDO_DE_LA_SALIDA_MS = 400;

export function useSalida(): Salida | null {
  return useContext(ContextoDeSalida);
}
