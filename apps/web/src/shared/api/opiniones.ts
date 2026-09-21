import {
  contestarLaEncuesta,
  guardarPregunta,
  mandarEncuesta,
  marcarRespuestaLeida,
  recordarEncuesta,
  revocarEncuesta,
  traerEncuestaCompartida,
  type EncuestaCompartida,
  type EncuestaNueva,
  type FilaDe,
  type PreguntaParaGuardar,
  type ResultadoDeContestar,
} from '@maun/db';
import type { RespuestaDelFormulario } from '@maun/domain';

import { clienteAnonimo, clienteMaun } from './cliente';

export function guardarLaPregunta(pregunta: PreguntaParaGuardar): Promise<FilaDe<'preguntas'>> {
  return guardarPregunta(clienteMaun(), pregunta);
}

export function mandarLaEncuesta(
  nueva: EncuestaNueva,
  revocar: { id: string; revocadaEn: string } | null,
): Promise<FilaDe<'encuestas_enviadas'>[]> {
  return mandarEncuesta(clienteMaun(), nueva, revocar);
}

export function darDeBajaLaEncuesta(
  id: string,
  revocadaEn: string,
): Promise<FilaDe<'encuestas_enviadas'>> {
  return revocarEncuesta(clienteMaun(), id, revocadaEn);
}

export function recordarLaEncuesta(
  id: string,
  recordadaEn: string,
): Promise<FilaDe<'encuestas_enviadas'>> {
  return recordarEncuesta(clienteMaun(), id, recordadaEn);
}

export function marcarLaOpinionLeida(id: string, leidaEn: string): Promise<FilaDe<'respuestas'>> {
  return marcarRespuestaLeida(clienteMaun(), id, leidaEn);
}

export function encuestaCompartida(token: string): Promise<EncuestaCompartida> {
  return traerEncuestaCompartida(clienteAnonimo(), token);
}

export function contestarEncuesta(
  token: string,
  respuesta: RespuestaDelFormulario,
): Promise<ResultadoDeContestar> {
  return contestarLaEncuesta(clienteAnonimo(), token, respuesta);
}
