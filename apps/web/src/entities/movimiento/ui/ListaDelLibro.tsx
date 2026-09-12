import type { Tesoro } from '@maun/domain';

import { fechaLarga, formatearPesos } from '@/shared/lib';

import type { DiaDelLibro, LineaDelTaller } from '../model/libro';
import { FilaDelLibro } from './FilaDelLibro';

export interface ListaDelLibroProps {
  dias: readonly DiaDelLibro[];
  tesoro: Tesoro | 'todos';
  hoy: string;
  sinConfirmar: (linea: LineaDelTaller) => boolean;
  alAbrir: (linea: LineaDelTaller) => void;
}

export function ListaDelLibro({ dias, tesoro, hoy, sinConfirmar, alAbrir }: ListaDelLibroProps) {
  return (
    <div className="flex flex-col">
      {dias.map((dia) => (
        <section
          key={dia.fecha}
          aria-label={fechaLarga(dia.fecha, hoy)}
          className="mt-4 first:mt-1"
        >
          <div className="flex items-baseline justify-between gap-3 border-b border-ink pb-1.5">
            <span className="text-label font-semibold">{fechaLarga(dia.fecha, hoy)}</span>
            <span className="text-meta text-text-2 tabular-nums">
              {dia.neto === 0
                ? 'sin efecto en los saldos'
                : `${dia.neto > 0 ? '+' : '−'}${formatearPesos(Math.abs(dia.neto))}`}
            </span>
          </div>
          <ul className="list-none">
            {dia.lineas.map((linea) => (
              <li key={linea.clave}>
                <FilaDelLibro
                  linea={linea}
                  tesoro={tesoro}
                  sinConfirmar={sinConfirmar(linea)}
                  alAbrir={() => {
                    alAbrir(linea);
                  }}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
