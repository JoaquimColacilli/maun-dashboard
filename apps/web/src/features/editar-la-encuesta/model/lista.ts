import {
  encuestaBase,
  sePuedeBorrar,
  usoDeLasPreguntas,
  type PreguntaGuardada,
  type TrabajoOpinado,
  type UsoDeLaPregunta,
} from '@maun/domain';

import {
  datosDeLasOpiniones,
  preguntaGuardada,
  trabajoOpinado,
  type FilaDePregunta,
} from '@/entities/opinion';
import { filasDe, type Replica } from '@/shared/api';

export interface PreguntaDelEditor {
  fila: FilaDePregunta;
  uso: UsoDeLaPregunta;
  versionada: boolean;
  borrable: boolean;
}

export interface PropiaDelEditor {
  fila: FilaDePregunta;
  trabajo: TrabajoOpinado;
}

export interface EncuestaDelEditor {
  vigentes: PreguntaDelEditor[];
  archivadas: PreguntaDelEditor[];
  propias: PropiaDelEditor[];
  siguienteOrden: number;
}

const SIN_USO: UsoDeLaPregunta = { respuestas: 0, enviada: false };

const PASO_DEL_ORDEN = 10;

export function encuestaDelEditor(replica: Replica): EncuestaDelEditor {
  const filas = filasDe(replica, 'preguntas');
  const pares = filas.map((fila) => ({ fila, pregunta: preguntaGuardada(fila) }));
  const filaDe = new Map(pares.map(({ fila, pregunta }) => [pregunta, fila]));
  const guardadas = pares.map(({ pregunta }) => pregunta);
  const uso = usoDeLasPreguntas(datosDeLasOpiniones(replica));
  const { vigentes, archivadas } = encuestaBase(guardadas);

  const armar = (pregunta: PreguntaGuardada): PreguntaDelEditor[] => {
    const fila = filaDe.get(pregunta);
    if (fila === undefined) return [];
    const suyo = uso.get(pregunta.id) ?? SIN_USO;
    const otras = guardadas.filter(
      (otra) => otra.serie === pregunta.serie && otra.id !== pregunta.id,
    );
    return [
      {
        fila,
        uso: suyo,
        versionada: otras.some((otra) => (uso.get(otra.id)?.respuestas ?? 0) > 0),
        borrable: sePuedeBorrar(pregunta, { ...suyo, otrasVersiones: otras.length > 0 }),
      },
    ];
  };

  const propias = filas
    .filter((fila) => fila.proyecto_id !== null)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((fila) => ({ fila, trabajo: trabajoOpinado(replica, fila.proyecto_id ?? '') }));

  const base = filas.filter((fila) => fila.proyecto_id === null);
  const ultimo = Math.max(0, ...base.map((fila) => fila.orden));

  return {
    vigentes: vigentes.flatMap(armar),
    archivadas: archivadas.flatMap(armar),
    propias,
    siguienteOrden: ultimo + PASO_DEL_ORDEN,
  };
}
