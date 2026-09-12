import type { MutationScope, QueryClient } from '@tanstack/react-query';

export const COLA_DE_SALIDA: MutationScope = { id: 'salida' };

export function esPersistible(estado: { status: string }): boolean {
  return estado.status === 'pending';
}

export function reanudarCola(queryClient: QueryClient): void {
  for (const mutacion of queryClient.getMutationCache().getAll()) {
    if (mutacion.state.status === 'pending' && !mutacion.state.isPaused) {
      void mutacion.continue();
    }
  }
  void queryClient.resumePausedMutations();
}
