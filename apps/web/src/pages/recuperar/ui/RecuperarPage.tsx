import { Link } from 'react-router';

import { FormularioDePedido } from '@/features/recuperar-acceso';
import { PantallaDeAcceso } from '@/shared/ui';

export function RecuperarPage() {
  return (
    <PantallaDeAcceso
      titulo="Recuperar el acceso"
      bajada="Te mandamos un enlace para poner una contraseña nueva. Abrilo desde este mismo dispositivo."
      pie={
        <Link to="/acceso" className="underline underline-offset-3">
          Volver a entrar
        </Link>
      }
    >
      <FormularioDePedido />
    </PantallaDeAcceso>
  );
}
