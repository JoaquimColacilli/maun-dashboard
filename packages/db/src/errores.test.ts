import { describe, expect, it } from 'vitest';

import { debeReintentarse, esRechazoDeNegocio, rechazoDeLaBase } from './errores.ts';

function deLaBase(code: string, message = 'algo pasó', hint?: string) {
  return { code, message, details: '', hint: hint ?? null };
}

describe('rechazoDeLaBase', () => {
  it('reconoce la forma del error de PostgREST y normaliza el hint', () => {
    expect(rechazoDeLaBase(deLaBase('MN001', 'está cobrado', 'reabrilo'))).toEqual({
      codigo: 'MN001',
      mensaje: 'está cobrado',
      hint: 'reabrilo',
    });
    expect(rechazoDeLaBase(deLaBase('23514'))?.hint).toBe('');
  });

  it('ignora lo que no tiene esa forma', () => {
    expect(rechazoDeLaBase(new Error('boom'))).toBeUndefined();
    expect(rechazoDeLaBase(null)).toBeUndefined();
    expect(rechazoDeLaBase({ code: 500 })).toBeUndefined();
  });
});

describe('esRechazoDeNegocio', () => {
  it('son los códigos de la clase MN y el de permisos', () => {
    expect(esRechazoDeNegocio(deLaBase('MN001'))).toBe(true);
    expect(esRechazoDeNegocio(deLaBase('MN008'))).toBe(true);
    expect(esRechazoDeNegocio(deLaBase('42501'))).toBe(true);
  });

  it('no son los errores genéricos ni los fallos de red', () => {
    expect(esRechazoDeNegocio(deLaBase('23514'))).toBe(false);
    expect(esRechazoDeNegocio(deLaBase('', 'TypeError: Failed to fetch'))).toBe(false);
    expect(esRechazoDeNegocio(new Error('boom'))).toBe(false);
  });
});

describe('debeReintentarse', () => {
  it('reintenta lo que no llegó a la base', () => {
    expect(debeReintentarse(deLaBase('', 'TypeError: Failed to fetch'))).toBe(true);
    expect(debeReintentarse(new Error('timeout'))).toBe(true);
  });

  it('no reintenta un rechazo de negocio: se le muestra al usuario', () => {
    expect(debeReintentarse(deLaBase('MN001'))).toBe(false);
    expect(debeReintentarse(deLaBase('42501'))).toBe(false);
  });

  it('no reintenta una violación de constraint: nunca va a andar y tapa la cola', () => {
    expect(debeReintentarse(deLaBase('23514'))).toBe(false);
    expect(debeReintentarse(deLaBase('23503'))).toBe(false);
    expect(debeReintentarse(deLaBase('22007'))).toBe(false);
  });

  it('sí reintenta lo que pasa solo: conexión, transacción abortada, falta de recursos', () => {
    expect(debeReintentarse(deLaBase('08006'))).toBe(true);
    expect(debeReintentarse(deLaBase('40001'))).toBe(true);
    expect(debeReintentarse(deLaBase('53300'))).toBe(true);
    expect(debeReintentarse(deLaBase('57P01'))).toBe(true);
  });

  it('reintenta los códigos propios de PostgREST, que no son SQLSTATE', () => {
    expect(debeReintentarse(deLaBase('PGRST301', 'JWT expired'))).toBe(true);
  });
});
