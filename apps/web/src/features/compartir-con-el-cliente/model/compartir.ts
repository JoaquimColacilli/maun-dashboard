import { loQueVeElCliente, type Archivo } from '@/entities/archivo';
import type { Enlace } from '@/entities/enlace';
import { enlaceDelCliente, tokenDelEnlace } from '@/shared/lib';

export type ComoSeVeElEnlace =
  | { como: 'sin_enlace' }
  | { como: 'de_baja' }
  | { como: 'activo'; url: string }
  | { como: 'activo_en_otro_dispositivo' };

export function comoSeVeElEnlace(
  enlace: Enlace | undefined,
  huboAlguno: boolean,
): ComoSeVeElEnlace {
  if (enlace === undefined) return huboAlguno ? { como: 'de_baja' } : { como: 'sin_enlace' };
  const token = tokenDelEnlace(enlace.id);
  if (token === undefined) return { como: 'activo_en_otro_dispositivo' };
  return { como: 'activo', url: enlaceDelCliente(token) };
}

export function mensajeParaElCliente(cliente: string, trabajo: string, url: string): string {
  const nombre = cliente.trim() === '' ? 'Hola' : `Hola ${cliente.split(' ')[0] ?? cliente}`;
  return `${nombre}, acá podés ver cómo va tu ${trabajo.toLocaleLowerCase('es-AR')}: ${url}`;
}

export function enlaceDeWhatsapp(telefono: string, mensaje: string): string {
  const numero = telefono.replace(/\D/g, '');
  const texto = encodeURIComponent(mensaje);
  return numero === '' ? `https://wa.me/?text=${texto}` : `https://wa.me/${numero}?text=${texto}`;
}

export function cuantosVeElCliente(archivos: readonly Archivo[]): string {
  const { compartidos, total } = loQueVeElCliente(archivos);
  return `${String(compartidos)} de ${String(total)} compartidos`;
}
