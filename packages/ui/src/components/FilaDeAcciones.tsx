import type { ReactNode } from 'react';

export interface FilaDeAccionesProps {
  children: ReactNode;
  className?: string;
}

export function FilaDeAcciones({ children, className = '' }: FilaDeAccionesProps) {
  return (
    <div
      data-fila-de-acciones=""
      className={[
        'grid grid-cols-[repeat(auto-fit,minmax(min(var(--accion-min),100%),1fr))] gap-2 *:w-full',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  );
}
