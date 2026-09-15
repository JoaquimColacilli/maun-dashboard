import { describe, expect, it } from 'vitest';

import { hayCambiosEnLaAnotacion, valoresIniciales } from './anotacion';

describe('hayCambiosEnLaAnotacion', () => {
  const inicial = valoresIniciales('2026-09-15');

  it('recién abierta, o con solo espacios, no hay nada que perder', () => {
    expect(hayCambiosEnLaAnotacion(inicial, inicial)).toBe(false);
    expect(hayCambiosEnLaAnotacion(inicial, { ...inicial, texto: '   ' })).toBe(false);
  });

  it('el texto, la categoría, el día, la hora, el trabajo o la marca cuentan como cambio', () => {
    for (const cambio of [
      { texto: 'Comprar tornillos' },
      { categoria: 'taller' as const },
      { fecha: '2026-09-16' },
      { hora: '15:00' },
      { proyectoId: 'p1' },
      { importante: true },
    ]) {
      expect(hayCambiosEnLaAnotacion(inicial, { ...inicial, ...cambio })).toBe(true);
    }
  });
});
