import { fechaLarga } from '@/shared/lib';
import { Icono } from '@/shared/ui';

import {
  CLASE_DE_ENTREGA,
  fechaConSuFranja,
  type EntregaDelResumen,
  type Urgencia,
} from '../model/entrega';

export interface EntregaRelativaProps {
  entrega: EntregaDelResumen;
  urgencia: Urgencia | undefined;
  hoy: string;
  conFecha?: boolean;
}

function Comprometida() {
  return <span className="text-meta font-medium text-text-2">comprometida</span>;
}

export function EntregaRelativa({
  entrega,
  urgencia,
  hoy,
  conFecha = false,
}: EntregaRelativaProps) {
  const { fecha } = entrega;
  if (fecha === null) {
    return <span className="text-meta text-text-3">Sin fecha</span>;
  }

  if (urgencia === undefined) {
    return (
      <span className="inline-flex items-center gap-1.5 text-text-2">
        <Icono nombre="calendar-check" tamano={14} />
        {fechaLarga(fecha, hoy)}
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col">
      <span className={`inline-flex items-center gap-1.5 ${CLASE_DE_ENTREGA[urgencia.tono]}`}>
        <Icono nombre={entrega.comprometida ? 'truck' : urgencia.icono} tamano={14} />
        {urgencia.texto}
        {entrega.comprometida && !conFecha && <Comprometida />}
      </span>
      {conFecha && (
        <span className="text-meta text-text-3">
          {entrega.comprometida
            ? `${fechaConSuFranja(fecha, entrega.franja, hoy)} · comprometida`
            : fechaLarga(fecha, hoy)}
        </span>
      )}
    </span>
  );
}
