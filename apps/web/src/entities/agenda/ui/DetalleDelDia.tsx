import type { EventoDeLaAgenda } from '@maun/domain';
import { useId } from 'react';

import type { AccionDelAviso } from '@/shared/lib';
import { Icono } from '@/shared/ui';

import {
  etiquetaDelDia,
  estaHecha,
  mesEnPalabras,
  numeroDelDia,
  resumenDelDia,
  diaEnPalabras,
} from '../model/calendario';
import { CaminosALosTrabajos } from './CaminosALosTrabajos';
import { FilaDeEvento, type AccionesDeLaAgenda } from './FilaDeEvento';
import { useAccionesConFoco } from './useAccionesConFoco';

export interface AvisoDelDia {
  texto: string;
  accion: AccionDelAviso | null;
}

export interface DetalleDelDiaProps {
  fecha: string;
  hoy: string;
  eventos: readonly EventoDeLaAgenda[];
  acciones: AccionesDeLaAgenda;
  alAnotar: () => void;
  alCerrar?: () => void;
  alIrAUnTrabajo?: () => void;
  conEncabezado?: boolean;
  aviso?: AvisoDelDia | null;
  alDescartarElAviso?: () => void;
}

export function DetalleDelDia({
  fecha,
  hoy,
  eventos,
  acciones,
  alAnotar,
  alCerrar,
  alIrAUnTrabajo,
  conEncabezado = true,
  aviso = null,
  alDescartarElAviso,
}: DetalleDelDiaProps) {
  const accionDelAviso = aviso?.accion ?? null;
  const etiqueta = etiquetaDelDia(fecha, hoy);
  const idDeLoHecho = useId();
  const { raiz, acciones: accionesConFoco } = useAccionesConFoco<HTMLDivElement>(acciones);
  const pendientes = eventos.filter((evento) => !estaHecha(evento));
  const hechas = eventos.filter((evento) => estaHecha(evento));

  return (
    <div ref={raiz} className="flex min-h-0 flex-1 flex-col">
      {conEncabezado && (
        <header className="flex flex-none items-start justify-between gap-3 border-b border-hairline px-5 pt-4.5 pb-3.5 md:px-5.5">
          <div className="min-w-0">
            <h2 className="flex flex-wrap items-baseline gap-2">
              <span className="font-display text-h1-lg leading-none">{numeroDelDia(fecha)}</span>
              <span className="text-body font-medium">
                <span className="sr-only">{diaEnPalabras(fecha)}</span>
                <span aria-hidden>{mesEnPalabras(fecha.slice(0, 7), hoy)}</span>
              </span>
              {etiqueta !== null && (
                <span className="rounded-control bg-ink px-1.5 py-0.5 text-badge font-semibold text-paper">
                  {etiqueta}
                </span>
              )}
            </h2>
            <p className="mt-1 text-label text-text-2">{resumenDelDia(eventos)}</p>
          </div>
          {alCerrar !== undefined && (
            <button
              type="button"
              aria-label="Cerrar el día"
              onClick={alCerrar}
              className="flex size-10 flex-none items-center justify-center rounded-field hover:bg-surface"
            >
              <Icono nombre="x" tamano={20} />
            </button>
          )}
        </header>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-5 md:px-5.5">
        {!conEncabezado && <p className="pt-3 text-label text-text-2">{resumenDelDia(eventos)}</p>}
        {eventos.length === 0 ? (
          <div className="flex flex-col gap-2.5 pt-5.5 pb-3">
            <p className="text-body-lg font-semibold">Este día está libre</p>
            <p className="max-w-[340px] text-body leading-relaxed text-text-2">
              No hay entregas ni visitas, y todavía no anotaste nada. Si tenés que comprar algo o
              dejar algo listo, anotalo.
            </p>
            <CaminosALosTrabajos fecha={fecha} alIr={alIrAUnTrabajo} />
          </div>
        ) : (
          <>
            {pendientes.length === 0 ? (
              <p className="pt-4 pb-3 text-body text-text-2">
                No queda nada pendiente para este día.
              </p>
            ) : (
              <ul aria-label={`Lo pendiente del ${diaEnPalabras(fecha)}`}>
                {pendientes.map((evento) => (
                  <FilaDeEvento
                    key={evento.id}
                    evento={evento}
                    hoy={hoy}
                    acciones={accionesConFoco}
                    enElDia
                  />
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
                      acciones={accionesConFoco}
                      enElDia
                    />
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>

      {alDescartarElAviso !== undefined && (
        <div role="status" className="flex-none px-5 md:px-5.5">
          {aviso !== null && (
            <div className="mb-2.5 flex items-center gap-3 rounded-panel bg-ink py-2 pr-2 pl-3.5 text-label text-paper shadow-toast">
              <span className="min-w-0 flex-1 leading-snug">{aviso.texto}</span>
              {accionDelAviso !== null && (
                <button
                  type="button"
                  onClick={() => {
                    alDescartarElAviso();
                    accionDelAviso.alTocar();
                  }}
                  className="h-8 flex-none rounded-field bg-paper/15 px-2.5 font-semibold"
                >
                  {accionDelAviso.etiqueta}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex-none border-t border-hairline px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:px-5.5 md:pb-3">
        <button
          type="button"
          onClick={alAnotar}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-field border border-dashed border-border bg-paper font-medium hover:border-ink hover:bg-surface"
        >
          <Icono nombre="plus" tamano={18} />
          Anotar algo para este día
        </button>
      </div>
    </div>
  );
}
