import { REALTIME_SUBSCRIBE_STATES } from '@supabase/supabase-js';

import type { ClienteMaun } from './cliente.ts';

export const EVENTO_DE_LOS_CAMBIOS = 'cambios';

export function temaDeLosCambios(householdId: string): string {
  return `cambios:${householdId}`;
}

export interface OyentesDeLosCambios {
  alAvisar: () => void;
  alConectar: () => void;
}

export function escucharLosCambios(
  cliente: ClienteMaun,
  householdId: string,
  oyentes: OyentesDeLosCambios,
): () => void {
  const canal = cliente
    .channel(temaDeLosCambios(householdId), { config: { private: true } })
    .on('broadcast', { event: EVENTO_DE_LOS_CAMBIOS }, () => {
      oyentes.alAvisar();
    })
    .subscribe((estado) => {
      if (estado === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) oyentes.alConectar();
    });
  return () => {
    void cliente.removeChannel(canal);
  };
}
