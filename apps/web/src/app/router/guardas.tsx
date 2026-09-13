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
    <ProveedorDeSesion
      sesion={{
        usuarioId: sesion.usuarioId,
        email: sesion.email,
        nombre: sesion.nombre,
        foto: sesion.foto,
      }}
    >
      <Outlet />
    </ProveedorDeSesion>
  );
}

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

  if (replica.isPaused || replica.isError) {
    return <ErrorDeCarga error={replica.error} reintentar={reintentar} />;
  }

  return <Cargando que="Trayendo los datos del taller" />;
}
