import type { EventoDeLaAgenda } from '@maun/domain';
import { useLayoutEffect, useRef } from 'react';

import {
  cuentaDelDia,
  diaDeLaSemana,
  diaEnPalabras,
  eventosDelDia,
  fechasDelMes,
  hayImportante,
  INICIALES_DE_LA_SEMANA,
  numeroDelDia,
} from '../model/calendario';
import { MarcaDeCategoria } from './MarcaDeCategoria';

export interface TiraDelMesProps {
  mes: string;
  hoy: string;
  elegido: string;
  eventos: readonly EventoDeLaAgenda[];
  alElegir: (fecha: string) => void;
}

export function TiraDelMes({ mes, hoy, elegido, eventos, alElegir }: TiraDelMesProps) {
  const contenedor = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const tira = contenedor.current;
    const dia = tira?.querySelector<HTMLElement>(`[data-fecha="${elegido}"]`);
    if (!tira || !dia) return;
    tira.scrollLeft = dia.offsetLeft - tira.clientWidth / 2 + dia.clientWidth / 2;
  }, [mes, elegido]);

  return (
    <div
      ref={contenedor}
      role="group"
      aria-label="Días del mes"
      className="flex snap-x snap-proximity gap-0.5 overflow-x-auto border-b border-hairline px-(--page-pad-mobile) pt-2 pb-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {fechasDelMes(mes).map((fecha) => {
        const delDia = eventosDelDia(eventos, fecha);
        const esElegido = fecha === elegido;
        const esHoy = fecha === hoy;
        const marcado = hayImportante(delDia);
        const fondo = esElegido
          ? 'bg-ink text-paper'
          : esHoy
            ? 'bg-surface text-ink ring-1 ring-border ring-inset'
            : 'text-text-2';
        return (
          <button
            key={fecha}
            type="button"
            data-fecha={fecha}
            aria-pressed={esElegido}
            aria-current={esHoy ? 'date' : undefined}
            aria-label={`${diaEnPalabras(fecha)}, ${cuentaDelDia(delDia)}${marcado ? ', con algo marcado' : ''}`}
            onClick={() => {
              alElegir(fecha);
            }}
            className={`flex h-[58px] w-(--tira-celda) flex-none snap-center flex-col items-center justify-center gap-0.5 rounded-pill ${fondo} ${
              marcado && !esElegido ? 'ring-[1.5px] ring-ag-marca' : ''
            }`}
          >
            <span aria-hidden className="text-badge leading-none opacity-75">
              {INICIALES_DE_LA_SEMANA[diaDeLaSemana(fecha)]}
            </span>
            <span aria-hidden className="font-display text-body-lg leading-tight">
              {numeroDelDia(fecha)}
            </span>
            <span aria-hidden className="flex h-[7px] items-center gap-0.5">
              {delDia.slice(0, 3).map((evento) => (
                <MarcaDeCategoria
                  key={evento.id}
                  categoria={evento.categoria}
                  tamano="chica"
                  className={esElegido ? 'brightness-[3] grayscale' : ''}
                />
              ))}
            </span>
          </button>
        );
      })}
    </div>
  );
}
