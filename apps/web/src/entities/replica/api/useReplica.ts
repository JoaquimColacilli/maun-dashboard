import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';

import { debeReintentarse, sincronizar, type Replica } from '@/shared/api';
import { claveDeReplica } from '@/shared/lib';

const REINTENTOS = 3;

export function useReplica(usuarioId: string): UseQueryResult<Replica> {
  const queryClient = useQueryClient();
  const clave = claveDeReplica(usuarioId);

  return useQuery({
    queryKey: clave,
    queryFn: () =>
      sincronizar({
        leerReplica: () => queryClient.getQueryData<Replica>(clave),
        usuarioId,
        ahora: Date.now(),
        hayPendientes: queryClient.getMutationCache().findAll({ status: 'pending' }).length > 0,
      }),
    retry: (intentos, error) => intentos < REINTENTOS && debeReintentarse(error),
  });
}
