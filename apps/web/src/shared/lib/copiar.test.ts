import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { copiar, seleccionarEnPantalla } from './copiar';

function conElPortapapeles(writeText: () => Promise<void>): void {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    get: () => ({ writeText }),
  });
}

function sinPortapapeles(): void {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, get: () => undefined });
}

function conElComando(valor: (comando: string) => boolean): void {
  Object.defineProperty(document, 'execCommand', { configurable: true, value: valor });
}

// El camino de atrás copia desde el evento: el navegador dispara «copy» sobre el nodo fantasma y
// ahí se escribe el texto. Esto es lo que hace un navegador de verdad.
function elComandoQueCopia(): (comando: string) => boolean {
  return (comando) => {
    if (comando !== 'copy') return false;
    document.body.lastElementChild?.dispatchEvent(
      new Event('copy', { bubbles: true, cancelable: true }),
    );
    return true;
  };
}

beforeEach(() => {
  sinPortapapeles();
  conElComando(() => false);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('copiar al portapapeles', () => {
  it('con la API del navegador, copia y lo dice', async () => {
    const escrito: string[] = [];
    conElPortapapeles(() => {
      escrito.push('llamada');
      return Promise.resolve();
    });

    expect(await copiar('0110001312345678901233')).toBe('copiado');
    expect(escrito).toEqual(['llamada']);
  });

  it('si la API rechaza, el camino de atrás copia igual', async () => {
    conElPortapapeles(() => Promise.reject(new DOMException('Document is not focused.')));
    conElComando(elComandoQueCopia());

    expect(await copiar('maun.muebles')).toBe('copiado');
  });

  it('sin API, va directo al camino de atrás', async () => {
    conElComando(elComandoQueCopia());

    expect(await copiar('maun.muebles')).toBe('copiado');
  });

  it('un comando que contesta que sí pero nunca copió no cuenta como copiado', async () => {
    conElComando(() => true);

    expect(await copiar('maun.muebles')).toBe('nada');
  });

  it('un comando que tira tampoco', async () => {
    conElComando(() => {
      throw new Error('no se puede');
    });

    expect(await copiar('maun.muebles')).toBe('nada');
  });

  it('si no copió por ningún lado, deja el dato seleccionado en la pantalla', async () => {
    const enPantalla = document.createElement('span');
    enPantalla.textContent = 'maun.muebles';
    document.body.append(enPantalla);
    vi.spyOn(globalThis, 'getSelection').mockReturnValue({
      rangeCount: 0,
      removeAllRanges: () => undefined,
      addRange: () => undefined,
      getRangeAt: () => document.createRange(),
      toString: () => 'maun.muebles',
    } as unknown as Selection);

    expect(await copiar('maun.muebles', enPantalla)).toBe('seleccionado');
    enPantalla.remove();
  });

  it('el fantasma no se queda en la página', async () => {
    const antes = document.body.childElementCount;
    conElComando(elComandoQueCopia());

    await copiar('maun.muebles');

    expect(document.body.childElementCount).toBe(antes);
  });
});

describe('seleccionar el dato en la pantalla', () => {
  it('sin nodo no hay nada que seleccionar', () => {
    expect(seleccionarEnPantalla(null)).toBe(false);
  });

  it('le saca el user-select heredado antes de marcarlo', () => {
    const nodo = document.createElement('span');
    nodo.textContent = 'maun.muebles';
    document.body.append(nodo);
    vi.spyOn(globalThis, 'getSelection').mockReturnValue({
      removeAllRanges: () => undefined,
      addRange: () => undefined,
      toString: () => 'maun.muebles',
    } as unknown as Selection);

    expect(seleccionarEnPantalla(nodo)).toBe(true);
    expect(nodo.style.userSelect).toBe('text');
    nodo.remove();
  });

  it('si la selección queda vacía, lo dice', () => {
    const nodo = document.createElement('span');
    document.body.append(nodo);
    vi.spyOn(globalThis, 'getSelection').mockReturnValue({
      removeAllRanges: () => undefined,
      addRange: () => undefined,
      toString: () => '   ',
    } as unknown as Selection);

    expect(seleccionarEnPantalla(nodo)).toBe(false);
    nodo.remove();
  });
});
