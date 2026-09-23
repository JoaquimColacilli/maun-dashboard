import type { ReactNode } from 'react';

export type AnchoDePagina = 'formulario' | 'ficha' | 'tablero' | 'lista';

export interface PaginaProps {
  children: ReactNode;
  ancho?: AnchoDePagina;
  className?: string;
}

const TOPE: Readonly<Record<AnchoDePagina, string>> = {
  formulario: 'max-w-formulario',
  ficha: 'max-w-ficha',
  tablero: 'max-w-tablero',
  lista: 'max-w-content',
};

export function Pagina({ children, ancho = 'lista', className = '' }: PaginaProps) {
  return (
    <div
      data-pagina={ancho}
      className={[
        'ms-(--inicio-de-la-pagina) me-auto flex w-full flex-col px-(--page-pad-mobile) py-3 md:px-(--page-pad-tablet) md:py-6 lg:px-(--page-pad-desktop) lg:py-7',
        TOPE[ancho],
        className,
      ].join(' ')}
    >
      {children}
    </div>
  );
}
