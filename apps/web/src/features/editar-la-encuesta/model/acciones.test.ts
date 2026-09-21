import { onlineManager, QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { GuardadoDePregunta } from '@/entities/opinion';
import {
  filaPorId,
  TABLAS_REPLICADAS,
  type FilaDe,
  type Replica,
  type TablaReplicada,
} from '@/shared/api';
import { claveDeReplica, type NuevoAviso } from '@/shared/lib';

import {
  agregarPregunta,
  cambiarPregunta,
  dejarDePreguntar,
  mover,
  recortado,
  volverAPreguntar,
} from './acciones';

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

function replicaCon(preguntas: readonly FilaDe<'preguntas'>[]): Replica {
  const tablas = {} as Record<TablaReplicada, Record<string, unknown>>;
  for (const tabla of TABLAS_REPLICADAS) tablas[tabla] = {};
  tablas.households = { h: { id: 'h', nombre: 'MAUN' } };
  tablas.preguntas = Object.fromEntries(preguntas.map((fila) => [fila.id, fila]));
  return { usuarioId: 'u', cursor: '', reconciliadoEn: '', tablas } as unknown as Replica;
}

function preparar(preguntas: readonly FilaDe<'preguntas'>[]) {
  const cliente = new QueryClient();
  cliente.setQueryData(claveDeReplica('u'), replicaCon(preguntas));
  const avisos: NuevoAviso[] = [];
  return {
    cliente,
    avisos,
    avisar: (aviso: NuevoAviso) => {
      avisos.push(aviso);
    },
    guardadas: (): GuardadoDePregunta[] =>
      cliente
        .getMutationCache()
        .getAll()
        .map((mutacion) => mutacion.state.variables as GuardadoDePregunta),
    enLaReplica: (id: string) => {
      const replica = cliente.getQueryData<Replica>(claveDeReplica('u'));
      return replica === undefined ? undefined : filaPorId(replica, 'preguntas', id);
    },
  };
}

const BORRADOR = {
  texto: '¿Cómo nos conociste?',
  tipo: 'una' as const,
  escala: null,
  obligatoria: false,
  opciones: ['Por un conocido', 'Por Instagram'],
};

beforeEach(() => {
  onlineManager.setOnline(false);
});

afterEach(() => {
  onlineManager.setOnline(true);
});

describe('guardar una pregunta', () => {
  it('una pregunta nueva empieza su propia serie y se ve enseguida, aunque no haya señal', async () => {
    const { cliente, avisar, avisos, guardadas, enLaReplica } = preparar([]);

    const id = agregarPregunta(cliente, BORRADOR, 60, avisar);

    expect(guardadas()[0]).toMatchObject({
      fila: { id, serie: id, numero: 1, orden: 60, proyecto_id: null, texto: BORRADOR.texto },
      titular: false,
      previa: null,
    });
    expect(avisos).toEqual([
      { clave: `pregunta-${id}`, tono: 'hecho', texto: 'Pregunta guardada.' },
    ]);
    await expect.poll(() => enLaReplica(id)?.cantidad_de_opciones).toBe(2);
  });

  it('en el lugar, cambia la misma fila y conserva la marca de titular', () => {
    const vigente = pregunta('conforme', { titular: true, version: 4 });
    const { cliente, avisar, guardadas } = preparar([vigente]);

    const id = cambiarPregunta(
      cliente,
      vigente,
      { ...BORRADOR, tipo: 'escala5', escala: 'conformidad', opciones: null },
      'en-el-lugar',
      true,
      avisar,
    );

    expect(id).toBe('conforme');
    expect(guardadas()[0]).toMatchObject({
      fila: { id: 'conforme', numero: 1, texto: BORRADOR.texto },
      titular: true,
      previa: vigente,
    });
  });

  it('como versión nueva, suma una fila a la serie en el mismo lugar y deja la vieja como estaba', () => {
    const vigente = pregunta('conforme', { orden: 10, titular: true });
    const { cliente, avisar, avisos, guardadas } = preparar([vigente]);

    const id = cambiarPregunta(cliente, vigente, BORRADOR, 'version-nueva', true, avisar);

    expect(id).not.toBe('conforme');
    expect(guardadas()).toHaveLength(1);
    expect(guardadas()[0]).toMatchObject({
      fila: { id, serie: 'conforme', numero: 2, orden: 10, tipo: 'una' },
      titular: true,
      previa: null,
    });
    expect(avisos[0]?.texto).toBe(
      'Guardada como versión nueva. Las respuestas viejas quedan aparte.',
    );
  });

  it('una versión nueva sin respuestas viejas no habla de respuestas', () => {
    const vigente = pregunta('mandada');
    const { cliente, avisar, avisos } = preparar([vigente]);

    cambiarPregunta(cliente, vigente, BORRADOR, 'version-nueva', false, avisar);

    expect(avisos[0]?.texto).toBe('Pregunta guardada.');
  });
});

describe('dejar de preguntar', () => {
  it('archiva, avisa con deshacer, y deshacer la vuelve a la encuesta', async () => {
    const vigente = pregunta('flete', {
      texto: '¿Te cobramos el flete aparte o incluido en el precio?',
    });
    const { cliente, avisar, avisos, guardadas, enLaReplica } = preparar([vigente]);

    dejarDePreguntar(cliente, vigente, false, avisar);

    expect(guardadas()[0]?.fila.archivada_at).not.toBeNull();
    expect(guardadas()[0]?.fila.deleted_at).toBeNull();
    expect(avisos[0]).toMatchObject({
      tono: 'hecho',
      texto: 'Dejaste de preguntar «¿Te cobramos el flete aparte o inc…».',
      accion: { etiqueta: 'Deshacer' },
    });
    await expect.poll(() => enLaReplica('flete')?.archivada_at).not.toBeNull();

    avisos[0]?.accion?.alTocar();

    expect(guardadas()[1]?.fila).toMatchObject({
      id: 'flete',
      archivada_at: null,
      deleted_at: null,
    });
    expect(guardadas()[1]?.previa?.archivada_at).not.toBeNull();
  });

  it('la que nadie vio se borra, y deshacer la trae de vuelta aunque ya no esté en la réplica', async () => {
    const vigente = pregunta('nueva');
    const { cliente, avisar, avisos, guardadas, enLaReplica } = preparar([vigente]);

    dejarDePreguntar(cliente, vigente, true, avisar);
    expect(guardadas()[0]?.fila.deleted_at).not.toBeNull();
    await expect.poll(() => enLaReplica('nueva')).toBeUndefined();

    avisos[0]?.accion?.alTocar();

    expect(guardadas()[1]).toMatchObject({
      fila: { id: 'nueva', archivada_at: null, deleted_at: null },
      previa: null,
    });
  });

  it('volver a preguntar una archivada le saca la marca', () => {
    const archivada = pregunta('vieja', { archivada_at: '2026-06-01T12:00:00Z' });
    const { cliente, avisar, avisos, guardadas } = preparar([archivada]);

    volverAPreguntar(cliente, archivada, avisar);

    expect(guardadas()[0]?.fila).toMatchObject({ id: 'vieja', archivada_at: null });
    expect(avisos[0]?.texto).toBe('Volviste a preguntarla.');
  });
});

describe('cambiar el orden', () => {
  it('intercambia los lugares de las dos preguntas', () => {
    const arriba = pregunta('a', { orden: 10 });
    const abajo = pregunta('b', { orden: 20 });
    const { cliente, guardadas } = preparar([arriba, abajo]);

    mover(cliente, abajo, arriba, 'arriba');

    expect(guardadas().map(({ fila }) => [fila.id, fila.orden])).toEqual([
      ['b', 10],
      ['a', 20],
    ]);
  });

  it('si las dos tenían el mismo lugar, igual quedan en el orden pedido', () => {
    const una = pregunta('a', { orden: 10 });
    const otra = pregunta('b', { orden: 10 });
    const { cliente, guardadas } = preparar([una, otra]);

    mover(cliente, una, otra, 'abajo');

    expect(guardadas().map(({ fila }) => [fila.id, fila.orden])).toEqual([
      ['a', 11],
      ['b', 10],
    ]);
  });
});

describe('recortado', () => {
  it('deja entero un texto corto y corta con puntos suspensivos uno largo', () => {
    expect(recortado('¿Qué podríamos hacer mejor?')).toBe('¿Qué podríamos hacer mejor?');
    expect(recortado('a'.repeat(40))).toBe(`${'a'.repeat(34)}…`);
  });
});
