import type { CSSProperties } from 'react';

export type TamanoDelMonto = 'tarjeta' | 'destacado';

const MAXIMO: Record<TamanoDelMonto, string> = {
  tarjeta: 'var(--text-money-lg-desktop)',
  destacado: 'var(--text-money-xl)',
};

export function caracteresDe(...montos: readonly string[]): number {
  return Math.max(1, ...montos.map((monto) => Array.from(monto).length));
}

export interface MontoQueEntraProps {
  children: string;
  caracteres?: number;
  tamano?: TamanoDelMonto;
  className?: string;
}

export function MontoQueEntra({
  children,
  caracteres,
  tamano = 'tarjeta',
  className = '',
}: MontoQueEntraProps) {
  const estilo: CSSProperties & Record<'--caracteres' | '--monto-maximo', string> = {
    '--caracteres': String(caracteres ?? caracteresDe(children)),
    '--monto-maximo': MAXIMO[tamano],
  };
  return (
    <span data-monto className={`text-monto-que-entra ${className}`} style={estilo}>
      {children}
    </span>
  );
}
