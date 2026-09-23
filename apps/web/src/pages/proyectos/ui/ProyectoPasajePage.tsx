import { useState } from 'react';
import { Navigate, useParams } from 'react-router';

import {
  opcionesDelProyecto,
  RUTA_DE_CONSULTAS,
  resumenDeProyecto,
  rutaDelProyecto,
} from '@/entities/proyecto';
import { useReplicaDelTaller } from '@/entities/replica';
import { PantallaDePasaje } from '@/features/avanzar-la-consulta';
import { hoyLocal } from '@/shared/lib';

export function ProyectoPasajePage() {
  const replica = useReplicaDelTaller();
  const { id = '' } = useParams();
  const resumen = resumenDeProyecto(replica, id, hoyLocal());
  const [enConsultasAlEntrar] = useState(() => resumen?.fase === 'consultas');

  if (!resumen) return <Navigate to={RUTA_DE_CONSULTAS} replace />;
  if (!enConsultasAlEntrar) return <Navigate to={rutaDelProyecto(id)} replace />;

  return <PantallaDePasaje resumen={resumen} opciones={opcionesDelProyecto(replica, id)} />;
}
