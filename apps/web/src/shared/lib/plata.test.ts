import { describe, expect, it } from 'vitest';

import { formatearPesos } from './plata';

const sinEspacios = (texto: string) => texto.replace(/\s/gu, '');

describe('formatearPesos', () => {
  it('muestra los pesos sin decimales cuando son redondos', () => {
    expect(sinEspacios(formatearPesos(180000000))).toBe('$1.800.000');
    expect(sinEspacios(formatearPesos(0))).toBe('$0');
  });

  it('muestra los centavos cuando los hay', () => {
    expect(sinEspacios(formatearPesos(123456))).toBe('$1.234,56');
  });

  it('muestra el signo de lo negativo', () => {
    expect(sinEspacios(formatearPesos(-50000))).toBe('-$500');
  });
});
