import type { HitoDeLaVista, NotaDelRelevamiento } from '@maun/domain';

import { fechaLarga } from '@/shared/lib';
import { Icono } from '@/shared/ui';

import { PasoDelCamino } from './NotaDelRelevamiento';

export interface CaminoDeHitosProps {
  hitos: readonly HitoDeLaVista[];
  nota: NotaDelRelevamiento | null;
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

export function CaminoDeHitos({ hitos, nota, hoy }: CaminoDeHitosProps) {
  const alcanzado = hitos.filter((hito) => hito.estado !== 'futuro').length - 1;

  return (
    <ol
      className={`list-none @xl:grid ${hitos.length > 5 ? '@xl:grid-cols-6' : '@xl:grid-cols-5'}`}
    >
      {hitos.map((hito, indice) => (
        <PasoDelCamino
          key={hito.id}
          nota={hito.estado === 'actual' ? nota : null}
          className="relative grid grid-cols-[18px_minmax(0,1fr)] items-stretch gap-x-3 @xl:flex @xl:flex-col @xl:gap-2.5"
        >
          {(boton) => (
            <>
              <div className="flex flex-col items-center @xl:relative @xl:h-[18px] @xl:flex-row @xl:items-center">
                <span
                  aria-hidden
                  className={`h-1.5 w-0 border-l @xl:absolute @xl:top-1/2 @xl:right-[calc(100%-9px)] @xl:left-[calc(-100%+9px)] @xl:h-0 @xl:w-auto @xl:-translate-y-1/2 @xl:border-t @xl:border-l-0 ${linea(indice <= alcanzado, indice === 0)}`}
                />
                <span
                  aria-hidden
                  className={`z-1 flex flex-none items-center justify-center rounded-pill ${PUNTO[hito.estado]}`}
                >
                  {hito.estado === 'pasado' && <Icono nombre="check" tamano={12} />}
                </span>
                <span
                  aria-hidden
                  className={`w-0 flex-1 border-l @xl:hidden ${linea(indice < alcanzado, indice === hitos.length - 1)}`}
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
                {(hito.fecha !== null || boton !== null) && (
                  <span className="flex flex-wrap items-center gap-x-1.5 text-label text-text-3 tabular-nums @xl:-mr-3">
                    {hito.fecha !== null && fechaLarga(hito.fecha, hoy)}
                    {boton}
                  </span>
                )}
              </div>
            </>
          )}
        </PasoDelCamino>
      ))}
    </ol>
  );
}
