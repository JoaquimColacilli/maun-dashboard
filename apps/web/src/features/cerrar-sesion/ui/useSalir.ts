import { useIsMutating, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { mensajeDeAcceso, salir } from '@/shared/api';
import { limpiarDatosLocales } from '@/shared/lib';

export interface Salida {
  pendientes: number;
  confirmando: boolean;
  saliendo: boolean;
  error: string;
  confirmar: () => void;
  cerrar: () => Promise<void>;
}

export function avisoDePendientes(pendientes: number): string {
  return pendientes === 1
    ? 'Hay 1 cambio sin sincronizar: si cerrás sesión, se pierde.'
    : `Hay ${String(pendientes)} cambios sin sincronizar: si cerrás sesión, se pierden.`;
}

export function useSalir(): Salida {
  const queryClient = useQueryClient();
  const pendientes = useIsMutating();
  const [confirmando, setConfirmando] = useState(false);
  const [saliendo, setSaliendo] = useState(false);
  const [error, setError] = useState('');

  async function cerrar() {
    setSaliendo(true);
    setError('');
    try {
      await salir();
    } catch (fallo) {
      setError(mensajeDeAcceso(fallo));
    } finally {
      await limpiarDatosLocales(queryClient);
      setSaliendo(false);
    }
  }

  return {
    pendientes,
    confirmando,
    saliendo,
    error,
    confirmar: () => {
      setConfirmando(true);
    },
    cerrar,
  };
}
