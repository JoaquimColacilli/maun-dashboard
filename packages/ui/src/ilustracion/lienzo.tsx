import type { ReactNode } from 'react';

import type { Limites } from './proyeccion.ts';

export const ANCHO_DE_ESCENA = 160;
export const ALTO_DE_ESCENA = 120;
const AIRE = 4;

export interface LienzoProps {
  limites: Limites;
  ancho?: number;
  alto?: number;
  className?: string;
  children: ReactNode;
}

export function Lienzo({ limites, ancho, alto, className = '', children }: LienzoProps) {
  const anchoFinal = ancho ?? Math.ceil(limites.derecha - limites.izquierda + 2 * AIRE);
  const altoFinal = alto ?? Math.ceil(limites.abajo - limites.arriba + 2 * AIRE);
  const x = Math.floor((limites.izquierda + limites.derecha - anchoFinal) / 2);
  const y = Math.floor((limites.arriba + limites.abajo - altoFinal) / 2);
  return (
    <svg
      viewBox={`${String(x)} ${String(y)} ${String(anchoFinal)} ${String(altoFinal)}`}
      width={anchoFinal}
      height={altoFinal}
      aria-hidden
      focusable={false}
      className={['ilustracion', className].join(' ').trim()}
    >
      {children}
    </svg>
  );
}
