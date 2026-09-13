import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CLAVE_DEL_TEMA, elegirTema, preferenciaDeTema, useTema } from './tema';

function simularSistema(oscuro: boolean) {
  const oyentes = new Set<() => void>();
  const consulta = {
    matches: oscuro,
    addEventListener: (_: string, oyente: () => void) => oyentes.add(oyente),
    removeEventListener: (_: string, oyente: () => void) => oyentes.delete(oyente),
  };
  vi.stubGlobal('matchMedia', () => consulta);
  return (valor: boolean) => {
    consulta.matches = valor;
    for (const oyente of oyentes) oyente();
  };
}

describe('la preferencia de tema', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sin atributo en la raíz sigue al sistema', () => {
    expect(preferenciaDeTema()).toBe('system');
  });

  it('elegir claro u oscuro lo escribe en la raíz y lo recuerda para el próximo arranque', () => {
    elegirTema('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem(CLAVE_DEL_TEMA)).toBe('dark');

    elegirTema('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem(CLAVE_DEL_TEMA)).toBe('light');
  });

  it('volver a «según el sistema» borra lo guardado y deja el atributo explícito', () => {
    elegirTema('dark');
    elegirTema('system');
    expect(document.documentElement.dataset.theme).toBe('system');
    expect(localStorage.getItem(CLAVE_DEL_TEMA)).toBeNull();
  });

  it('con «según el sistema» el tema resuelto cambia cuando cambia el sistema', () => {
    const cambiarSistema = simularSistema(false);
    elegirTema('system');
    const { result } = renderHook(() => useTema());
    expect(result.current).toEqual({ preferencia: 'system', oscuro: false });

    act(() => {
      cambiarSistema(true);
    });
    expect(result.current).toEqual({ preferencia: 'system', oscuro: true });
  });

  it('una elección explícita manda sobre el sistema y avisa a quien la está mirando', () => {
    simularSistema(true);
    const { result } = renderHook(() => useTema());

    act(() => {
      elegirTema('light');
    });
    expect(result.current).toEqual({ preferencia: 'light', oscuro: false });
  });
});
