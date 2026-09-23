import { describe, expect, it } from 'vitest';

import {
  esLaEncuestaPublica,
  esLaVistaPublica,
  esUnaPaginaPublica,
  PREFIJO_DE_LA_ENCUESTA_PUBLICA,
  RUTA_DE_LA_ENCUESTA_PUBLICA,
  fechaDelEnlace,
  PREFIJO_DE_LA_VISTA_PUBLICA,
  PARAMETRO_DE_ENTREGA,
  PARAMETRO_DE_TESORO,
  PARAMETRO_DE_VISITA,
  rutaDeContactoNuevo,
  RUTA_DE_LA_VISTA_PUBLICA,
  rutaDeFinanzasDelTesoro,
  rutaDelCliente,
  rutaDelProyecto,
  rutaDeProyectoNuevo,
  tesoroDelParametro,
} from './rutas';

describe('las fichas de un trabajo y de un cliente', () => {
  it('cada uno tiene su ruta por id', () => {
    expect(rutaDelProyecto('p1')).toBe('/proyectos/p1');
    expect(rutaDelCliente('c1')).toBe('/clientes/c1');
  });
});

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
    expect(rutaDeContactoNuevo('2026-09-15')).toBe('/consultas/nueva?visita=2026-09-15');
    expect(rutaDeProyectoNuevo('2026-09-15')).toBe('/proyectos/nuevo?entrega=2026-09-15');
    expect(rutaDeContactoNuevo()).toBe('/consultas/nueva');
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

describe('la vista pública del enlace', () => {
  it('se reconoce por el prefijo de la ruta, no por el token', () => {
    expect(esLaVistaPublica('/v/tZEFrYutatg5xhw1mcrUKIAFXk')).toBe(true);
    expect(esLaVistaPublica('/v/')).toBe(true);
    expect(esLaVistaPublica('/')).toBe(false);
    expect(esLaVistaPublica('/proyectos/p1/vista-cliente')).toBe(false);
    expect(esLaVistaPublica('/ver/p1')).toBe(false);
    expect(esLaVistaPublica('/finanzas?tesoro=hogar')).toBe(false);
  });

  it('el patrón del router sale del mismo prefijo', () => {
    expect(RUTA_DE_LA_VISTA_PUBLICA).toBe(`${PREFIJO_DE_LA_VISTA_PUBLICA}:token`);
    expect(esLaVistaPublica(RUTA_DE_LA_VISTA_PUBLICA)).toBe(true);
  });
});

describe('la encuesta pública', () => {
  it('tiene su propio prefijo, hermano del de la vista, y las dos son páginas públicas', () => {
    expect(esLaEncuestaPublica('/o/7k2m9pq4')).toBe(true);
    expect(esLaEncuestaPublica('/v/7k2m9pq4')).toBe(false);
    expect(esLaEncuestaPublica('/opiniones')).toBe(false);
    expect(esLaEncuestaPublica('/opiniones/preguntas')).toBe(false);
    expect(RUTA_DE_LA_ENCUESTA_PUBLICA).toBe(`${PREFIJO_DE_LA_ENCUESTA_PUBLICA}:token`);
    expect(esUnaPaginaPublica('/o/7k2m9pq4')).toBe(true);
    expect(esUnaPaginaPublica('/v/7k2m9pq4')).toBe(true);
    expect(esUnaPaginaPublica('/opiniones')).toBe(false);
    expect(esUnaPaginaPublica('/')).toBe(false);
  });
});
