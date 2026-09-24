import { describe, expect, it } from 'vitest';

import { parsearDias } from './vigencia';

describe('los días que vale un presupuesto', () => {
  it('es un número entero de días, con espacios alrededor o sin', () => {
    expect(parsearDias('15')).toBe(15);
    expect(parsearDias(' 30 ')).toBe(30);
    expect(parsearDias('1')).toBe(1);
    expect(parsearDias('365')).toBe(365);
  });

  it('entre uno y un año, como lo frena la base', () => {
    expect(parsearDias('0')).toBeUndefined();
    expect(parsearDias('366')).toBeUndefined();
  });

  it('ni vacío, ni con decimales, ni con letras', () => {
    expect(parsearDias('')).toBeUndefined();
    expect(parsearDias('7,5')).toBeUndefined();
    expect(parsearDias('15 días')).toBeUndefined();
    expect(parsearDias('-3')).toBeUndefined();
  });
});
