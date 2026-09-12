import { Navigate, Outlet } from 'react-router';

import { ProveedorDeReplica, useReplica } from '@/entities/replica';
import { ProveedorDeSesion, useSesion, useSesionActiva } from '@/entities/sesion';
import { tieneAcceso } from '@/shared/api';
import { Cargando } from '@/shared/ui';

import { ErrorDeCarga } from '../layout/ErrorDeCarga';

export function RutaPublica() {
  const sesion = useSesion();

  if (sesion.tipo === 'cargando') return <Cargando que="Abriendo la app" />;
  if (sesion.tipo === 'activa') return <Navigate to="/" replace />;
  return <Outlet />;
}

export function RutaConSesion() {
  const sesion = useSesion();

  if (sesion.tipo === 'cargando') return <Cargando que="Abriendo la app" />;
  if (sesion.tipo === 'anonimo') return <Navigate to="/acceso" replace />;

  return (
    <ProveedorDeSesion sesion={{ usuarioId: sesion.usuarioId, email: sesion.email }}>
      <Outlet />
    </ProveedorDeSesion>
  );
}

// El taller se crea junto con la cuenta y en la misma transacción (ADR 0012), así que una sesión
// sin taller es un alta que quedó a medias: no es un estado que la app tenga que explicar con una
// pantalla propia, sino un error como cualquier otro.
const SIN_TALLER = new Error('Tu cuenta no quedó asociada a ningún taller.');

export function RutaConAcceso() {
  const { usuarioId } = useSesionActiva();
  const replica = useReplica(usuarioId);
  const reintentar = () => {
    void replica.refetch();
  };

  if (replica.data) {
    if (tieneAcceso(replica.data)) {
      return (
        <ProveedorDeReplica replica={replica.data}>
          <Outlet />
        </ProveedorDeReplica>
      );
    }
    return (
      <ErrorDeCarga
        error={SIN_TALLER}
        detalle="El taller se crea solo al confirmar la cuenta, así que esto no debería pasar. Probá de nuevo; si sigue igual, cerrá sesión y volvé a entrar."
        reintentar={reintentar}
      />
    );
  }

  // Sin nada guardado y sin red la query queda en pausa, no en error: sin este caso, la pantalla
  // se quedaba en el skeleton para siempre, sin mensaje y sin forma de salir.
  if (replica.isPaused || replica.isError) {
    return <ErrorDeCarga error={replica.error} reintentar={reintentar} />;
  }

  return <Cargando que="Trayendo los datos del taller" />;
}
