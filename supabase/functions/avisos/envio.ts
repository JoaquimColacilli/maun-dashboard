import { eventosParaAvisar } from '@maun/domain';

import { datosDeLaAgenda } from '../../../packages/db/src/agenda.ts';
import type { AvisoPorMandar, Base, Suscripcion } from './base.ts';
import type { ClavesVapid } from './entorno.ts';
import { CARGA_DE_LA_PRUEBA, cargaDelAviso } from './texto.ts';

export type Enviador = (
  suscripcion: Suscripcion,
  carga: string,
  vapid: ClavesVapid,
) => Promise<void>;

export interface ResultadoDelEnvio {
  mandados: number;
  sinNadaQueAvisar: number;
  podados: number;
  fallidos: number;
}

export function estadoDelError(error: unknown): number | null {
  if (typeof error !== 'object' || error === null || !('statusCode' in error)) return null;
  return typeof error.statusCode === 'number' ? error.statusCode : null;
}

export function laSuscripcionMurio(error: unknown): boolean {
  const estado = estadoDelError(error);
  return estado === 404 || estado === 410;
}

function resultadoVacio(): ResultadoDelEnvio {
  return { mandados: 0, sinNadaQueAvisar: 0, podados: 0, fallidos: 0 };
}

async function mandarUno(
  suscripcion: Suscripcion,
  carga: string,
  base: Base,
  enviar: Enviador,
  vapid: ClavesVapid,
  resultado: ResultadoDelEnvio,
): Promise<boolean> {
  try {
    await enviar(suscripcion, carga, vapid);
    resultado.mandados += 1;
    return true;
  } catch (error) {
    if (laSuscripcionMurio(error)) {
      await base.borrarSuscripcionVencida(suscripcion.endpoint);
      resultado.podados += 1;
    } else {
      resultado.fallidos += 1;
      console.error('no se pudo mandar un aviso', estadoDelError(error), String(error));
    }
    return false;
  }
}

export async function mandarLosAvisos(
  avisos: readonly AvisoPorMandar[],
  base: Base,
  enviar: Enviador,
  vapid: ClavesVapid,
): Promise<ResultadoDelEnvio> {
  const resultado = resultadoVacio();
  for (const aviso of avisos) {
    const eventos = eventosParaAvisar(datosDeLaAgenda(aviso.filas), aviso.dia, aviso.preferencias);
    if (eventos.length === 0) {
      resultado.sinNadaQueAvisar += 1;
      await base.anotarAviso(aviso.id, aviso.dia, false);
      continue;
    }
    const carga = JSON.stringify(cargaDelAviso(eventos, aviso.dia));
    if (await mandarUno(aviso, carga, base, enviar, vapid, resultado)) {
      await base.anotarAviso(aviso.id, aviso.dia, true);
    }
  }
  return resultado;
}

export async function mandarLaPrueba(
  suscripciones: readonly Suscripcion[],
  base: Base,
  enviar: Enviador,
  vapid: ClavesVapid,
): Promise<ResultadoDelEnvio> {
  const resultado = resultadoVacio();
  const carga = JSON.stringify(CARGA_DE_LA_PRUEBA);
  for (const suscripcion of suscripciones) {
    await mandarUno(suscripcion, carga, base, enviar, vapid, resultado);
  }
  return resultado;
}
