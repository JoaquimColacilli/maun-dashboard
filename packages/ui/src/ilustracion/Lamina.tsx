import type { ReactNode } from 'react';

export interface LaminaProps {
  children: ReactNode;
  className?: string;
}

export function Lamina({ children, className = '' }: LaminaProps) {
  return (
    <div aria-hidden="true" data-lamina="" className={['lamina', className].join(' ').trim()}>
      {children}
    </div>
  );
}
