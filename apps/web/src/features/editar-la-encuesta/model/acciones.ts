import type { PreguntaEditable } from '@maun/domain';
import type { QueryClient } from '@tanstack/react-query';

import {
  guardarPreguntaEnLaCola as guardarEnLaCola,
  paraGuardar,
  preguntaEnLaReplica,
  type FilaDePregunta,
} from '@/entities/opinion';
import type { PreguntaParaGuardar } from '@/shared/api';
import { avisarEnPantalla, uuidv7, type NuevoAviso } from '@/shared/lib';

export type Avisador = (aviso: NuevoAviso) => void;

const DESHACER = 'Deshacer';

const LARGO_DEL_RECORTE = 34;

export type ModoDeGuardar = 'en-el-lugar' | 'version-nueva';

export function recortado(texto: string): string {
  return texto.length > LARGO_DEL_RECORTE ? `${texto.slice(0, LARGO_DEL_RECORTE)}…` : texto;
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
