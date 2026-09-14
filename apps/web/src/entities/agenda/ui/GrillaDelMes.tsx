import type { EventoDeLaAgenda } from '@maun/domain';

import {
  DIAS_DE_LA_SEMANA,
  diaEnPalabras,
  eventosDelDia,
  hayImportante,
  nombreDelEvento,
  numeroDelDia,
  semanasDelMes,
} from '../model/calendario';
import { DERIVADA } from '../model/categorias';
import { MarcaDeCategoria } from './MarcaDeCategoria';

export interface GrillaDelMesProps {
  mes: string;
  hoy: string;
  elegido: string | null;
  eventos: readonly EventoDeLaAgenda[];
  maximo: number;
  alElegirDia: (fecha: string) => void;
  alVerElDia?: (fecha: string) => void;
  alAbrirEvento: (evento: EventoDeLaAgenda) => void;
}

function textoCorto(evento: EventoDeLaAgenda): string {
  return evento.clase === 'propia'
    ? evento.texto
    : `${DERIVADA[evento.categoria].corta}: ${evento.titulo}`;
}

export function GrillaDelMes({
  mes,
  hoy,
  elegido,
  eventos,
  maximo,
  alElegirDia,
  alVerElDia = alElegirDia,
  alAbrirEvento,
}: GrillaDelMesProps) {
  const semanas = semanasDelMes(mes);

  return (
    <div
      data-grilla-del-mes
      className="flex flex-col overflow-hidden rounded-panel border border-hairline"
    >
      <div aria-hidden className="grid grid-cols-7 border-b border-hairline bg-surface">
        {DIAS_DE_LA_SEMANA.map((dia) => (
          <div key={dia} className="px-2.5 py-2 text-meta font-semibold text-text-2">
            {dia}
          </div>
        ))}
      </div>
      <div
        className="grid grid-cols-7 gap-px bg-hairline"
        style={{
          gridTemplateRows: `repeat(${String(semanas.length)}, minmax(var(--celda-min), auto))`,
        }}
      >
        {semanas.flat().map(({ fecha, fuera }) => {
          const delDia = eventosDelDia(eventos, fecha);
          const esHoy = fecha === hoy;
          const esElegido = fecha === elegido;
          const sobran = Math.max(0, delDia.length - maximo);
          const marcado = hayImportante(delDia);
          const numero = esHoy
            ? 'bg-ink text-paper'
            : fuera
              ? 'text-text-3'
              : 'text-ink hover:bg-surface';

          return (
            <div
              key={fecha}
              data-fecha={fecha}
              className={`flex min-w-0 flex-col gap-1 overflow-hidden px-1.5 pt-1.5 pb-2 ${
                fuera || esElegido ? 'bg-surface' : 'bg-paper'
              }`}
            >
              <button
                type="button"
                aria-label={`${diaEnPalabras(fecha)}${esHoy ? ', hoy' : ''}: ${
                  delDia.length === 0
                    ? 'nada agendado'
                    : `${String(delDia.length)} ${delDia.length === 1 ? 'cosa' : 'cosas'}`
                }${marcado ? ', con algo marcado' : ''}`}
                aria-pressed={esElegido}
                onClick={() => {
                  alElegirDia(fecha);
                }}
                className={`-ml-0.5 flex min-h-[26px] items-center gap-1.5 self-start rounded-pill py-px pr-2 pl-1 ${numero} ${
                  marcado && !esHoy ? 'ring-[1.5px] ring-ag-marca' : ''
                }`}
              >
                <span aria-hidden className="min-w-5 text-center font-display text-body">
                  {numeroDelDia(fecha)}
                </span>
                {esHoy && (
                  <span aria-hidden className="text-badge font-semibold">
                    hoy
                  </span>
                )}
              </button>
              {delDia.slice(0, maximo).map((evento) => {
                const hecha = evento.clase === 'propia' && evento.hecha;
                return (
                  <button
                    key={evento.id}
                    type="button"
                    title={nombreDelEvento(evento)}
                    onClick={() => {
                      alAbrirEvento(evento);
                    }}
                    className="flex min-h-6 w-full min-w-0 items-center gap-1.5 rounded-[3px] bg-surface px-1.5 py-0.5 text-left hover:bg-surface-2"
                  >
                    <span
                      aria-hidden
                      className={`flex size-[18px] flex-none items-center justify-center rounded-pill ${
                        evento.clase === 'propia' && evento.importante
                          ? 'ring-[1.5px] ring-ag-marca'
                          : ''
                      }`}
                    >
                      <MarcaDeCategoria categoria={evento.categoria} />
                    </span>
                    <span
                      className={`min-w-0 flex-1 truncate text-meta leading-snug ${
                        evento.clase === 'derivada' ? 'font-semibold' : ''
                      } ${hecha ? 'text-text-3 line-through' : 'text-ink'}`}
                    >
                      {textoCorto(evento)}
                    </span>
                  </button>
                );
              })}
              {sobran > 0 && (
                <button
                  type="button"
                  aria-label={`Ver las ${String(delDia.length)} cosas del ${diaEnPalabras(fecha)}`}
                  onClick={() => {
                    alVerElDia(fecha);
                  }}
                  className="flex h-[22px] items-center self-start rounded-[3px] px-1.5 text-meta font-semibold text-text-2 hover:bg-surface-2 hover:text-ink"
                >
                  +{sobran} más
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
