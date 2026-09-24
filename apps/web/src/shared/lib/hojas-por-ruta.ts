import { matchPath } from 'react-router';

export const HOJAS_POR_RUTA = [
  { patron: '/finanzas/nuevo', fondo: '/finanzas' },
  { patron: '/finanzas/:id', fondo: '/finanzas' },
  { patron: '/consultas/nueva', fondo: '/consultas' },
  { patron: '/agenda/anotar', fondo: '/agenda' },
] as const;

export type PatronDeHoja = (typeof HOJAS_POR_RUTA)[number]['patron'];

export function fondoPorDefecto(ruta: string): string | undefined {
  const pathname = ruta.split(/[?#]/)[0] ?? ruta;
  return HOJAS_POR_RUTA.find((hoja) => matchPath(hoja.patron, pathname) !== null)?.fondo;
}

export function esRutaDeHoja(ruta: string): boolean {
  return fondoPorDefecto(ruta) !== undefined;
}
