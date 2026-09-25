import { vistaDelCliente, type TrabajoDelCliente, type VistaDelCliente } from '@maun/domain';
import { useQuery } from '@tanstack/react-query';

import {
  debeReintentarse,
  rechazoDeLaBase,
  SIN_PERMISO,
  vistaCompartida as traerCompartida,
  vistaDelCliente as traerDelTrabajo,
} from '@/shared/api';
import { hoyEnElTaller } from '@/shared/lib';

export const RAIZ_DE_LA_VISTA = 'vista-del-cliente';

const REINTENTOS = 3;

export const NO_SIRVE = 'MN010';

export function claveDeLaVistaDelTrabajo(proyectoId: string): readonly unknown[] {
  return [RAIZ_DE_LA_VISTA, 'trabajo', proyectoId];
}

export function claveDeLaVistaCompartida(token: string): readonly unknown[] {
  return [RAIZ_DE_LA_VISTA, 'enlace', token];
}

export function elEnlaceNoSirve(error: unknown): boolean {
  const rechazo = rechazoDeLaBase(error);
  return rechazo?.codigo === NO_SIRVE || rechazo?.codigo === SIN_PERMISO;
}

export type ResultadoDeLaVista =
  | { estado: 'cargando' }
  | { estado: 'sin-senal' }
  | { estado: 'muerto' }
  | { estado: 'error'; reintentar: () => void }
  | { estado: 'lista'; vista: VistaDelCliente };

function resultado(
  consulta: {
    data: TrabajoDelCliente | undefined;
    error: unknown;
    isPending: boolean;
    isPaused: boolean;
    refetch: () => void;
  },
  hoy: string,
): ResultadoDeLaVista {
  if (consulta.data !== undefined) {
    return { estado: 'lista', vista: vistaDelCliente(consulta.data, hoy) };
  }
  if (consulta.error !== null && elEnlaceNoSirve(consulta.error)) return { estado: 'muerto' };
  if (consulta.isPaused) return { estado: 'sin-senal' };
  if (consulta.isPending) return { estado: 'cargando' };
  return {
    estado: 'error',
    reintentar: () => {
      consulta.refetch();
    },
  };
}

export function useVistaDelTrabajo(proyectoId: string): ResultadoDeLaVista {
  const consulta = useQuery({
    queryKey: claveDeLaVistaDelTrabajo(proyectoId),
    queryFn: () => traerDelTrabajo(proyectoId),
    staleTime: 0,
    retry: (intentos, error) => intentos < REINTENTOS && debeReintentarse(error),
  });
  return resultado(consulta, hoyEnElTaller());
}

export function useVistaCompartida(token: string): ResultadoDeLaVista {
  const consulta = useQuery({
    queryKey: claveDeLaVistaCompartida(token),
    queryFn: () => traerCompartida(token),
    staleTime: 0,
    retry: (intentos, error) => intentos < REINTENTOS && debeReintentarse(error),
  });
  return resultado(consulta, hoyEnElTaller());
}
