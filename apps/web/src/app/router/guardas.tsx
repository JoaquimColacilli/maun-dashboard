import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router';

import { ProveedorDeReplica, useCambiosEnVivo, useReplica } from '@/entities/replica';
import { ProveedorDeSesion, useSesion, useSesionActiva } from '@/entities/sesion';
import { EntrarConOtraCuenta } from '@/features/cerrar-sesion';
import { BloqueoAlVolver, PantallaDeBloqueo } from '@/features/desbloquear-la-app';
import { householdDe, tieneAcceso } from '@/shared/api';
import { esCelular, useAppBloqueada, useVueltaPorUnAviso, vigilarElBloqueo } from '@/shared/lib';
import { Cargando } from '@/shared/ui';

import { CargaQueTarda, ErrorDeCarga } from '../layout/ErrorDeCarga';

const TOPE_DE_LA_PRIMERA_CARGA_MS = 15_000;

function useTardaMasDe(milisegundos: number): boolean {
  const [tarda, setTarda] = useState(false);
  useEffect(() => {
    const reloj = setTimeout(() => {
      setTarda(true);
    }, milisegundos);
    return () => {
      clearTimeout(reloj);
    };
  }, [milisegundos]);
  return tarda;
}

export function RutaPublica() {
  const sesion = useSesion();

  if (sesion.tipo === 'cargando') return <Cargando que="Abriendo la app" />;
  if (sesion.tipo === 'activa') return <Navigate to="/" replace />;
  return <Outlet />;
}

function ConBloqueo({ usuarioId }: { usuarioId: string }) {
  const bloqueada = useAppBloqueada(usuarioId) && esCelular();
  const [yaSeAbrio, setYaSeAbrio] = useState(!bloqueada);
  if (!bloqueada && !yaSeAbrio) setYaSeAbrio(true);
  useEffect(() => vigilarElBloqueo(), []);
  useVueltaPorUnAviso();

  return (
    <>
      {bloqueada && !yaSeAbrio ? (
        <PantallaDeBloqueo otraCuenta={<EntrarConOtraCuenta />} />
      ) : (
        <Outlet />
      )}
      {bloqueada && yaSeAbrio && <BloqueoAlVolver otraCuenta={<EntrarConOtraCuenta />} />}
    </>
  );
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
      <ConBloqueo usuarioId={sesion.usuarioId} />
    </ProveedorDeSesion>
  );
}

const SIN_TALLER = new Error('Tu cuenta no quedó asociada a ningún taller.');

export function RutaConAcceso() {
  const { usuarioId } = useSesionActiva();
  const replica = useReplica(usuarioId);
  const tarda = useTardaMasDe(TOPE_DE_LA_PRIMERA_CARGA_MS);
  useCambiosEnVivo(usuarioId, replica.data ? (householdDe(replica.data)?.id ?? null) : null);
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

  if (tarda) return <CargaQueTarda que="Trayendo los datos del taller" reintentar={reintentar} />;
  return <Cargando que="Trayendo los datos del taller" />;
}
