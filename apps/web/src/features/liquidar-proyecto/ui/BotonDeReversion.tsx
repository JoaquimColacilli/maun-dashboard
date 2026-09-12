import { ESTADOS_DE_SEGUIMIENTO, type EstadoProyecto } from '@maun/domain';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

import {
  ESTADO,
  filaRevertida,
  MUTACION_DE_REVERSION,
  pedidoDeReversion,
  type Proyecto,
} from '@/entities/proyecto';
import { mensajeDeSincronizacion } from '@/shared/api';
import { fechaLarga, formatearPesos, hoyLocal } from '@/shared/lib';
import { Button, Icono } from '@/shared/ui';

const POR_DEFECTO: EstadoProyecto = 'presupuesto_enviado';

export interface BotonDeReversionProps {
  proyecto: Proyecto;
}

export function BotonDeReversion({ proyecto }: BotonDeReversionProps) {
  const revertir = useMutation(MUTACION_DE_REVERSION);
  const [abierto, setAbierto] = useState(false);
  const [hacia, setHacia] = useState<EstadoProyecto>(POR_DEFECTO);

  const esCobro = proyecto.estado === 'cobrado';
  const destino = esCobro ? 'entregado' : hacia;
  const diezmo = proyecto.dist_diezmo_centavos ?? 0;
  const sueldo = proyecto.dist_sueldo_centavos ?? 0;

  function confirmar(): void {
    revertir.mutate({
      pedido: pedidoDeReversion(proyecto, destino),
      optimista: filaRevertida(proyecto, destino, new Date().toISOString()),
      previo: proyecto,
      titulo: proyecto.titulo,
    });
    setAbierto(false);
  }

  if (!abierto) {
    return (
      <div>
        <Button
          variant="secundario"
          className="w-full"
          onClick={() => {
            setAbierto(true);
          }}
        >
          <Icono nombre="arrow-left-right" tamano={16} />
          {esCobro ? 'Reabrir el cobro' : 'Reactivar el presupuesto'}
        </Button>
        {revertir.isError && (
          <p role="alert" className="mt-1.5 text-label font-medium text-alerta">
            {mensajeDeSincronizacion(revertir.error, {
              operacion: esCobro ? 'reapertura' : 'reactivacion',
              sujeto: proyecto.titulo,
              estado: esCobro ? 'cobrado' : 'perdido',
            })}
          </p>
        )}
      </div>
    );
  }

  return (
    <section
      aria-label={esCobro ? 'Reabrir el cobro' : 'Reactivar el presupuesto'}
      className="rounded-panel border border-hairline bg-surface-3 px-4 py-3.5"
    >
      <h3 className="text-section font-semibold">
        {esCobro ? '¿Reabrís el cobro?' : '¿Reactivás el presupuesto?'}
      </h3>

      <p className="mt-1.5 text-label leading-relaxed text-text-2">
        {diezmo > 0 || sueldo > 0 ? (
          <>
            Se deshace el reparto: vuelven {formatearPesos(diezmo)} del diezmo y{' '}
            {formatearPesos(sueldo)} del hogar a la caja del taller.{' '}
            {proyecto.fecha_cobro !== null && (
              <>
                El mes de {fechaLarga(proyecto.fecha_cobro, hoyLocal())} deja de contar esta
                liquidación, y el que le falte de costos fijos queda a la vista.
              </>
            )}
          </>
        ) : (
          <>
            Este reparto no movió ningún tesoro, así que deshacerlo tampoco mueve plata. Los pagos y
            los gastos vuelven a poder editarse.
          </>
        )}
      </p>

      {esCobro ? (
        <p className="mt-2 text-meta leading-relaxed text-text-3">
          Vuelve a <strong>Entregado</strong>. Cuando lo vuelvas a cobrar, se usan la fecha y los
          objetivos de este cobro
          {proyecto.fecha_cobro !== null
            ? ` (${fechaLarga(proyecto.fecha_cobro, hoyLocal())})`
            : ''}
          : corregir un gasto no te reescribe el sueldo con los ajustes de hoy ni te cambia el cobro
          de mes.
        </p>
      ) : (
        <>
          <label className="mt-3 block text-label text-text-2" htmlFor="estado-al-reactivar">
            Vuelve al seguimiento, en
          </label>
          <select
            id="estado-al-reactivar"
            value={hacia}
            onChange={(evento) => {
              setHacia(evento.target.value as EstadoProyecto);
            }}
            className="mt-1 h-field w-full rounded-field border border-border bg-paper px-3.5 text-body-lg"
          >
            {ESTADOS_DE_SEGUIMIENTO.map((estado) => (
              <option key={estado} value={estado}>
                {ESTADO[estado].etiqueta}
              </option>
            ))}
          </select>
          <p className="mt-2 text-meta leading-relaxed text-text-3">
            A diferencia de reabrir un cobro, esto <strong>no guarda la fecha</strong>: un
            presupuesto que revive está vivo otra vez, y si más adelante lo volvés a dar por perdido
            es un cierre nuevo, con la fecha de ese día y los ajustes de ese momento.
          </p>
        </>
      )}

      <div className="mt-3.5 flex flex-wrap gap-2">
        <Button onClick={confirmar}>
          {esCobro ? 'Reabrir y deshacer el reparto' : 'Reactivar y deshacer el reparto'}
        </Button>
        <Button
          variant="secundario"
          onClick={() => {
            setAbierto(false);
          }}
        >
          Dejarlo como está
        </Button>
      </div>
    </section>
  );
}
