import { Link } from 'react-router';

import { FormularioDeRegistro } from '@/features/crear-cuenta';
import { PantallaDeAcceso } from '@/shared/ui';

export function CrearCuentaPage() {
  return (
    <PantallaDeAcceso
      titulo="Crear cuenta"
      bajada="Creá tu cuenta y confirmá el mail. Después, el dueño del taller te da acceso a sus datos."
      pie={
        <Link to="/acceso" className="underline underline-offset-3">
          Ya tengo cuenta
        </Link>
      }
    >
      <FormularioDeRegistro />
    </PantallaDeAcceso>
  );
}
