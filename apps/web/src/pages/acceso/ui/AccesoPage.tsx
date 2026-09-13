import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';

import { FormularioDeIngreso } from '@/features/iniciar-sesion';
import { errorDelEnlace } from '@/shared/api';
import { ENLACE_DE_ACCESO, ENLACE_DE_CAMPO, PantallaDeAcceso } from '@/shared/ui';

export function AccesoPage() {
  const navegar = useNavigate();
  const { pathname } = useLocation();
  const [delEnlace] = useState(() => errorDelEnlace(window.location.href));

  useEffect(() => {
    if (delEnlace !== undefined) void navegar(pathname, { replace: true });
  }, [delEnlace, navegar, pathname]);

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
      {delEnlace !== undefined && (
        <div
          role="alert"
          className="flex flex-col gap-1 rounded-field bg-alerta-tint px-3.5 py-3 text-label leading-relaxed text-alerta"
        >
          <p className="font-medium">{delEnlace}</p>
          <p>Si ya habías confirmado la cuenta, entrá con tu mail y tu contraseña.</p>
        </div>
      )}
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
