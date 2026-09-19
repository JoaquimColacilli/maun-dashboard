import {
  generarEnlacePublico,
  marcarArchivoParaElCliente,
  revocarEnlacePublico,
  traerVistaCompartida,
  traerVistaDelCliente,
  type EnlaceNuevo,
  type FilaDe,
} from '@maun/db';
import type { TrabajoDelCliente } from '@maun/domain';

import { clienteAnonimo, clienteMaun } from './cliente';

export function vistaDelCliente(proyectoId: string): Promise<TrabajoDelCliente> {
  return traerVistaDelCliente(clienteMaun(), proyectoId);
}

export function vistaCompartida(token: string): Promise<TrabajoDelCliente> {
  return traerVistaCompartida(clienteAnonimo(), token);
}

export function generarElEnlace(
  nuevo: EnlaceNuevo,
  revocar: { id: string; revocadoEn: string } | null,
): Promise<FilaDe<'enlaces_publicos'>[]> {
  return generarEnlacePublico(clienteMaun(), nuevo, revocar);
}

export function revocarElEnlace(
  id: string,
  revocadoEn: string,
): Promise<FilaDe<'enlaces_publicos'>> {
  return revocarEnlacePublico(clienteMaun(), id, revocadoEn);
}

export function compartirElArchivo(id: string, visible: boolean): Promise<FilaDe<'archivos'>> {
  return marcarArchivoParaElCliente(clienteMaun(), id, visible);
}
