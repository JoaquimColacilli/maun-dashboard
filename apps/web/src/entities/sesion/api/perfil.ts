import { useMutationState, type MutationOptions } from '@tanstack/react-query';

import { debeReintentarse, guardarNombreDeLaPersona } from '@/shared/api';
import { COLA_DE_SALIDA, guardarCacheAhora } from '@/shared/lib';

import { useSesionActiva } from '../model/contexto';

export const CLAVE_DEL_PERFIL = ['perfil', 'nombre'] as const;

export const LARGO_MAXIMO_DEL_NOMBRE = 60;

const REINTENTOS = 5;
const DURACION_DEL_RECHAZO_MS = 24 * 60 * 60 * 1000;

export interface CambioDelPerfil {
  nombre: string;
}

export const MUTACION_DEL_PERFIL: MutationOptions<void, unknown, CambioDelPerfil> = {
  mutationKey: CLAVE_DEL_PERFIL,
  mutationFn: ({ nombre }) => guardarNombreDeLaPersona(nombre),
  scope: COLA_DE_SALIDA,
  gcTime: DURACION_DEL_RECHAZO_MS,
  retry: (intentos, error) => intentos < REINTENTOS && debeReintentarse(error),
  onMutate: async () => {
    await guardarCacheAhora();
  },
};

function esCambioDelPerfil(valor: unknown): valor is CambioDelPerfil {
  return (
    typeof valor === 'object' &&
    valor !== null &&
    'nombre' in valor &&
    typeof valor.nombre === 'string'
  );
}

export function useNombreDeLaPersona(): string {
  const { nombre } = useSesionActiva();
  const pendientes = useMutationState({
    filters: { mutationKey: CLAVE_DEL_PERFIL, status: 'pending' },
    select: (mutacion) => mutacion.state.variables,
  });
  return pendientes.findLast(esCambioDelPerfil)?.nombre ?? nombre;
}
