import { describe, expect, it } from 'vitest';

import { TABLAS_REPLICADAS, type FilaDe, type Replica, type TablaReplicada } from '@/shared/api';

import { encuestaDelEditor } from './lista';

const AHORA = '2026-09-01T12:00:00Z';

function pregunta(id: string, extra: Partial<FilaDe<'preguntas'>> = {}): FilaDe<'preguntas'> {
  return {
    id,
    household_id: 'h',
    serie: id,
    numero: 1,
    proyecto_id: null,
    titular: false,
    orden: 10,
    texto: `Pregunta ${id}`,
    tipo: 'escala5',
    escala: 'conformidad',
    obligatoria: false,
    opciones: null,
    cantidad_de_opciones: 0,
    archivada_at: null,
    created_at: AHORA,
    updated_at: AHORA,
    deleted_at: null,
    version: 1,
    ...extra,
  };
}

function replicaCon(filas: {
  [T in TablaReplicada]?: readonly FilaDe<T>[];
}): Replica {
  const tablas = {} as Record<TablaReplicada, Record<string, unknown>>;
  for (const tabla of TABLAS_REPLICADAS) {
    tablas[tabla] = Object.fromEntries((filas[tabla] ?? []).map((fila) => [fila.id, fila]));
  }
  return { usuarioId: 'u', cursor: '', reconciliadoEn: '', tablas } as unknown as Replica;
}

function encuesta(
  id: string,
  preguntas: readonly string[],
  proyectoId = 'p1',
): FilaDe<'encuestas_enviadas'> {
  return {
    id,
    household_id: 'h',
    proyecto_id: proyectoId,
    token: `token-${id}`,
    token_hash: `hash-${id}`,
    preguntas: preguntas.map((pid) => ({
      id: pid,
      texto: `Pregunta ${pid}`,
      tipo: 'escala5',
      escala: 'conformidad',
      obligatoria: false,
      opciones: null,
      propia: false,
    })),
    enviada_at: AHORA,
    recordada_at: null,
    revocada_at: null,
    created_at: AHORA,
    updated_at: AHORA,
    deleted_at: null,
    version: 1,
  };
}

function respuesta(id: string, encuestaId: string): FilaDe<'respuestas'> {
  return {
    id,
    household_id: 'h',
    encuesta_id: encuestaId,
    contestada_at: AHORA,
    leida_at: null,
    created_at: AHORA,
    updated_at: AHORA,
    deleted_at: null,
    version: 1,
  };
}

function renglon(
  id: string,
  respuestaId: string,
  preguntaId: string,
): FilaDe<'renglones_de_respuesta'> {
  return {
    id,
    household_id: 'h',
    respuesta_id: respuestaId,
    pregunta_id: preguntaId,
    pregunta_texto: `Pregunta ${preguntaId}`,
    tipo: 'escala5',
    cantidad_de_opciones: 0,
    valor_numero: 4,
    valor_opciones: null,
    valor_texto: null,
    created_at: AHORA,
    updated_at: AHORA,
    deleted_at: null,
    version: 1,
  };
}

describe('la encuesta que ve el editor', () => {
  it('lista las vigentes en orden y deja aparte las archivadas y las de un trabajo', () => {
    const replica = replicaCon({
      preguntas: [
        pregunta('b', { orden: 20 }),
        pregunta('a', { orden: 10, titular: true }),
        pregunta('c', { orden: 30, archivada_at: '2026-08-01T12:00:00Z' }),
        pregunta('d', { orden: 10, proyecto_id: 'p1', texto: '¿La alacena quedó cómoda?' }),
      ],
      proyectos: [{ id: 'p1', titulo: 'Alacena', cliente_id: 'c1' } as FilaDe<'proyectos'>],
      clientes: [{ id: 'c1', nombre: 'Familia Villalba' } as FilaDe<'clientes'>],
    });

    const editor = encuestaDelEditor(replica);

    expect(editor.vigentes.map((item) => item.fila.id)).toEqual(['a', 'b']);
    expect(editor.archivadas.map((item) => item.fila.id)).toEqual(['c']);
    expect(editor.propias).toEqual([
      {
        fila: expect.objectContaining({ id: 'd' }) as unknown,
        trabajo: { proyectoId: 'p1', cliente: 'Familia Villalba', trabajo: 'Alacena' },
      },
    ]);
    expect(editor.siguienteOrden).toBe(40);
  });

  it('cuenta lo que contestaron de cada versión y marca la serie que partió con respuestas', () => {
    const replica = replicaCon({
      preguntas: [
        pregunta('v1', { serie: 's' }),
        pregunta('v2', { serie: 's', numero: 2 }),
        pregunta('otra', { orden: 20 }),
      ],
      encuestas_enviadas: [encuesta('e1', ['v1', 'otra'])],
      respuestas: [respuesta('r1', 'e1')],
      renglones_de_respuesta: [renglon('g1', 'r1', 'v1'), renglon('g2', 'r1', 'otra')],
    });

    const [serie, otra] = encuestaDelEditor(replica).vigentes;

    expect(serie?.fila.id).toBe('v2');
    expect(serie?.uso).toEqual({ respuestas: 0, enviada: false });
    expect(serie?.versionada).toBe(true);
    expect(otra?.uso).toEqual({ respuestas: 1, enviada: true });
    expect(otra?.versionada).toBe(false);
  });

  it('solo se borra de verdad la que nadie vio; la del número de arriba nunca', () => {
    const replica = replicaCon({
      preguntas: [
        pregunta('nueva', { orden: 10 }),
        pregunta('titular', { orden: 20, titular: true }),
        pregunta('mandada', { orden: 30 }),
        pregunta('v1', { orden: 40, serie: 's' }),
        pregunta('v2', { orden: 40, serie: 's', numero: 2 }),
      ],
      encuestas_enviadas: [encuesta('e1', ['mandada'])],
    });

    const borrables = Object.fromEntries(
      encuestaDelEditor(replica).vigentes.map((item) => [item.fila.id, item.borrable]),
    );

    expect(borrables).toEqual({ nueva: true, titular: false, mandada: false, v2: false });
  });

  it('sin preguntas de la encuesta base, la próxima arranca en el primer lugar', () => {
    expect(encuestaDelEditor(replicaCon({})).siguienteOrden).toBe(10);
  });
});
