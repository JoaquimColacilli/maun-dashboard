import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  avisarEnPantalla,
  avisoEnPantalla,
  avisosDeLaMeta,
  descartarDePantalla,
  metaDeAvisos,
  useAvisosEnPantalla,
  vaciarAvisosEnPantalla,
} from './pantalla';

function actuales() {
  return renderHook(() => useAvisosEnPantalla()).result.current;
}

describe('los avisos en pantalla', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vaciarAvisosEnPantalla();
  });

  afterEach(() => {
    vaciarAvisosEnPantalla();
    vi.useRealTimers();
  });

  it('lo confirmado y lo anotado sin señal se van solos; un error se queda hasta que se descarta', () => {
    avisarEnPantalla({ clave: 'a', tono: 'hecho', texto: 'Movimiento guardado.' });
    avisarEnPantalla({ clave: 'b', tono: 'en-cola', texto: 'Movimiento anotado sin señal.' });
    avisarEnPantalla({ clave: 'c', tono: 'error', texto: 'No se guardó el cliente.' });
    expect(actuales()).toHaveLength(3);

    vi.advanceTimersByTime(10_000);
    const quedan = actuales();
    expect(quedan.map((aviso) => aviso.tono)).toEqual(['error']);

    descartarDePantalla(quedan[0]?.id ?? 0);
    expect(actuales()).toHaveLength(0);
  });

  it('dos avisos con la misma clave se juntan en uno que cuenta cuántos fueron', () => {
    const textoParaVarios = (veces: number) => `Se guardaron las ${String(veces)} cosas.`;
    avisarEnPantalla({ clave: 'pendientes', tono: 'hecho', texto: 'Uno.', textoParaVarios });
    avisarEnPantalla({ clave: 'pendientes', tono: 'hecho', texto: 'Uno.', textoParaVarios });
    avisarEnPantalla({ clave: 'pendientes', tono: 'hecho', texto: 'Uno.', textoParaVarios });

    const [aviso] = actuales();
    expect(actuales()).toHaveLength(1);
    expect(aviso?.texto).toBe('Se guardaron las 3 cosas.');
  });

  it('con la misma clave y otro tono el aviso cambia en su lugar, no se suma otro', () => {
    avisarEnPantalla({ clave: 'cola', tono: 'en-cola', texto: 'Anotado sin señal.' });
    avisarEnPantalla({ clave: 'otro', tono: 'hecho', texto: 'Otra cosa.' });
    const primero = actuales()[0]?.id;
    avisarEnPantalla({ clave: 'cola', tono: 'hecho', texto: 'Guardado.' });

    const lista = actuales();
    expect(lista.map(({ tono, texto, veces }) => ({ tono, texto, veces }))).toEqual([
      { tono: 'hecho', texto: 'Guardado.', veces: 1 },
      { tono: 'hecho', texto: 'Otra cosa.', veces: 1 },
    ]);
    expect(lista[0]?.id).toBe(primero);
  });

  it('un aviso puede tomar el lugar de otro de otra clave, y el reloj del anterior no lo borra', () => {
    avisarEnPantalla({ clave: 'cola', tono: 'en-cola', texto: 'Anotado sin señal.' });
    const id = avisarEnPantalla({
      clave: 'error-1',
      tono: 'error',
      texto: 'No se guardó.',
      reemplaza: 'cola',
    });

    expect(actuales().map((aviso) => aviso.texto)).toEqual(['No se guardó.']);
    expect(avisoEnPantalla(id)?.tono).toBe('error');
    vi.advanceTimersByTime(10_000);
    expect(actuales().map((aviso) => aviso.texto)).toEqual(['No se guardó.']);
  });

  it('nunca muestra más de tres transitorios, y un error no se pierde por eso', () => {
    avisarEnPantalla({ clave: 'error', tono: 'error', texto: 'Falló.' });
    for (const clave of ['1', '2', '3', '4', '5']) {
      avisarEnPantalla({ clave, tono: 'hecho', texto: `Aviso ${clave}` });
    }

    const lista = actuales();
    expect(lista.filter((aviso) => aviso.tono === 'hecho').map((aviso) => aviso.texto)).toEqual([
      'Aviso 3',
      'Aviso 4',
      'Aviso 5',
    ]);
    expect(lista.some((aviso) => aviso.tono === 'error')).toBe(true);
  });
});

describe('la meta de una mutación', () => {
  it('lleva los tres textos y se puede leer de vuelta, aunque venga del disco', () => {
    const meta = structuredClone(
      metaDeAvisos('clienteBorrado', { errorEnPantalla: true, sujeto: 'Rosa Ibarra' }),
    );
    expect(avisosDeLaMeta(meta)).toEqual({
      que: 'clienteBorrado',
      sujeto: 'Rosa Ibarra',
      hecho: 'Cliente borrado.',
      enCola: 'Borrado anotado sin señal: se hace solo cuando vuelva.',
      error: 'No se borró el cliente.',
      errorEnPantalla: true,
      silencioso: false,
    });
  });

  it('una mutación silenciosa lo lleva en la meta, y también sobrevive al disco', () => {
    const meta = structuredClone(metaDeAvisos('anotacion', { silencioso: true, sujeto: 'Pintar' }));
    expect(avisosDeLaMeta(meta)).toMatchObject({ que: 'anotacion', silencioso: true });
  });

  it('una mutación sin avisos no avisa', () => {
    expect(avisosDeLaMeta(undefined)).toBeUndefined();
    expect(avisosDeLaMeta({ otra: 'cosa' })).toBeUndefined();
    expect(avisosDeLaMeta({ avisos: { hecho: 'Sí.' } })).toBeUndefined();
    expect(
      avisosDeLaMeta({ avisos: { que: 'otra', hecho: 'Sí.', enCola: 'Sí.', error: 'No.' } }),
    ).toBeUndefined();
  });
});
