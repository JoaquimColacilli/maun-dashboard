import {
  ESCALAS,
  esLinkDeResena,
  MOTIVOS_DEL_RECHAZO,
  TIPOS_DE_PREGUNTA,
  type Escala,
  type MotivoDelRechazo,
  type PreguntaDeLaEncuesta,
  type RespuestaDelFormulario,
  type TipoDePregunta,
  type ValorGuardado,
} from '@maun/domain';

import type { ClienteMaun } from './cliente.ts';
import type { Json } from './database.types.ts';
import { RespuestaInvalidaError } from './replica.ts';

export interface RenglonContestado {
  preguntaId: string;
  valor: ValorGuardado;
}

export interface LoQueContesto {
  fecha: string;
  renglones: RenglonContestado[];
}

export interface EncuestaCompartida {
  taller: string;
  cliente: string | null;
  trabajo: string;
  resena: string | null;
  preguntas: PreguntaDeLaEncuesta[];
  contestada: LoQueContesto | null;
}

export type ResultadoDeContestar = 'guardada' | 'ya_contestada';

function invalida(que: string): RespuestaInvalidaError {
  return new RespuestaInvalidaError(`La encuesta no devolvió ${que}.`);
}

function objeto(valor: unknown, que: string): Record<string, unknown> {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) throw invalida(que);
  return valor as Record<string, unknown>;
}

function texto(valor: unknown, que: string): string {
  if (typeof valor !== 'string') throw invalida(que);
  return valor;
}

function textoONada(valor: unknown, que: string): string | null {
  if (valor === null || valor === undefined) return null;
  const leido = texto(valor, que).trim();
  return leido === '' ? null : leido;
}

function booleano(valor: unknown, que: string): boolean {
  if (typeof valor !== 'boolean') throw invalida(que);
  return valor;
}

function lista(valor: unknown, que: string): unknown[] {
  if (!Array.isArray(valor)) throw invalida(que);
  return valor;
}

function tipoDe(valor: unknown): TipoDePregunta {
  const tipo = TIPOS_DE_PREGUNTA.find((uno) => uno === valor);
  if (tipo === undefined) throw invalida('el tipo de una pregunta');
  return tipo;
}

function escalaDe(valor: unknown): Escala | null {
  if (valor === null || valor === undefined) return null;
  const escala = ESCALAS.find((una) => una === valor);
  if (escala === undefined) throw invalida('la escala de una pregunta');
  return escala;
}

function opcionesDe(valor: unknown): string[] | null {
  if (valor === null || valor === undefined) return null;
  return lista(valor, 'las opciones de una pregunta').map((opcion) =>
    texto(opcion, 'una opción de una pregunta'),
  );
}

function pregunta(valor: unknown): PreguntaDeLaEncuesta {
  const cruda = objeto(valor, 'una pregunta');
  return {
    id: texto(cruda.id, 'el id de una pregunta'),
    texto: texto(cruda.texto, 'el texto de una pregunta'),
    tipo: tipoDe(cruda.tipo),
    escala: escalaDe(cruda.escala),
    obligatoria: booleano(cruda.obligatoria, 'si una pregunta es obligatoria'),
    opciones: opcionesDe(cruda.opciones),
    propia: booleano(cruda.propia, 'si una pregunta es propia'),
  };
}

function valorDe(valor: unknown): ValorGuardado {
  if (typeof valor === 'number' || typeof valor === 'string') return valor;
  return lista(valor, 'lo que contestó').map((elegido) => {
    if (typeof elegido !== 'number') throw invalida('lo que contestó');
    return elegido;
  });
}

function contestada(valor: unknown): LoQueContesto | null {
  if (valor === null || valor === undefined) return null;
  const cruda = objeto(valor, 'lo que contestó');
  return {
    fecha: texto(cruda.fecha, 'el día en que contestó'),
    renglones: lista(cruda.renglones, 'lo que contestó').map((fila) => {
      const renglon = objeto(fila, 'lo que contestó');
      return {
        preguntaId: texto(renglon.pregunta, 'a qué pregunta contestó'),
        valor: valorDe(renglon.valor),
      };
    }),
  };
}

function resenaDe(valor: unknown): string | null {
  const leida = textoONada(valor, 'el enlace de reseña');
  return leida !== null && esLinkDeResena(leida) ? leida : null;
}

export function leerEncuestaCompartida(valor: unknown): EncuestaCompartida {
  const cuerpo = objeto(valor, 'la encuesta');
  return {
    taller: texto(cuerpo.taller, 'el nombre del taller'),
    cliente: textoONada(cuerpo.cliente, 'el nombre del cliente'),
    trabajo: texto(cuerpo.trabajo, 'el trabajo'),
    resena: resenaDe(cuerpo.resena),
    preguntas: lista(cuerpo.preguntas, 'las preguntas').map(pregunta),
    contestada: contestada(cuerpo.contestada),
  };
}

export function leerResultadoDeContestar(valor: unknown): ResultadoDeContestar {
  const estado = objeto(valor, 'si se guardó').estado;
  if (estado === 'guardada' || estado === 'ya_contestada') return estado;
  throw invalida('si se guardó');
}

export function motivoDelRechazo(error: unknown): MotivoDelRechazo | null {
  if (typeof error !== 'object' || error === null) return null;
  const detalle = (error as Record<string, unknown>).details;
  return MOTIVOS_DEL_RECHAZO.find((motivo) => motivo === detalle) ?? null;
}

export async function traerEncuestaCompartida(
  cliente: ClienteMaun,
  token: string,
): Promise<EncuestaCompartida> {
  const { data, error } = await cliente.rpc('encuesta_compartida', { p_token: token });
  if (error) throw error;
  return leerEncuestaCompartida(data);
}

export async function contestarLaEncuesta(
  cliente: ClienteMaun,
  token: string,
  respuesta: RespuestaDelFormulario,
): Promise<ResultadoDeContestar> {
  const { data, error } = await cliente.rpc('contestar_encuesta', {
    p_token: token,
    p_respuesta: respuesta as unknown as Json,
  });
  if (error) throw error;
  return leerResultadoDeContestar(data);
}
