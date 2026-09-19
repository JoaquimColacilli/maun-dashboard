import { Navigate, useParams } from 'react-router';

import { resumenDeProyecto, RUTA_DE_PROYECTOS } from '@/entities/proyecto';
import { useReplicaDelTaller } from '@/entities/replica';
import { PantallaDeCompartir } from '@/features/compartir-con-el-cliente';
import { hoyLocal } from '@/shared/lib';

export function ProyectoCompartirPage() {
  const replica = useReplicaDelTaller();
  const { id = '' } = useParams();
  const resumen = resumenDeProyecto(replica, id, hoyLocal());

  if (!resumen) return <Navigate to={RUTA_DE_PROYECTOS} replace />;

  return <PantallaDeCompartir key={id} resumen={resumen} />;
}
