import { useMutation } from '@tanstack/react-query';
import { useState, type SyntheticEvent } from 'react';

import { formatearCbu, formatearCuit } from '@maun/domain';

import { mensajeDeSincronizacion, type FilaDe } from '@/shared/api';
import { useEstadoSync } from '@/shared/lib';
import { Button, Campo } from '@/shared/ui';

import { MUTACION_DE_AJUSTES } from '../api/mutacion';
import { diferencias } from '../model/cambios';
import {
  avisoDelAlias,
  avisoDelCuitDelTaller,
  cambiosDeCobro,
  cobroDeLosAjustes,
  errorDeCobro,
  etiquetaDeLaClave,
  LARGO_DEL_TITULAR,
  type DatosDeCobro,
  type ErrorDeCobro,
} from '../model/cobro';

export function FormularioDeCobro({ ajustes }: { ajustes: FilaDe<'ajustes'> }) {
  const [datos, setDatos] = useState<DatosDeCobro>(() => cobroDeLosAjustes(ajustes));
  const [error, setError] = useState<ErrorDeCobro | undefined>(undefined);

  const guardar = useMutation(MUTACION_DE_AJUSTES);
  const estadoSync = useEstadoSync();

  const guardando = guardar.isPending;
  const guardado =
    !guardando && !guardar.isError && guardar.isSuccess && estadoSync.tipo === 'sincronizado';

  const cambiar = (campo: keyof DatosDeCobro, valor: string) => {
    setDatos((previos) => ({ ...previos, [campo]: valor }));
  };

  function enviar(evento: SyntheticEvent<HTMLFormElement>) {
    evento.preventDefault();

    const problema = errorDeCobro(datos);
    if (problema) {
      setError(problema);
      return;
    }
    setError(undefined);

    const { cambios, previos } = diferencias(ajustes, cambiosDeCobro(datos));
    if (Object.keys(cambios).length === 0) return;
    guardar.mutate({ id: ajustes.id, cambios, previos });
  }

  return (
    <form noValidate className="flex flex-col gap-3" onSubmit={enviar}>
      <Campo
        etiqueta="Alias"
        inputMode="text"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        ayuda="El que tu cliente escribe en su banco o en su billetera."
        value={datos.alias}
        error={error?.campo === 'alias' ? error.mensaje : undefined}
        onChange={(evento) => {
          cambiar('alias', evento.target.value);
        }}
      />
      {error?.campo !== 'alias' && avisoDelAlias(datos.alias) !== undefined && (
        <p className="-mt-1.5 text-label leading-normal text-atencion">
          {avisoDelAlias(datos.alias)}
        </p>
      )}
      <Campo
        etiqueta={etiquetaDeLaClave(datos.cbu)}
        inputMode="numeric"
        ayuda="Los 22 dígitos. Se muestran de a cuatro para leerlos; el cliente lo copia de una."
        value={datos.cbu}
        error={error?.campo === 'cbu' ? error.mensaje : undefined}
        onChange={(evento) => {
          cambiar('cbu', formatearCbu(evento.target.value));
        }}
      />
      <Campo
        etiqueta="Titular de la cuenta"
        maxLength={LARGO_DEL_TITULAR}
        ayuda="A nombre de quién está. Es lo que el cliente ve en su banco antes de confirmar."
        value={datos.titular}
        error={error?.campo === 'titular' ? error.mensaje : undefined}
        onChange={(evento) => {
          cambiar('titular', evento.target.value);
        }}
      />
      <Campo
        etiqueta="CUIT del titular"
        inputMode="numeric"
        ayuda={
          error?.campo === 'cuit' ? undefined : (avisoDelCuitDelTaller(datos.cuit) ?? 'Opcional.')
        }
        value={datos.cuit}
        error={error?.campo === 'cuit' ? error.mensaje : undefined}
        onChange={(evento) => {
          cambiar('cuit', formatearCuit(evento.target.value));
        }}
      />

      {guardar.isError && (
        <p role="alert" className="text-label font-medium text-alerta">
          {mensajeDeSincronizacion(guardar.error)}
        </p>
      )}
      {guardando && estadoSync.tipo === 'sin-conexion' && (
        <p className="text-label text-atencion">
          Quedó en la cola: se guarda cuando vuelva la señal.
        </p>
      )}
      {guardado && <p className="text-label text-hogar">Guardado.</p>}

      <Button type="submit" cargando={guardando} className="mt-1 self-start">
        Guardar los datos
      </Button>
    </form>
  );
}
