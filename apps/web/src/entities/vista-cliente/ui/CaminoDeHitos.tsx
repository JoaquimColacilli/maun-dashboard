import type { HitoDeLaVista } from '@maun/domain';

import { fechaLarga } from '@/shared/lib';
import { Icono } from '@/shared/ui';

export interface CaminoDeHitosProps {
  hitos: readonly HitoDeLaVista[];
  desdeTexto: string;
  hoy: string;
}

const PUNTO: Readonly<Record<HitoDeLaVista['estado'], string>> = {
  pasado: 'size-4 bg-ink text-paper',
  actual: 'size-[18px] border-2 border-ink bg-paper ring-4 ring-surface',
  futuro: 'size-4 border border-border bg-paper',
};

function linea(activa: boolean, oculta: boolean): string {
  if (oculta) return 'border-transparent';
  return activa ? 'border-solid border-ink' : 'border-dashed border-border';
}

export function CaminoDeHitos({ hitos, desdeTexto, hoy }: CaminoDeHitosProps) {
  const actual = hitos.findIndex((hito) => hito.estado === 'actual');

  return (
    <ol className="list-none @xl:grid @xl:grid-cols-5">
      {hitos.map((hito, indice) => (
        <li
          key={hito.id}
          className="grid grid-cols-[18px_minmax(0,1fr)] items-stretch gap-x-3 @xl:relative @xl:flex @xl:flex-col @xl:gap-2.5 @xl:px-1"
        >
          <div className="flex flex-col items-center @xl:relative @xl:h-[18px] @xl:flex-row @xl:items-center">
            <span
              aria-hidden
              className={`h-1.5 w-0 border-l @xl:absolute @xl:top-2 @xl:right-1/2 @xl:-left-1/2 @xl:h-0 @xl:w-auto @xl:border-t @xl:border-l-0 ${linea(indice <= actual, indice === 0)}`}
            />
            <span
              aria-hidden
              className={`z-1 flex flex-none items-center justify-center rounded-pill ${PUNTO[hito.estado]}`}
            >
              {hito.estado === 'pasado' && <Icono nombre="check" tamano={11} />}
            </span>
            <span
              aria-hidden
              className={`w-0 flex-1 border-l @xl:hidden ${linea(indice < actual, indice === hitos.length - 1)}`}
            />
          </div>
          <div className="flex flex-col gap-0.5 pb-5 @xl:pr-2 @xl:pb-0">
            <span
              className={`leading-normal ${
                hito.estado === 'actual'
                  ? 'text-body-lg font-semibold'
                  : hito.estado === 'pasado'
                    ? 'text-label font-medium'
                    : 'text-label text-text-3'
              }`}
            >
              {hito.texto}
            </span>
            {hito.fecha !== null && (
              <span className="text-label text-text-3 tabular-nums">
                {fechaLarga(hito.fecha, hoy)}
              </span>
            )}
            {hito.estado === 'actual' && desdeTexto !== '' && (
              <span className="text-label text-text-2">{desdeTexto}</span>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
