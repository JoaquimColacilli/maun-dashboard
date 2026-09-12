import { describe, expect, it } from 'vitest';

import { formatearPorcentaje, parsearPorcentaje } from './porcentaje';

describe('formatearPorcentaje', () => {
  it('muestra los puntos básicos como los diría una persona', () => {
    expect(formatearPorcentaje(4000)).toBe('40');
    expect(formatearPorcentaje(0)).toBe('0');
    expect(formatearPorcentaje(4050)).toBe('40,5');
    expect(formatearPorcentaje(4005)).toBe('40,05');
  });
});

describe('parsearPorcentaje', () => {
  it('lee lo que se escribe y devuelve puntos básicos', () => {
    expect(parsearPorcentaje('40')).toBe(4000);
    expect(parsearPorcentaje('40,5')).toBe(4050);
    expect(parsearPorcentaje('40.5')).toBe(4050);
    expect(parsearPorcentaje('40 %')).toBe(4000);
  });

  it('acepta el cero: no tener tasa estimada es una respuesta', () => {
    expect(parsearPorcentaje('0')).toBe(0);
  });

  it('rechaza lo que la base no aceptaría', () => {
    expect(parsearPorcentaje('')).toBeUndefined();
    expect(parsearPorcentaje('abc')).toBeUndefined();
    expect(parsearPorcentaje('-5')).toBeUndefined();
    expect(parsearPorcentaje('1001')).toBeUndefined();
    expect(parsearPorcentaje('40,555')).toBeUndefined();
  });
});
