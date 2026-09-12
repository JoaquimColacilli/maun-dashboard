import { puedeCerrarPerdido, puedeCobrar, type EstadoLiquidado } from '@maun/domain';
import { Navigate, useParams } from 'react-router';

import { resumenDeProyecto, rutaDelProyecto } from '@/entities/proyecto';
import { useReplicaDelTaller } from '@/entities/replica';
import { PantallaDeLiquidacion } from '@/features/liquidar-proyecto';
import { hoyLocal } from '@/shared/lib';

export interface ProyectoLiquidacionPageProps {
  destino: EstadoLiquidado;
}

// Un proyecto que no se puede liquidar desde su estado no tiene por qué tener esta pantalla: se
// vuelve a la ficha en vez de ofrecer un botón que la base va a rechazar con MN007.
export function ProyectoLiquidacionPage({ destino }: ProyectoLiquidacionPageProps) {
  const replica = useReplicaDelTaller();
  const { id = '' } = useParams();
  const resumen = resumenDeProyecto(replica, id, hoyLocal());

  if (!resumen) return <Navigate to="/proyectos" replace />;

  const permitido =
    destino === 'cobrado'
      ? puedeCobrar(resumen.proyecto.estado)
      : puedeCerrarPerdido(resumen.proyecto.estado);

  if (!permitido) return <Navigate to={rutaDelProyecto(id)} replace />;

  return <PantallaDeLiquidacion resumen={resumen} destino={destino} />;
}
