import { useSyncExternalStore } from 'react';

import type { EstadoSesion } from '../model/estado';
import { leerEstadoSesion, suscribirSesion } from '../model/store';

export function useSesion(): EstadoSesion {
  return useSyncExternalStore(suscribirSesion, leerEstadoSesion, leerEstadoSesion);
}
