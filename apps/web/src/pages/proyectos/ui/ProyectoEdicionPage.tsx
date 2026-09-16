import { useLocation, useParams } from 'react-router';

import { PantallaDeProyecto } from '@/features/editar-proyecto';

export function ProyectoEdicionPage() {
  const { id = '' } = useParams();
  const estado: unknown = useLocation().state;
  const conLaPrimeraOpcion =
    typeof estado === 'object' && estado !== null && 'primeraOpcion' in estado;
  return <PantallaDeProyecto proyectoId={id} agregarUnaOpcion={conLaPrimeraOpcion} />;
}
