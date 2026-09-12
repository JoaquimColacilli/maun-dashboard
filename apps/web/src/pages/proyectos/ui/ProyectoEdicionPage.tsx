import { useParams } from 'react-router';

import { PantallaDeProyecto } from '@/features/editar-proyecto';

export function ProyectoEdicionPage() {
  const { id = '' } = useParams();
  return <PantallaDeProyecto proyectoId={id} />;
}
