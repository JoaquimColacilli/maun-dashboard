import { useCallback } from 'react';
import { matchPath, useLocation, useNavigate, type Location } from 'react-router';

export const HOJAS_POR_RUTA = [
  { patron: '/finanzas/nuevo', fondo: '/finanzas' },
  { patron: '/finanzas/:id', fondo: '/finanzas' },
  { patron: '/seguimiento/nuevo', fondo: '/seguimiento' },
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
  const navegar = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;
  const vieneDeAdentro = fondoDelEstado(location.state) !== undefined;

  return useCallback(() => {
    if (vieneDeAdentro) {
      void navegar(-1);
      return;
    }
    void navegar(fondoPorDefecto(pathname) ?? '/', { replace: true });
  }, [navegar, pathname, vieneDeAdentro]);
}
