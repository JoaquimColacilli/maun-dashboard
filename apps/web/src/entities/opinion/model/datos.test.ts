import { describe, expect, it } from 'vitest';

import { TABLAS_REPLICADAS, type FilaDe, type Replica, type TablaReplicada } from '@/shared/api';

import {
  fichaDeLaRespuesta,
  fotoDeLaEncuesta,
  novedadesDeOpiniones,
  pedidoDelTrabajo,
  trabajosParaPedir,
  type FilaDeEncuesta,
} from './datos';

const HOY = '2026-09-21';

const CONFORME = {
  id: 'conforme',
  household_id: 'h',
  serie: 'conforme',
  numero: 1,
  proyecto_id: null,
  titular: true,
  orden: 10,
  texto: '¿Qué tan conforme quedaste con el mueble?',
  tipo: 'escala5',
  escala: 'conformidad',
  obligatoria: true,
  opciones: null,
  cantidad_de_opciones: 0,
  archivada_at: null,
  created_at: '2026-01-01T12:00:00Z',
  updated_at: '2026-01-01T12:00:00Z',
  deleted_at: null,
  version: 1,
} satisfies FilaDe<'preguntas'>;

const MEJOR = {
  ...CONFORME,
  id: 'mejor',
  serie: 'mejor',
  titular: false,
  orden: 20,
  texto: '¿Qué podríamos hacer mejor?',
  tipo: 'texto',
  escala: null,
  obligatoria: false,
} satisfies FilaDe<'preguntas'>;

function fotoDe(fila: FilaDe<'preguntas'>) {
  return {
    id: fila.id,
    texto: fila.texto,
    tipo: fila.tipo,
    escala: fila.escala,
    obligatoria: fila.obligatoria,
    opciones: fila.opciones,
    propia: false,
  };
}

const FOTO = [fotoDe(CONFORME), fotoDe(MEJOR)];

function encuesta(id: string, proyectoId: string, extra: Partial<FilaDeEncuesta> = {}) {
  return {
    id,
    household_id: 'h',
    proyecto_id: proyectoId,
    token: `token-${id}`,
    token_hash: `hash-${id}`,
    preguntas: FOTO,
    enviada_at: '2026-09-10T12:00:00Z',
    recordada_at: null,
    revocada_at: null,
    created_at: '2026-09-10T12:00:00Z',
    updated_at: '2026-09-10T12:00:00Z',
    deleted_at: null,
    version: 1,
    ...extra,
  } satisfies FilaDeEncuesta;
}

function respuesta(id: string, encuestaId: string, dia: string, leida: boolean) {
  return {
    id,
    household_id: 'h',
    encuesta_id: encuestaId,
    contestada_at: `${dia}T15:00:00Z`,
    leida_at: leida ? `${dia}T20:00:00Z` : null,
    created_at: `${dia}T15:00:00Z`,
    updated_at: `${dia}T15:00:00Z`,
    deleted_at: null,
    version: 1,
  } satisfies FilaDe<'respuestas'>;
}

function renglon(
  id: string,
  respuestaId: string,
  pregunta: FilaDe<'preguntas'>,
  valor: number | string,
) {
  return {
    id,
    household_id: 'h',
    respuesta_id: respuestaId,
    pregunta_id: pregunta.id,
    pregunta_texto: pregunta.texto,
    tipo: pregunta.tipo,
    cantidad_de_opciones: 0,
    valor_numero: typeof valor === 'number' ? valor : null,
    valor_opciones: null,
    valor_texto: typeof valor === 'string' ? valor : null,
    created_at: '2026-09-12T15:00:00Z',
    updated_at: '2026-09-12T15:00:00Z',
    deleted_at: null,
    version: 1,
  } satisfies FilaDe<'renglones_de_respuesta'>;
}

function replicaCon(filas: { [T in TablaReplicada]?: readonly FilaDe<T>[] }): Replica {
  const tablas = {} as Record<TablaReplicada, Record<string, unknown>>;
  for (const tabla of TABLAS_REPLICADAS) {
    tablas[tabla] = Object.fromEntries(
      ((filas[tabla] ?? []) as readonly { id: string }[]).map((fila) => [fila.id, fila]),
    );
  }
  return { usuarioId: 'u', cursor: '', reconciliadoEn: '', tablas } as unknown as Replica;
}

