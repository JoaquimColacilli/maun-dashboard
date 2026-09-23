import { useState } from 'react';
import { Navigate, useParams } from 'react-router';

import {
  opcionesDelProyecto,
  RUTA_DE_SEGUIMIENTO,
  resumenDeProyecto,
  rutaDelProyecto,
} from '@/entities/proyecto';
import { useReplicaDelTaller } from '@/entities/replica';
import { PantallaDePasaje } from '@/features/seguir-contacto';
import { hoyLocal } from '@/shared/lib';

export function ProyectoPasajePage() {
  const replica = useReplicaDelTaller();
  const { id = '' } = useParams();
  const resumen = resumenDeProyecto(replica, id, hoyLocal());
  const [enSeguimientoAlEntrar] = useState(() => resumen?.fase === 'consultas');

  if (!resumen) return <Navigate to={RUTA_DE_SEGUIMIENTO} replace />;
  if (!enSeguimientoAlEntrar) return <Navigate to={rutaDelProyecto(id)} replace />;

  return <PantallaDePasaje resumen={resumen} opciones={opcionesDelProyecto(replica, id)} />;
}
