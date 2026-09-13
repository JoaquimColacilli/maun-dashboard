import { Suspense } from 'react';
import { Outlet } from 'react-router';

import { Cargando } from '@/shared/ui';

import { AvisoActualizacion } from './AvisoActualizacion';

export function Shell() {
  return (
    <>
      <Suspense fallback={<Cargando que="Abriendo la pantalla" />}>
        <Outlet />
      </Suspense>
      <AvisoActualizacion />
    </>
  );
}
