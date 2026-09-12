import 'fake-indexeddb/auto';

import { onlineManager, QueryClient } from '@tanstack/react-query';
import {
  persistQueryClientRestore,
  persistQueryClientSave,
} from '@tanstack/react-query-persist-client';
import { afterEach, describe, expect, it } from 'vitest';

import { COLA_DE_SALIDA, esPersistible, reanudarCola } from './cola';
import { borrarCacheLocal, crearPersisterIndexedDb } from './persister';

interface Variables {
  orden: number;
}

const CLAVE = ['prueba', 'guardar'] as const;
const VERSION = 'test';

const PERSISTIR_PENDIENTES = {
  shouldDehydrateMutation: (mutacion: { state: { status: string } }) =>
    esPersistible(mutacion.state),
};

function esperar(ms: number): Promise<void> {
  return new Promise((resolver) => setTimeout(resolver, ms));
}

function clienteCon(
  guardar: (variables: Variables) => Promise<number>,
  scope: boolean,
): QueryClient {
  const cliente = new QueryClient({ defaultOptions: { mutations: { networkMode: 'online' } } });
  cliente.setMutationDefaults(CLAVE, {
    mutationFn: guardar,
    ...(scope ? { scope: COLA_DE_SALIDA } : {}),
  });
  return cliente;
}

function encolar(cliente: QueryClient, orden: number): void {
  const mutacion = cliente
    .getMutationCache()
    .build<number, Error, Variables, unknown>(cliente, { mutationKey: CLAVE });
  void mutacion.execute({ orden }).catch(() => undefined);
}

async function guardar(cliente: QueryClient): Promise<void> {
  await persistQueryClientSave({
    queryClient: cliente,
    persister: crearPersisterIndexedDb(),
    buster: VERSION,
    dehydrateOptions: PERSISTIR_PENDIENTES,
  });
}

async function restaurar(cliente: QueryClient): Promise<void> {
  await persistQueryClientRestore({
    queryClient: cliente,
    persister: crearPersisterIndexedDb(),
    buster: VERSION,
    maxAge: 60_000,
  });
}

afterEach(async () => {
  onlineManager.setOnline(true);
  await borrarCacheLocal();
});

describe('la cola de salida', () => {
  it('sin red queda en pausa, sobrevive a cerrar la app y se aplica en orden al volver la señal', async () => {
    onlineManager.setOnline(false);

    const primerCliente = clienteCon(
      () => Promise.reject(new Error('sin red no tendría que ejecutarse')),
      true,
    );
    primerCliente.setQueryData(['replica', 'u1'], { movimientos: 1 });
    encolar(primerCliente, 1);
    encolar(primerCliente, 2);
    await esperar(0);

    const enCola = primerCliente.getMutationCache().getAll();
    expect(enCola).toHaveLength(2);
    expect(enCola.every((mutacion) => mutacion.state.isPaused)).toBe(true);

    await guardar(primerCliente);

    // El cliente que restaura NO registra el scope: si el orden se sostiene, es porque el scope
    // viajó con la mutación persistida. Con el scope en los defaults, este test pasaría igual.
    const terminadas: number[] = [];
    const segundoCliente = clienteCon(async ({ orden }) => {
      if (orden === 1) await esperar(30);
      terminadas.push(orden);
      return orden;
    }, false);

    await restaurar(segundoCliente);

    expect(segundoCliente.getQueryData(['replica', 'u1'])).toEqual({ movimientos: 1 });
    expect(segundoCliente.getMutationCache().getAll()).toHaveLength(2);

    onlineManager.setOnline(true);
    reanudarCola(segundoCliente);
    await esperar(120);

    expect(terminadas).toEqual([1, 2]);
  });

  it('sin el scope de la cola se drenan en paralelo y terminan al revés: por eso lo lleva', async () => {
    onlineManager.setOnline(false);
    const terminadas: number[] = [];
    const cliente = clienteCon(async ({ orden }) => {
      if (orden === 1) await esperar(30);
      terminadas.push(orden);
      return orden;
    }, false);

    encolar(cliente, 1);
    encolar(cliente, 2);
    await esperar(0);

    onlineManager.setOnline(true);
    await cliente.resumePausedMutations();

    expect(terminadas).toEqual([2, 1]);
  });

  it('una mutación que ya salió y estaba reintentando también se persiste y se reanuda', async () => {
    // Con señal mala navigator.onLine dice que hay red: la mutación no se pausa, sale y reintenta.
    // Si solo se persistiera lo pausado, ese cambio se perdería al cerrar la app.
    let colgada: (() => void) | undefined;
    const primerCliente = clienteCon(
      () =>
        new Promise<number>((_, rechazar) => {
          colgada = () => {
            rechazar(new Error('se cerró la app'));
          };
        }),
      true,
    );

    encolar(primerCliente, 7);
    await esperar(0);

    const enVuelo = primerCliente.getMutationCache().getAll()[0];
    expect(enVuelo?.state.status).toBe('pending');
    expect(enVuelo?.state.isPaused).toBe(false);

    await guardar(primerCliente);
    colgada?.();

    const corridas: number[] = [];
    const segundoCliente = clienteCon(({ orden }) => {
      corridas.push(orden);
      return Promise.resolve(orden);
    }, true);

    await restaurar(segundoCliente);
    expect(segundoCliente.getMutationCache().getAll()).toHaveLength(1);

    reanudarCola(segundoCliente);
    await esperar(50);

    expect(corridas).toEqual([7]);
  });

  it('el cache que quedó en IndexedDB se descarta si cambia la versión', async () => {
    const cliente = clienteCon(() => Promise.resolve(0), true);
    cliente.setQueryData(['replica', 'u1'], { movimientos: 1 });
    await guardar(cliente);

    const otro = clienteCon(() => Promise.resolve(0), true);
    await persistQueryClientRestore({
      queryClient: otro,
      persister: crearPersisterIndexedDb(),
      buster: 'otra-version',
      maxAge: 60_000,
    });

    expect(otro.getQueryData(['replica', 'u1'])).toBeUndefined();
  });
});
