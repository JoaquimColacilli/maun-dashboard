import type { QueryClient } from '@tanstack/react-query';

import { olvidarLosTokens } from '../enlaces';
import { olvidarBloqueo } from '../huella';
import { borrarCacheLocal } from './persister';

export async function limpiarDatosLocales(queryClient: QueryClient): Promise<void> {
  olvidarBloqueo();
  olvidarLosTokens();
  queryClient.getMutationCache().clear();
  queryClient.clear();
  await borrarCacheLocal();
}
