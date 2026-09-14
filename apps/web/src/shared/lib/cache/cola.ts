import type { MutationScope, QueryClient } from '@tanstack/react-query';

export const COLA_DE_SALIDA: MutationScope = { id: 'salida' };

export function esPersistible(estado: { status: string }): boolean {
  return estado.status === 'pending';
}

const sinImportar = () => undefined;

export async function reanudarCola(queryClient: QueryClient): Promise<void> {
  const enVuelo = queryClient
    .getMutationCache()
    .getAll()
    .filter((mutacion) => mutacion.state.status === 'pending' && !mutacion.state.isPaused)
    .map((mutacion) => mutacion.continue().catch(sinImportar));
  await Promise.all([...enVuelo, queryClient.resumePausedMutations()]);
}
