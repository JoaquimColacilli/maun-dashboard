import { escucharLosCambios, type OyentesDeLosCambios } from '@maun/db';

import { clienteMaun } from './cliente';

export type { OyentesDeLosCambios };

export function escucharLosCambiosDelTaller(
  householdId: string,
  oyentes: OyentesDeLosCambios,
): () => void {
  return escucharLosCambios(clienteMaun(), householdId, oyentes);
}
