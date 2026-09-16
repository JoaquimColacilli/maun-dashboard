import { describe, expect, it } from 'vitest';

import { formatearPorcentaje, parsearPorcentaje, SENA_MAXIMA_BP } from './porcentaje';

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

  // La seña tiene su propio techo: el check de la base la acepta entre 0 y 100%, y la tasa de Cocos
  // llega hasta 1000%. Sin el tope propio, un 500% pasaría el formulario y la base lo rechazaría con
  // una violación de check, que es definitiva y tapa la cola.
  it('con el tope de la seña no deja pasar lo que el check de la seña rechazaría', () => {
    expect(parsearPorcentaje('50', SENA_MAXIMA_BP)).toBe(5000);
    expect(parsearPorcentaje('100', SENA_MAXIMA_BP)).toBe(10_000);
    expect(parsearPorcentaje('0', SENA_MAXIMA_BP)).toBe(0);
    expect(parsearPorcentaje('101', SENA_MAXIMA_BP)).toBeUndefined();
    expect(parsearPorcentaje('500', SENA_MAXIMA_BP)).toBeUndefined();
  });

  it('sin tope propio sigue aceptando la tasa de Cocos, que llega más arriba', () => {
    expect(parsearPorcentaje('500')).toBe(50_000);
  });
});
