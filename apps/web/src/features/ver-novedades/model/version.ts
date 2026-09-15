import { nombreDelMes } from '@/shared/lib';

import { NOVEDADES, type Novedad } from './novedades';

const FORMATO_DE_LA_VERSION = /^(\d{4})-(\d{2})-(\d{2})(?:\.([2-9]|[1-9]\d+))?$/;

export interface PartesDeLaVersion {
  fecha: string;
  vez: number;
}

export function partesDeLaVersion(version: string): PartesDeLaVersion | null {
  const partes = FORMATO_DE_LA_VERSION.exec(version);
  if (partes === null) return null;
  const [, anio = '', mes = '', dia = '', vez] = partes;
  const fecha = new Date(Date.UTC(Number(anio), Number(mes) - 1, Number(dia)));
  if (
    fecha.getUTCFullYear() !== Number(anio) ||
    fecha.getUTCMonth() !== Number(mes) - 1 ||
    fecha.getUTCDate() !== Number(dia)
  ) {
    return null;
  }
  return { fecha: `${anio}-${mes}-${dia}`, vez: vez === undefined ? 1 : Number(vez) };
}

export function compararVersiones(una: string, otra: string): number {
  const primera = partesDeLaVersion(una);
  const segunda = partesDeLaVersion(otra);
  if (primera === null || segunda === null) return Number.NaN;
  if (primera.fecha !== segunda.fecha) return primera.fecha < segunda.fecha ? -1 : 1;
  return primera.vez - segunda.vez;
}

export function versionActual(novedades: readonly Novedad[] = NOVEDADES): string {
  return novedades[0]?.version ?? '';
}

export function etiquetaDeLaVersion(version: string): string {
  const partes = partesDeLaVersion(version);
  if (partes === null) return 'Versión sin fecha';
  const dia = Number(partes.fecha.slice(8, 10));
  const mes = nombreDelMes(partes.fecha).toLowerCase();
  const anio = partes.fecha.slice(0, 4);
  const vez = partes.vez > 1 ? ` (${String(partes.vez)})` : '';
  return `Versión del ${String(dia)} de ${mes} de ${anio}${vez}`;
}

export function novedadesSinVer(
  vista: string | null,
  novedades: readonly Novedad[] = NOVEDADES,
): readonly Novedad[] {
  const actual = novedades[0];
  if (actual === undefined) return [];
  if (vista === null || partesDeLaVersion(vista) === null) return [actual];
  return novedades.filter((novedad) => compararVersiones(novedad.version, vista) > 0);
}
