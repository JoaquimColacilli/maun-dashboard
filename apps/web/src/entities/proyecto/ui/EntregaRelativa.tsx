import { fechaLarga } from '@/shared/lib';
import { Icono } from '@/shared/ui';

import { CLASE_DE_ENTREGA, type Urgencia } from '../model/entrega';

export interface EntregaRelativaProps {
  entregaEstimada: string | null;
  urgencia: Urgencia | undefined;
  hoy: string;
  conFecha?: boolean;
}

// La urgencia manda y la fecha va abajo, chica: el dueño mira esta columna para decidir qué hace
// hoy, y "en 4 días" se lee de un vistazo, "jue 30 sep" hay que calcularlo.
export function EntregaRelativa({
  entregaEstimada,
  urgencia,
  hoy,
  conFecha = false,
}: EntregaRelativaProps) {
  if (entregaEstimada === null) {
    return <span className="text-meta text-text-3">Sin fecha</span>;
  }

  if (urgencia === undefined) {
    return (
      <span className="inline-flex items-center gap-1.5 text-text-2">
        <Icono nombre="calendar-check" tamano={14} />
        {fechaLarga(entregaEstimada, hoy)}
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col">
      <span className={`inline-flex items-center gap-1.5 ${CLASE_DE_ENTREGA[urgencia.tono]}`}>
        <Icono nombre={urgencia.icono} tamano={14} />
        {urgencia.texto}
      </span>
      {conFecha && (
        <span className="text-meta text-text-3">{fechaLarga(entregaEstimada, hoy)}</span>
      )}
    </span>
  );
}
