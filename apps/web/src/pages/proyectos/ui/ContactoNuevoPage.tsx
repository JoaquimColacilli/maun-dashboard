import { useCallback } from 'react';
import { useNavigate } from 'react-router';

import { RUTA_DE_SEGUIMIENTO, rutaDelProyecto } from '@/entities/proyecto';
import { HojaDeContacto } from '@/features/seguir-contacto';

export function ContactoNuevoPage() {
  const navegar = useNavigate();

  const alCerrar = useCallback(() => {
    void navegar(RUTA_DE_SEGUIMIENTO);
  }, [navegar]);

  const alGuardar = useCallback(
    (id: string) => {
      void navegar(rutaDelProyecto(id));
    },
    [navegar],
  );

  return <HojaDeContacto alCerrar={alCerrar} alGuardar={alGuardar} />;
}
