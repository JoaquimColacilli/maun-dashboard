import { describe, expect, it } from 'vitest';

import {
  compararVersiones,
  etiquetaDeLaVersion,
  novedadesSinVer,
  partesDeLaVersion,
  versionActual,
} from './version';

const NOVEDADES = [
  { version: '2026-10-02', lineas: ['La tercera.'] },
  { version: '2026-10-01.2', lineas: ['La segunda, el mismo día que la primera.'] },
  { version: '2026-10-01', lineas: ['La primera.'] },
];

describe('la versión', () => {
  it('es una fecha real, con un número desde la segunda del mismo día', () => {
    expect(partesDeLaVersion('2026-09-15')).toEqual({ fecha: '2026-09-15', vez: 1 });
    expect(partesDeLaVersion('2026-09-15.2')).toEqual({ fecha: '2026-09-15', vez: 2 });
    expect(partesDeLaVersion('2026-09-15.12')).toEqual({ fecha: '2026-09-15', vez: 12 });
    for (const rota of ['2026-02-30', '2026-9-15', '2026-09-15.1', '2026-09-15.02', '1.2.3', '']) {
      expect(partesDeLaVersion(rota), rota).toBeNull();
    }
  });

  it('se lee como la dice cualquiera, y la más nueva es la de fecha más adelante', () => {
    expect(etiquetaDeLaVersion('2026-09-15')).toBe('Versión del 15 de septiembre de 2026');
    expect(etiquetaDeLaVersion('2026-10-01.2')).toBe('Versión del 1 de octubre de 2026 (2)');
    expect(compararVersiones('2026-10-02', '2026-10-01.2')).toBeGreaterThan(0);
    expect(compararVersiones('2026-10-01.2', '2026-10-01')).toBeGreaterThan(0);
    expect(compararVersiones('2026-10-01.10', '2026-10-01.9')).toBeGreaterThan(0);
    expect(compararVersiones('2026-10-01', '2026-10-01')).toBe(0);
  });

  it('la actual es la de la entrada de más arriba', () => {
    expect(versionActual(NOVEDADES)).toBe('2026-10-02');
    expect(versionActual([])).toBe('');
  });
});

describe('lo que falta ver', () => {
  it('sin nada visto, o con algo ilegible, es solo la última', () => {
    expect(novedadesSinVer(null, NOVEDADES).map((novedad) => novedad.version)).toEqual([
      '2026-10-02',
    ]);
    expect(novedadesSinVer('ayer', NOVEDADES).map((novedad) => novedad.version)).toEqual([
      '2026-10-02',
    ]);
  });

  it('con una vieja vista son todas las posteriores, de la más nueva a la más vieja', () => {
    expect(novedadesSinVer('2026-10-01', NOVEDADES).map((novedad) => novedad.version)).toEqual([
      '2026-10-02',
      '2026-10-01.2',
    ]);
  });

  it('con la actual vista, o una más nueva, no hay nada', () => {
    expect(novedadesSinVer('2026-10-02', NOVEDADES)).toEqual([]);
    expect(novedadesSinVer('2027-01-01', NOVEDADES)).toEqual([]);
    expect(novedadesSinVer(null, [])).toEqual([]);
  });
});
