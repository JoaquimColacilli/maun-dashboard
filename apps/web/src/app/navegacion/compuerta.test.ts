import { createBrowserRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { crearCompuerta, TOPE_DE_LO_RETENIDO_MS } from './compuerta';

const RUTAS = [
  { path: '/a', element: null },
  { path: '/b', element: null },
  { path: '/c', element: null },
];

function hastaQue(condicion: () => boolean): Promise<void> {
  return vi.waitFor(
    () => {
      if (!condicion()) throw new Error('todavía no');
    },
    { timeout: 3_000, interval: 5 },
  );
}

beforeEach(() => {
  window.history.replaceState(null, '', '/a');
});

describe('la compuerta, la ventana que recibe el router', () => {
  it('todo lo que no es el popstate pasa derecho a la ventana real, con los métodos atados a ella', () => {
    const { ventana } = crearCompuerta(window);
    expect(ventana.location).toBe(window.location);
    expect(ventana.document).toBe(document);
    expect(ventana.history).toBe(window.history);
    expect(ventana.sessionStorage).toBe(window.sessionStorage);
    expect(() => ventana.setTimeout(() => undefined, 0)).not.toThrow();
    const oyente = vi.fn();
    ventana.addEventListener('pagehide', oyente);
    window.dispatchEvent(new Event('pagehide'));
    ventana.removeEventListener('pagehide', oyente);
    window.dispatchEvent(new Event('pagehide'));
    expect(oyente).toHaveBeenCalledTimes(1);
  });

  it('entrega cada popstate una vez, en el acto o cuando se lo piden, y lo retenido tiene un tope', () => {
    const compuerta = crearCompuerta(window);
    const oyente = vi.fn();
    compuerta.ventana.addEventListener('popstate', oyente);
    let decision: 'ahora' | 'retener' = 'ahora';
    compuerta.alVolver(() => decision);

    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(oyente).toHaveBeenCalledTimes(1);

    decision = 'retener';
    window.dispatchEvent(new PopStateEvent('popstate'));
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(oyente).toHaveBeenCalledTimes(1);
    expect(compuerta.hayAlgoRetenido()).toBe(true);
    compuerta.entregarLoRetenido();
    compuerta.entregarLoRetenido();
    expect(oyente).toHaveBeenCalledTimes(2);

    vi.useFakeTimers();
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(oyente).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(TOPE_DE_LO_RETENIDO_MS);
    expect(oyente).toHaveBeenCalledTimes(3);
    vi.useRealTimers();

    compuerta.ventana.removeEventListener('popstate', oyente);
    expect(compuerta.escuchaAlgo()).toBe(false);
  });
});

describe('el contrato con React Router', () => {
  let desmontar: (() => void) | undefined;

  afterEach(() => {
    desmontar?.();
    desmontar = undefined;
  });

  it('escucha el popstate por la ventana que recibe y no lee el evento: lee el historial', async () => {
    const oyentes: EventListener[] = [];
    const ventana = new Proxy(window, {
      get(objetivo, propiedad) {
        if (propiedad === 'addEventListener') {
          return (tipo: string, oyente: EventListener) => {
            if (tipo === 'popstate') oyentes.push(oyente);
            else window.addEventListener(tipo, oyente);
          };
        }
        const valor: unknown = Reflect.get(objetivo, propiedad, objetivo);
        return typeof valor === 'function'
          ? (valor as (...argumentos: unknown[]) => unknown).bind(objetivo)
          : valor;
      },
    });
    const router = createBrowserRouter(RUTAS, { window: ventana });
    desmontar = () => {
      router.dispose();
    };
    expect(oyentes).toHaveLength(1);

    await router.navigate('/b');
    window.history.back();
    await hastaQue(() => window.location.pathname === '/a');
    expect(router.state.location.pathname).toBe('/b');

    oyentes[0]?.(new Event('cualquier-cosa'));
    await hastaQue(() => router.state.location.pathname === '/a');
  });

  it('con varios atrás seguidos, la primera entrega ya trae todo el salto y el router termina donde tiene que terminar', async () => {
    const compuerta = crearCompuerta(window);
    compuerta.alVolver(() => 'retener');
    const router = createBrowserRouter(RUTAS, { window: compuerta.ventana });
    desmontar = () => {
      router.dispose();
    };
    expect(compuerta.escuchaAlgo()).toBe(true);

    await router.navigate('/b');
    await router.navigate('/c');
    window.history.back();
    await hastaQue(() => window.location.pathname === '/b');
    window.history.back();
    await hastaQue(() => window.location.pathname === '/a');
    expect(router.state.location.pathname).toBe('/c');

    compuerta.entregarLoRetenido();
    await hastaQue(() => router.state.location.pathname === '/a');
    expect(compuerta.hayAlgoRetenido()).toBe(false);

    await router.navigate('/b');
    expect(router.state.location.pathname).toBe('/b');
  });
});
