import { useQuery } from '@tanstack/react-query';

import {
  debeReintentarse,
  encuestaCompartida,
  rechazoDeLaBase,
  SIN_PERMISO,
  type EncuestaCompartida,
} from '@/shared/api';

export const RAIZ_DE_LA_ENCUESTA_COMPARTIDA = 'encuesta-compartida';

export const NO_SIRVE = 'MN010';

const REINTENTOS = 3;

export function claveDeLaEncuestaCompartida(token: string): readonly unknown[] {
  return [RAIZ_DE_LA_ENCUESTA_COMPARTIDA, token];
}

export function laEncuestaNoSirve(error: unknown): boolean {
  const rechazo = rechazoDeLaBase(error);
  return rechazo?.codigo === NO_SIRVE || rechazo?.codigo === SIN_PERMISO;
}

export type ResultadoDeLaEncuesta =
  | { estado: 'cargando' }
  | { estado: 'sin-senal' }
  | { estado: 'muerto' }
  | { estado: 'error'; reintentar: () => void }
  | { estado: 'lista'; encuesta: EncuestaCompartida; releer: () => void };

export function useEncuestaCompartida(token: string): ResultadoDeLaEncuesta {
  const consulta = useQuery({
    queryKey: claveDeLaEncuestaCompartida(token),
    queryFn: () => encuestaCompartida(token),
    staleTime: 0,
    retry: (intentos, error) => intentos < REINTENTOS && debeReintentarse(error),
  });
  const releer = () => {
    void consulta.refetch();
  };

  if (consulta.data !== undefined) {
    return { estado: 'lista', encuesta: consulta.data, releer };
  }
  if (consulta.error !== null && laEncuestaNoSirve(consulta.error)) return { estado: 'muerto' };
  if (consulta.isPaused) return { estado: 'sin-senal' };
  if (consulta.isPending) return { estado: 'cargando' };
  return { estado: 'error', reintentar: releer };
}
