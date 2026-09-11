import { onlineManager, useIsMutating, useMutationState } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

import { calcularEstadoSync, type EstadoSync } from './estado-sync';

const suscribir = (avisar: () => void) => onlineManager.subscribe(avisar);
const estaEnLinea = () => onlineManager.isOnline();

export function useEstadoSync(): EstadoSync {
  const enLinea = useSyncExternalStore(suscribir, estaEnLinea, estaEnLinea);
  const pendientes = useIsMutating();
  const rechazados = useMutationState({
    filters: { status: 'error' },
    select: (mutacion) => mutacion.mutationId,
  }).length;

  return calcularEstadoSync(enLinea, pendientes, rechazados);
}
