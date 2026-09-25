import { describe, expect, it } from 'vitest';

import { aplicarFilaLocal, replicaVacia, type FilaDe } from './replica.ts';
import { analisisDeLaReplica, datosDelAnalisis } from './vistas.ts';

const TRABAJO = {
  id: 'p1',
  titulo: 'Placard de pasillo',
  estado: 'entregado',
  fecha_inicio: '2026-09-01',
  fecha_entrega: '2026-09-20',
  listo_el: '2026-09-18',
  tipo_de_proyecto: 'Placard',
  version: 1,
  deleted_at: null,
} as unknown as FilaDe<'proyectos'>;

const ESTIMADA = {
  id: 'f1',
  proyecto_id: 'p1',
  tipo: 'estimada',
  fecha: '2026-09-22',
  origen: 'taller',
  created_at: '2026-09-01T12:00:00Z',
  trabajos_en_curso: 2,
  version: 1,
  deleted_at: null,
} as unknown as FilaDe<'cambios_de_fecha'>;

describe('los datos del analítico de entregas', () => {
  it('salen de los trabajos y de la historia de las fechas', () => {
    let replica = aplicarFilaLocal(replicaVacia('u'), 'proyectos', TRABAJO);
    replica = aplicarFilaLocal(replica, 'cambios_de_fecha', ESTIMADA);

    expect(datosDelAnalisis(replica)).toEqual({
      trabajos: [
        {
          id: 'p1',
          titulo: 'Placard de pasillo',
          tipo: 'Placard',
          estado: 'entregado',
          inicio: '2026-09-01',
          listo: '2026-09-18',
          entregado: '2026-09-20',
        },
      ],
      cambios: [
        {
          id: 'f1',
          proyectoId: 'p1',
          tipo: 'estimada',
          fecha: '2026-09-22',
          origen: 'taller',
          creadoEn: '2026-09-01T12:00:00Z',
          trabajosEnCurso: 2,
        },
      ],
    });
    expect(analisisDeLaReplica(replica).trabajos).toMatchObject([{ id: 'p1', desvio: -2 }]);
  });

  it('una fila guardada antes de que existieran listo y el tipo se lee sin ellos', () => {
    const { listo_el: _listo, tipo_de_proyecto: _tipo, ...vieja } = TRABAJO;
    const replica = aplicarFilaLocal(
      replicaVacia('u'),
      'proyectos',
      vieja as unknown as FilaDe<'proyectos'>,
    );

    expect(datosDelAnalisis(replica).trabajos).toMatchObject([{ tipo: null, listo: null }]);
  });
});
