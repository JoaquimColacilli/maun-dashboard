import { claimsGuardados, escucharSesion, leerClaims, vinoPorRecuperacion } from '@/shared/api';

import { SESION_ANONIMA, SESION_CARGANDO, sesionDe, type EstadoSesion } from './estado';

export const TOPE_PARA_VALIDAR_LA_SESION_MS = 10_000;

let estado: EstadoSesion = SESION_CARGANDO;
let arrancado = false;
const oyentes = new Set<() => void>();

function iguales(a: EstadoSesion, b: EstadoSesion): boolean {
  if (a.tipo !== b.tipo) return false;
  if (a.tipo === 'activa' && b.tipo === 'activa') {
    return (
      a.usuarioId === b.usuarioId &&
      a.email === b.email &&
      a.nombre === b.nombre &&
      a.foto === b.foto &&
      a.porRecuperacion === b.porRecuperacion
    );
  }
  return true;
}

function guardar(nuevo: EstadoSesion): void {
  if (iguales(estado, nuevo)) return;
  estado = nuevo;
  for (const oyente of oyentes) oyente();
}

function arrancar(): void {
  if (arrancado) return;
  arrancado = true;

  escucharSesion((claims) => {
    guardar(sesionDe(claims, vinoPorRecuperacion()));
  });

  const tope = setTimeout(() => {
    if (estado.tipo === 'cargando') guardar(sesionDe(claimsGuardados(), vinoPorRecuperacion()));
  }, TOPE_PARA_VALIDAR_LA_SESION_MS);

  leerClaims()
    .then((claims) => {
      clearTimeout(tope);
      guardar(sesionDe(claims, vinoPorRecuperacion()));
    })
    .catch(() => {
      clearTimeout(tope);
      guardar(SESION_ANONIMA);
    });
}

export function suscribirSesion(oyente: () => void): () => void {
  arrancar();
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}

export function leerEstadoSesion(): EstadoSesion {
  return estado;
}
