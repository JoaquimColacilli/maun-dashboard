import { Link } from 'react-router';

import { RUTA_DE_OPINIONES, RUTA_DE_PREGUNTAS } from '@/shared/lib';

type Seccion = 'resultados' | 'preguntas';

const SECCIONES: readonly { id: Seccion; etiqueta: string; ruta: string }[] = [
  { id: 'resultados', etiqueta: 'Resultados', ruta: RUTA_DE_OPINIONES },
  { id: 'preguntas', etiqueta: 'Preguntas', ruta: RUTA_DE_PREGUNTAS },
];

export function EncabezadoDeOpiniones({ seccion }: { seccion: Seccion }) {
  const actual = SECCIONES.find((opcion) => opcion.id === seccion);

  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <span className="text-label text-text-2">Opiniones</span>
        <h1 className="mt-0.5 font-display text-h1 leading-tight lg:text-h1-lg">
          {actual?.etiqueta}
        </h1>
      </div>
      <nav aria-label="Opiniones" className="flex gap-0.5 rounded-panel bg-surface-2 p-0.5">
        {SECCIONES.map((opcion) => {
          const activa = opcion.id === seccion;
          return (
            <Link
              key={opcion.id}
              to={opcion.ruta}
              aria-current={activa ? 'page' : undefined}
              className={`flex h-9 items-center rounded-field px-3.5 text-body-sm no-underline ${
                activa
                  ? 'bg-paper font-semibold text-ink shadow-float'
                  : 'font-medium text-text-2 hover:text-ink'
              }`}
            >
              {opcion.etiqueta}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
