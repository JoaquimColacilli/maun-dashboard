import { useIsMutating, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { mensajeDeAcceso, salir } from '@/shared/api';
import { limpiarDatosLocales, useEstadoSync } from '@/shared/lib';
import { Button } from '@/shared/ui';

function losCambios(cantidad: number): string {
  return cantidad === 1 ? 'el cambio' : `los ${String(cantidad)} cambios`;
}

export function EntrarConOtraCuenta() {
  const queryClient = useQueryClient();
  const pendientes = useIsMutating();
  const sinSenal = useEstadoSync().tipo === 'sin-conexion';
  const [avisando, setAvisando] = useState(false);
  const [saliendo, setSaliendo] = useState(false);
  const [error, setError] = useState('');

  async function salirDeLaCuenta(): Promise<void> {
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

  const alerta =
    error === '' ? null : (
      <p role="alert" className="text-label leading-relaxed font-medium text-alerta">
        {error}
      </p>
    );

  if (avisando && pendientes > 0) {
    const uno = pendientes === 1;
    return (
      <div className="flex flex-col gap-3">
        <div
          role="alert"
          className="flex flex-col gap-1.5 rounded-field bg-alerta-tint px-3.5 py-3 text-label leading-relaxed text-alerta"
        >
          <p className="font-semibold">
            {uno
              ? 'Hay 1 cambio de este teléfono sin sincronizar.'
              : `Hay ${String(pendientes)} cambios de este teléfono sin sincronizar.`}
          </p>
          <p>
            {uno
              ? 'Si entrás con otra cuenta, se borra de este teléfono y no llega al taller: no hay forma de recuperarlo.'
              : 'Si entrás con otra cuenta, se borran de este teléfono y no llegan al taller: no hay forma de recuperarlos.'}
          </p>
          <p>
            {`Para no ${uno ? 'perderlo' : 'perderlos'}, ${
              sinSenal
                ? `entrá con la huella y esperá a que vuelva la señal para que ${uno ? 'se sincronice' : 'se sincronicen'}.`
                : `entrá con la huella o la contraseña y esperá a que ${uno ? 'se sincronice' : 'se sincronicen'}.`
            }`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="peligro"
            cargando={saliendo}
            onClick={() => {
              void salirDeLaCuenta();
            }}
          >
            {saliendo ? 'Saliendo…' : `Borrar ${losCambios(pendientes)} y salir`}
          </Button>
          <Button
            variant="secundario"
            disabled={saliendo}
            onClick={() => {
              setAvisando(false);
            }}
          >
            No, volver
          </Button>
        </div>
        {alerta}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        variant="terciario"
        className="-ml-3"
        cargando={saliendo}
        onClick={() => {
          if (pendientes > 0) setAvisando(true);
          else void salirDeLaCuenta();
        }}
      >
        Entrar con otra cuenta
      </Button>
      {alerta}
    </div>
  );
}
