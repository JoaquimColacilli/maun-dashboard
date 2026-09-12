import { Link } from 'react-router';

import { FormularioDeIngreso } from '@/features/iniciar-sesion';
import { PantallaDeAcceso } from '@/shared/ui';

export function AccesoPage() {
  return (
    <PantallaDeAcceso
      titulo="MAUN"
      bajada="La gestión del taller. Entrá con tu mail y tu contraseña: una vez adentro, la app anda aunque no haya señal."
      pie={
        <>
          <Link to="/acceso/recuperar" className="underline underline-offset-3">
            Me olvidé la contraseña
          </Link>
          <Link to="/acceso/crear-cuenta" className="underline underline-offset-3">
            Todavía no tengo cuenta
          </Link>
        </>
      }
    >
      <FormularioDeIngreso />
    </PantallaDeAcceso>
  );
}
