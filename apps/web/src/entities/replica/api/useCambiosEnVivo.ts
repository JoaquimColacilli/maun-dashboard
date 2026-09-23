import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { escucharLosCambiosDelTaller } from '@/shared/api';
import { claveDeReplica } from '@/shared/lib';

import { crearPedidor } from '../model/pedidor';

export const MINIMO_ENTRE_PEDIDOS_MS = 5_000;

export function useCambiosEnVivo(usuarioId: string, householdId: string | null): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (householdId === null) return undefined;
    const taller = householdId;
    const clave = claveDeReplica(usuarioId);
    const pedidor = crearPedidor({
      traer: () =>
        queryClient.refetchQueries({ queryKey: clave, exact: true }, { cancelRefetch: false }),
      yaTrae: () => queryClient.isFetching({ queryKey: clave, exact: true }) > 0,
      minimoMs: MINIMO_ENTRE_PEDIDOS_MS,
    });
    let dejar: (() => void) | undefined;

    const escuchar = () => {
      dejar ??= escucharLosCambiosDelTaller(taller, {
        alAvisar: pedidor.pedir,
        alConectar: pedidor.pedir,
      });
    };
    const soltar = () => {
      dejar?.();
      dejar = undefined;
    };
    const alCambiarLaVisibilidad = () => {
      if (document.visibilityState === 'hidden') {
        soltar();
        return;
      }
      escuchar();
      pedidor.pedir();
    };
    const alVolverLaSenal = () => {
      pedidor.pedir();
    };

    if (document.visibilityState !== 'hidden') escuchar();
    document.addEventListener('visibilitychange', alCambiarLaVisibilidad);
    globalThis.addEventListener('online', alVolverLaSenal);
    return () => {
      document.removeEventListener('visibilitychange', alCambiarLaVisibilidad);
      globalThis.removeEventListener('online', alVolverLaSenal);
      soltar();
      pedidor.cancelar();
    };
  }, [queryClient, usuarioId, householdId]);
}
