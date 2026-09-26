import type { ReactNode } from 'react';

export interface PaginaProps {
  children: ReactNode;
  className?: string;
  quieta?: boolean;
}

export function Pagina({ children, className = '', quieta = false }: PaginaProps) {
  return (
    <div
      data-pagina=""
      data-quieta={quieta ? '' : undefined}
      className={[
        'mx-auto flex w-full max-w-content flex-col px-(--page-pad-mobile) py-4 md:px-(--page-pad-tablet) md:py-6 lg:px-(--page-pad-desktop) lg:py-7',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  );
}
