import type { ReactNode } from 'react';

import { Ir, RUTA_DE_OPINIONES, RUTA_DE_PREGUNTAS } from '@/shared/lib';
import { Pagina } from '@/shared/ui';

type Seccion = 'resultados' | 'preguntas';

const SECCIONES: readonly { id: Seccion; etiqueta: string; ruta: string }[] = [
  { id: 'resultados', etiqueta: 'Resultados', ruta: RUTA_DE_OPINIONES },
  { id: 'preguntas', etiqueta: 'Preguntas', ruta: RUTA_DE_PREGUNTAS },
];

export function EncabezadoDeOpiniones({ seccion }: { seccion: Seccion }) {
  const actual = SECCIONES.find((opcion) => opcion.id === seccion);

  return (
    <header className="flex flex-col items-start gap-3 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <span className="text-label text-text-2">Opiniones</span>
        <h1 className="mt-0.5 font-display text-h1 leading-tight lg:text-h1-lg">
          {actual?.etiqueta}
        </h1>
      </div>
      <nav aria-label="Opiniones" className="flex gap-0.5 rounded-pill bg-ink/6 p-1">
        {SECCIONES.map((opcion) => {
          const activa = opcion.id === seccion;
          return (
            <Ir
              key={opcion.id}
              a={opcion.ruta}
              aria-current={activa ? 'page' : undefined}
              className={`relative flex h-9 items-center rounded-pill px-3.5 text-body-sm no-underline ${
                activa ? 'font-semibold text-ink' : 'font-medium text-text-2 hover:text-ink'
              }`}
            >
              {activa && (
                <span
                  aria-hidden
                  data-fondo-de-la-pestana
                  className="absolute inset-0 rounded-pill bg-elevado shadow-float"
                />
              )}
              <span data-etiqueta-de-la-pestana className="relative">
                {opcion.etiqueta}
              </span>
            </Ir>
          );
        })}
      </nav>
    </header>
  );
}

export function PaginaDeOpiniones({
  seccion,
  children,
}: {
  seccion: Seccion;
  children: ReactNode;
}) {
  return (
    <Pagina className="gap-3 pb-10 md:gap-4">
      <EncabezadoDeOpiniones seccion={seccion} />
      <div data-bajo-las-pestanas className="flex flex-col gap-3 md:gap-4">
        {children}
      </div>
    </Pagina>
  );
}
