import { centavos, type EstadoLiquidado } from '@maun/domain';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import {
  ajustesDeLaReplica,
  datosActualesDelProyecto,
  despieceDeLaLiquidacion,
  DistribucionDespiece,
  filaLiquidada,
  liquidacionProyectada,
  MUTACION_DE_LIQUIDACION,
  MUTACION_DE_PROYECTO,
  pedidoDeLiquidacion,
  rutaDelProyecto,
  type ResumenDeProyecto,
} from '@/entities/proyecto';
import { useReplicaDelTaller } from '@/entities/replica';
import { mensajeDeSincronizacion, type ProyectoParaGuardar } from '@/shared/api';
import { formatearPesos, hoyLocal, parsearPesos, pesosEditables, uuidv7 } from '@/shared/lib';
import { Button, Campo, Icono } from '@/shared/ui';

const TEXTOS = {
  cobrado: {
    titulo: 'Cobrar',
    verbo: 'Cobrar y repartir',
    volver: 'Volver sin cobrar',
  },
  perdido: {
    titulo: 'Dar por perdido',
    verbo: 'Dar por perdido y liquidar la seña',
    volver: 'Volver sin cerrarlo',
  },
} as const;

function Trio({ resumen }: { resumen: ResumenDeProyecto }) {
  const celdas = [
    {
      clave: 'Presupuesto',
      valor:
        resumen.proyecto.presupuesto_centavos === null ? '—' : formatearPesos(resumen.presupuesto),
      tono: '',
    },
    { clave: 'Cobrado', valor: formatearPesos(resumen.cobrado), tono: 'text-hogar' },
    {
      clave: 'Saldo',
      valor: resumen.saldo > 0 ? formatearPesos(resumen.saldo) : 'Sin saldo',
      tono: resumen.saldo > 0 ? 'text-atencion' : 'text-hogar',
    },
  ];

  return (
    <dl className="mt-4 grid grid-cols-3 border-t border-b border-ink border-b-hairline">
      {celdas.map((celda, indice) => (
        <div
          key={celda.clave}
          className={`py-3 ${indice === 0 ? 'pr-3' : 'border-l border-hairline px-3'}`}
        >
          <dt className="text-meta text-text-2">{celda.clave}</dt>
          <dd
            className={`text-money-lg font-semibold tabular-nums whitespace-nowrap ${celda.tono}`}
          >
            {celda.valor}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export interface PantallaDeLiquidacionProps {
  resumen: ResumenDeProyecto;
  destino: EstadoLiquidado;
}

// El cobro no lleva «¿estás seguro?»: la confirmación es el despiece, que se lee en vez de
// descartarse, y el botón dice el verbo de verdad (ADR 0016). Cobrar es reversible, y eso también
// está dicho abajo del botón.
export function PantallaDeLiquidacion({ resumen, destino }: PantallaDeLiquidacionProps) {
  const replica = useReplicaDelTaller();
  const navegar = useNavigate();
  const { proyecto } = resumen;
  const textos = TEXTOS[destino];

  const guardar = useMutation(MUTACION_DE_PROYECTO);
  const liquidar = useMutation(MUTACION_DE_LIQUIDACION);

  const faltaCobrar = destino === 'cobrado' && resumen.saldo > 0;
  const [conPagoFinal, setConPagoFinal] = useState(faltaCobrar);
  const [monto, setMonto] = useState(() => pesosEditables(resumen.saldo));
  const [fecha, setFecha] = useState(hoyLocal);
  const [concepto, setConcepto] = useState('Saldo final en la entrega');

  // La fecha del pago es del pago: el cliente pudo haber transferido el martes. La liquidación es de
  // hoy, y es la que decide en qué mes cae el reparto. Si el cobro viene de una reapertura, el
  // dominio ignora las dos y usa la del cobro original (ADR 0011).
  const pagoExtra = centavos(conPagoFinal && faltaCobrar ? (parsearPesos(monto) ?? 0) : 0);
  const liquidacion = liquidacionProyectada(replica, proyecto, hoyLocal(), { destino, pagoExtra });
  const despiece = despieceDeLaLiquidacion(liquidacion);
  const ajustes = ajustesDeLaReplica(replica);

  const enCurso = liquidar.isPending && !liquidar.isPaused;

  function confirmar(): void {
    if (pagoExtra > 0) {
      const pedidoDelPago: ProyectoParaGuardar = {
        id: proyecto.id,
        version: proyecto.version,
        datos: datosActualesDelProyecto(proyecto),
        pagos: [
          {
            id: uuidv7(),
            fecha,
            concepto: concepto.trim(),
            monto_centavos: pagoExtra,
          },
        ],
        gastos: [],
      };
      guardar.mutate({
        pedido: pedidoDelPago,
        previos: { proyecto, pagos: [], gastos: [] },
      });
    }

    const pedido = pedidoDeLiquidacion(proyecto, liquidacion);
    liquidar.mutate({
      pedido,
      optimista: filaLiquidada(proyecto, liquidacion, new Date().toISOString()),
      previo: proyecto,
      titulo: proyecto.titulo,
    });

    void navegar(rutaDelProyecto(proyecto.id), { replace: true, state: { recienLiquidado: true } });
  }

  const aRepartir = despiece.piezas.filter((pieza) => pieza.monto > 0);

  return (
    <div className="mx-auto flex max-w-[720px] flex-col px-(--page-pad-mobile) py-2 md:px-(--page-pad-tablet) lg:px-(--page-pad-desktop)">
      <Link
        to={rutaDelProyecto(proyecto.id)}
        className="mb-2.5 flex min-h-tap w-fit items-center gap-1 rounded-field pr-2 text-body font-medium text-text-2 hover:bg-surface"
      >
        <Icono nombre="chevron-left" tamano={20} />
        {textos.volver}
      </Link>

      <header>
        <p className="text-label text-text-2">{resumen.nombreDelCliente}</p>
        <h1 className="mt-0.5 font-display text-h1 leading-tight lg:text-h1-lg">
          {textos.titulo} «{proyecto.titulo}»
        </h1>
      </header>

      <Trio resumen={resumen} />

      {faltaCobrar && (
        <section aria-label="Pago final" className="mt-5">
          <label className="flex min-h-tap items-center gap-2.5 text-body font-medium">
            <input
              type="checkbox"
              checked={conPagoFinal}
              onChange={(evento) => {
                setConPagoFinal(evento.target.checked);
              }}
              className="size-4 accent-ink"
            />
            Registrar el pago final de {formatearPesos(resumen.saldo)}
          </label>
          <p className="mt-1 text-meta leading-normal text-text-3">
            Queda cargado como un pago más del proyecto, y entra en la cuenta de abajo. Si el
            cliente te quedó debiendo, destildalo y cobrá lo que entró.
          </p>

          {conPagoFinal && (
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_140px_150px]">
              <Campo
                etiqueta="Concepto"
                value={concepto}
                onChange={(evento) => {
                  setConcepto(evento.target.value);
                }}
              />
              <Campo
                etiqueta="Monto"
                inputMode="decimal"
                value={monto}
                onChange={(evento) => {
                  setMonto(evento.target.value);
                }}
              />
              <Campo
                etiqueta="Fecha"
                type="date"
                value={fecha}
                onChange={(evento) => {
                  setFecha(evento.target.value);
                }}
              />
            </div>
          )}
        </section>
      )}

      {destino === 'perdido' && (
        <section
          aria-label="Qué pasa con la seña"
          className="mt-5 rounded-panel bg-atencion-tint px-4 py-3.5 text-label leading-relaxed text-atencion"
        >
          <h2 className="font-semibold">
            Esto mueve plata, aunque sea un presupuesto que no salió
          </h2>
          {resumen.cobrado > 0 ? (
            <p className="mt-1.5">
              Los {formatearPesos(resumen.cobrado)} de seña que retenés dejan de ser un anticipo y
              pasan a ser ingreso del taller.{' '}
              {ajustes.perdidoConDiezmo
                ? `De ahí sale el diezmo: ${formatearPesos(liquidacion.diezmo)}.`
                : 'Esta seña no paga diezmo, según está configurado el taller.'}{' '}
              {ajustes.perdidoConSueldo
                ? 'Y también paga sueldo, según está configurado el taller.'
                : 'No paga sueldo: un presupuesto que no prosperó no es un trabajo.'}{' '}
              El resto queda en el taller.
            </p>
          ) : (
            <p className="mt-1.5">
              No hay seña retenida, así que no se mueve plata de los tesoros.
              {resumen.gastos > 0
                ? ` Los ${formatearPesos(resumen.gastos)} de gastos que cargaste quedan como pérdida del taller.`
                : ''}
            </p>
          )}
          <p className="mt-1.5">
            Se puede deshacer: reactivando el presupuesto vuelve al seguimiento y la plata se
            descuenta de los tesoros.
          </p>
        </section>
      )}

      <div className="mt-5 rounded-panel border border-hairline px-4 pt-4 pb-3.5">
        <DistribucionDespiece despiece={despiece} />
      </div>

      <div className="mt-5">
        <Button className="w-full sm:w-auto" cargando={enCurso} onClick={confirmar}>
          <Icono nombre="hand-coins" tamano={18} />
          {textos.verbo}
          {despiece.neta > 0 ? ` ${formatearPesos(despiece.neta)}` : ''}
        </Button>

        <p className="mt-2 max-w-[520px] text-meta leading-relaxed text-text-3">
          {despiece.neta > 0 ? (
            <>
              Se reparten {formatearPesos(despiece.neta)} de ganancia neta:{' '}
              {aRepartir
                .map((pieza) => `${formatearPesos(pieza.monto)} ${pieza.etiqueta.toLowerCase()}`)
                .join(', ')}
              . Los saldos de los tesoros se mueven con esto.
            </>
          ) : (
            <>
              No hay ganancia que repartir: no se mueve ningún tesoro y la pérdida queda anotada en
              el remanente del taller.
            </>
          )}{' '}
          {destino === 'cobrado'
            ? 'Si te equivocaste, se reabre desde la ficha y el reparto se deshace.'
            : 'Si te equivocaste, se reactiva desde la ficha y el reparto se deshace.'}
        </p>

        {liquidar.isError && (
          <p role="alert" className="mt-2 max-w-[520px] text-label font-medium text-alerta">
            {mensajeDeSincronizacion(liquidar.error, {
              operacion: destino === 'cobrado' ? 'cobro' : 'cierre',
              sujeto: proyecto.titulo,
              estado: destino,
            })}
          </p>
        )}
      </div>
    </div>
  );
}
