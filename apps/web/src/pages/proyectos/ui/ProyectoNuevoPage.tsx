import { useSearchParams } from 'react-router';

import { PantallaDeProyecto } from '@/features/editar-proyecto';

export function ProyectoNuevoPage() {
  const [busqueda] = useSearchParams();
  return <PantallaDeProyecto clienteInicial={busqueda.get('cliente') ?? undefined} />;
}
