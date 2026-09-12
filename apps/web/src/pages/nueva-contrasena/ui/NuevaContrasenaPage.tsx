import { useState } from 'react';
import { Link } from 'react-router';

import { useSesion } from '@/entities/sesion';
import { FormularioDeNuevaContrasena } from '@/features/recuperar-acceso';
import { useEstadoSync } from '@/shared/lib';
import { PantallaDeAcceso } from '@/shared/ui';

export function NuevaContrasenaPage() {
  const sesion = useSesion();
  const estadoSync = useEstadoSync();
  const [listo, setListo] = useState(false);

  if (listo) {
    return (
      <PantallaDeAcceso
        titulo="Listo"
        bajada="Guardamos la contraseña nueva. Ya estás adentro con ella."
        pie={
          <Link to="/" className="underline underline-offset-3">
            Ir a la app
          </Link>
        }
      >
        <p className="text-body leading-relaxed text-text-2">
          Si entrás desde otro dispositivo, usá esta contraseña.
        </p>
      </PantallaDeAcceso>
    );
  }

  if (sesion.tipo === 'cargando') {
    return (
      <PantallaDeAcceso titulo="Un segundo" bajada="Estamos validando el enlace del correo.">
        <p aria-busy="true" className="text-body text-text-2">
          Verificando el enlace…
        </p>
      </PantallaDeAcceso>
    );
  }

  if (sesion.tipo === 'anonimo') {
    const sinConexion = estadoSync.tipo === 'sin-conexion';
    return (
      <PantallaDeAcceso
        titulo={sinConexion ? 'Sin conexión' : 'El enlace no sirve acá'}
        bajada={
          sinConexion
            ? 'El enlace se valida contra el servidor y ahora no hay señal.'
            : 'Los enlaces del correo se abren en el mismo navegador desde el que los pediste, y vencen.'
        }
        pie={
          <Link to="/acceso/recuperar" className="underline underline-offset-3">
            Pedir otro enlace
          </Link>
        }
      >
        <p className="text-body leading-relaxed text-text-2">
          {sinConexion
            ? 'Buscá señal y volvé a abrir el enlace del correo. Si ya no funciona, pedí uno nuevo: tené en cuenta que el servidor manda pocos mails por hora.'
            : 'Pedí uno nuevo desde este dispositivo y abrilo sin copiarlo a otro navegador.'}
        </p>
      </PantallaDeAcceso>
    );
  }

  // Una sesión abierta no alcanza para cambiar la contraseña sin saber la anterior: esta pantalla
  // solo vale cuando la sesión vino del enlace de recuperación.
  if (!sesion.porRecuperacion) {
    return (
      <PantallaDeAcceso
        titulo="Esta pantalla se abre desde el correo"
        bajada="Para cambiar la contraseña hay que pedir el enlace y abrirlo desde el mail."
        pie={
          <>
            <Link to="/acceso/recuperar" className="underline underline-offset-3">
              Pedir el enlace
            </Link>
            <Link to="/" className="underline underline-offset-3">
              Volver a la app
            </Link>
          </>
        }
      >
        <p className="text-body leading-relaxed text-text-2">
          Es la forma de que nadie que agarre el dispositivo desbloqueado pueda cambiarla.
        </p>
      </PantallaDeAcceso>
    );
  }

  return (
    <PantallaDeAcceso
      titulo="Contraseña nueva"
      bajada={`Estás cambiando la contraseña de ${sesion.email}.`}
    >
      <FormularioDeNuevaContrasena
        alCambiar={() => {
          setListo(true);
        }}
      />
    </PantallaDeAcceso>
  );
}
