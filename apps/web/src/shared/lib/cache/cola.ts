import type { MutationScope, QueryClient } from '@tanstack/react-query';

export const COLA_DE_SALIDA: MutationScope = { id: 'salida' };

// Solo se persiste lo que está pendiente, pausado o no: una mutación que salió y estaba
// reintentando cuando se cerró la app también es un cambio del usuario que no llegó a la base.
export function esPersistible(estado: { status: string }): boolean {
  return estado.status === 'pending';
}

// Al restaurar, las pausadas las reanuda resumePausedMutations(); las que quedaron a mitad de
// envío no están pausadas y quedarían colgadas, y como comparten scope taparían a las demás.
// Se las continúa primero, para no invertir el orden.
export function reanudarCola(queryClient: QueryClient): void {
  for (const mutacion of queryClient.getMutationCache().getAll()) {
    if (mutacion.state.status === 'pending' && !mutacion.state.isPaused) {
      void mutacion.continue();
    }
  }
  void queryClient.resumePausedMutations();
}
