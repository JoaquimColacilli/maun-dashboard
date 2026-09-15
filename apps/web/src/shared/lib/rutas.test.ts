import { describe, expect, it } from 'vitest';

import {
  fechaDelEnlace,
  PARAMETRO_DE_ENTREGA,
  PARAMETRO_DE_TESORO,
  PARAMETRO_DE_VISITA,
  rutaDeContactoNuevo,
  rutaDeFinanzasDelTesoro,
  rutaDeProyectoNuevo,
  tesoroDelParametro,
} from './rutas';

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

describe('el día que viaja en el enlace a cargar un contacto o un proyecto', () => {
  it('cada enlace lleva la fecha en su parámetro, y sin fecha va solo', () => {
    expect(rutaDeContactoNuevo('2026-09-15')).toBe('/seguimiento/nuevo?visita=2026-09-15');
    expect(rutaDeProyectoNuevo('2026-09-15')).toBe('/proyectos/nuevo?entrega=2026-09-15');
    expect(rutaDeContactoNuevo()).toBe('/seguimiento/nuevo');
    expect(rutaDeProyectoNuevo()).toBe('/proyectos/nuevo');
  });

  it('del parámetro sale solo una fecha que existe', () => {
    expect(fechaDelEnlace('2026-09-15')).toBe('2026-09-15');
    expect(fechaDelEnlace(null)).toBeUndefined();
    expect(fechaDelEnlace('')).toBeUndefined();
    expect(fechaDelEnlace('2026-02-30')).toBeUndefined();
    expect(fechaDelEnlace('15/09/2026')).toBeUndefined();
  });

  it('el enlace y la lectura usan el mismo parámetro', () => {
    const contacto = new URL(rutaDeContactoNuevo('2026-09-15'), 'https://maun.test');
    const proyecto = new URL(rutaDeProyectoNuevo('2026-10-01'), 'https://maun.test');
    expect(fechaDelEnlace(contacto.searchParams.get(PARAMETRO_DE_VISITA))).toBe('2026-09-15');
    expect(fechaDelEnlace(proyecto.searchParams.get(PARAMETRO_DE_ENTREGA))).toBe('2026-10-01');
  });
});
