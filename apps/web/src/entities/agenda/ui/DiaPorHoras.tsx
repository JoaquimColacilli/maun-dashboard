import {
  diaPorHoras,
  HORARIO_DEL_TALLER,
  TODO_EL_RELOJ,
  type EventoDeLaAgenda,
} from '@maun/domain';
import { useEffect, useId, useRef, useState } from 'react';

import { Icono } from '@/shared/ui';

import { conLoHechoAlFinal, diaEnPalabras, estaHecha } from '../model/calendario';
import { FilaDeEvento, type AccionesDeLaAgenda } from './FilaDeEvento';

export interface DiaPorHorasProps {
  fecha: string;
  hoy: string;
  eventos: readonly EventoDeLaAgenda[];
  acciones: AccionesDeLaAgenda;
  ahora?: Date;
}

function minutosDeAhora(ahora: Date): number {
  return ahora.getHours() * 60 + ahora.getMinutes();
}

export function DiaPorHoras({ fecha, hoy, eventos, acciones, ahora }: DiaPorHorasProps) {
  const [todoElReloj, setTodoElReloj] = useState(false);
  const idDeLaFranja = useId();
  const idDeLoHecho = useId();
  const grilla = useRef<HTMLDivElement>(null);
  const primeraConAlgo = useRef<HTMLDivElement>(null);

  const dia = diaPorHoras(eventos, todoElReloj ? TODO_EL_RELOJ : HORARIO_DEL_TALLER);
  const pendientes = dia.todoElDia.filter((evento) => !estaHecha(evento));
  const hechas = dia.todoElDia.filter(estaHecha);
  const conAlgo = dia.franjas.find((franja) => franja.eventos.length > 0);
  const quedaAlgoPendiente = eventos.some((evento) => !estaHecha(evento));

  useEffect(() => {
    const destino = primeraConAlgo.current;
    const contenedor = grilla.current;
    if (destino === null || contenedor === null) return;
    const caja = destino.getBoundingClientRect();
    const marco = contenedor.getBoundingClientRect();
    contenedor.scrollTop = Math.max(0, contenedor.scrollTop + caja.top - marco.top - 8);
  }, [fecha]);

  const minutos = fecha === hoy && ahora !== undefined ? minutosDeAhora(ahora) : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <section aria-labelledby={idDeLaFranja} className="flex-none pt-3">
        <p id={idDeLaFranja} className="text-meta font-semibold text-text-3">
          Todo el día
        </p>
        {!quedaAlgoPendiente && (
          <p className="border-t border-hairline-soft py-2.5 text-body text-text-2">
            No queda nada pendiente para este día.
          </p>
        )}
        {pendientes.length > 0 && (
          <ul aria-label={`Lo pendiente del ${diaEnPalabras(fecha)}`}>
            {pendientes.map((evento) => (
              <FilaDeEvento key={evento.id} evento={evento} hoy={hoy} acciones={acciones} enElDia />
            ))}
          </ul>
        )}
        {hechas.length > 0 && (
          <div className="pt-2">
            <p id={idDeLoHecho} className="pb-1.5 text-meta font-semibold text-text-3">
              Hecho
            </p>
            <ul aria-labelledby={idDeLoHecho}>
              {hechas.map((evento) => (
                <FilaDeEvento
                  key={evento.id}
                  evento={evento}
                  hoy={hoy}
                  acciones={acciones}
                  enElDia
                />
              ))}
            </ul>
          </div>
        )}
        {dia.todoElDia.length === 0 && quedaAlgoPendiente && (
          <p className="border-t border-hairline-soft py-2.5 text-label text-text-2">
            Nada sin hora para este día.
          </p>
        )}
      </section>

      <div ref={grilla} className="min-h-0 flex-1 overflow-y-auto pt-3">
        {dia.franjas.map((franja) => {
          const vacia = franja.eventos.length === 0;
          const laDeAhora =
            minutos !== null && minutos >= franja.hora * 60 && minutos < (franja.hora + 1) * 60;
          return (
            <div
              key={franja.hora}
              ref={franja.hora === conAlgo?.hora ? primeraConAlgo : undefined}
              data-hora={franja.desde}
              data-vacia={String(vacia)}
              className="grid grid-cols-[3rem_1fr] items-start gap-2 border-t border-hairline-soft"
            >
              <span
                className={`py-2 text-meta tabular-nums ${
                  laDeAhora ? 'font-semibold text-alerta' : 'text-text-3'
                }`}
              >
                {franja.desde}
              </span>
              {vacia ? (
                <span className="min-h-9" />
              ) : (
                <ul className="min-w-0">
                  {conLoHechoAlFinal(franja.eventos).map((evento) => (
                    <FilaDeEvento
                      key={evento.id}
                      evento={evento}
                      hoy={hoy}
                      acciones={acciones}
                      enElDia
                      sinBorde
                    />
                  ))}
                </ul>
              )}
            </div>
          );
        })}

        <button
          type="button"
          aria-pressed={todoElReloj}
          onClick={() => {
            setTodoElReloj((previo) => !previo);
          }}
          className="mt-2 mb-1 flex min-h-tap w-full items-center justify-center gap-1.5 rounded-field text-label font-medium text-text-2 hover:bg-surface"
        >
          <Icono nombre={todoElReloj ? 'chevron-up' : 'clock'} tamano={14} />
          {todoElReloj ? 'Ver solo el horario del taller' : 'Ver las demás horas'}
        </button>
      </div>
    </div>
  );
}
