import { onlineManager, QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { claveDeReplica, COLA_DE_SALIDA } from '@/shared/lib';

import { sincronizarAhora } from './sincronizarAhora';

const CLAVE = claveDeReplica('u1');

function esperar(ms: number): Promise<void> {
  return new Promise((resolver) => setTimeout(resolver, ms));
}

async function clienteConReplica(traer: () => Promise<unknown>): Promise<QueryClient> {
  const cliente = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { networkMode: 'online' } },
  });
  cliente.setQueryDefaults(CLAVE, { queryFn: traer });
  await cliente.query({ queryKey: CLAVE });
  return cliente;
}

async function encolarSinSenal(
  cliente: QueryClient,
  guardar: () => Promise<unknown>,
): Promise<void> {
  onlineManager.setOnline(false);
  const mutacion = cliente
    .getMutationCache()
    .build(cliente, { mutationFn: guardar, scope: COLA_DE_SALIDA, networkMode: 'online' });
  void mutacion.execute(undefined).catch(() => undefined);
  await esperar(0);
}

function conLaSenal(hay: boolean): void {
  vi.spyOn(Navigator.prototype, 'onLine', 'get').mockReturnValue(hay);
}

afterEach(() => {
  vi.restoreAllMocks();
  onlineManager.setOnline(true);
});

describe('sincronizarAhora', () => {
  it('sin señal no sale a la red: dice cuántos cambios esperan a que vuelva', async () => {
    const traer = vi.fn(() => Promise.resolve({ vuelta: 1 }));
    const guardar = vi.fn(() => Promise.resolve(1));
    const cliente = await clienteConReplica(traer);
    await encolarSinSenal(cliente, guardar);
    conLaSenal(false);

    expect(await sincronizarAhora(cliente, 'u1')).toEqual({
      tipo: 'estado',
      estado: { tipo: 'sin-conexion', pendientes: 1 },
    });
    expect(traer).toHaveBeenCalledTimes(1);
    expect(guardar).not.toHaveBeenCalled();
  });

  it('con señal drena la cola y trae lo último, aunque el aviso de que volvió la señal no haya llegado', async () => {
    let vuelta = 0;
    const traer = vi.fn(() => {
      vuelta += 1;
      return Promise.resolve({ vuelta });
    });
    const guardar = vi.fn(() => Promise.resolve(1));
    const cliente = await clienteConReplica(traer);
    await encolarSinSenal(cliente, guardar);
    expect(cliente.getMutationCache().getAll()[0]?.state.isPaused).toBe(true);
    conLaSenal(true);

    expect(await sincronizarAhora(cliente, 'u1')).toEqual({
      tipo: 'estado',
      estado: { tipo: 'sincronizado' },
    });
    expect(guardar).toHaveBeenCalledTimes(1);
    expect(traer).toHaveBeenCalledTimes(2);
    expect(cliente.getQueryData(CLAVE)).toEqual({ vuelta: 2 });
  });

  it('lo que la base rechaza al drenar queda como rechazado, no como sincronizado', async () => {
    const cliente = await clienteConReplica(() => Promise.resolve({ vuelta: 1 }));
    await encolarSinSenal(cliente, () => Promise.reject(new Error('rechazado')));
    conLaSenal(true);

    expect(await sincronizarAhora(cliente, 'u1')).toEqual({
      tipo: 'estado',
      estado: { tipo: 'rechazado', rechazados: 1 },
    });
  });

  it('si la réplica no llega con señal, es un fallo con su motivo', async () => {
    const error = new Error('se cayó');
    const traer = vi.fn().mockResolvedValueOnce({ vuelta: 1 }).mockRejectedValueOnce(error);
    const cliente = await clienteConReplica(traer);
    conLaSenal(true);

    expect(await sincronizarAhora(cliente, 'u1')).toEqual({ tipo: 'fallo', error });
  });

  it('si no responde antes del tope, lo dice en vez de quedar esperando para siempre', async () => {
    const traer = vi
      .fn()
      .mockResolvedValueOnce({ vuelta: 1 })
      .mockReturnValueOnce(new Promise(() => undefined));
    const cliente = await clienteConReplica(traer);
    conLaSenal(true);

    expect(await sincronizarAhora(cliente, 'u1', 20)).toEqual({ tipo: 'sin-respuesta' });
  });
});
