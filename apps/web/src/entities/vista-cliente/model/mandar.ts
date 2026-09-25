import type { CoordinacionDeLaEntrega, RespuestaDeEntregaParaMandar } from '@maun/domain';

export type ResultadoDeMandar =
  | { tipo: 'guardada' }
  | { tipo: 'ya-confirmada' }
  | { tipo: 'cambio' }
  | { tipo: 'error'; texto: string };

export type MandarLaEntrega = (
  respuesta: RespuestaDeEntregaParaMandar,
) => Promise<ResultadoDeMandar>;

export type CoordinacionConPedido = Exclude<CoordinacionDeLaEntrega, { situacion: 'sin-pedido' }>;

export function claveDeLaCoordinacion(coordinacion: CoordinacionConPedido): string {
  const { propuesta, respuesta } = coordinacion;
  return `${propuesta.id}:${respuesta === null ? 'sin' : JSON.stringify(respuesta)}`;
}
