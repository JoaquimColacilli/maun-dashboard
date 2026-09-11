import { Navigate, Outlet } from 'react-router';

import { useReplica } from '@/entities/replica';
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

export function RutaConAcceso() {
  const { usuarioId } = useSesionActiva();
  const replica = useReplica(usuarioId);

  if (replica.data) {
    return tieneAcceso(replica.data) ? <Outlet /> : <Navigate to="/sin-acceso" replace />;
  }

  // Sin nada guardado y sin red la query queda en pausa, no en error: sin este caso, la pantalla
  // se quedaba en el skeleton para siempre, sin mensaje y sin forma de salir.
  if (replica.isPaused || replica.isError) {
    return (
      <ErrorDeCarga
        error={replica.error}
        reintentar={() => {
          void replica.refetch();
        }}
      />
    );
  }

  return <Cargando que="Trayendo los datos del taller" />;
}
