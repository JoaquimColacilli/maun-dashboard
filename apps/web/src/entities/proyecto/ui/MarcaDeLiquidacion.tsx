import { useAvisosDelProyecto } from '@/shared/lib';
import { Icono } from '@/shared/ui';

import { useLiquidacionEnVuelo } from '../api/liquidacion';
import { marcaDeLiquidacion } from '../model/marca';

export interface MarcaDeLiquidacionProps {
  proyectoId: string;
}

export function MarcaDeLiquidacion({ proyectoId }: MarcaDeLiquidacionProps) {
  const enVuelo = useLiquidacionEnVuelo(proyectoId);
  const avisos = useAvisosDelProyecto(proyectoId);
  const marca = marcaDeLiquidacion(
    enVuelo,
    avisos.some((aviso) => aviso.tipo === 'rechazo'),
  );
  if (!marca) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 text-meta font-medium whitespace-nowrap ${marca.tono}`}
    >
      <Icono nombre={marca.icono} tamano={14} />
      {marca.texto}
    </span>
  );
}
