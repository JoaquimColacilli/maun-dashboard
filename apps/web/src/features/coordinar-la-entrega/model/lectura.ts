import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { MUTACION_DE_LECTURA_DE_ENTREGA, type FilaDeRespuestaDeEntrega } from '@/entities/entrega';
import { useReplicaDelTaller } from '@/entities/replica';
import { filasDe } from '@/shared/api';
import { metaDeAvisos } from '@/shared/lib';

export function marcarLeida(
  cliente: QueryClient,
  respuesta: FilaDeRespuestaDeEntrega,
  momento: string = new Date().toISOString(),
): boolean {
  if (respuesta.leida_at !== null) return false;
  void cliente
    .getMutationCache()
    .build(cliente, {
      ...MUTACION_DE_LECTURA_DE_ENTREGA,
      meta: metaDeAvisos('respuestaDeEntregaLeida', { silencioso: true }),
    })
    .execute({ respuesta, momento })
    .catch(() => undefined);
  return true;
}

export function useLeerLasRespuestasDeEntrega(proyectoId: string): void {
  const cliente = useQueryClient();
  const replica = useReplicaDelTaller();
  const pedidas = useRef(new Set<string>());

  useEffect(() => {
    const momento = new Date().toISOString();
    for (const respuesta of filasDe(replica, 'respuestas_de_entrega')) {
      if (respuesta.proyecto_id !== proyectoId || pedidas.current.has(respuesta.id)) continue;
      if (marcarLeida(cliente, respuesta, momento)) pedidas.current.add(respuesta.id);
    }
  }, [cliente, replica, proyectoId]);
}
