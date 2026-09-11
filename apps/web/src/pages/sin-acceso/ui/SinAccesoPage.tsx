import { Navigate } from 'react-router';

import { useReplica } from '@/entities/replica';
import { useSesionActiva } from '@/entities/sesion';
import { BotonSalir } from '@/features/cerrar-sesion';
import { mensajeDeSincronizacion, tieneAcceso } from '@/shared/api';
import { Aviso, Button, Cargando, PantallaDeAcceso } from '@/shared/ui';

export function SinAccesoPage() {
  const { email, usuarioId } = useSesionActiva();
  const replica = useReplica(usuarioId);

  if (replica.data && tieneAcceso(replica.data)) return <Navigate to="/" replace />;

  // Mientras no tengamos la réplica no se sabe si la cuenta tiene taller: decirle que no lo tiene
  // sería inventar. Esta pantalla es donde el usuario espera, así que acá se recarga seguido.
  if (!replica.data) {
    if (replica.isPaused || replica.isError) {
      return (
        <Aviso
          titulo="No pudimos fijarnos"
          mensaje={mensajeDeSincronizacion(replica.error)}
          detalle="No sabemos todavía si te dieron acceso a un taller."
        >
          <Button
            onClick={() => {
              void replica.refetch();
            }}
          >
            Reintentar
          </Button>
          <BotonSalir />
        </Aviso>
      );
    }
    return <Cargando que="Fijándonos si ya te dieron acceso" />;
  }

  return (
    <PantallaDeAcceso
      titulo="Todavía sin acceso"
      bajada={`Tu cuenta (${email}) está creada, pero nadie la sumó a un taller todavía.`}
      pie={<BotonSalir />}
    >
      <div className="flex flex-col gap-3">
        <p className="text-body leading-relaxed text-text-2">
          Los talleres no se crean solos: te tiene que dar acceso quien administra los datos. Cuando
          lo haga, tocá el botón y entrás.
        </p>
        <Button
          variant="secundario"
          cargando={replica.isFetching}
          onClick={() => {
            void replica.refetch();
          }}
        >
          Ya me dieron acceso
        </Button>
      </div>
    </PantallaDeAcceso>
  );
}
