import { describe, expect, it } from 'vitest';

import type { EntradaDelHistorial } from './historial';
import {
  destinoDeLaBarra,
  etiquetaDeVolver,
  mismaDireccion,
  planDeIr,
  planDeVolver,
  type Situacion,
} from './pila';

function pila(...urls: string[]): EntradaDelHistorial[] {
  return urls.map((url, indice) => ({ key: `k${String(indice)}`, url }));
}

function enElCelular(actual: string, ...anteriores: string[]): Situacion {
  return { actual, anteriores: pila(...anteriores), movil: true, conHistorial: true };
}

function enLaCompu(actual: string, ...anteriores: string[]): Situacion {
  return { actual, anteriores: pila(...anteriores), movil: false, conHistorial: true };
}

describe('volver', () => {
  it('va atrás si hay una entrada anterior de este documento', () => {
    expect(planDeVolver('/proyectos', enElCelular('/proyectos/1', '/agenda', '/'))).toEqual({
      tipo: 'atras',
      pasos: [{ tipo: 'atras', saltos: 1 }],
    });
  });

  it('sin anterior, en el celular, reemplaza por el padre y deja Inicio abajo si el padre es una raíz', () => {
    expect(planDeVolver('/proyectos', enElCelular('/proyectos/1'))).toEqual({
      tipo: 'reemplazar',
      pasos: [
        { tipo: 'reemplazar', url: '/' },
        { tipo: 'apilar', url: '/proyectos' },
      ],
    });
  });

  it('sin anterior, con un padre que no es raíz o en la compu, solo reemplaza', () => {
    expect(planDeVolver('/proyectos/1', enElCelular('/proyectos/1/editar')).pasos).toEqual([
      { tipo: 'reemplazar', url: '/proyectos/1' },
    ]);
    expect(planDeVolver('/proyectos', enLaCompu('/proyectos/1')).pasos).toEqual([
      { tipo: 'reemplazar', url: '/proyectos' },
    ]);
    expect(planDeVolver('/', enElCelular('/agenda')).pasos).toEqual([
      { tipo: 'reemplazar', url: '/' },
    ]);
  });

  it('sin la API de navegación, apila el padre como siempre', () => {
    expect(
      planDeVolver('/clientes', { ...enElCelular('/clientes/1', '/'), conHistorial: false }).pasos,
    ).toEqual([{ tipo: 'apilar', url: '/clientes' }]);
  });
});

describe('las secciones, en el celular', () => {
  it('ir a la raíz de otra sección vuelve hasta Inicio y la apila', () => {
    expect(planDeIr('/finanzas', {}, enElCelular('/clientes/1', '/clientes', '/'))).toEqual({
      tipo: 'seccion',
      pasos: [
        { tipo: 'atras', saltos: 2 },
        { tipo: 'apilar', url: '/finanzas', state: undefined },
      ],
    });
  });

  it('si Inicio no está abajo, vuelve a la primera entrada del documento y la cambia por Inicio', () => {
    expect(planDeIr('/finanzas', {}, enElCelular('/clientes/1', '/clientes')).pasos).toEqual([
      { tipo: 'atras', saltos: 1 },
      { tipo: 'reemplazar', url: '/' },
      { tipo: 'apilar', url: '/finanzas', state: undefined },
    ]);
    expect(planDeIr('/clientes', {}, enElCelular('/agenda')).pasos).toEqual([
      { tipo: 'reemplazar', url: '/' },
      { tipo: 'apilar', url: '/clientes', state: undefined },
    ]);
  });

  it('desde Inicio apila la raíz, y un enlace a una raíz también cuenta como cambiar de sección', () => {
    expect(planDeIr('/finanzas?tesoro=hogar', {}, enElCelular('/')).pasos).toEqual([
      { tipo: 'apilar', url: '/finanzas?tesoro=hogar', state: undefined },
    ]);
  });

  it('ir a Inicio desde otra sección vuelve hasta él sin apilar otro', () => {
    expect(planDeIr('/', {}, enElCelular('/finanzas', '/')).pasos).toEqual([
      { tipo: 'atras', saltos: 1 },
    ]);
    expect(planDeIr('/', {}, enElCelular('/finanzas')).pasos).toEqual([
      { tipo: 'reemplazar', url: '/' },
    ]);
  });

  it('la barra, en la sección en la que estás y más adentro, vuelve a la raíz con que llegaste', () => {
    const adentro = enElCelular('/proyectos/1', '/consultas', '/');
    const destino = destinoDeLaBarra('/proyectos', adentro);
    expect(destino).toBe('/consultas');
    expect(planDeIr(destino ?? '', { desdeLaNavegacion: true }, adentro).pasos).toEqual([
      { tipo: 'atras', saltos: 1 },
    ]);
    const enLaAgenda = enElCelular('/agenda', '/');
    expect(destinoDeLaBarra('/', enLaAgenda)).toBe('/');
    expect(planDeIr('/', { desdeLaNavegacion: true }, enLaAgenda).pasos).toEqual([
      { tipo: 'atras', saltos: 1 },
    ]);
  });

  it('la barra, en una raíz de la sección en la que estás, no hace nada', () => {
    expect(destinoDeLaBarra('/proyectos', enElCelular('/consultas', '/'))).toBeNull();
    expect(destinoDeLaBarra('/', enElCelular('/'))).toBeNull();
    expect(destinoDeLaBarra('/clientes', enElCelular('/proyectos', '/'))).toBe('/clientes');
  });

  it('el menú a una pestaña de la sección desde más adentro vuelve a la raíz y cambia de pestaña', () => {
    expect(
      planDeIr(
        '/proyectos',
        { desdeLaNavegacion: true },
        enElCelular('/proyectos/1', '/consultas', '/'),
      ).pasos,
    ).toEqual([
      { tipo: 'atras', saltos: 1 },
      { tipo: 'reemplazar', url: '/proyectos', state: undefined },
    ]);
  });

  it('ir a donde ya estás no hace nada', () => {
    expect(planDeIr('/clientes', {}, enElCelular('/clientes', '/')).pasos).toEqual([]);
  });

  it('en la tablet y en la compu no se toca la pila: se apila como siempre', () => {
    expect(
      planDeIr(
        '/finanzas',
        { desdeLaNavegacion: true },
        enLaCompu('/clientes/1', '/clientes', '/'),
      ),
    ).toEqual({ tipo: 'apilar', pasos: [{ tipo: 'apilar', url: '/finanzas', state: undefined }] });
  });
});

