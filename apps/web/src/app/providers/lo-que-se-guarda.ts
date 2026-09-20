import { defaultShouldDehydrateQuery } from '@tanstack/react-query';
import type { PersistedQueryClientSaveOptions } from '@tanstack/react-query-persist-client';

import { RAIZ_DE_LA_VISTA } from '@/entities/vista-cliente';
import { esPersistible } from '@/shared/lib';

export function esVistaDelCliente(clave: readonly unknown[]): boolean {
  return clave[0] === RAIZ_DE_LA_VISTA;
}

export const OPCIONES_DE_DESHIDRATACION: PersistedQueryClientSaveOptions['dehydrateOptions'] = {
  shouldDehydrateMutation: (mutacion) => esPersistible(mutacion.state),
  shouldDehydrateQuery: (query) =>
    !esVistaDelCliente(query.queryKey) && defaultShouldDehydrateQuery(query),
};
