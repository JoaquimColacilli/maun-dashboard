import { describe, expect, it } from 'vitest';

import { esMedidaDeCelular } from './pantalla';

describe('qué pantalla es de celular', () => {
  it('un teléfono parado o acostado sigue siendo un teléfono', () => {
    expect(esMedidaDeCelular(390, 844)).toBe(true);
    expect(esMedidaDeCelular(844, 390)).toBe(true);
    expect(esMedidaDeCelular(360, 780)).toBe(true);
  });

  it('una tablet y una PC no', () => {
    expect(esMedidaDeCelular(768, 1024)).toBe(false);
    expect(esMedidaDeCelular(1440, 900)).toBe(false);
    expect(esMedidaDeCelular(1920, 1080)).toBe(false);
  });
});
