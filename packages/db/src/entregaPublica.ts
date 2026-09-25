import {
  MOTIVOS_DE_LA_ENTREGA,
  type MotivoDeLaEntrega,
  type RespuestaDeEntregaParaMandar,
} from '@maun/domain';

import type { ClienteMaun } from './cliente.ts';
import type { Json } from './database.types.ts';
import { RespuestaInvalidaError } from './replica.ts';

export const RESULTADOS_DE_RESPONDER = ['guardada', 'ya_confirmada', 'cambio'] as const;

export type ResultadoDeResponder = (typeof RESULTADOS_DE_RESPONDER)[number];

export const CODIGO_DEL_RECHAZO_DE_LA_ENTREGA = 'MN020';

export function leerResultadoDeResponder(valor: unknown): ResultadoDeResponder {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) {
    throw new RespuestaInvalidaError('La entrega no devolvió si se guardó.');
  }
  const estado = (valor as Record<string, unknown>).estado;
  const resultado = RESULTADOS_DE_RESPONDER.find((uno) => uno === estado);
  if (resultado === undefined) {
    throw new RespuestaInvalidaError('La entrega no devolvió si se guardó.');
  }
  return resultado;
}

export function motivoDelRechazoDeLaEntrega(error: unknown): MotivoDeLaEntrega | null {
  if (typeof error !== 'object' || error === null) return null;
  const { code, details } = error as Record<string, unknown>;
  if (code !== CODIGO_DEL_RECHAZO_DE_LA_ENTREGA) return null;
  return MOTIVOS_DE_LA_ENTREGA.find((motivo) => motivo === details) ?? null;
}

export async function responderLaEntrega(
  cliente: ClienteMaun,
  token: string,
  respuesta: RespuestaDeEntregaParaMandar,
): Promise<ResultadoDeResponder> {
  const { data, error } = await cliente.rpc('responder_la_entrega', {
    p_token: token,
    p_respuesta: respuesta as unknown as Json,
  });
  if (error) throw error;
  return leerResultadoDeResponder(data);
}
