import { describe, expect, it } from 'vitest';

import {
  destinoResaltado,
  NAV_ESCRITORIO,
  NAV_MOVIL,
  NAV_TABLET,
  seccionDeLaRuta,
} from './destinos';

describe('seccionDeLaRuta', () => {
  it('la raíz es Inicio', () => {
    expect(seccionDeLaRuta('/')).toBe('inicio');
  });

  it('una ruta de sección es su sección', () => {
    expect(seccionDeLaRuta('/proyectos')).toBe('proyectos');
    expect(seccionDeLaRuta('/clientes')).toBe('clientes');
    expect(seccionDeLaRuta('/ajustes')).toBe('ajustes');
  });

  it('una ruta hija sigue siendo de su sección', () => {
    expect(seccionDeLaRuta('/proyectos/5eed0000-0000-7000-8000-000000000001')).toBe('proyectos');
  });

  it('una ruta desconocida cae en Inicio en vez de dejar la barra sin nada marcado', () => {
    expect(seccionDeLaRuta('/lo-que-sea')).toBe('inicio');
  });
});

describe('destinoResaltado', () => {
  it('en escritorio cada sección se resalta a sí misma', () => {
    expect(destinoResaltado('seguimiento', NAV_ESCRITORIO)).toBe('seguimiento');
    expect(destinoResaltado('ajustes', NAV_ESCRITORIO)).toBe('ajustes');
    expect(destinoResaltado('diezmo', NAV_ESCRITORIO)).toBe('diezmo');
  });

  it('en celular Seguimiento se resalta sobre Proyectos, que es donde vive', () => {
    expect(destinoResaltado('seguimiento', NAV_MOVIL)).toBe('proyectos');
  });

  it('en celular Diezmo y Ajustes se resaltan sobre Inicio, que es desde donde se llega', () => {
    expect(destinoResaltado('diezmo', NAV_MOVIL)).toBe('inicio');
    expect(destinoResaltado('ajustes', NAV_MOVIL)).toBe('inicio');
  });

  it('en tablet Diezmo es destino propio y Ajustes sigue cayendo en Inicio', () => {
    expect(destinoResaltado('diezmo', NAV_TABLET)).toBe('diezmo');
    expect(destinoResaltado('ajustes', NAV_TABLET)).toBe('inicio');
  });
});
