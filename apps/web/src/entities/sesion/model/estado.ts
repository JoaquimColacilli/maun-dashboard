import type { Claims } from '@/shared/api';

export type EstadoSesion =
  | { tipo: 'cargando' }
  | { tipo: 'anonimo' }
  | { tipo: 'activa'; usuarioId: string; email: string; porRecuperacion: boolean };

export const SESION_CARGANDO: EstadoSesion = { tipo: 'cargando' };
export const SESION_ANONIMA: EstadoSesion = { tipo: 'anonimo' };

export function sesionDe(claims: Claims | undefined, porRecuperacion = false): EstadoSesion {
  if (!claims) return SESION_ANONIMA;
  return { tipo: 'activa', usuarioId: claims.usuarioId, email: claims.email, porRecuperacion };
}
