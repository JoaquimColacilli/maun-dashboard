import type { Claims } from '@/shared/api';

export type EstadoSesion =
  | { tipo: 'cargando' }
  | { tipo: 'anonimo'; vencida: boolean }
  | {
      tipo: 'activa';
      usuarioId: string;
      email: string;
      nombre: string;
      foto: string;
      porRecuperacion: boolean;
    };

export const SESION_CARGANDO: EstadoSesion = { tipo: 'cargando' };
export const SESION_ANONIMA: EstadoSesion = { tipo: 'anonimo', vencida: false };
export const SESION_VENCIDA: EstadoSesion = { tipo: 'anonimo', vencida: true };

export function sesionDe(claims: Claims | undefined, porRecuperacion = false): EstadoSesion {
  if (!claims) return SESION_ANONIMA;
  return {
    tipo: 'activa',
    usuarioId: claims.usuarioId,
    email: claims.email,
    nombre: claims.nombre,
    foto: claims.foto,
    porRecuperacion,
  };
}
