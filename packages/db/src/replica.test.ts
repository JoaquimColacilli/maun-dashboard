import { describe, expect, it } from 'vitest';

import {
  ajustesDe,
  aplicarFilaLocal,
  aplicarLote,
  cantidadDe,
  filasDe,
  householdDe,
  leerLote,
  necesitaReconcile,
  quitarFilaLocal,
  replicaVacia,
  RespuestaInvalidaError,
  TABLAS_REPLICADAS,
  tieneAcceso,
  type FilaDe,
  type Lote,
  type ModoDeSincronizacion,
  type Replica,
  type TablaReplicada,
} from './replica.ts';

const USUARIO = '11111111-1111-7000-8000-000000000001';
const AHORA = Date.parse('2026-09-11T12:00:00Z');
const HACE_23_HORAS = Date.parse('2026-09-10T13:00:00Z');
const HACE_24_HORAS = Date.parse('2026-09-10T12:00:00Z');

function cruda(id: string, version: number, extra: Record<string, unknown> = {}) {
  return { id, version, deleted_at: null, ...extra };
}

function borrada(id: string, version: number) {
  return { id, version, deleted_at: '2026-09-11T12:00:00Z' };
}

function lote(cursor: string, filas: Partial<Record<TablaReplicada, unknown[]>>): Lote {
  const cuerpo: Record<string, unknown> = { cursor };
  for (const tabla of TABLAS_REPLICADAS) cuerpo[tabla] = filas[tabla] ?? [];
  return leerLote(cuerpo);
}

function conClientes(
  cursor: string,
  filas: unknown[],
  modo: ModoDeSincronizacion = 'reconcile',
  ahora = AHORA,
) {
  return aplicarLote(replicaVacia(USUARIO), lote(cursor, { clientes: filas }), modo, ahora);
}

function ids(replica: Replica, tabla: TablaReplicada): string[] {
  return filasDe(replica, tabla).map((fila) => (fila as { id: string }).id);
}

describe('leerLote', () => {
  it('acepta la respuesta de bootstrap y delta', () => {
    const resultado = lote('2026-09-11T12:00:00Z', { clientes: [cruda('c1', 1)] });
    expect(resultado.cursor).toBe('2026-09-11T12:00:00Z');
    expect(resultado.filas.clientes).toHaveLength(1);
    expect(resultado.filas.movimientos).toHaveLength(0);
  });

  it('rechaza lo que no es un objeto', () => {
    expect(() => leerLote(null)).toThrow(RespuestaInvalidaError);
    expect(() => leerLote('{}')).toThrow(RespuestaInvalidaError);
  });

  it('rechaza una respuesta sin cursor', () => {
    expect(() => leerLote({ clientes: [] })).toThrow(/cursor/);
  });

  it('rechaza una respuesta a la que le falta una tabla', () => {
    expect(() => leerLote({ cursor: 'x', clientes: [] })).toThrow(/households/);
  });

  it('rechaza una fila sin los campos que la sincronización necesita', () => {
    expect(() => lote('x', { clientes: [{ id: 'c1', version: 1 }] })).toThrow(/deleted_at/);
    expect(() => lote('x', { clientes: [{ id: 'c1', version: 1.5, deleted_at: null }] })).toThrow(
      /version/,
    );
  });
});

describe('aplicarLote', () => {
  it('con reconcile reemplaza la copia entera', () => {
    const primera = conClientes('t1', [cruda('c1', 1), cruda('c2', 1)]);
    const segunda = aplicarLote(
      primera,
      lote('t2', { clientes: [cruda('c3', 1)] }),
      'reconcile',
      AHORA,
    );

    expect(ids(segunda, 'clientes')).toEqual(['c3']);
    expect(segunda.cursor).toBe('t2');
  });

  it('con delta agrega, actualiza y saca lo borrado', () => {
    const previa = conClientes('t1', [cruda('c1', 1), cruda('c2', 1)]);
    const siguiente = aplicarLote(
      previa,
      lote('t2', {
        clientes: [cruda('c1', 2, { nombre: 'Marcela' }), borrada('c2', 2), cruda('c3', 1)],
      }),
      'delta',
      AHORA,
    );

    expect(ids(siguiente, 'clientes')).toEqual(['c1', 'c3']);
    expect(filasDe(siguiente, 'clientes')[0]).toMatchObject({ version: 2, nombre: 'Marcela' });
    expect(siguiente.cursor).toBe('t2');
    expect(siguiente.reconciliadoEn).toBe(previa.reconciliadoEn);
  });

  it('una fila más vieja no pisa a la más nueva: cubre un delta que llega fuera de orden', () => {
    const previa = conClientes('t1', [cruda('c1', 5, { nombre: 'al día' })]);
    const siguiente = aplicarLote(
      previa,
      lote('t2', { clientes: [cruda('c1', 4, { nombre: 'vieja' })] }),
      'delta',
      AHORA,
    );

    expect(filasDe(siguiente, 'clientes')[0]).toMatchObject({ version: 5, nombre: 'al día' });
  });

  it('con la misma version gana la del servidor: es el solape, y completa la fila optimista', () => {
    const previa = aplicarFilaLocal(replicaVacia(USUARIO), 'movimientos', {
      id: 'm1',
      version: 1,
      deleted_at: null,
      household_id: '',
    } as unknown as FilaDe<'movimientos'>);
    const siguiente = aplicarLote(
      previa,
      lote('t2', { movimientos: [cruda('m1', 1, { household_id: 'h1' })] }),
      'delta',
      AHORA,
    );

    expect(filasDe(siguiente, 'movimientos')[0]).toMatchObject({ household_id: 'h1' });
  });

  it('no toca la réplica anterior', () => {
    const previa = conClientes('t1', [cruda('c1', 1)]);
    aplicarLote(
      previa,
      lote('t2', { clientes: [borrada('c1', 2), cruda('c2', 1)] }),
      'delta',
      AHORA,
    );

    expect(ids(previa, 'clientes')).toEqual(['c1']);
    expect(previa.cursor).toBe('t1');
  });
});

