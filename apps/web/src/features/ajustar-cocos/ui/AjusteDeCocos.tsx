import { centavos, type Money } from '@maun/domain';
import { useMutation } from '@tanstack/react-query';
import { useState, type SyntheticEvent } from 'react';

import { MUTACION_DE_MOVIMIENTO } from '@/entities/movimiento';
import { mensajeDeSincronizacion } from '@/shared/api';
import { formatearPesos, hoyLocal, useEstadoSync, uuidv7 } from '@/shared/lib';
import { Button, MoneyInput } from '@/shared/ui';

import { ajusteDeCocos } from '../model/ajuste';

export interface AjusteDeCocosProps {
  saldo: Money;
}

export function AjusteDeCocos({ saldo }: AjusteDeCocosProps) {
  const [leido, setLeido] = useState<number | null>(saldo);
  const [error, setError] = useState<string | undefined>(undefined);
  const [hecho, setHecho] = useState<string | undefined>(undefined);

  const mutacion = useMutation(MUTACION_DE_MOVIMIENTO);
  const estadoSync = useEstadoSync();

  const ajuste = leido === null ? null : ajusteDeCocos(saldo, centavos(leido));

  function enviar(evento: SyntheticEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (leido === null) {
      setError('Escribí el saldo que tenés de verdad, por ejemplo 1.250.000.');
      return;
    }
    setError(undefined);
    if (!ajuste) {
      setHecho('El saldo que escribiste es el que la app ya tiene: no hace falta ajustar nada.');
      return;
    }

    mutacion.mutate({
      id: uuidv7(),
      fecha: hoyLocal(),
      tipo: 'ajuste',
      tesoro_origen: ajuste.origen,
      tesoro_destino: ajuste.destino,
      monto_centavos: ajuste.monto,
      categoria: 'Ajuste',
      descripcion: ajuste.concepto,
    });
    setHecho(
      `Se anotó un ajuste de ${ajuste.diferencia > 0 ? '+' : '−'}${formatearPesos(ajuste.monto)}. Cocos queda en ${formatearPesos(centavos(leido))}.`,
    );
  }

  return (
    <form noValidate className="flex flex-col gap-3" onSubmit={enviar}>
      <p className="text-label leading-relaxed text-text-2">
        Cocos es el único saldo que se corrige a mano: sube solo por los intereses y baja cuando
        retirás. Escribí el saldo que ves en la cuenta y la app anota la diferencia.{' '}
        <strong className="font-semibold text-ink">La resta no la hacés vos.</strong>
      </p>

      <dl className="flex items-baseline justify-between gap-4 border-y border-hairline-soft py-2">
        <dt className="text-label text-text-2">Lo que la app tiene calculado</dt>
        <dd className="text-body font-semibold tabular-nums">{formatearPesos(saldo)}</dd>
      </dl>

      <MoneyInput
        etiqueta="El saldo que tenés de verdad"
        value={leido}
        error={error}
        onChange={(centavos) => {
          setLeido(centavos);
          setError(undefined);
          setHecho(undefined);
        }}
      />

      {ajuste !== null && hecho === undefined && (
        <p className="rounded-field bg-cocos-tint px-3.5 py-2.5 text-label leading-relaxed text-ink">
          Se va a anotar un asiento de{' '}
          <strong className="font-semibold">
            {ajuste.diferencia > 0 ? '+' : '−'}
            {formatearPesos(ajuste.monto)}
          </strong>{' '}
          con el concepto «{ajuste.concepto}».
        </p>
      )}

      {hecho !== undefined && (
        <p role="status" className="text-label leading-relaxed text-hogar">
          {hecho}
        </p>
      )}
      {mutacion.isError && (
        <p role="alert" className="text-label font-medium text-alerta">
          {mensajeDeSincronizacion(mutacion.error)}
        </p>
      )}
      {mutacion.isPending && estadoSync.tipo === 'sin-conexion' && (
        <p className="text-label text-atencion">
          Queda en la cola: se sincroniza cuando vuelva la señal.
        </p>
      )}

      <Button type="submit" cargando={mutacion.isPending} className="self-start">
        Ajustar el saldo de Cocos
      </Button>
    </form>
  );
}
