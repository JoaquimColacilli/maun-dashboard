import { describe, expect, it } from 'vitest';

import { TABLAS_REPLICADAS, type FilaDe, type Replica, type TablaReplicada } from '@/shared/api';

import {
  avisosDeEntregas,
  coordinacionEnLaFicha,
  diasDeLaRespuesta,
  laComprometidaVinoDelCliente,
  propuestaAbierta,
  type FilaDePropuesta,
  type FilaDeRespuestaDeEntrega,
} from './datos';

function replicaCon(filas: { [T in TablaReplicada]?: readonly FilaDe<T>[] }): Replica {
  const tablas = {} as Record<TablaReplicada, Record<string, unknown>>;
  for (const tabla of TABLAS_REPLICADAS) {
    tablas[tabla] = Object.fromEntries(
      ((filas[tabla] ?? []) as readonly { id: string }[]).map((fila) => [fila.id, fila]),
    );
  }
  return { usuarioId: 'u', cursor: '', reconciliadoEn: '', tablas } as unknown as Replica;
}

const CLIENTES = [
  { id: 'c1', nombre: 'Cintia Paz' },
  { id: 'c2', nombre: 'Hernán Cabrera' },
] as FilaDe<'clientes'>[];

function trabajo(id: string, extra: Partial<FilaDe<'proyectos'>> = {}): FilaDe<'proyectos'> {
  return {
    id,
    cliente_id: 'c1',
    titulo: `Trabajo ${id}`,
    estado: 'en_curso',
    listo_el: '2026-09-24',
    entrega_comprometida: null,
    entrega_comprometida_franja: null,
    ...extra,
  } as FilaDe<'proyectos'>;
}

function propuesta(id: string, extra: Partial<FilaDePropuesta> = {}): FilaDePropuesta {
  return {
    id,
    household_id: 'h',
    proyecto_id: 'p1',
    forma: 'un_dia',
    fecha: '2026-10-08',
    franja: 'manana',
    cerrada_at: null,
    created_at: '2026-09-25T10:00:00Z',
    updated_at: '2026-09-25T10:00:00Z',
    deleted_at: null,
    version: 1,
    ...extra,
  };
}

function respuesta(
  id: string,
  extra: Partial<FilaDeRespuestaDeEntrega> = {},
): FilaDeRespuestaDeEntrega {
  return {
    id,
    household_id: 'h',
    proyecto_id: 'p1',
    propuesta_id: 'd1',
    respuesta: 'mis_dias',
    dias: [{ fecha: '2026-09-29', franjas: ['tarde'] }],
    nota: 'Tercer piso',
    leida_at: null,
    created_at: '2026-09-25T12:00:00Z',
    updated_at: '2026-09-25T12:00:00Z',
    deleted_at: null,
    version: 1,
    ...extra,
  };
}

describe('los días que manda el cliente', () => {
  it('se leen de la fila, y lo que no se entiende se deja afuera', () => {
    expect(
      diasDeLaRespuesta(
        respuesta('r1', {
          dias: [
            { fecha: '2026-09-29', franjas: ['tarde', 'manana'] },
            { fecha: '2026-02-30', franjas: ['manana'] },
            { fecha: '2026-09-30', franjas: ['noche'] },
            { fecha: '2026-10-01' },
            null,
            'x',
          ],
        }),
      ),
    ).toEqual([{ fecha: '2026-09-29', franjas: ['manana', 'tarde'] }]);
    expect(diasDeLaRespuesta(respuesta('r1', { dias: {} }))).toEqual([]);
  });
});

