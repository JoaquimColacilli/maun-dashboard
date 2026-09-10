import { Outlet } from 'react-router';

import { AvisoActualizacion } from './AvisoActualizacion';
import { IndicadorSync } from './IndicadorSync';

export function Shell() {
  return (
    <>
      <Outlet />
      <IndicadorSync />
      <AvisoActualizacion />
    </>
  );
}
