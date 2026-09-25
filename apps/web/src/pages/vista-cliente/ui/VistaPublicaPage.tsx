import { useParams } from 'react-router';

import {
  PantallaDeLaVista,
  useMandarLaEntrega,
  useVistaCompartida,
} from '@/entities/vista-cliente';

export const TITULO_MUERTO = 'Este enlace ya no funciona';

export const TEXTO_MUERTO =
  'Los enlaces que comparte el taller se dan de baja cuando hace falta. Pedile uno nuevo a quien te lo pasó y vas a poder ver todo de nuevo.';

export function VistaPublicaPage() {
  const { token = '' } = useParams();
  const resultado = useVistaCompartida(token);
  const mandar = useMandarLaEntrega(token);

  return (
    <main className="min-h-dvh bg-mesa pb-10">
      <PantallaDeLaVista
        resultado={resultado}
        tituloMuerto={TITULO_MUERTO}
        textoMuerto={TEXTO_MUERTO}
        alMandar={mandar}
      />
    </main>
  );
}