describe('la coordinación en la ficha', () => {
  it('la propuesta abierta y la última respuesta a ella', () => {
    const replica = replicaCon({
      proyectos: [trabajo('p1')],
      propuestas_de_entrega: [
        propuesta('d0', { cerrada_at: '2026-09-25T09:00:00Z', created_at: '2026-09-24T10:00:00Z' }),
        propuesta('d1', { forma: 'sus_dias', fecha: null, franja: null }),
      ],
      respuestas_de_entrega: [
        respuesta('r0', { propuesta_id: 'd0', created_at: '2026-09-24T12:00:00Z' }),
        respuesta('r1', { created_at: '2026-09-25T11:00:00Z', nota: 'Primero' }),
        respuesta('r2', { created_at: '2026-09-25T13:00:00Z', leida_at: '2026-09-25T14:00:00Z' }),
      ],
    });

    const coordinacion = coordinacionEnLaFicha(replica, 'p1');
    expect(coordinacion.propuesta?.id).toBe('d1');
    expect(coordinacion.respuesta).toEqual({
      id: 'r2',
      respuesta: 'mis_dias',
      dias: [{ fecha: '2026-09-29', franjas: ['tarde'] }],
      nota: 'Tercer piso',
      leida: true,
      creadaEn: '2026-09-25T13:00:00Z',
    });
    expect(coordinacion.sinLeer.map((fila) => fila.id)).toEqual(['r0', 'r1']);
    expect(coordinacion.laAceptoElCliente).toBe(false);
  });

  it('sin propuesta abierta no hay respuesta que mostrar', () => {
    const replica = replicaCon({
      proyectos: [trabajo('p1')],
      propuestas_de_entrega: [propuesta('d1', { cerrada_at: '2026-09-25T11:00:00Z' })],
      respuestas_de_entrega: [respuesta('r1')],
    });
    expect(propuestaAbierta(replica, 'p1')).toBeNull();
    expect(coordinacionEnLaFicha(replica, 'p1').respuesta).toBeNull();
    expect(propuestaAbierta(replica, 'otro')).toBeNull();
  });

  it('la comprometida vino del cliente si la última de su historia es la suya y es la de hoy', () => {
    const historia = (fecha: string, origen: FilaDe<'cambios_de_fecha'>['origen'], hora: string) =>
      ({
        id: `f-${hora}`,
        proyecto_id: 'p1',
        tipo: 'comprometida',
        fecha,
        origen,
        created_at: `2026-09-25T${hora}:00Z`,
      }) as FilaDe<'cambios_de_fecha'>;

    const aceptada = replicaCon({
      proyectos: [trabajo('p1', { entrega_comprometida: '2026-10-08' })],
      cambios_de_fecha: [historia('2026-10-08', 'cliente', '12:00')],
    });
    expect(laComprometidaVinoDelCliente(aceptada, 'p1')).toBe(true);

    const cambiadaDespues = replicaCon({
      proyectos: [trabajo('p1', { entrega_comprometida: '2026-10-09' })],
      cambios_de_fecha: [
        historia('2026-10-08', 'cliente', '12:00'),
        historia('2026-10-09', 'taller', '13:00'),
      ],
    });
    expect(laComprometidaVinoDelCliente(cambiadaDespues, 'p1')).toBe(false);

    const sinHistoria = replicaCon({
      proyectos: [trabajo('p1', { entrega_comprometida: '2026-10-08' })],
    });
    expect(laComprometidaVinoDelCliente(sinHistoria, 'p1')).toBe(false);
    expect(laComprometidaVinoDelCliente(sinHistoria, 'otro')).toBe(false);
    expect(laComprometidaVinoDelCliente(replicaCon({ proyectos: [trabajo('p1')] }), 'p1')).toBe(
      false,
    );
  });
});

describe('los avisos de Inicio', () => {
  it('uno por trabajo con lo que el cliente contestó sin leer, el más nuevo primero', () => {
    const replica = replicaCon({
      clientes: CLIENTES,
      proyectos: [trabajo('p1'), trabajo('p2', { cliente_id: 'c2' }), trabajo('p3')],
      propuestas_de_entrega: [
        propuesta('d1'),
        propuesta('d2', { proyecto_id: 'p2', forma: 'sus_dias', fecha: null, franja: null }),
        propuesta('d3', { proyecto_id: 'p3' }),
      ],
      respuestas_de_entrega: [
        respuesta('r1', { respuesta: 'me_queda_bien', dias: [], nota: '' }),
        respuesta('r2', {
          proyecto_id: 'p2',
          propuesta_id: 'd2',
          created_at: '2026-09-25T15:00:00Z',
        }),
        respuesta('r3', {
          proyecto_id: 'p2',
          propuesta_id: 'd2',
          created_at: '2026-09-25T16:00:00Z',
        }),
        respuesta('r4', {
          proyecto_id: 'p3',
          propuesta_id: 'd3',
          leida_at: '2026-09-25T17:00:00Z',
        }),
        respuesta('r5', { proyecto_id: 'borrado' }),
      ],
    });

    const avisos = avisosDeEntregas(replica);
    expect(
      avisos.map(({ proyectoId, cliente, respuesta: que, fecha, franja, sinLeer }) => ({
        proyectoId,
        cliente,
        que,
        fecha,
        franja,
        sinLeer: sinLeer.map((fila) => fila.id),
      })),
    ).toEqual([
      {
        proyectoId: 'p2',
        cliente: 'Hernán Cabrera',
        que: 'mis_dias',
        fecha: null,
        franja: null,
        sinLeer: ['r2', 'r3'],
      },
      {
        proyectoId: 'p1',
        cliente: 'Cintia Paz',
        que: 'me_queda_bien',
        fecha: '2026-10-08',
        franja: 'manana',
        sinLeer: ['r1'],
      },
    ]);
    expect(avisos[1]?.trabajo).toBe('Trabajo p1');
  });

  it('un «me queda bien» sin su propuesta en el aparato, o de un cliente borrado, igual avisa', () => {
    const replica = replicaCon({
      proyectos: [trabajo('p1', { cliente_id: 'borrado' })],
      respuestas_de_entrega: [respuesta('r1', { respuesta: 'me_queda_bien', dias: [], nota: '' })],
    });
    expect(avisosDeEntregas(replica)).toMatchObject([
      { proyectoId: 'p1', cliente: '', fecha: null, franja: null },
    ]);
  });
});
