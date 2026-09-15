import { filasDe, type FilaDe, type Replica } from '@/shared/api';

export type Archivo = FilaDe<'archivos'>;

export const TIPOS_DE_ARCHIVO = ['image/webp', 'image/jpeg', 'application/pdf'] as const;

export type TipoDeArchivo = (typeof TIPOS_DE_ARCHIVO)[number];

export const ESPACIO_DEL_PLAN_BYTES = 1024 ** 3;

export const ESPACIO_PARA_AVISAR_BYTES = 800 * 1024 ** 2;

const EXTENSION: Readonly<Record<TipoDeArchivo, string>> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'application/pdf': 'pdf',
};

export interface UbicacionDelArchivo {
  id: string;
  household_id: string;
  proyecto_id: string;
  tipo: string;
}

function esTipoDeArchivo(tipo: string): tipo is TipoDeArchivo {
  return (TIPOS_DE_ARCHIVO as readonly string[]).includes(tipo);
}

function extensionDe(tipo: string): string {
  return esTipoDeArchivo(tipo) ? EXTENSION[tipo] : 'bin';
}

export function esImagen(archivo: { tipo: string }): boolean {
  return archivo.tipo === 'image/webp' || archivo.tipo === 'image/jpeg';
}

function carpetaDe(archivo: UbicacionDelArchivo): string {
  return `${archivo.household_id}/${archivo.proyecto_id}/${archivo.id}`;
}

export function rutaDelArchivo(archivo: UbicacionDelArchivo): string {
  return `${carpetaDe(archivo)}.${extensionDe(archivo.tipo)}`;
}

export function rutaDeLaMiniatura(archivo: UbicacionDelArchivo): string {
  return esImagen(archivo)
    ? `${carpetaDe(archivo)}.mini.${extensionDe(archivo.tipo)}`
    : rutaDelArchivo(archivo);
}

export function rutasEnElBucket(archivo: UbicacionDelArchivo): string[] {
  return esImagen(archivo)
    ? [rutaDelArchivo(archivo), rutaDeLaMiniatura(archivo)]
    : [rutaDelArchivo(archivo)];
}

function masNuevoPrimero(uno: Archivo, otro: Archivo): number {
  if (uno.created_at !== otro.created_at) return uno.created_at < otro.created_at ? 1 : -1;
  return uno.id < otro.id ? 1 : -1;
}

export function archivosDelProyecto(replica: Replica, proyectoId: string): Archivo[] {
  return filasDe(replica, 'archivos')
    .filter((archivo) => archivo.proyecto_id === proyectoId)
    .sort(masNuevoPrimero);
}

export function espacioUsado(replica: Replica): number {
  return filasDe(replica, 'archivos').reduce((suma, archivo) => suma + archivo.bytes, 0);
}

const KB = 1024;
const MB = 1024 * KB;
const GB = 1024 * MB;

function conUnDecimal(valor: number): string {
  return valor.toLocaleString('es-AR', { maximumFractionDigits: 1 });
}

export function pesoLegible(bytes: number): string {
  if (bytes < MB) return `${String(Math.max(1, Math.round(bytes / KB)))} KB`;
  if (bytes < GB) return `${conUnDecimal(bytes / MB)} MB`;
  return `${conUnDecimal(bytes / GB)} GB`;
}