describe('las pestañas reemplazan', () => {
  it('entre las cuatro de Proyectos, en todos los anchos', () => {
    for (const situacion of [enElCelular('/consultas', '/'), enLaCompu('/consultas', '/')]) {
      expect(planDeIr('/proyectos?etapa=historial', {}, situacion).pasos).toEqual([
        { tipo: 'reemplazar', url: '/proyectos?etapa=historial', state: undefined },
      ]);
    }
  });

  it('entre las dos de Opiniones, y desde un enlace de adentro', () => {
    expect(planDeIr('/opiniones/preguntas', {}, enElCelular('/opiniones', '/')).pasos).toEqual([
      { tipo: 'reemplazar', url: '/opiniones/preguntas', state: undefined },
    ]);
  });

  it('desde otra pantalla, ir a una pestaña de Opiniones apila', () => {
    expect(planDeIr('/opiniones/preguntas', {}, enElCelular('/proyectos/1', '/')).pasos).toEqual([
      { tipo: 'apilar', url: '/opiniones/preguntas', state: undefined },
    ]);
  });
});

describe('terminar no apila', () => {
  it('va atrás si el destino es la entrada anterior, aunque los parámetros vengan en otro orden', () => {
    expect(
      planDeIr(
        '/proyectos/1',
        { como: 'terminar' },
        enElCelular('/proyectos/1/cobrar', '/proyectos/1'),
      ),
    ).toEqual({ tipo: 'terminar', pasos: [{ tipo: 'atras', saltos: 1 }] });
    expect(
      planDeIr(
        '/opiniones?a=1&b=2',
        { como: 'terminar' },
        enLaCompu('/opiniones?b=2&a=1&respuesta=r', '/opiniones?b=2&a=1'),
      ).pasos,
    ).toEqual([{ tipo: 'atras', saltos: 1 }]);
  });

  it('si no, reemplaza', () => {
    expect(
      planDeIr('/proyectos/2', { como: 'terminar' }, enElCelular('/proyectos/nuevo', '/proyectos'))
        .pasos,
    ).toEqual([{ tipo: 'reemplazar', url: '/proyectos/2', state: undefined }]);
    expect(
      planDeIr('/opiniones', { como: 'terminar' }, enElCelular('/opiniones?respuesta=r', '/'))
        .pasos,
    ).toEqual([{ tipo: 'reemplazar', url: '/opiniones', state: undefined }]);
  });

  it('sin la API de navegación, reemplaza', () => {
    expect(
      planDeIr(
        '/proyectos/1',
        { como: 'terminar' },
        {
          ...enElCelular('/proyectos/1/cobrar', '/proyectos/1'),
          conHistorial: false,
        },
      ).pasos,
    ).toEqual([{ tipo: 'reemplazar', url: '/proyectos/1', state: undefined }]);
  });

  it('si ya está en el destino, no hace nada; si además el destino es la anterior, va atrás', () => {
    expect(
      planDeIr('/proyectos/1', { como: 'terminar' }, enElCelular('/proyectos/1', '/proyectos')),
    ).toEqual({ tipo: 'nada', pasos: [] });
    expect(
      planDeIr(
        '/proyectos/1',
        { como: 'terminar' },
        enElCelular('/proyectos/1', '/proyectos/1', '/proyectos'),
      ).pasos,
    ).toEqual([{ tipo: 'atras', saltos: 1 }]);
  });
});

describe('la etiqueta de volver', () => {
  it('sin entrada anterior, o si la anterior es la que ya nombra, no cambia', () => {
    expect(etiquetaDeVolver('/proyectos', 'Proyectos', [])).toBe('Proyectos');
    expect(etiquetaDeVolver('/proyectos', 'Proyectos', pila('/proyectos', '/'))).toBe('Proyectos');
  });

  it('si no, dice el nombre de la pantalla anterior, y el de una ficha es el de su sección', () => {
    expect(etiquetaDeVolver('/proyectos', 'Proyectos', pila('/agenda', '/'))).toBe('Agenda');
    expect(etiquetaDeVolver('/proyectos', 'Proyectos', pila('/consultas', '/'))).toBe('Consultas');
    expect(etiquetaDeVolver('/clientes', 'Clientes', pila('/proyectos/1', '/'))).toBe('Proyectos');
    expect(
      etiquetaDeVolver('/proyectos', 'Proyectos', pila('/proyectos?etapa=historial', '/')),
    ).toBe('Historial');
  });
});

describe('las direcciones', () => {
  it('son la misma sin importar el orden de los parámetros ni el hash', () => {
    expect(mismaDireccion('/finanzas?tesoro=hogar#x', '/finanzas?tesoro=hogar')).toBe(true);
    expect(mismaDireccion('/finanzas?tesoro=hogar', '/finanzas')).toBe(false);
  });
});
