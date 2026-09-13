import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { useSesion } from '@/entities/sesion';
import { FormularioDeNuevaContrasena } from '@/features/recuperar-acceso';
import { errorDelEnlace } from '@/shared/api';
import { useEstadoSync } from '@/shared/lib';
import { Button, ENLACE_DE_ACCESO, PantallaDeAcceso } from '@/shared/ui';

export function NuevaContrasenaPage() {
  const sesion = useSesion();
  const estadoSync = useEstadoSync();
  const navegar = useNavigate();
  const [listo, setListo] = useState(false);
  const [delEnlace] = useState(() => errorDelEnlace(window.location.href));

  if (listo) {
    return (
      <PantallaDeAcceso
        titulo="Listo, ya entraste"
        bajada="Guardamos la contraseña nueva. Si entrás desde otro dispositivo, usá esta."
      >
        <Button
          size="grande"
          className="w-full"
          onClick={() => {
            void navegar('/', { replace: true });
          }}
        >
          Ir al taller
        </Button>
      </PantallaDeAcceso>
    );
  }

  if (sesion.tipo === 'cargando') {
    return (
      <PantallaDeAcceso titulo="Un segundo" bajada="Estamos validando el enlace del correo.">
        <p role="status" aria-busy="true" className="text-body text-text-2">
          Verificando el enlace…
        </p>
      </PantallaDeAcceso>
    );
  }

  if (sesion.tipo === 'anonimo') {
    const sinConexion = estadoSync.tipo === 'sin-conexion';
    return (
      <PantallaDeAcceso
        titulo={sinConexion ? 'Sin señal' : 'Este enlace no sirve'}
        bajada={
          sinConexion
            ? 'El enlace se valida contra el servidor y ahora no hay señal.'
            : (delEnlace ??
              'Los enlaces del correo se abren en el mismo navegador desde el que los pediste, y vencen.')
        }
        pie={
          <Link to="/acceso/recuperar" className={ENLACE_DE_ACCESO}>
            Pedir otro enlace
          </Link>
        }
      >
        <p className="text-body leading-relaxed text-text-2">
          {sinConexion
            ? 'Buscá señal y volvé a abrir el enlace del correo. Si ya no funciona, pedí uno nuevo: el servidor manda pocos mails por hora.'
            : 'Pedí uno nuevo desde este dispositivo y abrilo sin copiarlo a otro navegador.'}
        </p>
      </PantallaDeAcceso>
    );
  }

  if (!sesion.porRecuperacion) {
    return (
      <PantallaDeAcceso
        titulo="Esta pantalla se abre desde el correo"
        bajada="Para cambiar la contraseña hay que pedir el enlace y abrirlo desde el mail."
        pie={
          <Link to="/" className={ENLACE_DE_ACCESO}>
            Volver al taller
          </Link>
        }
      >
        <p className="text-body leading-relaxed text-text-2">
          Así nadie que agarre el dispositivo desbloqueado puede cambiarla.
        </p>
      </PantallaDeAcceso>
    );
  }

  return (
    <PantallaDeAcceso
      titulo="Poné una contraseña nueva"
      bajada={
        <>
          Es para <strong className="font-medium text-ink">{sesion.email}</strong>.
        </>
      }
    >
      <FormularioDeNuevaContrasena
        alCambiar={() => {
          setListo(true);
        }}
      />
    </PantallaDeAcceso>
  );
}
