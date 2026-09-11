import { useIsMutating, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { mensajeDeAcceso, salir } from '@/shared/api';
import { limpiarDatosLocales } from '@/shared/lib';
import { Button } from '@/shared/ui';

export function BotonSalir() {
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
      // Se limpia siempre, también cuando salir() falla: ante un error que no sea de permisos,
      // auth-js ya borró la sesión local antes de devolverlo, así que el usuario queda afuera y
      // los datos no pueden quedarse en el disco.
      await limpiarDatosLocales(queryClient);
      setSaliendo(false);
    }
  }

  if (pendientes > 0 && !confirmando) {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-meta text-atencion">
          {pendientes === 1
            ? 'Hay 1 cambio sin sincronizar: si cerrás sesión, se pierde.'
            : `Hay ${String(pendientes)} cambios sin sincronizar: si cerrás sesión, se pierden.`}
        </p>
        <Button
          variant="secundario"
          size="chico"
          onClick={() => {
            setConfirmando(true);
          }}
        >
          Cerrar sesión igual
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        variant="secundario"
        size="chico"
        cargando={saliendo}
        onClick={() => {
          void cerrar();
        }}
      >
        {saliendo ? 'Cerrando…' : 'Cerrar sesión'}
      </Button>
      {error !== '' && (
        <p role="alert" className="text-meta font-medium text-alerta">
          {error}
        </p>
      )}
    </div>
  );
}
