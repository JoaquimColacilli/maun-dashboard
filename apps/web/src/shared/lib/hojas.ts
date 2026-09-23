import { useCallback } from 'react';
import { matchPath, useLocation, type Location } from 'react-router';

import { useIr, useVolver } from './puerta';

export const HOJAS_POR_RUTA = [
  { patron: '/finanzas/nuevo', fondo: '/finanzas' },
  { patron: '/finanzas/:id', fondo: '/finanzas' },
  { patron: '/consultas/nueva', fondo: '/consultas' },
  { patron: '/agenda/anotar', fondo: '/agenda' },
] as const;

export type PatronDeHoja = (typeof HOJAS_POR_RUTA)[number]['patron'];

export interface EstadoConFondo {
  fondo: Location;
}

export function fondoPorDefecto(ruta: string): string | undefined {
  const pathname = ruta.split(/[?#]/)[0] ?? ruta;
  return HOJAS_POR_RUTA.find((hoja) => matchPath(hoja.patron, pathname) !== null)?.fondo;
}

export function esRutaDeHoja(ruta: string): boolean {
  return fondoPorDefecto(ruta) !== undefined;
}

export function conFondo(ubicacion: Location): EstadoConFondo {
  return { fondo: ubicacion };
}

export function fondoDelEstado(estado: unknown): Location | undefined {
  if (typeof estado !== 'object' || estado === null || !('fondo' in estado)) return undefined;
  const { fondo } = estado;
  if (typeof fondo !== 'object' || fondo === null || !('pathname' in fondo)) return undefined;
  return typeof fondo.pathname === 'string' ? (fondo as Location) : undefined;
}

export function useUbicacionVisible(): Location {
  const location = useLocation();
  const fondo = fondoDelEstado(location.state);
  if (fondo) return fondo;
  const porDefecto = fondoPorDefecto(location.pathname);
  if (porDefecto === undefined) return location;
  return { ...location, pathname: porDefecto, search: '', hash: '', state: null };
}

export function useCerrarHoja(): () => void {
  const ir = useIr();
  const location = useLocation();
  const fondo = fondoDelEstado(location.state);
  const porDefecto = fondoPorDefecto(location.pathname) ?? '/';
  const { volver } = useVolver(
    fondo === undefined ? porDefecto : `${fondo.pathname}${fondo.search}`,
    '',
  );
  const vieneDeAdentro = fondo !== undefined;

  return useCallback(() => {
    if (vieneDeAdentro) {
      volver();
      return;
    }
    ir(porDefecto, { como: 'reemplazar' });
  }, [ir, porDefecto, vieneDeAdentro, volver]);
}
