import {
  ANTICIPACIONES,
  type Anticipacion,
  type AvisoDeLaAgenda,
  type PreferenciasDeAvisos,
} from '@maun/domain';
import { FunctionsHttpError } from '@supabase/supabase-js';

import type { ClienteMaun } from './cliente.ts';
import type { Json } from './database.types.ts';
import { RespuestaInvalidaError } from './replica.ts';

export const FUNCION_DE_AVISOS = 'avisos';

export interface PreferenciasDeLaPersona {
  zona: string;
  hora: string;
  avisos: PreferenciasDeAvisos;
}

export interface EstadoDeLosAvisos {
  suscripto: boolean;
  ultimoEnvio: string | null;
  dispositivos: number;
  preferencias: PreferenciasDeLaPersona | null;
}

export interface SuscripcionDelDispositivo {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface ServidorDeAvisos {
  configurado: boolean;
  clavePublica: string | null;
}

export interface ResultadoDeLaPrueba {
  configurado: boolean;
  mandados: number;
  podados: number;
  fallidos: number;
}

type Objeto = Readonly<Record<string, unknown>>;

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

function esObjeto(valor: unknown): valor is Objeto {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function invalida(que: string): never {
  throw new RespuestaInvalidaError(`La respuesta de los avisos no trae ${que}.`);
}

function esAnticipacion(valor: unknown): valor is Anticipacion {
  return ANTICIPACIONES.some((anticipacion) => anticipacion === valor);
}

function leerPreferencia(
  avisos: Objeto,
  aviso: AvisoDeLaAgenda,
): PreferenciasDeAvisos[AvisoDeLaAgenda] {
  const preferencia = avisos[aviso];
  if (!esObjeto(preferencia)) return invalida(`la preferencia de ${aviso}`);
  const { activo, anticipacion } = preferencia;
  if (typeof activo !== 'boolean' || !esAnticipacion(anticipacion)) {
    return invalida(`la preferencia de ${aviso}`);
  }
  return { activo, anticipacion };
}

function leerPreferencias(valor: unknown): PreferenciasDeLaPersona {
  if (!esObjeto(valor)) return invalida('las preferencias');
  const { zona, hora, avisos } = valor;
  if (typeof zona !== 'string' || zona === '') return invalida('la zona horaria');
  if (typeof hora !== 'string' || !HORA.test(hora)) return invalida('la hora');
  if (!esObjeto(avisos)) return invalida('qué avisa');
  return {
    zona,
    hora,
    avisos: {
      entregas: leerPreferencia(avisos, 'entregas'),
      visitas: leerPreferencia(avisos, 'visitas'),
      presupuestos: leerPreferencia(avisos, 'presupuestos'),
      anotaciones: leerPreferencia(avisos, 'anotaciones'),
    },
  };
}

function contador(valor: Objeto, clave: string): number {
  const numero = valor[clave];
  return typeof numero === 'number' && Number.isInteger(numero) && numero >= 0 ? numero : 0;
}

export function leerEstadoDeLosAvisos(valor: unknown): EstadoDeLosAvisos {
  if (!esObjeto(valor)) return invalida('el estado');
  const { suscripto, ultimo_envio: ultimoEnvio, dispositivos, preferencias } = valor;
  if (typeof suscripto !== 'boolean') return invalida('si este dispositivo recibe');
  if (ultimoEnvio !== null && typeof ultimoEnvio !== 'string') return invalida('el último envío');
  if (typeof dispositivos !== 'number' || !Number.isInteger(dispositivos) || dispositivos < 0) {
    return invalida('los dispositivos');
  }
  return {
    suscripto,
    ultimoEnvio,
    dispositivos,
    preferencias: preferencias === null ? null : leerPreferencias(preferencias),
  };
}

export function leerServidorDeAvisos(valor: unknown): ServidorDeAvisos {
  if (!esObjeto(valor)) return invalida('si el servidor puede mandar');
  const { configurado, clavePublica } = valor;
  if (typeof configurado !== 'boolean') return invalida('si el servidor puede mandar');
  if (clavePublica !== null && typeof clavePublica !== 'string') {
    return invalida('la clave pública');
  }
  return { configurado: configurado && clavePublica !== null, clavePublica };
}

export function leerResultadoDeLaPrueba(valor: unknown): ResultadoDeLaPrueba {
  if (!esObjeto(valor)) return invalida('el resultado de la prueba');
  const { configurado } = valor;
  if (typeof configurado !== 'boolean') return invalida('el resultado de la prueba');
  return {
    configurado,
    mandados: contador(valor, 'mandados'),
    podados: contador(valor, 'podados'),
    fallidos: contador(valor, 'fallidos'),
  };
}

export async function traerEstadoDeLosAvisos(
  cliente: ClienteMaun,
  endpoint: string | null,
): Promise<EstadoDeLosAvisos> {
  const { data, error } = await cliente.rpc(
    'estado_de_mis_avisos',
    endpoint === null ? {} : { p_endpoint: endpoint },
  );
  if (error) throw error;
  return leerEstadoDeLosAvisos(data);
}

export async function registrarSuscripcion(
  cliente: ClienteMaun,
  suscripcion: SuscripcionDelDispositivo,
  zona: string,
): Promise<EstadoDeLosAvisos> {
  const { data, error } = await cliente.rpc('registrar_suscripcion', {
    p_endpoint: suscripcion.endpoint,
    p_p256dh: suscripcion.p256dh,
    p_auth: suscripcion.auth,
    p_zona: zona,
  });
  if (error) throw error;
  return leerEstadoDeLosAvisos(data);
}

export async function darDeBajaSuscripcion(
  cliente: ClienteMaun,
  endpoint: string,
): Promise<boolean> {
  const { data, error } = await cliente.rpc('dar_de_baja_suscripcion', { p_endpoint: endpoint });
  if (error) throw error;
  return data;
}

export async function guardarPreferenciasDeAvisos(
  cliente: ClienteMaun,
  preferencias: PreferenciasDeLaPersona,
): Promise<EstadoDeLosAvisos> {
  const { data, error } = await cliente.rpc('guardar_preferencias_de_avisos', {
    p_zona: preferencias.zona,
    p_hora: preferencias.hora,
    p_avisos: preferencias.avisos as unknown as Json,
  });
  if (error) throw error;
  return leerEstadoDeLosAvisos(data);
}

export async function consultarServidorDeAvisos(cliente: ClienteMaun): Promise<ServidorDeAvisos> {
  const respuesta = await cliente.functions.invoke<unknown>(FUNCION_DE_AVISOS, { method: 'GET' });
  const error: unknown = respuesta.error;
  if (error !== null) throw comoError(error);
  return leerServidorDeAvisos(respuesta.data);
}

function comoError(error: unknown): Error {
  return error instanceof Error ? error : new Error('La función de avisos no respondió.');
}

function estadoHttp(error: FunctionsHttpError): number | null {
  const respuesta: unknown = error.context;
  return respuesta instanceof Response ? respuesta.status : null;
}

export async function probarLosAvisos(
  cliente: ClienteMaun,
  endpoint: string,
): Promise<ResultadoDeLaPrueba> {
  const respuesta = await cliente.functions.invoke<unknown>(`${FUNCION_DE_AVISOS}/probar`, {
    body: { endpoint },
  });
  const error: unknown = respuesta.error;
  if (error instanceof FunctionsHttpError && estadoHttp(error) === 503) {
    return { configurado: false, mandados: 0, podados: 0, fallidos: 0 };
  }
  if (error !== null) throw comoError(error);
  return leerResultadoDeLaPrueba(respuesta.data);
}
