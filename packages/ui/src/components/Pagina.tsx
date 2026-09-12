import type { ReactNode } from 'react';

export interface PaginaProps {
  children: ReactNode;
  className?: string;
}

export function Pagina({ children, className = '' }: PaginaProps) {
  return (
    <div
      className={[
        'mx-auto flex w-full max-w-content flex-col px-(--page-pad-mobile) py-3 md:px-(--page-pad-tablet) md:py-6 lg:px-(--page-pad-desktop) lg:py-7',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  );
}
