import { RouterProvider } from 'react-router/dom';

import { esUnaPaginaPublica } from '@/shared/lib';

import type { Coordinador } from './navegacion/coordinador';
import { ContextoDelCoordinador } from './navegacion/contexto';
import { ProveedorPublico } from './providers/ProveedorPublico';
import { QueryProvider } from './providers/QueryProvider';
import type { RouterDeLaApp } from './router/router';

export interface AppProps {
  router: RouterDeLaApp;
  coordinador: Coordinador;
}

export function App({ router, coordinador }: AppProps) {
  if (esUnaPaginaPublica(globalThis.location.pathname)) {
    return (
      <ProveedorPublico>
        <RouterProvider router={router} />
      </ProveedorPublico>
    );
  }

  return (
    <QueryProvider>
      <ContextoDelCoordinador value={coordinador}>
        <RouterProvider router={router} />
      </ContextoDelCoordinador>
    </QueryProvider>
  );
}
