import type { QueryClient } from '@tanstack/react-query';

import {
  CLAVE_DE_AJUSTES,
  CLAVE_DEL_NOMBRE,
  MUTACION_DE_AJUSTES,
  MUTACION_DEL_NOMBRE,
} from '@/features/configurar-taller';
import { CLAVE_DE_MOVIMIENTO, MUTACION_DE_MOVIMIENTO } from '@/features/registrar-movimiento';

type RegistroDeMutacion = (queryClient: QueryClient) => void;

const mutacionesPersistibles: readonly RegistroDeMutacion[] = [
  (queryClient) => {
    queryClient.setMutationDefaults(CLAVE_DE_MOVIMIENTO, MUTACION_DE_MOVIMIENTO);
  },
  (queryClient) => {
    queryClient.setMutationDefaults(CLAVE_DE_AJUSTES, MUTACION_DE_AJUSTES);
  },
  (queryClient) => {
    queryClient.setMutationDefaults(CLAVE_DEL_NOMBRE, MUTACION_DEL_NOMBRE);
  },
];

export function registrarMutacionesPersistibles(queryClient: QueryClient): void {
  for (const registrar of mutacionesPersistibles) registrar(queryClient);
}
