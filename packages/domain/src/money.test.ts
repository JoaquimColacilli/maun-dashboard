import { describe, expect, it } from 'vitest';

import {
  aplicarPorcentaje,
  centavos,
  CERO,
  esNegativo,
  maximo,
  minimo,
  puntosBasicos,
  restar,
  sumar,
  sumarTodos,
} from './money.ts';

describe('centavos', () => {
  it('acepta enteros seguros, también negativos y cero', () => {
    expect(centavos(124_000_000)).toBe(124_000_000);
    expect(centavos(-500)).toBe(-500);
    expect(centavos(0)).toBe(CERO);
    expect(centavos(Number.MAX_SAFE_INTEGER)).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('rechaza decimales, NaN, infinitos y enteros fuera del rango seguro', () => {
    for (const valor of [
      0.5,
      10.01,
      Number.NaN,
      Infinity,
      -Infinity,
      Number.MAX_SAFE_INTEGER + 1,
    ]) {
      expect(() => centavos(valor)).toThrow(RangeError);
    }
  });
});

describe('operaciones', () => {
  it('suma, resta y suma listas de forma exacta', () => {
    expect(sumar(centavos(10), centavos(20))).toBe(30);
    expect(restar(centavos(10), centavos(25))).toBe(-15);
    expect(sumarTodos([centavos(40_000_000), centavos(40_000_000), centavos(44_000_000)])).toBe(
      124_000_000,
    );
    expect(sumarTodos([])).toBe(0);
  });

  it('corta en vez de perder precisión cuando el resultado sale del rango seguro', () => {
    expect(() => sumar(centavos(Number.MAX_SAFE_INTEGER), centavos(1))).toThrow(RangeError);
    expect(() => restar(centavos(-Number.MAX_SAFE_INTEGER), centavos(1))).toThrow(RangeError);
  });

  it('mínimo, máximo y signo', () => {
    expect(minimo(centavos(3), centavos(7))).toBe(3);
    expect(minimo(centavos(7), centavos(3))).toBe(3);
    expect(maximo(centavos(3), centavos(7))).toBe(7);
    expect(maximo(centavos(7), centavos(3))).toBe(7);
    expect(esNegativo(centavos(-1))).toBe(true);
    expect(esNegativo(CERO)).toBe(false);
  });
});

describe('puntosBasicos', () => {
  it('acepta enteros entre 0 y 10.000', () => {
    expect(puntosBasicos(0)).toBe(0);
    expect(puntosBasicos(1_000)).toBe(1_000);
    expect(puntosBasicos(10_000)).toBe(10_000);
  });

  it('rechaza negativos, decimales y más de 100%', () => {
    for (const valor of [-1, 10_001, 10.5, Number.NaN]) {
      expect(() => puntosBasicos(valor)).toThrow(RangeError);
    }
  });
});

describe('aplicarPorcentaje', () => {
  it('redondea mitad hacia arriba al centavo', () => {
    const diezPorciento = puntosBasicos(1_000);
    expect(aplicarPorcentaje(centavos(15), diezPorciento)).toBe(2);
    expect(aplicarPorcentaje(centavos(14), diezPorciento)).toBe(1);
    expect(aplicarPorcentaje(centavos(5), diezPorciento)).toBe(1);
    expect(aplicarPorcentaje(centavos(4), diezPorciento)).toBe(0);
    expect(aplicarPorcentaje(centavos(88_670_000), diezPorciento)).toBe(8_867_000);
  });

  it('cero y cien por ciento', () => {
    expect(aplicarPorcentaje(centavos(12_345), puntosBasicos(0))).toBe(0);
    expect(aplicarPorcentaje(centavos(12_345), puntosBasicos(10_000))).toBe(12_345);
    expect(aplicarPorcentaje(CERO, puntosBasicos(1_000))).toBe(0);
  });

  it('solo se aplica sobre importes no negativos', () => {
    expect(() => aplicarPorcentaje(centavos(-100), puntosBasicos(1_000))).toThrow(RangeError);
  });

  it('corta si el producto no entra en el rango seguro', () => {
    expect(() =>
      aplicarPorcentaje(centavos(Number.MAX_SAFE_INTEGER), puntosBasicos(1_000)),
    ).toThrow(RangeError);
  });

  it('da exactamente lo mismo que la cuenta entera con BigInt, también con importes grandes', () => {
    let estado = 20_260_911;
    const siguiente = (tope: number): number => {
      estado = (estado + 0x6d2b79f5) >>> 0;
      let t = estado;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4_294_967_296) * tope);
    };
    const casos: [number, number][] = [
      [900_719_925_473, 10_000],
      [900_719_925_473, 9_999],
      [9_007_199_254_730, 1_000],
      [15, 1_000],
      [5, 1_000],
    ];
    for (let i = 0; i < 3_000; i++) {
      const bp = siguiente(10_001);
      const limite = Math.floor((Number.MAX_SAFE_INTEGER - 5_000) / Math.max(bp, 1));
      casos.push([siguiente(limite + 1), bp]);
    }
    for (const [importe, bp] of casos) {
      const esperado = Number((BigInt(importe) * BigInt(bp) + 5_000n) / 10_000n);
      expect(aplicarPorcentaje(centavos(importe), puntosBasicos(bp))).toBe(esperado);
    }
  });
});
