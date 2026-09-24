import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';

import { useSesion } from '@/entities/sesion';
import { FormularioDeIngreso } from '@/features/iniciar-sesion';
import { errorDelEnlace } from '@/shared/api';
import { Ir, useIr } from '@/shared/lib';
import { ENLACE_DE_ACCESO, ENLACE_DE_CAMPO, PantallaDeAcceso } from '@/shared/ui';

export function AccesoPage() {
  const sesion = useSesion();
  const vencida = sesion.tipo === 'anonimo' && sesion.vencida;
  const ir = useIr();
  const { pathname } = useLocation();
  const [delEnlace] = useState(() => errorDelEnlace(window.location.href));

  useEffect(() => {
    if (delEnlace !== undefined) ir(pathname, { como: 'reemplazar' });
  }, [delEnlace, ir, pathname]);

  return (
    <PantallaDeAcceso
      titulo="Entrá al taller"
      nota="Una vez adentro, la app anda aunque no haya señal."
      pie={
        <p>
          ¿No tenés cuenta?{' '}
          <Ir a="/acceso/crear-cuenta" className={ENLACE_DE_ACCESO}>
            Creá una
          </Ir>
        </p>
      }
    >
      {vencida && (
        <div
          role="alert"
          className="flex flex-col gap-1 rounded-field bg-atencion-tint px-3.5 py-3 text-label leading-relaxed text-atencion"
        >
          <p className="font-medium">
            La sesión de este teléfono se cerró: venció o se cerró desde otro lado.
          </p>
          <p>
            Entrá de nuevo con tu mail y tu contraseña. Si usabas la huella, activala otra vez en
            Ajustes.
          </p>
        </div>
      )}
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
          <Ir a="/acceso/recuperar" className={ENLACE_DE_CAMPO}>
            ¿La olvidaste?
          </Ir>
        }
      />
    </PantallaDeAcceso>
  );
}
