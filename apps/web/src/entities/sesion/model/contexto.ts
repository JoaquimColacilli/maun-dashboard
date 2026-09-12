import { createContext, useContext } from 'react';

export interface SesionActiva {
  usuarioId: string;
  email: string;
  nombre: string;
}

export const ContextoDeSesion = createContext<SesionActiva | undefined>(undefined);

export function useSesionActiva(): SesionActiva {
  const sesion = useContext(ContextoDeSesion);
  if (!sesion) {
    throw new Error('useSesionActiva solo se usa adentro de una ruta con sesión.');
  }
  return sesion;
}