const TALLER = replicaCon({
  preguntas: [CONFORME, MEJOR],
  clientes: [
    { id: 'c1', nombre: 'Nadia Roldán', telefono: '11 4088 2210' },
    { id: 'c2', nombre: 'Hernán Cabrera', telefono: '' },
    { id: 'c3', nombre: 'Graciela Ruiz', telefono: '' },
  ] as FilaDe<'clientes'>[],
  proyectos: [
    {
      id: 'p1',
      cliente_id: 'c1',
      titulo: 'Escritorio en L',
      estado: 'entregado',
      fecha_entrega: '2026-09-15',
      updated_at: '2026-09-15T12:00:00Z',
    },
    {
      id: 'p2',
      cliente_id: 'c2',
      titulo: 'Vanitory colgante',
      estado: 'cobrado',
      fecha_entrega: '2026-09-08',
      updated_at: '2026-09-08T12:00:00Z',
    },
    {
      id: 'p3',
      cliente_id: 'c3',
      titulo: 'Mueble de recibidor',
      estado: 'entregado',
      fecha_entrega: '2026-09-18',
      updated_at: '2026-09-18T12:00:00Z',
    },
    {
      id: 'p4',
      cliente_id: 'c3',
      titulo: 'Placard',
      estado: 'en_curso',
      fecha_entrega: null,
      updated_at: '2026-09-01T12:00:00Z',
    },
  ] as FilaDe<'proyectos'>[],
  encuestas_enviadas: [encuesta('e1', 'p1'), encuesta('e2', 'p2')],
  respuestas: [
    respuesta('r1', 'e1', '2026-09-18', false),
    respuesta('r2', 'e2', '2026-09-12', false),
  ],
  renglones_de_respuesta: [
    renglon('g1', 'r1', CONFORME, 5),
    renglon('t1', 'r1', MEJOR, 'Quedó impecable.'),
    renglon('g2', 'r2', CONFORME, 4),
  ],
});

describe('la foto de una encuesta', () => {
  it('se lee aunque venga con algo que no entiende, sin inventar preguntas', () => {
    const rara = encuesta('x', 'p1', {
      preguntas: [
        fotoDe(CONFORME),
        { id: 'sin-tipo', texto: 'nada' },
        'basura',
        null,
        { ...fotoDe(MEJOR), opciones: [1, 2] },
      ],
    });
    expect(fotoDeLaEncuesta(rara).map((pregunta) => [pregunta.id, pregunta.opciones])).toEqual([
      ['conforme', null],
      ['mejor', null],
    ]);
    expect(fotoDeLaEncuesta(encuesta('y', 'p1', { preguntas: {} }))).toEqual([]);
  });
});

describe('la ficha de una respuesta', () => {
  it('junta el trabajo, el teléfono y cada renglón con su pregunta', () => {
    const ficha = fichaDeLaRespuesta(TALLER, 'r1');
    expect(ficha?.trabajo).toEqual({
      proyectoId: 'p1',
      cliente: 'Nadia Roldán',
      trabajo: 'Escritorio en L',
    });
    expect(ficha?.telefono).toBe('11 4088 2210');
    expect(ficha?.contestadaEl).toBe('2026-09-18');
    expect(
      ficha?.lineas.map((linea) => [
        linea.pregunta.id,
        linea.pasos.map((paso) => paso.etiqueta),
        linea.texto,
      ]),
    ).toEqual([
      ['conforme', ['Muy conforme'], null],
      ['mejor', [], 'Quedó impecable.'],
    ]);
  });

  it('una respuesta que no está devuelve nada en vez de romper', () => {
    expect(fichaDeLaRespuesta(TALLER, 'otra')).toBeNull();
  });
});

describe('lo sin leer', () => {
  it('cuenta las nuevas, nombra a quienes opinaron y trae la última con su frase', () => {
    const novedades = novedadesDeOpiniones(TALLER, HOY);
    expect(novedades.sinLeer).toBe(2);
    expect(novedades.nombres).toEqual(['Nadia Roldán', 'Hernán Cabrera']);
    expect(novedades.ultima).toMatchObject({
      respuestaId: 'r1',
      cliente: 'Nadia Roldán',
      trabajo: 'Escritorio en L',
      titular: { etiqueta: 'Muy conforme' },
      comentario: 'Quedó impecable.',
    });
  });

  it('sin nada nuevo no hay línea que mostrar', () => {
    const leidas = replicaCon({
      preguntas: [CONFORME],
      respuestas: [respuesta('r1', 'e1', '2026-09-18', true)],
    });
    expect(novedadesDeOpiniones(leidas, HOY)).toEqual({ sinLeer: 0, nombres: [], ultima: null });
  });
});

describe('los trabajos para pedir', () => {
  it('cuenta los terminados y sugiere el más reciente que todavía no se pidió', () => {
    expect(trabajosParaPedir(TALLER)).toEqual({ terminados: 3, sinPedir: 'p3' });
  });
});

describe('el pedido de un trabajo', () => {
  it('trae el estado, la encuesta vigente, la respuesta y la foto de lo que se preguntó', () => {
    const pedido = pedidoDelTrabajo(TALLER, 'p1');
    expect(pedido.pedido.estado).toBe('contestada');
    expect(pedido.encuesta?.id).toBe('e1');
    expect(pedido.respuesta?.id).toBe('r1');
    expect(pedido.preguntas.map((pregunta) => pregunta.id)).toEqual(['conforme', 'mejor']);
  });

  it('un trabajo sin pedir no tiene encuesta ni respuesta', () => {
    const pedido = pedidoDelTrabajo(TALLER, 'p3');
    expect(pedido).toMatchObject({
      pedido: { estado: 'sin_mandar' },
      encuesta: undefined,
      respuesta: undefined,
      preguntas: [],
    });
  });
});
