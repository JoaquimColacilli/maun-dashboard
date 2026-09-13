import { MutationObserver, onlineManager, QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { metaDeAvisos, vaciarAvisosEnPantalla } from '@/shared/lib';

import { avisarDesdeLaCola } from './avisos-de-la-cola';

const avisados = vi.hoisted(() => [] as { tono: string; texto: string; detalle?: string }[]);

vi.mock('@/shared/lib', async (original) => {
  const real = await original<typeof import('@/shared/lib')>();
  return {
    ...real,
    avisarEnPantalla: (aviso: { tono: string; texto: string; detalle?: string }) => {
      avisados.push({ tono: aviso.tono, texto: aviso.texto, detalle: aviso.detalle });
    },
  };
});

function cliente(): QueryClient {
  return new QueryClient({ defaultOptions: { mutations: { networkMode: 'online', retry: 0 } } });
}

describe('los avisos que salen de la cola', () => {
  let queryClient: QueryClient;
  let dejarDeEscuchar: () => void;

  beforeEach(() => {
    avisados.length = 0;
    onlineManager.setOnline(true);
    queryClient = cliente();
    queryClient.mount();
    dejarDeEscuchar = avisarDesdeLaCola(queryClient);
  });

  afterEach(() => {
    dejarDeEscuchar();
    queryClient.unmount();
    onlineManager.setOnline(true);
    vaciarAvisosEnPantalla();
  });

  it('con señal dice guardado recién cuando el servidor contesta', async () => {
    let contestar: () => void = () => undefined;
    const observador = new MutationObserver(queryClient, {
      mutationFn: () =>
        new Promise<void>((resolver) => {
          contestar = resolver;
        }),
      meta: metaDeAvisos('movimientoNuevo'),
    });

    const enVuelo = observador.mutate();
    await Promise.resolve();
    expect(avisados).toEqual([]);

    contestar();
    await enVuelo;
    expect(avisados).toEqual([
      { tono: 'hecho', texto: 'Movimiento guardado.', detalle: undefined },
    ]);
  });

  it('sin señal dice anotado, no guardado, y cuando vuelve la señal dice que se guardó', async () => {
    onlineManager.setOnline(false);
    const observador = new MutationObserver(queryClient, {
      mutationFn: () => Promise.resolve(),
      meta: metaDeAvisos('movimientoNuevo'),
    });

    const enCola = observador.mutate();
    await vi.waitFor(() => {
      expect(avisados).toHaveLength(1);
    });
    expect(avisados[0]).toMatchObject({
      tono: 'en-cola',
      texto: 'Movimiento anotado sin señal: se guarda solo cuando vuelva.',
    });
    expect(avisados.some((aviso) => aviso.texto === 'Movimiento guardado.')).toBe(false);

    onlineManager.setOnline(true);
    await enCola;
    expect(avisados[1]).toMatchObject({
      tono: 'hecho',
      texto: 'Movimiento guardado. Estaba anotado sin señal.',
    });
  });

  it('un rechazo que ya se ve en el formulario abierto no se repite en un aviso', async () => {
    const observador = new MutationObserver(queryClient, {
      mutationFn: () => Promise.reject(new Error('MN006')),
      meta: metaDeAvisos('proyectoGuardado', { errorEnPantalla: true }),
    });
    const dejar = observador.subscribe(() => undefined);

    await observador.mutate().catch(() => undefined);
    expect(avisados).toEqual([]);
    dejar();
  });

  it('un rechazo que llega con el formulario ya cerrado se avisa como error, con el motivo', async () => {
    const observador = new MutationObserver(queryClient, {
      mutationFn: () =>
        Promise.reject(
          Object.assign(new Error('tiene proyectos vivos'), { code: 'MN003', hint: '' }),
        ),
      meta: metaDeAvisos('clienteBorrado', { errorEnPantalla: true, sujeto: 'Rosa Ibarra' }),
    });
    const dejar = observador.subscribe(() => undefined);

    const enVuelo = observador.mutate().catch(() => undefined);
    dejar();
    await enVuelo;
    expect(avisados).toHaveLength(1);
    expect(avisados[0]?.tono).toBe('error');
    expect(avisados[0]?.texto).toBe('No se borró el cliente.');
    expect(avisados[0]?.detalle).toContain('«Rosa Ibarra» tiene trabajos cargados.');
  });

  it('una mutación sin textos de aviso, como las notas o un cobro, no avisa nada', async () => {
    const observador = new MutationObserver(queryClient, { mutationFn: () => Promise.resolve() });
    await observador.mutate();
    expect(avisados).toEqual([]);
  });
});
