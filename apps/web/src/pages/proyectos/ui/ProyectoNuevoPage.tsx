import { useSearchParams } from 'react-router';

import { PantallaDeProyecto } from '@/features/editar-proyecto';
import { fechaDelEnlace, PARAMETRO_DE_ENTREGA } from '@/shared/lib';

export function ProyectoNuevoPage() {
  const [busqueda] = useSearchParams();
  return (
    <PantallaDeProyecto
      clienteInicial={busqueda.get('cliente') ?? undefined}
      entregaInicial={fechaDelEnlace(busqueda.get(PARAMETRO_DE_ENTREGA))}
    />
  );
}
