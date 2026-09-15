import { describe, expect, it } from 'vitest';

import { hayCambios } from './cambios';

describe('hayCambios', () => {
  it('compara campo por campo contra lo que había al abrir', () => {
    const inicial = { texto: '', monto: null as number | null, importante: false };
    expect(hayCambios(inicial, { ...inicial })).toBe(false);
    expect(hayCambios(inicial, { ...inicial, texto: 'Comprar tornillos' })).toBe(true);
    expect(hayCambios(inicial, { ...inicial, monto: 0 })).toBe(true);
    expect(hayCambios(inicial, { ...inicial, importante: true })).toBe(true);
  });
});
