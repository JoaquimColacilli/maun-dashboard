import type { Tesoro } from '@maun/domain';

import { formatearPesos, TESORO } from '@/shared/lib';
import { Icono } from '@/shared/ui';

import { efectoDeLaLinea, type LineaDelTaller } from '../model/libro';

function Lados({ desde, hacia }: { desde: Tesoro; hacia: Tesoro }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`font-semibold ${TESORO[desde].texto}`}>{TESORO[desde].nombre}</span>
      <span aria-hidden className="text-text-3">
        →
      </span>
      <span className={`font-semibold ${TESORO[hacia].texto}`}>{TESORO[hacia].nombre}</span>
    </span>
  );
}

export interface FilaDelLibroProps {
  linea: LineaDelTaller;
  tesoro: Tesoro | 'todos';
  sinConfirmar: boolean;
  alAbrir: () => void;
}

export function FilaDelLibro({ linea, tesoro, sinConfirmar, alAbrir }: FilaDelLibroProps) {
  const mueve = linea.sentido === 'mueve';
  const efecto = efectoDeLaLinea(linea, tesoro);
  const neutro = (mueve && efecto === 0) || linea.yaEnLaApertura;
  const datos = TESORO[linea.tesoroPrincipal];

  const importe = neutro
    ? formatearPesos(linea.monto)
    : `${efecto > 0 ? '+' : '−'}${formatearPesos(Math.abs(efecto))}`;

  return (
    <button
      type="button"
      onClick={alAbrir}
      className="flex min-h-[56px] w-full items-center gap-3 border-b border-hairline-soft py-2 text-left hover:bg-surface-3"
    >
      <span
        aria-hidden
        className={`flex size-7 flex-none items-center justify-center rounded-field ${
          mueve ? 'bg-surface text-text-2' : `${datos.fondo} ${datos.texto}`
        }`}
      >
        <Icono nombre={mueve ? 'arrow-left-right' : datos.icono} tamano={15} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-body font-medium">
          {linea.detalle === '' ? linea.etiqueta : linea.detalle}
        </span>
        <span className="flex flex-wrap items-center gap-x-2 text-meta text-text-3">
          {mueve && linea.desde !== null && linea.hacia !== null ? (
            <Lados desde={linea.desde} hacia={linea.hacia} />
          ) : (
            <span>{linea.etiqueta}</span>
          )}
          {linea.categoria !== '' && !mueve && <span>{linea.categoria}</span>}
          {linea.proyectoTitulo !== null && (
            <span className="flex items-center gap-1 rounded-control border border-hairline px-1.5 text-badge text-text-2">
              <Icono nombre="folder-kanban" tamano={10} />
              {linea.proyectoTitulo}
            </span>
          )}
          {linea.yaEnLaApertura && (
            <span className="text-badge font-semibold text-text-2">ya estaba en tus saldos</span>
          )}
          {sinConfirmar && (
            <span className="flex items-center gap-1 text-badge font-semibold text-atencion">
              <Icono nombre="cloud-off" tamano={10} />
              sin confirmar
            </span>
          )}
        </span>
      </span>

      <span
        className={`flex-none text-body font-semibold tabular-nums ${
          neutro ? 'text-text-2' : efecto > 0 ? 'text-ink' : 'text-text-2'
        }`}
      >
        {importe}
      </span>
      <span aria-hidden className="flex-none text-text-3">
        <Icono nombre="chevron-right" tamano={16} />
      </span>
    </button>
  );
}
