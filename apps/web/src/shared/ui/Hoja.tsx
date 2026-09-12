import { useEffect, useId, type ReactNode } from 'react';

import { Icono } from '@maun/ui';

import { useAltoVisible, useAnchoDePantalla } from '@/shared/lib';

export interface HojaProps {
  titulo: string;
  alCerrar: () => void;
  children: ReactNode;
}

export function Hoja({ titulo, alCerrar, children }: HojaProps) {
  const ancho = useAnchoDePantalla();
  const altoVisible = useAltoVisible();
  const idTitulo = useId();
  const enCelular = ancho === 'movil';

  useEffect(() => {
    function alApretar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') alCerrar();
    }
    document.addEventListener('keydown', alApretar);
    return () => {
      document.removeEventListener('keydown', alApretar);
    };
  }, [alCerrar]);

  return (
    <div className="fixed inset-0 z-40">
      <button
        type="button"
        aria-hidden
        tabIndex={-1}
        onClick={alCerrar}
        className="absolute inset-0 cursor-default bg-ink/35"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        style={enCelular && altoVisible !== undefined ? { height: altoVisible - 40 } : undefined}
        className={`absolute flex flex-col bg-paper shadow-float ${
          enCelular
            ? 'inset-x-0 bottom-0 max-h-[calc(100dvh-40px)] rounded-t-sheet'
            : 'top-1/2 left-1/2 max-h-[88dvh] w-[min(560px,calc(100%-40px))] -translate-x-1/2 -translate-y-1/2 rounded-dialog'
        }`}
      >
        <header className="flex flex-none items-center justify-between border-b border-hairline py-2.5 pr-2.5 pl-5 md:py-3.5 md:pr-3.5 md:pl-6">
          <h2 id={idTitulo} className="text-body-lg font-semibold">
            {titulo}
          </h2>
          <button
            type="button"
            onClick={alCerrar}
            aria-label="Cerrar"
            className="flex size-11 items-center justify-center rounded-field text-text-2 hover:bg-surface"
          >
            <Icono nombre="x" tamano={20} />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
