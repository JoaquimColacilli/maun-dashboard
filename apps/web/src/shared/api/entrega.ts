import {
  guardarLaEntrega,
  marcarRespuestaDeEntregaLeida,
  proponerLaEntrega,
  responderLaEntrega,
  type CambiosDeLaEntrega,
  type FilaDe,
  type PropuestaNueva,
  type ResultadoDeResponder,
} from '@maun/db';
import type { RespuestaDeEntregaParaMandar } from '@maun/domain';

import { clienteAnonimo, clienteMaun } from './cliente';

export function guardarLaEntregaDelTrabajo(
  id: string,
  cambios: CambiosDeLaEntrega,
): Promise<FilaDe<'proyectos'>> {
  return guardarLaEntrega(clienteMaun(), id, cambios);
}

export function proponerleLaEntrega(
  proyectoId: string,
  propuesta: PropuestaNueva | null,
): Promise<FilaDe<'propuestas_de_entrega'>[]> {
  return proponerLaEntrega(clienteMaun(), proyectoId, propuesta);
}

export function marcarLaRespuestaDeEntregaLeida(
  id: string,
  leidaEn: string,
): Promise<FilaDe<'respuestas_de_entrega'>> {
  return marcarRespuestaDeEntregaLeida(clienteMaun(), id, leidaEn);
}

export function contestarLaEntrega(
  token: string,
  respuesta: RespuestaDeEntregaParaMandar,
): Promise<ResultadoDeResponder> {
  return responderLaEntrega(clienteAnonimo(), token, respuesta);
}
