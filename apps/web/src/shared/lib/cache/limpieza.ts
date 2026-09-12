import type { QueryClient } from '@tanstack/react-query';

import { borrarCacheLocal } from './persister';

export async function limpiarDatosLocales(queryClient: QueryClient): Promise<void> {
  queryClient.getMutationCache().clear();
  queryClient.clear();
  await borrarCacheLocal();
}
