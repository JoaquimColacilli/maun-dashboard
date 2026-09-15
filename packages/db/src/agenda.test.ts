import { describe, expect, it } from 'vitest';

import { datosDeLaAgenda, datosDeLaAgendaDeLaReplica } from './agenda.ts';
import { aplicarFilaLocal, replicaVacia, type FilaDe } from './replica.ts';

const METADATOS = {
  household_id: 'h',
  created_at: '2026-09-01T12:00:00Z',
  updated_at: '2026-09-01T12:00:00Z',
  deleted_at: null,
  version: 1,
} as const;

const PROYECTO = {
  ...METADATOS,
  id: 'p1',
  cliente_id: 'c1',
  titulo: 'Mesada y alacena',
  estado: 'a_presupuestar',
  fecha_visita: '2026-09-07',
  entrega_estimada: null,
  vencimiento_presupuesto: '2026-09-10',
  direccion_entrega: 'Sarmiento 2310',
} as unknown as FilaDe<'proyectos'>;

const CLIENTE = {
  ...METADATOS,
  id: 'c1',
  nombre: 'Familia Villalba',
  zona: 'Morón',
} as unknown as FilaDe<'clientes'>;

const ANOTACION: FilaDe<'anotaciones'> = {
  ...METADATOS,
  id: 'n1',
  fecha: '2026-09-08',
  hora: '15:00:00',
  texto: 'Retirar el pulpo',
  categoria: 'taller',
  proyecto_id: null,
  hecha: false,
  importante: true,
};

describe('datosDeLaAgenda', () => {
  it('traduce las filas de la base a lo que el dominio lee, y la hora va sin segundos', () => {
    expect(
      datosDeLaAgenda({
        proyectos: [PROYECTO],
        clientes: [CLIENTE],
        anotaciones: [ANOTACION, { ...ANOTACION, id: 'n2', hora: null }],
      }),
    ).toEqual({
      proyectos: [
        {
          id: 'p1',
          clienteId: 'c1',
          titulo: 'Mesada y alacena',
          estado: 'a_presupuestar',
          fechaVisita: '2026-09-07',
          entregaEstimada: null,
          vencimientoPresupuesto: '2026-09-10',
          direccionEntrega: 'Sarmiento 2310',
        },
      ],
      clientes: [{ id: 'c1', nombre: 'Familia Villalba', zona: 'Morón' }],
      anotaciones: [
        {
          id: 'n1',
          fecha: '2026-09-08',
          hora: '15:00',
          texto: 'Retirar el pulpo',
          categoria: 'taller',
          proyectoId: null,
          hecha: false,
          importante: true,
        },
        expect.objectContaining({ id: 'n2', hora: null }),
      ],
    });
  });

  it('desde la réplica lee las mismas tres tablas', () => {
    let replica = replicaVacia('u');
    replica = aplicarFilaLocal(replica, 'proyectos', PROYECTO);
    replica = aplicarFilaLocal(replica, 'clientes', CLIENTE);
    replica = aplicarFilaLocal(replica, 'anotaciones', ANOTACION);

    expect(datosDeLaAgendaDeLaReplica(replica)).toEqual(
      datosDeLaAgenda({ proyectos: [PROYECTO], clientes: [CLIENTE], anotaciones: [ANOTACION] }),
    );
  });
});
