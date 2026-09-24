import { describe, expect, it } from 'vitest';

import { historialDe } from './historial';

const ORIGEN = 'https://maun.test';

function entrada(index: number, camino: string, sameDocument = true) {
  return { key: `k${String(index)}`, url: `${ORIGEN}${camino}`, index, sameDocument };
}

describe('el historial que lee la API de navegación', () => {
  it('lee las entradas anteriores de este documento, de la más cercana a la más lejana', () => {
    const entradas = [entrada(0, '/'), entrada(1, '/clientes'), entrada(2, '/clientes/1')];
    const historial = historialDe(
      { currentEntry: entradas[2] ?? null, entries: () => entradas },
      ORIGEN,
    );
    expect(historial.disponible()).toBe(true);
    expect(historial.actual()).toEqual({ key: 'k2', url: '/clientes/1' });
    expect(historial.anteriores()).toEqual([
      { key: 'k1', url: '/clientes' },
      { key: 'k0', url: '/' },
    ]);
  });

  it('corta en la primera entrada de otro documento: la de antes de una recarga no se cuenta', () => {
    const entradas = [
      entrada(0, '/'),
      entrada(1, '/finanzas', false),
      entrada(2, '/ajustes'),
      entrada(3, '/ajustes/avisos'),
    ];
    const historial = historialDe(
      { currentEntry: entradas[3] ?? null, entries: () => entradas },
      ORIGEN,
    );
    expect(historial.anteriores()).toEqual([{ key: 'k2', url: '/ajustes' }]);
  });

  it('sin la API no hay historial que leer', () => {
    const historial = historialDe(undefined, ORIGEN);
    expect(historial.disponible()).toBe(false);
    expect(historial.actual()).toBeNull();
    expect(historial.anteriores()).toEqual([]);
  });
});
