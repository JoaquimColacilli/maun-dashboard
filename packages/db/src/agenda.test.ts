import { describe, expect, it } from 'vitest';

import {
  COLUMNA_DE_LA_FECHA,
  COLUMNA_DE_LA_MARCA,
  COLUMNAS_DE_MARCAS,
  datosDeLaAgenda,
  datosDeLaAgendaDeLaReplica,
  marcadaComoImportante,
  visitaHecha,
} from './agenda.ts';
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
  visita_hora: '15:30:00',
  visita_hecha: true,
  entrega_estimada: null,
  entrega_hora: null,
  vencimiento_presupuesto: '2026-09-10',
  direccion_entrega: 'Sarmiento 2310',
  presupuesto_importante: false,
  visita_importante: true,
  entrega_importante: false,
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
          visitaHora: '15:30',
          visitaHecha: true,
          entregaEstimada: null,
          entregaHora: null,
          vencimientoPresupuesto: '2026-09-10',
          direccionEntrega: 'Sarmiento 2310',
          importante: { presupuesto: false, visita: true, entrega: false },
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

  it('una fila guardada en el dispositivo antes de las columnas nuevas no tiene la visita hecha ni marcas', () => {
    const vieja = {
      ...METADATOS,
      id: 'p2',
      cliente_id: 'c1',
      titulo: 'Placard',
      estado: 'entregado',
      fecha_visita: '2026-08-01',
      entrega_estimada: '2026-09-01',
      vencimiento_presupuesto: null,
      direccion_entrega: '',
    } as unknown as FilaDe<'proyectos'>;

    expect(visitaHecha(vieja)).toBe(false);
    expect(marcadaComoImportante(vieja, 'entrega')).toBe(false);
    expect(
      datosDeLaAgenda({ proyectos: [vieja], clientes: [], anotaciones: [] }).proyectos[0],
    ).toMatchObject({
      visitaHecha: false,
      importante: { presupuesto: false, visita: false, entrega: false },
    });
  });

  it('cada evento derivado tiene su columna de marca, y son las tres de la base', () => {
    expect(Object.values(COLUMNA_DE_LA_MARCA)).toEqual([...COLUMNAS_DE_MARCAS]);
  });
});

describe('las columnas de las que sale cada evento derivado', () => {
  it('cada categoría derivada tiene una sola columna donde vive su fecha', () => {
    expect(COLUMNA_DE_LA_FECHA).toEqual({
      presupuesto: 'vencimiento_presupuesto',
      visita: 'fecha_visita',
      entrega: 'entrega_estimada',
    });
  });

  it('una fila guardada antes de las horas no trae hora, y no rompe', () => {
    const sinHoras = { ...PROYECTO } as unknown as Record<string, unknown>;
    delete sinHoras.visita_hora;
    delete sinHoras.entrega_hora;
    const datos = datosDeLaAgenda({
      proyectos: [sinHoras as unknown as FilaDe<'proyectos'>],
      clientes: [CLIENTE],
      anotaciones: [],
    });
    expect(datos.proyectos[0]?.visitaHora).toBeNull();
    expect(datos.proyectos[0]?.entregaHora).toBeNull();
  });
});
