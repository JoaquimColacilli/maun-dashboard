import { isValidElement } from 'react';
import { describe, expect, it } from 'vitest';

import { HOJAS_POR_RUTA } from '@/shared/lib';

import { RutaVieja } from '../router/RutaVieja';
import { RUTAS_DE_HOJA, RUTAS_DE_PANTALLA } from '../router/rutas';
import { CATALOGO, pantallaDe, sonPestanasDelMismoGrupo } from './catalogo';

function patronDe(ruta: { index?: boolean; path?: string }): string {
  return ruta.index === true ? '/' : (ruta.path ?? '');
}

describe('el catálogo de las pantallas del marco', () => {
  it('tiene una entrada por cada ruta del marco y ninguna de más', () => {
    const rutas = new Set([...RUTAS_DE_PANTALLA, ...RUTAS_DE_HOJA].map(patronDe));
    const catalogo = new Set(CATALOGO.map((pantalla) => pantalla.patron));
    expect([...catalogo].sort()).toEqual([...rutas].sort());
  });

  it('marca la ruta índice, las redirecciones viejas y las hojas por ruta', () => {
    for (const ruta of RUTAS_DE_PANTALLA) {
      const entradas = CATALOGO.filter((pantalla) => pantalla.patron === patronDe(ruta));
      const esVieja = isValidElement(ruta.element) && ruta.element.type === RutaVieja;
      for (const entrada of entradas) {
        expect(entrada.redireccion === true, entrada.id).toBe(esVieja);
        expect(entrada.indice === true, entrada.id).toBe(ruta.index === true);
        expect(entrada.forma, entrada.id).not.toBe('hoja');
      }
    }
    for (const hoja of HOJAS_POR_RUTA) {
      expect(CATALOGO.find((pantalla) => pantalla.patron === hoja.patron)?.forma).toBe('hoja');
    }
  });

  it('las capas son las de la pantalla de proyecto', () => {
    expect(
      CATALOGO.filter((pantalla) => pantalla.forma === 'capa').map((pantalla) => pantalla.id),
    ).toEqual(['proyecto-nuevo', 'editar']);
  });

  it('reconoce cada pestaña de Proyectos por su etapa, y a lo demás por su camino', () => {
    expect(pantallaDe('/consultas')?.id).toBe('consultas');
    expect(pantallaDe('/proyectos')?.id).toBe('activos');
    expect(pantallaDe('/proyectos?etapa=seguimiento')?.id).toBe('seguimiento');
    expect(pantallaDe('/proyectos?etapa=historial&orden=x')?.id).toBe('historial');
    expect(pantallaDe('/proyectos?etapa=cualquiera')?.id).toBe('activos');
    expect(pantallaDe('/proyectos/nuevo')?.id).toBe('proyecto-nuevo');
    expect(pantallaDe('/proyectos/0190/editar')?.id).toBe('editar');
    expect(pantallaDe('/finanzas?tesoro=hogar')?.id).toBe('finanzas');
    expect(pantallaDe('/finanzas/nuevo')?.id).toBe('movimiento-nuevo');
    expect(pantallaDe('/opiniones?respuesta=1#pregunta-2')?.id).toBe('resultados');
    expect(pantallaDe('/v/token')).toBeUndefined();
  });

  it('en el celular, Agenda, Opiniones, Diezmo y Ajustes cuelgan de Inicio', () => {
    for (const id of ['agenda', 'resultados', 'preguntas', 'diezmo', 'ajustes']) {
      const pantalla = CATALOGO.find((una) => una.id === id);
      expect(pantalla?.seccion, id).toBe('inicio');
      expect(pantalla?.raiz, id).toBe(false);
    }
    expect(CATALOGO.filter((pantalla) => pantalla.raiz).map((pantalla) => pantalla.id)).toEqual([
      'inicio',
      'consultas',
      'seguimiento',
      'activos',
      'historial',
      'clientes',
      'finanzas',
    ]);
  });

  it('las pestañas son las de una misma pantalla', () => {
    expect(sonPestanasDelMismoGrupo('/consultas', '/proyectos')).toBe(true);
    expect(sonPestanasDelMismoGrupo('/opiniones', '/opiniones/preguntas')).toBe(true);
    expect(sonPestanasDelMismoGrupo('/consultas', '/opiniones')).toBe(false);
    expect(sonPestanasDelMismoGrupo('/consultas', '/consultas')).toBe(false);
  });
});
