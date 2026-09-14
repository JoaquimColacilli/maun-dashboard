import { afterEach, describe, expect, it, vi } from 'vitest';

type Ceremonia = typeof import('./ceremonia');

async function modulo(): Promise<Ceremonia> {
  vi.resetModules();
  return import('./ceremonia');
}

function colgada(senal: AbortSignal): Promise<string> {
  return new Promise((_resolver, rechazar) => {
    senal.addEventListener(
      'abort',
      () => {
        rechazar(new DOMException('La ceremonia se canceló.', 'AbortError'));
      },
      { once: true },
    );
  });
}

describe('una sola ceremonia de WebAuthn por vez', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('una nueva cancela la pendiente y espera su rechazo antes de empezar', async () => {
    const { conUnaSolaCeremonia } = await modulo();
    const orden: string[] = [];

    const primera = conUnaSolaCeremonia(
      (senal) =>
        new Promise<string>((_resolver, rechazar) => {
          senal.addEventListener('abort', () => {
            orden.push('se rechaza la primera');
            rechazar(new DOMException('cancelada', 'AbortError'));
          });
        }),
    );
    const segunda = conUnaSolaCeremonia((senal) => {
      orden.push('empieza la segunda');
      expect(senal.aborted).toBe(false);
      return Promise.resolve('huella');
    });

    expect(await primera).toEqual({ tipo: 'cancelada-por-la-app' });
    expect(await segunda).toEqual({ tipo: 'terminada', valor: 'huella' });
    expect(orden).toEqual(['se rechaza la primera', 'empieza la segunda']);
  });

  it('con tres seguidas solo corre la última, y cada una recibe una señal nueva', async () => {
    const { conUnaSolaCeremonia } = await modulo();
    const llamadas: string[] = [];
    const senales: AbortSignal[] = [];

    const a = conUnaSolaCeremonia((senal) => {
      llamadas.push('a');
      senales.push(senal);
      return colgada(senal);
    });
    const b = conUnaSolaCeremonia((senal) => {
      llamadas.push('b');
      return colgada(senal);
    });
    const c = conUnaSolaCeremonia((senal) => {
      llamadas.push('c');
      senales.push(senal);
      return Promise.resolve('c');
    });

    expect(await a).toEqual({ tipo: 'cancelada-por-la-app' });
    expect(await b).toEqual({ tipo: 'cancelada-por-la-app' });
    expect(await c).toEqual({ tipo: 'terminada', valor: 'c' });
    expect(llamadas).toEqual(['a', 'c']);
    expect(senales[0]).not.toBe(senales[1]);
    expect(senales[1]?.aborted).toBe(false);
  });

  it('cancelarla desde afuera, como al desmontar la pantalla, es una cancelación propia', async () => {
    const { conUnaSolaCeremonia } = await modulo();
    const afuera = new AbortController();

    const pendiente = conUnaSolaCeremonia(colgada, { signal: afuera.signal });
    afuera.abort();

    expect(await pendiente).toEqual({ tipo: 'cancelada-por-la-app' });
  });

  it('si ya llega cancelada, ni siquiera empieza', async () => {
    const { conUnaSolaCeremonia } = await modulo();
    const afuera = new AbortController();
    afuera.abort();
    const ceremonia = vi.fn(colgada);

    expect(await conUnaSolaCeremonia(ceremonia, { signal: afuera.signal })).toEqual({
      tipo: 'cancelada-por-la-app',
    });
    expect(ceremonia).not.toHaveBeenCalled();
  });

  it('una que no contesta vence en el tope corto y dice que no respondió', async () => {
    vi.useFakeTimers();
    const { conUnaSolaCeremonia, TOPE_DE_UNA_CEREMONIA_MS } = await modulo();

    const pendiente = conUnaSolaCeremonia(colgada);
    await vi.advanceTimersByTimeAsync(TOPE_DE_UNA_CEREMONIA_MS);

    expect(await pendiente).toEqual({ tipo: 'sin-respuesta' });
    expect(TOPE_DE_UNA_CEREMONIA_MS).toBeLessThan(300_000);
  });

  it('un rechazo de la plataforma no es una cancelación propia: llega como falla', async () => {
    const { conUnaSolaCeremonia } = await modulo();
    const rechazo = new DOMException('Otro pedido en curso.', 'NotAllowedError');

    expect(await conUnaSolaCeremonia(() => Promise.reject(rechazo))).toEqual({
      tipo: 'fallida',
      error: rechazo,
    });
  });

  it('la mediación condicional no le quita el lugar a un pedido de huella', async () => {
    const { conUnaSolaCeremonia } = await modulo();
    const afuera = new AbortController();
    const huella = conUnaSolaCeremonia(colgada, { signal: afuera.signal });
    const condicional = vi.fn(colgada);

    expect(await conUnaSolaCeremonia(condicional, { pasiva: true, tope: null })).toEqual({
      tipo: 'cancelada-por-la-app',
    });
    expect(condicional).not.toHaveBeenCalled();

    afuera.abort();
    expect(await huella).toEqual({ tipo: 'cancelada-por-la-app' });
  });

  it('un pedido de huella sí le quita el lugar a la mediación condicional', async () => {
    const { conUnaSolaCeremonia } = await modulo();
    const condicional = conUnaSolaCeremonia(colgada, { pasiva: true, tope: null });
    const huella = conUnaSolaCeremonia(() => Promise.resolve('huella'));

    expect(await condicional).toEqual({ tipo: 'cancelada-por-la-app' });
    expect(await huella).toEqual({ tipo: 'terminada', valor: 'huella' });
  });

  it('si la anterior no suelta, la nueva no queda esperándola para siempre', async () => {
    vi.useFakeTimers();
    const { conUnaSolaCeremonia, ESPERA_DE_LA_CEREMONIA_ANTERIOR_MS } = await modulo();
    void conUnaSolaCeremonia(() => new Promise<string>(() => undefined), { tope: null });

    const nueva = conUnaSolaCeremonia(() => Promise.resolve('huella'));
    await vi.advanceTimersByTimeAsync(ESPERA_DE_LA_CEREMONIA_ANTERIOR_MS);

    expect(await nueva).toEqual({ tipo: 'terminada', valor: 'huella' });
  });
});
