import { describe, expect, it } from 'vitest';

import { TABLAS_REPLICADAS, type Replica, type TablaReplicada } from '@/shared/api';

import type { ResumenDeProyecto } from './resumen';
import {
  etapaAlVolver,
  historiaDelSeguimiento,
  pendienteDelSeguimiento,
  seguimientosEnOrden,
  type ProximoContacto,
} from './seguimiento';

const HOY = '2026-09-23';

function contacto(extra: Partial<ProximoContacto>): ProximoContacto {
  return {
    id: 'c',
    household_id: 'h',
    proyecto_id: 'p1',
    fecha: '2026-10-01',
    nota: '',
    etapa_previa: 'presupuesto_enviado',
    hecho_el: null,
    resultado: null,
    respuesta: '',
    importante: false,
    created_at: '2026-09-01T12:00:00Z',
    updated_at: '2026-09-01T12:00:00Z',
    deleted_at: null,
    version: 1,
    ...extra,
  };
}

function replicaCon(contactos: readonly ProximoContacto[]): Replica {
  const tablas = {} as Record<TablaReplicada, Record<string, unknown>>;
  for (const tabla of TABLAS_REPLICADAS) tablas[tabla] = {};
  for (const fila of contactos) tablas.proximos_contactos[fila.id] = fila;
  return { usuarioId: 'u', cursor: '', reconciliadoEn: '', tablas } as unknown as Replica;
}

function resumen(id: string, fase: ResumenDeProyecto['fase']): ResumenDeProyecto {
  return { fase, proyecto: { id } } as unknown as ResumenDeProyecto;
}

describe('el seguimiento de un trabajo', () => {
  const replica = replicaCon([
    contacto({
      id: 'viejo',
      hecho_el: '2026-09-02',
      resultado: 'otra_fecha',
      created_at: '2026-08-01T12:00:00Z',
    }),
    contacto({ id: 'medio', hecho_el: '2026-09-15', resultado: 'otra_fecha' }),
    contacto({ id: 'pendiente', fecha: '2026-10-15' }),
    contacto({ id: 'borrado', deleted_at: '2026-09-20T12:00:00Z' }),
    contacto({ id: 'ajeno', proyecto_id: 'p2', fecha: '2026-09-20' }),
  ]);

  it('el pendiente es el único sin registrar, y lo borrado no cuenta', () => {
    expect(pendienteDelSeguimiento(replica, 'p1')?.id).toBe('pendiente');
  });

  it('la historia es lo registrado, lo más nuevo arriba', () => {
    expect(historiaDelSeguimiento(replica, 'p1').map((fila) => fila.id)).toEqual([
      'medio',
      'viejo',
    ]);
  });

  it('reactivar vuelve a la etapa en que estaba, y si no se sabe, a presupuesto enviado', () => {
    expect(etapaAlVolver(contacto({ etapa_previa: 'relevamiento' }))).toBe('relevamiento');
    expect(etapaAlVolver(undefined)).toBe('presupuesto_enviado');
  });

  it('la pestaña se ordena por el próximo contacto: lo atrasado primero, y dice qué es de hoy', () => {
    const lista = seguimientosEnOrden(
      [resumen('p1', 'seguimiento'), resumen('p2', 'seguimiento'), resumen('p3', 'consultas')],
      replicaCon([
        contacto({ id: 'a', proyecto_id: 'p1', fecha: '2026-10-15' }),
        contacto({ id: 'b', proyecto_id: 'p2', fecha: '2026-09-20' }),
      ]),
      HOY,
    );
    expect(lista.map((fila) => [fila.resumen.proyecto.id, fila.atrasado, fila.esHoy])).toEqual([
      ['p2', true, false],
      ['p1', false, false],
    ]);
  });

  it('uno sin pendiente, que no debería existir, va al final en vez de romper', () => {
    const lista = seguimientosEnOrden(
      [resumen('sin', 'seguimiento'), resumen('p1', 'seguimiento')],
      replicaCon([contacto({ id: 'a', proyecto_id: 'p1', fecha: HOY })]),
      HOY,
    );
    expect(lista.map((fila) => [fila.resumen.proyecto.id, fila.esHoy])).toEqual([
      ['p1', true],
      ['sin', false],
    ]);
  });
});
