import { Link } from 'react-router';

import { filaPorId, type Replica } from '@/shared/api';
import { Icono } from '@/shared/ui';

import { useLiquidacionesEnVuelo } from '../api/liquidacion';
import { rutaDelProyecto } from '../model/rutas';

export interface LiquidacionesSinConfirmarProps {
  replica: Replica;
}

export function LiquidacionesSinConfirmar({ replica }: LiquidacionesSinConfirmarProps) {
  const enVuelo = useLiquidacionesEnVuelo();
  if (enVuelo.length === 0) return null;

  const proyectos = enVuelo.map((pendiente) => ({
    id: pendiente.proyectoId,
    titulo: filaPorId(replica, 'proyectos', pendiente.proyectoId)?.titulo ?? 'Un proyecto',
  }));

  return (
    <p
      role="status"
      className="mt-2.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-field bg-atencion-tint px-3 py-2 text-meta leading-relaxed text-atencion"
    >
      <Icono nombre="cloud-off" tamano={14} />
      <span>
        {proyectos.length === 1
          ? 'Estos saldos cuentan una liquidación que el servidor todavía no confirmó:'
          : `Estos saldos cuentan ${String(proyectos.length)} liquidaciones que el servidor todavía no confirmó:`}
      </span>
      {proyectos.map((proyecto, indice) => (
        <span key={proyecto.id}>
          <Link
            to={rutaDelProyecto(proyecto.id)}
            className="font-semibold underline underline-offset-2"
          >
            {proyecto.titulo}
          </Link>
          {indice < proyectos.length - 1 ? ',' : ''}
        </span>
      ))}
    </p>
  );
}
