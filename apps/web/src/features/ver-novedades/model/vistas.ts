import { claimsGuardados } from '@/shared/api';

import { NOVEDADES, type Novedad } from './novedades';
import { novedadesSinVer, versionActual } from './version';

export const CLAVE_DE_LAS_NOVEDADES = 'maun:novedades-vistas';

const HABIA_SESION_AL_ABRIR = claimsGuardados() !== undefined;

export function versionVista(): string | null {
  try {
    return globalThis.localStorage.getItem(CLAVE_DE_LAS_NOVEDADES);
  } catch {
    return null;
  }
}

function anotarVersionVista(version: string): void {
  try {
    globalThis.localStorage.setItem(CLAVE_DE_LAS_NOVEDADES, version);
  } catch {
    return;
  }
}

export function tomarNovedadesSinVer(
  novedades: readonly Novedad[] = NOVEDADES,
): readonly Novedad[] {
  const actual = versionActual(novedades);
  if (actual === '') return [];
  const vista = versionVista();
  if (vista !== actual) anotarVersionVista(actual);
  if (vista === null && !HABIA_SESION_AL_ABRIR) return [];
  return novedadesSinVer(vista, novedades);
}
