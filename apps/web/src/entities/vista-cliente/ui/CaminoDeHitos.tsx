import { QUEDAMOS_EN_IR, type HitoDeLaVista, type RelevamientoDeLaVista } from '@maun/domain';

import { fechaLarga } from '@/shared/lib';
import { Icono } from '@/shared/ui';

export interface CaminoDeHitosProps {
  hitos: readonly HitoDeLaVista[];
  relevamiento: RelevamientoDeLaVista | null;
  hoy: string;
}

const PUNTO: Readonly<Record<HitoDeLaVista['estado'], string>> = {
  pasado: 'size-[18px] bg-hogar text-paper',
  actual: 'size-[18px] border-2 border-atencion bg-atencion-tint',
  futuro: 'size-[18px] border border-border bg-paper',
};

function linea(activa: boolean, oculta: boolean): string {
  if (oculta) return 'border-transparent';
  return activa ? 'border-solid border-hogar' : 'border-dashed border-border';
}

function Relevamiento({ relevamiento, hoy }: { relevamiento: RelevamientoDeLaVista; hoy: string }) {
  const hecho = relevamiento.estado === 'hecho';

  return (
    <div className="mt-2 flex items-start gap-2 @xl:mt-3 @xl:flex-col @xl:gap-1.5">
      <span
        aria-hidden
        className={`mt-0.5 flex size-4 flex-none items-center justify-center rounded-control ${
          hecho ? 'bg-hogar text-paper' : 'border-[1.5px] border-text-3 bg-paper'
        }`}
      >
        {hecho && <Icono nombre="check" tamano={11} />}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-label leading-normal font-medium">{relevamiento.texto}</span>
        <span className="text-label leading-normal text-text-2">{relevamiento.detalle}</span>
        {relevamiento.fecha !== null && (
          <span className="text-label text-text-3 tabular-nums">
            {hecho
              ? fechaLarga(relevamiento.fecha, hoy)
              : `${QUEDAMOS_EN_IR} ${fechaLarga(relevamiento.fecha, hoy)}`}
          </span>
        )}
      </span>
    </div>
  );
}

export function CaminoDeHitos({ hitos, relevamiento, hoy }: CaminoDeHitosProps) {
  const actual = hitos.findIndex((hito) => hito.estado === 'actual');

  return (
    <ol
      className={`list-none @xl:grid ${hitos.length > 5 ? '@xl:grid-cols-6' : '@xl:grid-cols-5'}`}
    >
      {hitos.map((hito, indice) => (
        <li
          key={hito.id}
          className="grid grid-cols-[18px_minmax(0,1fr)] items-stretch gap-x-3 @xl:relative @xl:flex @xl:flex-col @xl:gap-2.5"
        >
          <div className="flex flex-col items-center @xl:relative @xl:h-[18px] @xl:flex-row @xl:items-center">
            <span
              aria-hidden
              className={`h-1.5 w-0 border-l @xl:absolute @xl:top-1/2 @xl:right-[calc(100%-9px)] @xl:left-[calc(-100%+9px)] @xl:h-0 @xl:w-auto @xl:-translate-y-1/2 @xl:border-t @xl:border-l-0 ${linea(indice <= actual, indice === 0)}`}
            />
            <span
              aria-hidden
              className={`z-1 flex flex-none items-center justify-center rounded-pill ${PUNTO[hito.estado]}`}
            >
              {hito.estado === 'pasado' && <Icono nombre="check" tamano={12} />}
            </span>
            <span
              aria-hidden
              className={`w-0 flex-1 border-l @xl:hidden ${linea(indice < actual, indice === hitos.length - 1)}`}
            />
          </div>
          <div className="flex flex-col gap-0.5 pb-5 @xl:pr-3 @xl:pb-0">
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
            {hito.id === 'presupuesto' && relevamiento !== null && (
              <Relevamiento relevamiento={relevamiento} hoy={hoy} />
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
