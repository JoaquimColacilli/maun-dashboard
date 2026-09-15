import {
  consultarServidorDeAvisos,
  darDeBajaSuscripcion,
  guardarPreferenciasDeAvisos,
  probarLosAvisos,
  registrarSuscripcion,
  traerEstadoDeLosAvisos,
  type EstadoDeLosAvisos,
  type PreferenciasDeLaPersona,
  type ResultadoDeLaPrueba,
  type ServidorDeAvisos,
  type SuscripcionDelDispositivo,
} from '@maun/db';

import { clienteMaun } from './cliente';

export async function servidorDeAvisos(): Promise<ServidorDeAvisos> {
  return consultarServidorDeAvisos(clienteMaun());
}

export async function estadoDeMisAvisos(endpoint: string | null): Promise<EstadoDeLosAvisos> {
  return traerEstadoDeLosAvisos(clienteMaun(), endpoint);
}

export async function activarAvisosEnElServidor(
  suscripcion: SuscripcionDelDispositivo,
  zona: string,
): Promise<EstadoDeLosAvisos> {
  return registrarSuscripcion(clienteMaun(), suscripcion, zona);
}

export async function apagarAvisosEnElServidor(endpoint: string): Promise<boolean> {
  return darDeBajaSuscripcion(clienteMaun(), endpoint);
}

export async function guardarMisPreferenciasDeAvisos(
  preferencias: PreferenciasDeLaPersona,
): Promise<EstadoDeLosAvisos> {
  return guardarPreferenciasDeAvisos(clienteMaun(), preferencias);
}

export async function mandarAvisoDePrueba(endpoint: string): Promise<ResultadoDeLaPrueba> {
  return probarLosAvisos(clienteMaun(), endpoint);
}
