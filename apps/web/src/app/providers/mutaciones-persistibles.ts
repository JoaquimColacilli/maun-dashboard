import type { QueryClient } from '@tanstack/react-query';

import { CLAVE_DE_MOVIMIENTO, MUTACION_DE_MOVIMIENTO } from '@/features/registrar-movimiento';

type RegistroDeMutacion = (queryClient: QueryClient) => void;

const mutacionesPersistibles: readonly RegistroDeMutacion[] = [
  (queryClient) => {
    queryClient.setMutationDefaults(CLAVE_DE_MOVIMIENTO, MUTACION_DE_MOVIMIENTO);
  },
];

export function registrarMutacionesPersistibles(queryClient: QueryClient): void {
  for (const registrar of mutacionesPersistibles) registrar(queryClient);
}
