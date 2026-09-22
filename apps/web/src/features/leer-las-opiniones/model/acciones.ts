import type { QueryClient } from '@tanstack/react-query';

import { MUTACION_DE_LECTURA, type FilaDeRespuesta } from '@/entities/opinion';
import { metaDeAvisos } from '@/shared/lib';

export function marcarLeida(
  cliente: QueryClient,
  respuesta: FilaDeRespuesta,
  momento: string = new Date().toISOString(),
): boolean {
  if (respuesta.leida_at !== null) return false;
  void cliente
    .getMutationCache()
    .build(cliente, {
      ...MUTACION_DE_LECTURA,
      meta: metaDeAvisos('opinionLeida', { silencioso: true }),
    })
    .execute({ respuesta, momento })
    .catch(() => undefined);
  return true;
}
