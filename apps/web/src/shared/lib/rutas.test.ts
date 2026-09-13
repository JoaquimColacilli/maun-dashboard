import { describe, expect, it } from 'vitest';

import { PARAMETRO_DE_TESORO, rutaDeFinanzasDelTesoro, tesoroDelParametro } from './rutas';

describe('el filtro de tesoro en la URL de Finanzas', () => {
  it('cada tesoro arma su enlace a Finanzas con el filtro puesto', () => {
    expect(rutaDeFinanzasDelTesoro('hogar')).toBe('/finanzas?tesoro=hogar');
    expect(rutaDeFinanzasDelTesoro('cocos')).toBe('/finanzas?tesoro=cocos');
  });

  it('del parámetro sale el tesoro, y cualquier otra cosa es todos', () => {
    expect(tesoroDelParametro('maun')).toBe('maun');
    expect(tesoroDelParametro('diezmo')).toBe('diezmo');
    expect(tesoroDelParametro(null)).toBe('todos');
    expect(tesoroDelParametro('HOGAR')).toBe('todos');
    expect(tesoroDelParametro('todos')).toBe('todos');
  });

  it('el enlace y la lectura usan el mismo parámetro', () => {
    const url = new URL(rutaDeFinanzasDelTesoro('maun'), 'https://maun.test');
    expect(tesoroDelParametro(url.searchParams.get(PARAMETRO_DE_TESORO))).toBe('maun');
  });
});
