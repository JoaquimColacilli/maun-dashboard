import { describe, expect, it, vi } from 'vitest';

import { EVENTO_DE_LOS_CAMBIOS, escucharLosCambios, temaDeLosCambios } from './cambios.ts';
import type { ClienteMaun } from './cliente.ts';

function clienteFalso() {
  const oyentes: { tipo: string; filtro: unknown; oyente: () => void }[] = [];
  let alSuscribirse: ((estado: string) => void) | undefined;
  const canal = {
    on: vi.fn((tipo: string, filtro: unknown, oyente: () => void) => {
      oyentes.push({ tipo, filtro, oyente });
      return canal;
    }),
    subscribe: vi.fn((oyente: (estado: string) => void) => {
      alSuscribirse = oyente;
      return canal;
    }),
  };
  const channel = vi.fn(() => canal);
  const removeChannel = vi.fn(() => Promise.resolve('ok'));
  const cliente = { channel, removeChannel } as unknown as ClienteMaun;
  return {
    cliente,
    channel,
    removeChannel,
    canal,
    oyentes,
    estado: (estado: string) => alSuscribirse?.(estado),
  };
}

describe('escucharLosCambios', () => {
  it('se suscribe al canal privado del taller, al evento de los cambios', () => {
    const falso = clienteFalso();

    escucharLosCambios(falso.cliente, 'h1', { alAvisar: vi.fn(), alConectar: vi.fn() });

    expect(temaDeLosCambios('h1')).toBe('cambios:h1');
    expect(falso.channel).toHaveBeenCalledWith('cambios:h1', { config: { private: true } });
    expect(falso.oyentes.map(({ tipo, filtro }) => [tipo, filtro])).toEqual([
      ['broadcast', { event: EVENTO_DE_LOS_CAMBIOS }],
    ]);
  });

  it('avisa cada aviso, y cada vez que queda conectado, también al reconectar', () => {
    const falso = clienteFalso();
    const alAvisar = vi.fn();
    const alConectar = vi.fn();

    escucharLosCambios(falso.cliente, 'h1', { alAvisar, alConectar });
    falso.oyentes[0]?.oyente();
    falso.estado('SUBSCRIBED');
    falso.estado('CHANNEL_ERROR');
    falso.estado('SUBSCRIBED');

    expect(alAvisar).toHaveBeenCalledTimes(1);
    expect(alConectar).toHaveBeenCalledTimes(2);
  });

  it('dejar de escuchar saca el canal', () => {
    const falso = clienteFalso();

    const dejar = escucharLosCambios(falso.cliente, 'h1', {
      alAvisar: vi.fn(),
      alConectar: vi.fn(),
    });
    dejar();

    expect(falso.removeChannel).toHaveBeenCalledWith(falso.canal);
  });
});
