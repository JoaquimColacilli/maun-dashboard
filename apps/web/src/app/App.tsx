import { RouterProvider } from 'react-router/dom';

import { esLaVistaPublica } from '@/shared/lib';

import { ProveedorPublico } from './providers/ProveedorPublico';
import { QueryProvider } from './providers/QueryProvider';
import { router } from './router/router';

export function App() {
  if (esLaVistaPublica(globalThis.location.pathname)) {
    return (
      <ProveedorPublico>
        <RouterProvider router={router} />
      </ProveedorPublico>
    );
  }

  return (
    <QueryProvider>
      <RouterProvider router={router} />
    </QueryProvider>
  );
}
