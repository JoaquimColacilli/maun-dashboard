import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { crearPedidor } from './pedidor';

const MINIMO = 5_000;

function conTraer(yaTrae = () => false) {
  const pendientes: (() => void)[] = [];
  const traer = vi.fn(
    () =>
      new Promise<void>((resolver) => {
        pendientes.push(resolver);
      }),
  );
  const pedidor = crearPedidor({ traer, yaTrae, minimoMs: MINIMO });
  const terminar = async () => {
    pendientes.shift()?.();
    await vi.advanceTimersByTimeAsync(0);
  };
  return { traer, pedidor, terminar };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('crearPedidor', () => {
  it('el primer pedido sale enseguida', () => {
    const { traer, pedidor } = conTraer();

    pedidor.pedir();

    expect(traer).toHaveBeenCalledTimes(1);
  });

  it('los pedidos que llegan antes del mínimo se juntan en uno solo, al cumplirse', async () => {
    const { traer, pedidor, terminar } = conTraer();
    pedidor.pedir();
    await terminar();

    await vi.advanceTimersByTimeAsync(1_000);
    pedidor.pedir();
    pedidor.pedir();
    pedidor.pedir();
    expect(traer).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(3_999);
    expect(traer).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(traer).toHaveBeenCalledTimes(2);
  });

  it('un pedido mientras trae no se pierde: vuelve a traer cuando termina, respetando el mínimo', async () => {
    const { traer, pedidor, terminar } = conTraer();
    pedidor.pedir();
    pedidor.pedir();
    expect(traer).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(7_000);
    await terminar();
    expect(traer).toHaveBeenCalledTimes(2);
  });

  it('si ya había otra carga en vuelo, se suma y después trae de nuevo', async () => {
    const { traer, pedidor, terminar } = conTraer(() => true);
    pedidor.pedir();
    await terminar();
    expect(traer).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(MINIMO);
    expect(traer).toHaveBeenCalledTimes(2);
  });

  it('un error al traer no lo traba', async () => {
    const traer = vi.fn(() => Promise.reject(new Error('sin señal')));
    const pedidor = crearPedidor({ traer, yaTrae: () => false, minimoMs: MINIMO });
    pedidor.pedir();
    await vi.advanceTimersByTimeAsync(MINIMO);
    pedidor.pedir();

    expect(traer).toHaveBeenCalledTimes(2);
  });

  it('cancelado, no trae más, ni lo que estaba esperando', async () => {
    const { traer, pedidor, terminar } = conTraer();
    pedidor.pedir();
    await terminar();
    pedidor.pedir();
    pedidor.cancelar();

    await vi.advanceTimersByTimeAsync(MINIMO * 2);
    pedidor.pedir();
    expect(traer).toHaveBeenCalledTimes(1);
  });
});
