import type { QueryClient } from '@tanstack/react-query';

type DefaultsDeMutacion = Parameters<QueryClient['setMutationDefaults']>;

const mutacionesPersistibles: readonly DefaultsDeMutacion[] = [];

export function registrarMutacionesPersistibles(queryClient: QueryClient): void {
  for (const [mutationKey, opciones] of mutacionesPersistibles) {
    queryClient.setMutationDefaults(mutationKey, opciones);
  }
}
