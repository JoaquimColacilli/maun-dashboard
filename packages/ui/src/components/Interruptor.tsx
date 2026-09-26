import { useState, type ReactNode } from 'react';

export interface InterruptorProps {
  activo: boolean;
  alCambiar: (activo: boolean) => void;
  etiqueta?: string;
  className?: string;
  children?: ReactNode;
}

export function Interruptor({
  activo,
  alCambiar,
  etiqueta,
  className = 'min-h-tap rounded-pill',
  children,
}: InterruptorProps) {
  const [tocado, setTocado] = useState(false);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      data-tocado={tocado ? '' : undefined}
      onClick={() => {
        setTocado(true);
        alCambiar(!activo);
      }}
      className={['interruptor flex flex-none items-center gap-3 text-left', className]
        .join(' ')
        .trim()}
    >
      <span
        aria-hidden
        className={`relative block h-8 w-13 flex-none rounded-pill transition-colors duration-(--dur-fast) ${
          activo ? 'bg-ink' : 'bg-border'
        }`}
      >
        <span className="perilla absolute inset-y-0.75 rounded-pill bg-paper shadow-float" />
      </span>
      {children}
    </button>
  );
}
