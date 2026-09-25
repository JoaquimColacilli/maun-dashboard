import { largoDelTexto, sinBlancosEnLasPuntas, tieneTexto } from './encuesta.ts';
import { diaDeLaSemana, diasEntre, esFechaQueExiste } from './fechas.ts';

export const FRANJAS_DE_ENTREGA = ['manana', 'tarde'] as const;

export type FranjaDeEntrega = (typeof FRANJAS_DE_ENTREGA)[number];

export const FORMAS_DE_COORDINAR = ['un_dia', 'sus_dias'] as const;

export type FormaDeCoordinar = (typeof FORMAS_DE_COORDINAR)[number];

export const RESPUESTAS_DE_ENTREGA = ['me_queda_bien', 'mis_dias'] as const;

export type RespuestaDeEntrega = (typeof RESPUESTAS_DE_ENTREGA)[number];

export const DESDE_CUANTOS_DIAS = 2;

export const HASTA_CUANTOS_DIAS = 30;

export const DIAS_MAXIMOS_DE_LA_RESPUESTA = 10;

export const LARGO_MAXIMO_DE_LA_NOTA = 500;

export const MOTIVOS_DE_LA_ENTREGA = [
  'forma',
  'propuesta',
  'vacia',
  'demasiados',
  'repetido',
  'fuera',
  'domingo',
  'franja',
  'largo',
  'tope',
] as const;

export type MotivoDeLaEntrega = (typeof MOTIVOS_DE_LA_ENTREGA)[number];

export type MotivoDeLaValidacion = Exclude<MotivoDeLaEntrega, 'tope'>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DIA = /^2[0-9]{3}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;

const CLAVES_DE_LA_RESPUESTA = ['dias', 'id', 'nota', 'propuesta_id', 'respuesta'] as const;

const CLAVES_DEL_DIA = ['fecha', 'franjas'] as const;

export interface DiaElegido {
  fecha: string;
  franjas: readonly FranjaDeEntrega[];
}

export interface RespuestaDeEntregaParaMandar {
  id: string;
  propuesta_id: string;
  respuesta: RespuestaDeEntrega;
  dias: readonly DiaElegido[];
  nota: string;
}

export function armarRespuestaDeEntrega(
  id: string,
  propuestaId: string,
  respuesta: RespuestaDeEntrega,
  dias: readonly DiaElegido[],
  nota: string,
): RespuestaDeEntregaParaMandar {
  if (respuesta === 'me_queda_bien') {
    return { id, propuesta_id: propuestaId, respuesta, dias: [], nota: '' };
  }
  return {
    id,
    propuesta_id: propuestaId,
    respuesta,
    dias: [...dias]
      .sort((uno, otro) => (uno.fecha < otro.fecha ? -1 : 1))
      .map((dia) => ({
        fecha: dia.fecha,
        franjas: FRANJAS_DE_ENTREGA.filter((franja) => dia.franjas.includes(franja)),
      })),
    nota: sinBlancosEnLasPuntas(nota),
  };
}

export function esFranja(valor: unknown): valor is FranjaDeEntrega {
  return FRANJAS_DE_ENTREGA.some((franja) => franja === valor);
}

export function esDiaDeLaEntrega(texto: string): boolean {
  return DIA.test(texto) && esFechaQueExiste(texto);
}

export function sePuedeElegir(fecha: string, hoy: string): boolean {
  const distancia = diasEntre(hoy, fecha);
  return (
    distancia >= DESDE_CUANTOS_DIAS && distancia <= HASTA_CUANTOS_DIAS && diaDeLaSemana(fecha) !== 0
  );
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function tieneJusto(objeto: Record<string, unknown>, claves: readonly string[]): boolean {
  const suyas = Object.keys(objeto).sort();
  return suyas.length === claves.length && suyas.every((clave, indice) => clave === claves[indice]);
}

interface DiaBienFormado {
  fecha: string;
  franjas: readonly string[];
}

function diaBienFormado(dia: unknown): DiaBienFormado | null {
  if (!esObjeto(dia) || !tieneJusto(dia, CLAVES_DEL_DIA)) return null;
  const { fecha, franjas } = dia;
  if (typeof fecha !== 'string' || !esDiaDeLaEntrega(fecha) || !Array.isArray(franjas)) return null;
  const lista: readonly unknown[] = franjas;
  if (!lista.every((franja) => typeof franja === 'string')) return null;
  return { fecha, franjas: lista };
}

function franjasValidas(franjas: readonly string[]): boolean {
  return (
    franjas.length >= 1 &&
    franjas.length <= FRANJAS_DE_ENTREGA.length &&
    franjas.every(esFranja) &&
    new Set(franjas).size === franjas.length
  );
}

export function validarRespuestaDeEntrega(
  respuesta: unknown,
  forma: FormaDeCoordinar,
  hoy: string,
): MotivoDeLaValidacion | null {
  if (!esObjeto(respuesta) || !tieneJusto(respuesta, CLAVES_DE_LA_RESPUESTA)) return 'forma';
  if (typeof respuesta.id !== 'string' || !UUID.test(respuesta.id)) return 'forma';
  if (typeof respuesta.propuesta_id !== 'string' || !UUID.test(respuesta.propuesta_id)) {
    return 'forma';
  }
  if (respuesta.respuesta !== 'me_queda_bien' && respuesta.respuesta !== 'mis_dias') return 'forma';
  if (!Array.isArray(respuesta.dias) || typeof respuesta.nota !== 'string') return 'forma';

  const crudos: readonly unknown[] = respuesta.dias;
  const nota = respuesta.nota;
  const dias: DiaBienFormado[] = [];
  for (const crudo of crudos) {
    const dia = diaBienFormado(crudo);
    if (dia === null) return 'forma';
    dias.push(dia);
  }

  if (respuesta.respuesta === 'me_queda_bien') {
    if (dias.length > 0 || tieneTexto(nota)) return 'forma';
    return forma === 'un_dia' ? null : 'propuesta';
  }

  if (dias.length === 0 && !tieneTexto(nota)) return 'vacia';
  if (dias.length > DIAS_MAXIMOS_DE_LA_RESPUESTA) return 'demasiados';

  const vistos = new Set<string>();
  for (const dia of dias) {
    if (vistos.has(dia.fecha)) return 'repetido';
    vistos.add(dia.fecha);
    const distancia = diasEntre(hoy, dia.fecha);
    if (distancia < DESDE_CUANTOS_DIAS || distancia > HASTA_CUANTOS_DIAS) return 'fuera';
    if (diaDeLaSemana(dia.fecha) === 0) return 'domingo';
    if (!franjasValidas(dia.franjas)) return 'franja';
  }

  return largoDelTexto(sinBlancosEnLasPuntas(nota)) > LARGO_MAXIMO_DE_LA_NOTA ? 'largo' : null;
}
