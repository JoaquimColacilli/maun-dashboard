import type { QueryClient } from '@tanstack/react-query';

import { borrarCacheLocal } from './persister';

// Todo final de sesión pasa por acá, no solo el botón: una sesión que se muere sola (refresh token
// revocado, contraseña cambiada desde otro lado) dejaba en el disco la copia entera del taller y
// una cola que el usuario siguiente reejecutaba con su propio household.
export async function limpiarDatosLocales(queryClient: QueryClient): Promise<void> {
  queryClient.getMutationCache().clear();
  queryClient.clear();
  await borrarCacheLocal();
}
