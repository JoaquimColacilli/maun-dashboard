import { Link } from 'react-router';

import { FormularioDeIngreso } from '@/features/iniciar-sesion';
import { ENLACE_DE_ACCESO, ENLACE_DE_CAMPO, PantallaDeAcceso } from '@/shared/ui';

export function AccesoPage() {
  return (
    <PantallaDeAcceso
      titulo="Entrá al taller"
      nota="Una vez adentro, la app anda aunque no haya señal."
      pie={
        <p>
          ¿No tenés cuenta?{' '}
          <Link to="/acceso/crear-cuenta" className={ENLACE_DE_ACCESO}>
            Creá una
          </Link>
        </p>
      }
    >
      <FormularioDeIngreso
        olvido={
          <Link to="/acceso/recuperar" className={ENLACE_DE_CAMPO}>
            ¿La olvidaste?
          </Link>
        }
      />
    </PantallaDeAcceso>
  );
}
