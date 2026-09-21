import type { PreguntaEditable } from '@maun/domain';
import type { MutationOptions, QueryClient } from '@tanstack/react-query';

import { MUTACION_DE_PREGUNTA, type FilaDePregunta } from '@/entities/opinion';
import { filaPorId, type PreguntaParaGuardar, type Replica } from '@/shared/api';
import {
  avisarEnPantalla,
  claveDeTodaReplica,
  metaDeAvisos,
  uuidv7,
  type NuevoAviso,
  type QueSeGuarda,
} from '@/shared/lib';

export type Avisador = (aviso: NuevoAviso) => void;

const DESHACER = 'Deshacer';

const LARGO_DEL_RECORTE = 34;

export type ModoDeGuardar = 'en-el-lugar' | 'version-nueva';

function mandarALaCola<TDatos, TVariables>(
  cliente: QueryClient,
  opciones: MutationOptions<TDatos, unknown, TVariables>,
  variables: TVariables,
): void {
  void cliente
    .getMutationCache()
    .build(cliente, opciones)
    .execute(variables)
    .catch(() => undefined);
}

export function recortado(texto: string): string {
  return texto.length > LARGO_DEL_RECORTE ? `${texto.slice(0, LARGO_DEL_RECORTE)}…` : texto;
}

export function paraGuardar(fila: FilaDePregunta): PreguntaParaGuardar {
  return {
    id: fila.id,
    serie: fila.serie,
    numero: fila.numero,
    proyecto_id: fila.proyecto_id,
    orden: fila.orden,
    texto: fila.texto,
    tipo: fila.tipo,
    escala: fila.escala,
    obligatoria: fila.obligatoria,
    opciones: fila.opciones,
    archivada_at: fila.archivada_at,
    deleted_at: fila.deleted_at,
  };
}

function conElBorrador(fila: PreguntaParaGuardar, borrador: PreguntaEditable): PreguntaParaGuardar {
  return {
    ...fila,
    texto: borrador.texto,
    tipo: borrador.tipo,
    escala: borrador.escala,
    obligatoria: borrador.obligatoria,
    opciones: borrador.opciones === null ? null : [...borrador.opciones],
  };
}

export function preguntaEnLaReplica(cliente: QueryClient, id: string): FilaDePregunta | undefined {
  for (const [, replica] of cliente.getQueriesData<Replica>({ queryKey: claveDeTodaReplica() })) {
    const fila = replica === undefined ? undefined : filaPorId(replica, 'preguntas', id);
    if (fila) return fila;
  }
  return undefined;
}

export function guardarEnLaCola(
  cliente: QueryClient,
  fila: PreguntaParaGuardar,
  titular: boolean,
  previa: FilaDePregunta | null,
  que: QueSeGuarda = 'pregunta',
): void {
  mandarALaCola(
    cliente,
    { ...MUTACION_DE_PREGUNTA, meta: metaDeAvisos(que, { silencioso: true, sujeto: fila.texto }) },
    { fila, titular, previa },
  );
}

export function agregarPregunta(
  cliente: QueryClient,
  borrador: PreguntaEditable,
  orden: number,
  avisar: Avisador = avisarEnPantalla,
): string {
  const id = uuidv7();
  guardarEnLaCola(
    cliente,
    conElBorrador(
      {
        id,
        serie: id,
        numero: 1,
        proyecto_id: null,
        orden,
        texto: '',
        tipo: 'escala5',
        escala: null,
        obligatoria: false,
        opciones: null,
        archivada_at: null,
        deleted_at: null,
      },
      borrador,
    ),
    false,
    null,
  );
  avisar({ clave: `pregunta-${id}`, tono: 'hecho', texto: 'Pregunta guardada.' });
  return id;
}

export function cambiarPregunta(
  cliente: QueryClient,
  vigente: FilaDePregunta,
  borrador: PreguntaEditable,
  modo: ModoDeGuardar,
  conRespuestas: boolean,
  avisar: Avisador = avisarEnPantalla,
): string {
  if (modo === 'en-el-lugar') {
    guardarEnLaCola(
      cliente,
      conElBorrador(paraGuardar(vigente), borrador),
      vigente.titular,
      vigente,
    );
    avisar({ clave: `pregunta-${vigente.id}`, tono: 'hecho', texto: 'Pregunta guardada.' });
    return vigente.id;
  }
  const id = uuidv7();
  guardarEnLaCola(
    cliente,
    conElBorrador(
      {
        ...paraGuardar(vigente),
        id,
        numero: vigente.numero + 1,
        archivada_at: null,
        deleted_at: null,
      },
      borrador,
    ),
    vigente.titular,
    null,
  );
  avisar({
    clave: `pregunta-${vigente.serie}`,
    tono: 'hecho',
    texto: conRespuestas
      ? 'Guardada como versión nueva. Las respuestas viejas quedan aparte.'
      : 'Pregunta guardada.',
  });
  return id;
}

export function dejarDePreguntar(
  cliente: QueryClient,
  pregunta: FilaDePregunta,
  borrar: boolean,
  avisar: Avisador = avisarEnPantalla,
): void {
  const momento = new Date().toISOString();
  const fila = paraGuardar(pregunta);
  guardarEnLaCola(
    cliente,
    borrar ? { ...fila, deleted_at: momento } : { ...fila, archivada_at: momento },
    pregunta.titular,
    pregunta,
  );
  avisar({
    clave: `pregunta-fuera-${pregunta.id}`,
    tono: 'hecho',
    texto: `Dejaste de preguntar «${recortado(pregunta.texto)}».`,
    accion: {
      etiqueta: DESHACER,
      alTocar: () => {
        const actual = preguntaEnLaReplica(cliente, pregunta.id);
        guardarEnLaCola(
          cliente,
          { ...paraGuardar(actual ?? pregunta), archivada_at: null, deleted_at: null },
          pregunta.titular,
          actual ?? null,
        );
      },
    },
  });
}

export function volverAPreguntar(
  cliente: QueryClient,
  pregunta: FilaDePregunta,
  avisar: Avisador = avisarEnPantalla,
): void {
  guardarEnLaCola(
    cliente,
    { ...paraGuardar(pregunta), archivada_at: null },
    pregunta.titular,
    pregunta,
  );
  avisar({
    clave: `pregunta-vuelve-${pregunta.id}`,
    tono: 'hecho',
    texto: 'Volviste a preguntarla.',
  });
}

export function mover(
  cliente: QueryClient,
  pregunta: FilaDePregunta,
  vecina: FilaDePregunta,
  hacia: 'arriba' | 'abajo',
): void {
  const propio =
    vecina.orden === pregunta.orden ? vecina.orden + (hacia === 'arriba' ? -1 : 1) : vecina.orden;
  guardarEnLaCola(cliente, { ...paraGuardar(pregunta), orden: propio }, pregunta.titular, pregunta);
  guardarEnLaCola(
    cliente,
    { ...paraGuardar(vecina), orden: pregunta.orden },
    vecina.titular,
    vecina,
  );
}
