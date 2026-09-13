import { useCallback } from 'react';
import { useNavigate } from 'react-router';

import { rutaDelProyecto } from '@/entities/proyecto';
import { HojaDeContacto } from '@/features/seguir-contacto';
import { useCerrarHoja } from '@/shared/lib';

export function ContactoNuevoPage() {
  const navegar = useNavigate();
  const cerrar = useCerrarHoja();

  const alGuardar = useCallback(
    (id: string) => {
      void navegar(rutaDelProyecto(id), { replace: true });
    },
    [navegar],
  );

  return <HojaDeContacto alCerrar={cerrar} alGuardar={alGuardar} />;
}
