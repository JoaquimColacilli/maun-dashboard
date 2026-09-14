import { hydrate, MutationObserver, onlineManager, QueryClient } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  metaDeAvisos,
  TEXTOS_DE_AVISO,
  useAvisosEnPantalla,
  vaciarAvisosEnPantalla,
  type QueSeGuarda,
} from '@/shared/lib';

import { avisarDesdeLaCola } from './avisos-de-la-cola';

const avisados = vi.hoisted(() => [] as { tono: string; texto: string; detalle?: string }[]);

vi.mock('@/shared/lib', async (original) => {
  const real = await original<typeof import('@/shared/lib')>();
  return {
    ...real,
    avisarEnPantalla: (aviso: Parameters<typeof real.avisarEnPantalla>[0]) => {
      avisados.push({ tono: aviso.tono, texto: aviso.texto, detalle: aviso.detalle });
      return real.avisarEnPantalla(aviso);
    },
  };
});

const COLA = { id: 'salida' };

function cliente(): QueryClient {
  return new QueryClient({ defaultOptions: { mutations: { networkMode: 'online', retry: 0 } } });
}

function enPantalla(): { tono: string; texto: string }[] {
  return renderHook(() => useAvisosEnPantalla()).result.current.map(({ tono, texto }) => ({
    tono,
    texto,
  }));
}

describe('los avisos que salen de la cola', () => {
  let queryClient: QueryClient;
  let dejarDeEscuchar: () => void;

  beforeEach(() => {
    avisados.length = 0;
    vaciarAvisosEnPantalla();
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

  function enEspera(): boolean {
    return queryClient.getMutationCache().getAll().at(-1)?.state.isPaused === true;
  }

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

  it.each<QueSeGuarda>([
    'contactoGuardado',
    'movimientoNuevo',
    'clienteNuevo',
    'proyectoGuardado',
    'proyectoAvanzado',
  ])(
    'con señal, %s que espera su turno detrás de otro cambio no dice que quedó sin señal',
    async (que) => {
      let soltar: () => void = () => undefined;
      const delante = new MutationObserver(queryClient, {
        mutationFn: () =>
          new Promise<void>((resolver) => {
            soltar = resolver;
          }),
        scope: COLA,
      });
      const detras = new MutationObserver(queryClient, {
        mutationFn: () => Promise.resolve(),
        scope: COLA,
        meta: metaDeAvisos(que),
      });

      const primero = delante.mutate();
      const segundo = detras.mutate();
      await vi.waitFor(() => {
        expect(enEspera()).toBe(true);
      });
      expect(avisados).toEqual([]);

      soltar();
      await primero;
      await segundo;
      expect(avisados.map((aviso) => aviso.texto)).toEqual([TEXTOS_DE_AVISO[que].hecho]);
      expect(enPantalla()).toEqual([{ tono: 'hecho', texto: TEXTOS_DE_AVISO[que].hecho }]);
    },
  );

  it('sin señal deja un solo aviso, que pasa a decir que se guardó cuando vuelve la señal', async () => {
    onlineManager.setOnline(false);
    const observador = new MutationObserver(queryClient, {
      mutationFn: () => Promise.resolve(),
      scope: COLA,
      meta: metaDeAvisos('contactoGuardado'),
    });

    const enCola = observador.mutate();
    await vi.waitFor(() => {
      expect(enPantalla()).toEqual([
        { tono: 'en-cola', texto: 'Contacto anotado sin señal: se guarda solo cuando vuelva.' },
      ]);
    });

    onlineManager.setOnline(true);
    await enCola;
    expect(enPantalla()).toEqual([
      { tono: 'hecho', texto: 'Contacto guardado. Estaba anotado sin señal.' },
    ]);
  });

  it('si se corta la señal mientras espera su turno, avisa una sola vez que quedó anotado', async () => {
    let soltar: () => void = () => undefined;
    const delante = new MutationObserver(queryClient, {
      mutationFn: () =>
        new Promise<void>((resolver) => {
          soltar = resolver;
        }),
      scope: COLA,
    });
    const detras = new MutationObserver(queryClient, {
      mutationFn: () => Promise.resolve(),
      scope: COLA,
      meta: metaDeAvisos('contactoGuardado'),
    });

    const primero = delante.mutate();
    const segundo = detras.mutate();
    await vi.waitFor(() => {
      expect(enEspera()).toBe(true);
    });

    onlineManager.setOnline(false);
    expect(enPantalla()).toEqual([
      { tono: 'en-cola', texto: 'Contacto anotado sin señal: se guarda solo cuando vuelva.' },
    ]);

    soltar();
    await primero;
    onlineManager.setOnline(true);
    await segundo;

    expect(avisados.filter((aviso) => aviso.tono === 'en-cola')).toHaveLength(1);
    expect(enPantalla()).toEqual([
      { tono: 'hecho', texto: 'Contacto guardado. Estaba anotado sin señal.' },
    ]);
  });

  it('lo que quedó anotado en otra apertura, al guardarse, dice que estaba sin señal', async () => {
    const clave = ['avisos', 'restaurada'];
    queryClient.setMutationDefaults(clave, { mutationFn: () => Promise.resolve() });
    hydrate(queryClient, {
      queries: [],
      mutations: [
        {
          mutationKey: clave,
          meta: metaDeAvisos('clienteNuevo'),
          scope: COLA,
          state: {
            context: undefined,
            data: undefined,
            error: null,
            failureCount: 0,
            failureReason: null,
            isPaused: true,
            status: 'pending',
            variables: undefined,
            submittedAt: 0,
          },
        },
      ],
    });

    await queryClient.resumePausedMutations();
    expect(enPantalla()).toEqual([
      { tono: 'hecho', texto: 'Cliente guardado. Estaba anotado sin señal.' },
    ]);
  });

  it('si lo anotado sin señal rebota al volver, el aviso pasa a ser el error en vez de sumarse', async () => {
    onlineManager.setOnline(false);
    const observador = new MutationObserver(queryClient, {
      mutationFn: () =>
        Promise.reject(
          Object.assign(new Error('tiene proyectos vivos'), { code: 'MN003', hint: '' }),
        ),
      scope: COLA,
      meta: metaDeAvisos('clienteBorrado', { sujeto: 'Rosa Ibarra' }),
    });

    const enCola = observador.mutate().catch(() => undefined);
    await vi.waitFor(() => {
      expect(enPantalla()).toHaveLength(1);
    });

    onlineManager.setOnline(true);
    await enCola;
    expect(enPantalla()).toEqual([{ tono: 'error', texto: 'No se borró el cliente.' }]);
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
