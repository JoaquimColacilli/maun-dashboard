import { useCallback } from 'react';
import { useSearchParams } from 'react-router';

import { rutaDelProyecto } from '@/entities/proyecto';
import { HojaDeContacto } from '@/features/avanzar-la-consulta';
import { fechaDelEnlace, PARAMETRO_DE_VISITA, useCerrarHoja, useIr } from '@/shared/lib';

export function ContactoNuevoPage() {
  const ir = useIr();
  const cerrar = useCerrarHoja();
  const [parametros] = useSearchParams();

  const alGuardar = useCallback(
    (id: string) => {
      ir(rutaDelProyecto(id), { como: 'reemplazar' });
    },
    [ir],
  );

  return (
    <HojaDeContacto
      visitaInicial={fechaDelEnlace(parametros.get(PARAMETRO_DE_VISITA))}
      alCerrar={cerrar}
      alGuardar={alGuardar}
    />
  );
}
