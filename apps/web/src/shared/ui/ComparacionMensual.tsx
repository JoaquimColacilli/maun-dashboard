import { useId, useState } from 'react';

import { Icono } from '@maun/ui';

import { formatearPesos } from '@/shared/lib';

export interface BarraComparada {
  id: string;
  etiqueta: string;
  previo: number;
  actual: number;
  tono: string;
  mejorSiBaja?: boolean;
}

export interface ComparacionMensualProps {
  titulo: string;
  etiquetaPrevia: string;
  etiquetaActual: string;
  barras: readonly BarraComparada[];
}

const ALTO_UTIL = 96;
const PISO = 118;
const ANCHO_BARRA = 26;

function variacion(barra: BarraComparada): string {
  if (barra.previo <= 0) return '—';
  const porciento = Math.round(((barra.actual - barra.previo) / barra.previo) * 100);
  return `${porciento >= 0 ? '+' : '−'}${String(Math.abs(porciento))}%`;
}

function tonoDeLaVariacion(barra: BarraComparada): string {
  if (barra.previo <= 0) return 'text-text-3';
  const subio = barra.actual >= barra.previo;
  return (barra.mejorSiBaja === true ? !subio : subio) ? 'text-hogar' : 'text-alerta';
}

export function ComparacionMensual({
  titulo,
  etiquetaPrevia,
  etiquetaActual,
  barras,
}: ComparacionMensualProps) {
  const [conNumeros, setConNumeros] = useState(false);
  const idTabla = useId();

  const techo = Math.max(1, ...barras.flatMap((barra) => [barra.previo, barra.actual]));
  const alto = (valor: number) => Math.max(2, Math.round((valor / techo) * ALTO_UTIL));

  return (
    <section aria-label={titulo} className="rounded-panel bg-surface px-4 pt-3.5 pb-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-label font-semibold">{titulo}</span>
        <span className="flex gap-3 text-meta text-text-2">
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="size-2 rounded-control bg-border" />
            {etiquetaPrevia}
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="size-2 rounded-control bg-ink" />
            {etiquetaActual}
          </span>
        </span>
      </div>

      <svg
        aria-hidden
        focusable="false"
        role="presentation"
        viewBox="0 0 360 152"
        width="100%"
        className="mt-2 block max-w-full overflow-visible"
      >
        <line x1="0" y1={PISO} x2="360" y2={PISO} className="stroke-border" strokeWidth="1" />
        {barras.map((barra, indice) => {
          const centro = 60 + indice * 120;
          const altoPrevio = alto(barra.previo);
          const altoActual = alto(barra.actual);
          return (
            <g key={barra.id} className={barra.tono}>
              <rect
                x={centro - 29}
                y={PISO - altoPrevio}
                width={ANCHO_BARRA}
                height={altoPrevio}
                rx="1"
                className="fill-border"
              />
              <rect
                x={centro + 3}
                y={PISO - altoActual}
                width={ANCHO_BARRA}
                height={altoActual}
                rx="1"
                fill="currentColor"
              />
              <text
                x={centro}
                y={PISO - Math.max(altoPrevio, altoActual) - 6}
                textAnchor="middle"
                className="fill-ink text-meta font-semibold tabular-nums"
              >
                {formatearPesos(barra.actual)}
              </text>
              <text x={centro} y="138" textAnchor="middle" className="fill-text-2 text-badge">
                {barra.etiqueta}
              </text>
            </g>
          );
        })}
      </svg>

      <button
        type="button"
        aria-expanded={conNumeros}
        aria-controls={idTabla}
        onClick={() => {
          setConNumeros((previo) => !previo);
        }}
        className="mt-1 flex min-h-tap items-center gap-1.5 text-meta font-semibold text-ink underline underline-offset-3"
      >
        <Icono nombre={conNumeros ? 'arrow-up' : 'arrow-down'} tamano={14} />
        {conNumeros ? 'Ocultar los números' : 'Ver los números'}
      </button>

      <div id={idTabla} hidden={!conNumeros}>
        <table className="mt-1 w-full border-collapse text-label tabular-nums">
          <caption className="sr-only">{titulo}</caption>
          <thead>
            <tr className="text-meta text-text-2">
              <th scope="col" className="py-1 text-left font-medium">
                Concepto
              </th>
              <th scope="col" className="py-1 text-right font-medium">
                {etiquetaPrevia}
              </th>
              <th scope="col" className="py-1 text-right font-medium">
                {etiquetaActual}
              </th>
              <th scope="col" className="py-1 text-right font-medium">
                Diferencia
              </th>
            </tr>
          </thead>
          <tbody>
            {barras.map((barra) => (
              <tr key={barra.id} className="border-t border-hairline">
                <th scope="row" className="py-1.5 text-left font-medium">
                  {barra.etiqueta}
                </th>
                <td className="py-1.5 text-right text-text-2">{formatearPesos(barra.previo)}</td>
                <td className="py-1.5 text-right font-semibold">{formatearPesos(barra.actual)}</td>
                <td className={`py-1.5 text-right font-semibold ${tonoDeLaVariacion(barra)}`}>
                  {variacion(barra)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
