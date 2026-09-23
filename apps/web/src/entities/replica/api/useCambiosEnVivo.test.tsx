import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { OyentesDeLosCambios } from '@/shared/api';
import { claveDeReplica } from '@/shared/lib';

import { MINIMO_ENTRE_PEDIDOS_MS, useCambiosEnVivo } from './useCambiosEnVivo';

const escuchas = vi.hoisted(() => ({
  abiertas: [] as { taller: string; oyentes: OyentesDeLosCambios; dejar: () => void }[],
}));

vi.mock('@/shared/api', () => ({
  escucharLosCambiosDelTaller: (taller: string, oyentes: OyentesDeLosCambios) => {
    const dejar = vi.fn();
    escuchas.abiertas.push({ taller, oyentes, dejar });
    return dejar;
  },
}));

const CLAVE = claveDeReplica('u1');

let visibilidad: DocumentVisibilityState = 'visible';

function ponerLaVisibilidad(estado: DocumentVisibilityState): void {
  visibilidad = estado;
  document.dispatchEvent(new Event('visibilitychange'));
}

function montar(householdId: string | null = 'h1') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const traer = vi.fn(() => Promise.resolve({ filas: 1 }));
  queryClient.setQueryDefaults(CLAVE, { queryFn: traer });
  queryClient.setQueryData(CLAVE, { filas: 0 });
  const envoltorio = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const hook = renderHook(
    () => {
      useCambiosEnVivo('u1', householdId);
    },
    { wrapper: envoltorio },
  );
  return { traer, hook };
}

function ultima() {
  const escucha = escuchas.abiertas.at(-1);
  if (escucha === undefined) throw new Error('no se abrió ninguna escucha');
  return escucha;
}

beforeEach(() => {
  vi.useFakeTimers();
  escuchas.abiertas.length = 0;
  visibilidad = 'visible';
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibilidad);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useCambiosEnVivo', () => {
  it('a la vista escucha el canal de su taller, y al conectarse trae el delta', async () => {
    const { traer } = montar();

    expect(escuchas.abiertas.map((escucha) => escucha.taller)).toEqual(['h1']);
    ultima().oyentes.alConectar();
    await vi.advanceTimersByTimeAsync(0);

    expect(traer).toHaveBeenCalledTimes(1);
  });

  it('cada aviso trae el delta, con el mínimo de segundos entre pedidos', async () => {
    const { traer } = montar();
    ultima().oyentes.alAvisar();
    await vi.advanceTimersByTimeAsync(0);
    ultima().oyentes.alAvisar();
    ultima().oyentes.alAvisar();
    await vi.advanceTimersByTimeAsync(0);
    expect(traer).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(MINIMO_ENTRE_PEDIDOS_MS);
    expect(traer).toHaveBeenCalledTimes(2);
  });

  it('oculta deja el canal; al volver lo escucha de nuevo y trae lo nuevo sin esperar el aviso', async () => {
    const { traer } = montar();
    const primera = ultima();

    ponerLaVisibilidad('hidden');
    expect(primera.dejar).toHaveBeenCalledTimes(1);

    ponerLaVisibilidad('visible');
    await vi.advanceTimersByTimeAsync(0);
    expect(escuchas.abiertas).toHaveLength(2);
    expect(traer).toHaveBeenCalledTimes(1);
  });

  it('cuando vuelve la señal trae el delta', async () => {
    const { traer } = montar();

    globalThis.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(0);

    expect(traer).toHaveBeenCalledTimes(1);
  });

  it('abierta de fondo no escucha hasta que se la ve', () => {
    visibilidad = 'hidden';
    montar();
    expect(escuchas.abiertas).toHaveLength(0);

    ponerLaVisibilidad('visible');
    expect(escuchas.abiertas).toHaveLength(1);
  });

  it('sin taller no escucha nada', () => {
    const { traer } = montar(null);
    ponerLaVisibilidad('visible');

    expect(escuchas.abiertas).toHaveLength(0);
    expect(traer).not.toHaveBeenCalled();
  });

  it('al desmontarse deja el canal y no trae lo que quedaba esperando', async () => {
    const { traer, hook } = montar();
    ultima().oyentes.alAvisar();
    await vi.advanceTimersByTimeAsync(0);
    ultima().oyentes.alAvisar();

    hook.unmount();
    await vi.advanceTimersByTimeAsync(MINIMO_ENTRE_PEDIDOS_MS * 2);

    expect(ultima().dejar).toHaveBeenCalledTimes(1);
    expect(traer).toHaveBeenCalledTimes(1);
  });
});
