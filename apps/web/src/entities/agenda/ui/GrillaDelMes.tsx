import type { EventoDeLaAgenda } from '@maun/domain';
import { useId } from 'react';

import {
  DIAS_DE_LA_SEMANA,
  conLoHechoAlFinal,
  cuentaDelDia,
  diaEnPalabras,
  estaHecha,
  eventosDelDia,
  hayImportante,
  nombreDelEvento,
  numeroDelDia,
  semanasDelMes,
  textoDeLoHecho,
} from '../model/calendario';
import { DERIVADA } from '../model/categorias';
import { MarcaDeCategoria } from './MarcaDeCategoria';
import type { AccionesDelArrastre } from './useArrastreDeEventos';

export interface GrillaDelMesProps {
  mes: string;
  hoy: string;
  elegido: string | null;
  eventos: readonly EventoDeLaAgenda[];
  maximo: number;
  alElegirDia: (fecha: string) => void;
  alVerElDia?: (fecha: string) => void;
  alAbrirEvento: (evento: EventoDeLaAgenda) => void;
  idDeLaCapa?: string;
  arrastre?: AccionesDelArrastre;
}

function textoCorto(evento: EventoDeLaAgenda): string {
  return evento.clase === 'propia'
    ? evento.texto
    : `${DERIVADA[evento.categoria].corta}${DERIVADA[evento.categoria].conector}${evento.titulo}`;
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
  idDeLaCapa,
  arrastre,
}: GrillaDelMesProps) {
  const semanas = semanasDelMes(mes);
  const idDeLaAyuda = useId();
  const agarrado = arrastre?.arrastre ?? null;
  const abreLaCapa =
    idDeLaCapa === undefined
      ? {}
      : { popoverTarget: idDeLaCapa, popoverTargetAction: 'show' as const };

  return (
    <div
      data-grilla-del-mes
      className="flex flex-col overflow-hidden rounded-panel border border-hairline bg-paper"
    >
      {arrastre !== undefined && (
        <p id={idDeLaAyuda} className="sr-only">
          Se mueve a otro día arrastrándolo, o agarrándolo con la barra espaciadora, moviéndolo con
          las flechas y soltándolo con Enter. Escape lo deja donde estaba. También se cambia la
          fecha abriéndolo.
        </p>
      )}
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
          const delDia = conLoHechoAlFinal(eventosDelDia(eventos, fecha));
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
              data-abierto={esElegido ? '' : undefined}
              data-destino={agarrado?.destino === fecha ? '' : undefined}
              className={`flex min-w-0 flex-col gap-1 overflow-hidden px-1.5 pt-1.5 pb-2 ${
                fuera || esElegido ? 'bg-surface' : 'bg-paper'
              } ${agarrado?.destino === fecha ? 'inset-ring-2 inset-ring-ink bg-surface-2' : ''}`}
            >
              <button
                type="button"
                aria-label={`${diaEnPalabras(fecha)}${esHoy ? ', hoy' : ''}: ${cuentaDelDia(delDia)}${
                  marcado ? ', con algo marcado' : ''
                }`}
                aria-pressed={esElegido}
                {...abreLaCapa}
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
                const hecha = estaHecha(evento);
                const propiasDelArrastre = arrastre?.propsDelChip(evento);
                const seEstaMoviendo = agarrado?.evento.id === evento.id;
                return (
                  <button
                    key={evento.id}
                    type="button"
                    data-evento={evento.id}
                    title={nombreDelEvento(evento)}
                    aria-describedby={propiasDelArrastre === undefined ? undefined : idDeLaAyuda}
                    {...(evento.clase === 'propia' ? abreLaCapa : {})}
                    {...propiasDelArrastre}
                    onClick={(toque) => {
                      if (arrastre?.seAcabaDeArrastrar() === true) {
                        toque.preventDefault();
                        return;
                      }
                      alAbrirEvento(evento);
                    }}
                    className={`flex w-full min-w-0 items-center gap-1.5 rounded-[3px] bg-surface px-1.5 text-left hover:bg-surface-2 ${
                      hecha ? 'min-h-5 py-0' : 'min-h-6 py-0.5'
                    } ${propiasDelArrastre === undefined ? '' : 'touch-none'} ${
                      seEstaMoviendo ? 'opacity-60 ring-2 ring-ink' : ''
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`flex size-[18px] flex-none items-center justify-center rounded-pill ${
                        evento.importante ? 'ring-[1.5px] ring-ag-marca' : ''
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
                    {hecha && <span className="sr-only">, {textoDeLoHecho(evento)}</span>}
                  </button>
                );
              })}
              {sobran > 0 && (
                <button
                  type="button"
                  aria-label={`Ver las ${String(delDia.length)} cosas del ${diaEnPalabras(fecha)}`}
                  {...abreLaCapa}
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
