import { describe, expect, it } from 'vitest';

import { cortar, type Ubicada } from './guillotina.ts';

const TABLERO = { x: 0, y: 0, largo: 208, ancho: 136 };
const SIERRA = 7;

function seTocan(a: Ubicada<unknown>, b: Ubicada<unknown>): boolean {
  return a.x < b.x + b.largo && b.x < a.x + a.largo && a.y < b.y + b.ancho && b.y < a.y + a.ancho;
}

describe('cortar', () => {
  const piezas = [
    { id: 'hogar', parte: 0.4 },
    { id: 'maun', parte: 0.32 },
    { id: 'diezmo', parte: 0.1 },
    { id: 'gastos', parte: 0.18 },
  ];

  it('corta el tablero en tantas piezas como partes, en el mismo orden y sin pisarse', () => {
    const ubicadas = cortar(piezas, TABLERO, SIERRA);

    expect(ubicadas.map((ubicada) => ubicada.pieza.id)).toEqual([
      'hogar',
      'maun',
      'diezmo',
      'gastos',
    ]);
    for (const [indice, una] of ubicadas.entries()) {
      expect(una.x).toBeGreaterThanOrEqual(0);
      expect(una.y).toBeGreaterThanOrEqual(0);
      expect(una.x + una.largo).toBeLessThanOrEqual(TABLERO.largo + 1e-9);
      expect(una.y + una.ancho).toBeLessThanOrEqual(TABLERO.ancho + 1e-9);
      for (const otra of ubicadas.slice(indice + 1)) expect(seTocan(una, otra)).toBe(false);
    }
  });

  it('cada pieza ocupa la parte que le toca, descontando lo que se lleva la sierra', () => {
    const ubicadas = cortar(piezas, TABLERO, SIERRA);
    const util = ubicadas.reduce((suma, ubicada) => suma + ubicada.largo * ubicada.ancho, 0);

    for (const ubicada of ubicadas) {
      expect((ubicada.largo * ubicada.ancho) / util).toBeCloseTo(ubicada.pieza.parte, 1);
    }
  });

  it('una sola parte es el tablero entero, y sin partes no hay piezas', () => {
    expect(cortar([{ parte: 1 }], TABLERO, SIERRA)).toEqual([{ ...TABLERO, pieza: { parte: 1 } }]);
    expect(cortar([], TABLERO, SIERRA)).toEqual([]);
  });
});
