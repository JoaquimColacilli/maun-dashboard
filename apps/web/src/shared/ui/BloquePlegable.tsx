import { useId, type ReactNode } from 'react';

import { Icono } from '@maun/ui';

export interface BloquePlegableProps {
  titulo: string;
  abiertoAlPrincipio?: boolean;
  resumen?: ReactNode;
  ayuda?: string;
  children: ReactNode;
  className?: string;
}

export function BloquePlegable({
  titulo,
  abiertoAlPrincipio = true,
  resumen,
  ayuda,
  children,
  className = '',
}: BloquePlegableProps) {
  const id = useId();

  return (
    <details open={abiertoAlPrincipio} className={`group ${className}`}>
      <summary
        aria-describedby={ayuda === undefined ? undefined : id}
        className="flex min-h-tap cursor-pointer list-none items-baseline gap-3 rounded-field [&::-webkit-details-marker]:hidden"
      >
        <span className="flex min-w-0 flex-1 items-baseline gap-2">
          <Icono
            nombre="chevron-right"
            tamano={16}
            className="translate-y-0.5 flex-none text-text-3 transition-transform group-open:rotate-90"
          />
          <h2 className="text-section font-semibold">{titulo}</h2>
        </span>
        {resumen !== undefined && (
          <span className="flex-none text-label text-text-2 tabular-nums">{resumen}</span>
        )}
      </summary>
      {ayuda !== undefined && (
        <p id={id} className="mt-0.5 mb-1 ml-6 text-meta leading-normal text-text-3">
          {ayuda}
        </p>
      )}
      <div className="mt-1.5">{children}</div>
    </details>
  );
}