describe('aplicarFilaLocal', () => {
  it('agrega la fila optimista y la baja la saca', () => {
    const fila = { id: 'm1', version: 1, deleted_at: null } as unknown as FilaDe<'movimientos'>;
    const conFila = aplicarFilaLocal(replicaVacia(USUARIO), 'movimientos', fila);
    expect(ids(conFila, 'movimientos')).toEqual(['m1']);

    const baja = {
      ...fila,
      deleted_at: '2026-09-11T12:00:00Z',
    } as unknown as FilaDe<'movimientos'>;
    expect(ids(aplicarFilaLocal(conFila, 'movimientos', baja), 'movimientos')).toEqual([]);
  });

  it('no toca las otras tablas ni la réplica anterior', () => {
    const previa = conClientes('t1', [cruda('c1', 1)]);
    const siguiente = aplicarFilaLocal(previa, 'movimientos', {
      id: 'm1',
      version: 1,
      deleted_at: null,
    } as unknown as FilaDe<'movimientos'>);

    expect(ids(siguiente, 'clientes')).toEqual(['c1']);
    expect(cantidadDe(previa, 'movimientos')).toBe(0);
    expect(siguiente.cursor).toBe(previa.cursor);
  });
});

describe('quitarFilaLocal', () => {
  it('saca la fila optimista que la base rechazó', () => {
    const conFila = aplicarFilaLocal(replicaVacia(USUARIO), 'movimientos', {
      id: 'm1',
      version: 1,
      deleted_at: null,
    } as unknown as FilaDe<'movimientos'>);

    expect(ids(quitarFilaLocal(conFila, 'movimientos', 'm1'), 'movimientos')).toEqual([]);
  });

  it('devuelve la misma réplica si la fila no está', () => {
    const replica = conClientes('t1', [cruda('c1', 1)]);
    expect(quitarFilaLocal(replica, 'movimientos', 'm1')).toBe(replica);
  });
});

describe('lecturas de la réplica', () => {
  it('ordena por id, que en UUIDv7 es por fecha de creación', () => {
    const replica = conClientes('t1', [cruda('c3', 1), cruda('c1', 1), cruda('c2', 1)]);
    expect(ids(replica, 'clientes')).toEqual(['c1', 'c2', 'c3']);
  });

  it('sin household no hay acceso, y con household hay ajustes', () => {
    expect(tieneAcceso(replicaVacia(USUARIO))).toBe(false);
    expect(householdDe(replicaVacia(USUARIO))).toBeUndefined();
    expect(ajustesDe(replicaVacia(USUARIO))).toBeUndefined();

    const replica = aplicarLote(
      replicaVacia(USUARIO),
      lote('t1', {
        households: [cruda('h1', 1, { nombre: 'Taller' })],
        ajustes: [cruda('a1', 1, { sueldo_mensual_centavos: 180000000 })],
      }),
      'reconcile',
      AHORA,
    );

    expect(tieneAcceso(replica)).toBe(true);
    expect(householdDe(replica)).toMatchObject({ nombre: 'Taller' });
    expect(ajustesDe(replica)).toMatchObject({ sueldo_mensual_centavos: 180000000 });
  });
});

describe('necesitaReconcile', () => {
  it('sin réplica, o sin reconcile previo, o con una marca ilegible', () => {
    expect(necesitaReconcile(undefined, AHORA)).toBe(true);
    expect(necesitaReconcile(replicaVacia(USUARIO), AHORA)).toBe(true);

    const corrupta: Replica = { ...conClientes('t1', []), reconciliadoEn: 'no es una fecha' };
    expect(necesitaReconcile(corrupta, AHORA)).toBe(true);
  });

  it('a las 24 horas sí, antes no', () => {
    expect(necesitaReconcile(conClientes('t1', [], 'reconcile', HACE_23_HORAS), AHORA)).toBe(false);
    expect(necesitaReconcile(conClientes('t1', [], 'reconcile', HACE_24_HORAS), AHORA)).toBe(true);
  });

  it('la marca del reconcile es el reloj del cliente, no el cursor del servidor', () => {
    const replica = conClientes('2020-01-01T00:00:00Z', [], 'reconcile', AHORA);

    expect(replica.reconciliadoEn).toBe(new Date(AHORA).toISOString());
    expect(replica.cursor).toBe('2020-01-01T00:00:00Z');
    // Con el cursor del servidor como marca, esto pediría un bootstrap en cada sincronización.
    expect(necesitaReconcile(replica, AHORA + 60_000)).toBe(false);
  });
});
