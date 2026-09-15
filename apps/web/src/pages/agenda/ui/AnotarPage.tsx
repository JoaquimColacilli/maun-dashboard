import { useSearchParams } from 'react-router';

import { fechaDelParametro, HojaDeAnotacion } from '@/features/llevar-la-agenda';
import { hoyLocal, useCerrarHoja } from '@/shared/lib';

export function AnotarPage() {
  const [parametros] = useSearchParams();
  const cerrar = useCerrarHoja();

  return (
    <HojaDeAnotacion
      fechaInicial={fechaDelParametro(parametros.get('fecha'), hoyLocal())}
      alCerrar={cerrar}
    />
  );
}
