import { useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { rutaDelProyecto } from '@/entities/proyecto';
import { HojaDeContacto } from '@/features/avanzar-la-consulta';
import { fechaDelEnlace, PARAMETRO_DE_VISITA, useCerrarHoja } from '@/shared/lib';

export function ContactoNuevoPage() {
  const navegar = useNavigate();
  const cerrar = useCerrarHoja();
  const [parametros] = useSearchParams();

  const alGuardar = useCallback(
    (id: string) => {
      void navegar(rutaDelProyecto(id), { replace: true });
    },
    [navegar],
  );

  return (
    <HojaDeContacto
      visitaInicial={fechaDelEnlace(parametros.get(PARAMETRO_DE_VISITA))}
      alCerrar={cerrar}
      alGuardar={alGuardar}
    />
  );
}
