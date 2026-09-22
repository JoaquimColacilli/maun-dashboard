import { onlineManager, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import {
  buscarVersionNueva,
  calcularEstadoSync,
  claveDeReplica,
  reanudarCola,
  type EstadoSync,
} from '@/shared/lib';

export const TOPE_DE_LA_SINCRONIZACION_MS = 10_000;

export type DesenlaceDeLaSincronizacion =
  | { tipo: 'estado'; estado: EstadoSync }
  | { tipo: 'fallo'; error: unknown }
  | { tipo: 'sin-respuesta' };

function estadoDeLaCola(queryClient: QueryClient): EstadoSync {
  return calcularEstadoSync(
    onlineManager.isOnline(),
    queryClient.isMutating(),
    queryClient.getMutationCache().findAll({ status: 'error' }).length,
  );
}

export async function sincronizarAhora(
  queryClient: QueryClient,
  usuarioId: string,
  tope = TOPE_DE_LA_SINCRONIZACION_MS,
): Promise<DesenlaceDeLaSincronizacion> {
  onlineManager.setOnline(navigator.onLine);
  if (!onlineManager.isOnline()) return { tipo: 'estado', estado: estadoDeLaCola(queryClient) };

  const clave = claveDeReplica(usuarioId);
  let reloj: ReturnType<typeof setTimeout> | undefined;
  const vencida = new Promise<'vencida'>((resolver) => {
    reloj = setTimeout(() => {
      resolver('vencida');
    }, tope);
  });
  const trabajo = Promise.all([
    reanudarCola(queryClient),
    queryClient.refetchQueries({ queryKey: clave, exact: true }, { throwOnError: true }),
  ]).then(
    () => 'hecha' as const,
    (error: unknown) => ({ error }),
  );

  try {
    const final = await Promise.race([trabajo, vencida]);
    if (final === 'vencida') {
      const sigueTrayendo = queryClient.isFetching({ queryKey: clave, exact: true }) > 0;
      return onlineManager.isOnline() && sigueTrayendo
        ? { tipo: 'sin-respuesta' }
        : { tipo: 'estado', estado: estadoDeLaCola(queryClient) };
    }
    if (final !== 'hecha' && onlineManager.isOnline()) return { tipo: 'fallo', error: final.error };
    return { tipo: 'estado', estado: estadoDeLaCola(queryClient) };
  } finally {
    clearTimeout(reloj);
  }
}

export function useSincronizarAhora(usuarioId: string): () => Promise<DesenlaceDeLaSincronizacion> {
  const queryClient = useQueryClient();
  return useCallback(() => {
    void buscarVersionNueva();
    return sincronizarAhora(queryClient, usuarioId);
  }, [queryClient, usuarioId]);
}
