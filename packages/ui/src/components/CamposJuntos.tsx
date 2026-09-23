import type { ReactNode } from 'react';

export type CampoMinimo = '12rem' | '14rem' | '16rem';

export interface CamposJuntosProps {
  children: ReactNode;
  columnas?: 2 | 3;
  deADos?: boolean;
  campoMinimo?: CampoMinimo;
  separacion?: string;
  className?: string;
}

const EN_UN_RENGLON: Readonly<Record<2 | 3, Readonly<Record<CampoMinimo, string>>>> = {
  2: {
    '12rem': '@min-[25rem]/campos:grid-cols-2',
    '14rem': '@min-[29rem]/campos:grid-cols-2',
    '16rem': '@min-[33rem]/campos:grid-cols-2',
  },
  3: {
    '12rem': '@min-[38rem]/campos:grid-cols-3',
    '14rem': '@min-[44rem]/campos:grid-cols-3',
    '16rem': '@min-[50rem]/campos:grid-cols-3',
  },
};

export function CamposJuntos({
  children,
  columnas = 2,
  deADos = false,
  campoMinimo = '16rem',
  separacion = 'gap-3',
  className = '',
}: CamposJuntosProps) {
  return (
    <div data-reparto="campos" className="relative min-w-0 md:@container/campos">
      <div
        className={[
          'grid min-w-0 grid-cols-1 items-start gap-x-4',
          columnas === 3 && deADos ? EN_UN_RENGLON[2][campoMinimo] : '',
          EN_UN_RENGLON[columnas][campoMinimo],
          separacion,
          className,
        ].join(' ')}
      >
        {children}
      </div>
    </div>
  );
}
