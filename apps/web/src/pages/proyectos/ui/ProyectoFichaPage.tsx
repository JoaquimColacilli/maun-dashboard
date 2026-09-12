import { estaLiquidado, puedeCerrarPerdido, puedeCobrar } from '@maun/domain';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';

import { enlaceDeMapa } from '@/entities/cliente';
import {
  COMPROBANTE,
  despieceDelProyecto,
  DistribucionDespiece,
  ESTADO,
  EstadoBadge,
  FORMA_DE_PAGO,
  gastosDelProyecto,
  hijosDelProyecto,
  MarcaDeLiquidacion,
  MUTACION_DE_BAJA_DE_PROYECTO,
  MUTACION_DE_NOTAS,
  pagosDelProyecto,
  resumenDeProyecto,
  rutaDeCierre,
  rutaDeCobro,
  rutaDeEdicion,
  useLiquidacionEnVuelo,
} from '@/entities/proyecto';
import { useReplicaDelTaller } from '@/entities/replica';
import { BotonDeReversion } from '@/features/liquidar-proyecto';
import { mensajeDeSincronizacion } from '@/shared/api';
import { fechaLarga, formatearPesos, hoyLocal, useAvisosDelProyecto } from '@/shared/lib';
import { Button, Icono, PanelDeAvisos } from '@/shared/ui';

const DEMORA_DE_LAS_NOTAS_MS = 900;

function vieneDeLiquidar(estado: unknown): boolean {
  return typeof estado === 'object' && estado !== null && 'recienLiquidado' in estado;
}

function Dato({ clave, valor, extra }: { clave: string; valor: string; extra?: string }) {
  return (
    <div className="flex items-center gap-3 border-t border-hairline py-3">
      <div className="min-w-0 flex-1">
        <span className="block text-meta text-text-2">{clave}</span>
        <span className="mt-0.5 block text-body-lg leading-snug font-medium">{valor}</span>
        {extra !== undefined && (
          <span className="mt-0.5 block text-meta font-medium text-atencion">{extra}</span>
        )}
      </div>
    </div>
  );
}

export function ProyectoFichaPage() {
  const replica = useReplicaDelTaller();
  const navegar = useNavigate();
  const { id = '' } = useParams();

  const location = useLocation();

  const hoy = hoyLocal();
  const resumen = resumenDeProyecto(replica, id, hoy);
  const avisos = useAvisosDelProyecto(id);
  const enVuelo = useLiquidacionEnVuelo(id);

  const guardarNotas = useMutation(MUTACION_DE_NOTAS);
  const borrar = useMutation(MUTACION_DE_BAJA_DE_PROYECTO);
  const [notas, setNotas] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const reloj = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const recienLiquidado = vieneDeLiquidar(location.state);

  useEffect(
    () => () => {
      clearTimeout(reloj.current);
    },
    [],
  );

  if (!resumen) {
    return (
      <div className="mx-auto flex max-w-content flex-col items-start gap-3 px-(--page-pad-mobile) py-8 md:px-(--page-pad-tablet) lg:px-(--page-pad-desktop)">
        <h1 className="font-display text-h1 leading-tight">Ese proyecto no está</h1>
        <p className="max-w-[520px] text-body leading-relaxed text-text-2">
          Puede que lo hayas borrado desde otro dispositivo, o que el enlace apunte a un proyecto de
          otro taller.
        </p>
        <Button
          onClick={() => {
            void navegar('/proyectos');
          }}
        >
          Volver a Proyectos
        </Button>
      </div>
    );
  }

  const { proyecto, cliente } = resumen;
  const pagos = pagosDelProyecto(replica, proyecto.id);
  const gastos = gastosDelProyecto(replica, proyecto.id);
  const despiece = despieceDelProyecto(replica, proyecto, hoy);
  const liquidado = estaLiquidado(proyecto.estado);

  const notasVisibles = notas ?? proyecto.notas;
  const direccionDistinta =
    cliente !== undefined &&
    cliente.direccion.trim() !== '' &&
    proyecto.direccion_entrega.trim() !== cliente.direccion.trim();

  function alEscribirNotas(texto: string): void {
    setNotas(texto);
    clearTimeout(reloj.current);
    reloj.current = setTimeout(() => {
      guardarNotas.mutate({
        id: proyecto.id,
        cambios: { notas: texto.trim() },
        previos: { notas: proyecto.notas },
      });
    }, DEMORA_DE_LAS_NOTAS_MS);
  }

  // La app no dice "guardado" para algo que sigue en la cola (ADR 0010): mientras la mutación está
  // pausada por falta de señal, lo que se muestra es eso.
  const estadoDeLasNotas = guardarNotas.isPaused
    ? {
        texto: 'Sin señal: se guarda cuando vuelva',
        icono: 'cloud-off' as const,
        tono: 'text-text-2',
      }
    : guardarNotas.isPending
      ? { texto: 'Guardando…', icono: 'arrow-up-down' as const, tono: 'text-text-2' }
      : guardarNotas.isError
        ? { texto: 'No se pudo guardar', icono: 'triangle-alert' as const, tono: 'text-alerta' }
        : guardarNotas.isSuccess
          ? { texto: 'Guardado', icono: 'check' as const, tono: 'text-hogar' }
          : undefined;

  const fechas: { clave: string; valor: string; tono?: string }[] = [];
  if (proyecto.fecha_inicio !== null) {
    fechas.push({ clave: 'Inicio', valor: fechaLarga(proyecto.fecha_inicio, hoy) });
  }
  if (proyecto.entrega_estimada !== null) {
    fechas.push({
      clave: 'Entrega estimada',
      valor:
        resumen.urgencia === undefined
          ? fechaLarga(proyecto.entrega_estimada, hoy)
          : `${fechaLarga(proyecto.entrega_estimada, hoy)}, ${resumen.urgencia.texto}`,
      tono:
        resumen.urgencia === undefined
          ? undefined
          : resumen.urgencia.tono === 'vencida'
            ? 'font-semibold text-alerta'
            : resumen.urgencia.tono === 'atencion'
              ? 'font-semibold text-atencion'
              : undefined,
    });
  }
  if (proyecto.fecha_entrega !== null) {
    fechas.push({ clave: 'Entregado', valor: fechaLarga(proyecto.fecha_entrega, hoy) });
  }
  if (proyecto.fecha_cobro !== null) {
    fechas.push({
      clave: proyecto.estado === 'perdido' ? 'Cerrado' : 'Cobrado',
      valor: fechaLarga(proyecto.fecha_cobro, hoy),
      tono: 'text-hogar',
    });
  }

  return (
    <div className="mx-auto flex max-w-content flex-col px-(--page-pad-mobile) py-2 md:px-(--page-pad-tablet) md:py-5 lg:px-(--page-pad-desktop) lg:py-6">
      <div className="mb-2.5 flex items-center justify-between">
        <Link
          to="/proyectos"
          className="flex min-h-tap items-center gap-1 rounded-field pr-2 text-body font-medium text-text-2 hover:bg-surface"
        >
          <Icono nombre="chevron-left" tamano={20} />
          Proyectos
        </Link>
        <div className="flex gap-2">
          <Button
            variant="secundario"
            size="chico"
            onClick={() => {
              setConfirmando(true);
            }}
          >
            <Icono nombre="trash-2" tamano={16} />
            Borrar
          </Button>
          <Button
            variant="secundario"
            size="chico"
            onClick={() => {
              void navegar(rutaDeEdicion(proyecto.id));
            }}
          >
            <Icono nombre="pencil" tamano={16} />
            Editar
          </Button>
        </div>
      </div>

      <header className="flex flex-col gap-2">
        {cliente === undefined ? (
          <span className="text-label text-text-3">{resumen.nombreDelCliente}</span>
        ) : (
          <Link
            to={`/clientes/${cliente.id}`}
            className="inline-flex items-center gap-1.5 self-start text-label font-medium text-text-2"
          >
            {cliente.nombre}
            <Icono nombre="chevron-right" tamano={14} />
          </Link>
        )}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="max-w-[720px] font-display text-h1 leading-tight text-pretty lg:text-h1-lg">
            {proyecto.titulo}
          </h1>
          <span className="flex flex-wrap items-center gap-2">
            <EstadoBadge estado={proyecto.estado} />
            <MarcaDeLiquidacion proyectoId={proyecto.id} />
          </span>
        </div>
        {fechas.length > 0 && (
          <dl className="mt-1 flex flex-wrap gap-x-6 gap-y-1.5 text-label">
            {fechas.map((fecha) => (
              <div key={fecha.clave} className="flex items-baseline gap-1.5">
                <dt className="text-text-3">{fecha.clave}</dt>
                <dd className={`font-medium ${fecha.tono ?? ''}`}>{fecha.valor}</dd>
              </div>
            ))}
          </dl>
        )}
      </header>

      {avisos.length > 0 && (
        <div className="mt-4">
          <PanelDeAvisos avisos={avisos} />
        </div>
      )}

      <dl className="mt-4 grid grid-cols-3 border-t border-b border-ink border-b-hairline">
        <div className="py-3 pr-3">
          <dt className="text-meta text-text-2">Presupuesto</dt>
          <dd className="text-money-lg font-semibold tabular-nums whitespace-nowrap">
            {proyecto.presupuesto_centavos === null ? '—' : formatearPesos(resumen.presupuesto)}
          </dd>
        </div>
        <div className="border-l border-hairline px-3 py-3">
          <dt className="text-meta text-text-2">Cobrado</dt>
          <dd className="text-money-lg font-semibold text-hogar tabular-nums whitespace-nowrap">
            {formatearPesos(resumen.cobrado)}
          </dd>
        </div>
        <div className="border-l border-hairline py-3 pl-3">
          <dt className="text-meta text-text-2">Saldo</dt>
          <dd
            className={`text-money-lg font-semibold tabular-nums whitespace-nowrap ${
              resumen.saldo > 0 ? 'text-ink' : 'text-hogar'
            }`}
          >
            {resumen.saldo > 0 ? formatearPesos(resumen.saldo) : 'Sin saldo'}
          </dd>
        </div>
      </dl>

      <div className="mt-4 max-w-[520px]">
        {puedeCobrar(proyecto.estado) && (
          <Button
            className="w-full sm:w-auto"
            onClick={() => {
              void navegar(rutaDeCobro(proyecto.id));
            }}
          >
            <Icono nombre="hand-coins" tamano={18} />
            {resumen.saldo > 0
              ? `Cobrar el saldo de ${formatearPesos(resumen.saldo)}`
              : 'Cobrar y repartir'}
          </Button>
        )}

        {puedeCerrarPerdido(proyecto.estado) && (
          <Button
            variant="secundario"
            className="w-full sm:w-auto"
            onClick={() => {
              void navegar(rutaDeCierre(proyecto.id));
            }}
          >
            <Icono nombre="x" tamano={16} />
            Dar por perdido
          </Button>
        )}

        {liquidado && <BotonDeReversion proyecto={proyecto} />}
      </div>

      <div className="grid gap-0 lg:grid-cols-2 lg:gap-x-11">
        <div className="min-w-0 lg:order-2">
          <div className="mt-5 rounded-panel border border-hairline px-4 pt-4 pb-3.5">
            <DistribucionDespiece
              despiece={despiece}
              animar={recienLiquidado}
              provisoria={enVuelo !== undefined && despiece.modo === 'real'}
            />
          </div>

          <section aria-label="Entrega y comprobante" className="mt-5 flex flex-col">
            <Dato
              clave="Dirección de entrega"
              valor={
                proyecto.direccion_entrega.trim() === ''
                  ? 'Sin dirección'
                  : proyecto.direccion_entrega
              }
              extra={direccionDistinta ? 'Distinta del domicilio del cliente' : undefined}
            />
            {proyecto.direccion_entrega.trim() !== '' && (
              <a
                href={enlaceDeMapa(proyecto.direccion_entrega, '') ?? '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 flex min-h-tap items-center gap-2 self-start rounded-field border border-border px-3 text-label font-medium hover:bg-surface"
              >
                <Icono nombre="map-pin" tamano={16} />
                Abrir en el mapa
              </a>
            )}
            <Dato clave="Comprobante a emitir" valor={COMPROBANTE[proyecto.comprobante]} />
            <Dato
              clave="Forma de pago"
              valor={
                proyecto.forma_pago === null ? 'Sin definir' : FORMA_DE_PAGO[proyecto.forma_pago]
              }
            />
          </section>

          <section aria-label="Notas de obra" className="mt-5">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h2 className="text-section font-semibold">Notas de obra</h2>
              {estadoDeLasNotas !== undefined && (
                <span
                  role="status"
                  className={`flex items-center gap-1.5 text-meta ${estadoDeLasNotas.tono}`}
                >
                  <Icono nombre={estadoDeLasNotas.icono} tamano={13} />
                  {estadoDeLasNotas.texto}
                </span>
              )}
            </div>
            <textarea
              value={notasVisibles}
              onChange={(evento) => {
                alEscribirNotas(evento.target.value);
              }}
              rows={Math.max(4, notasVisibles.split('\n').length + 1)}
              aria-label="Notas de obra"
              placeholder="Medidas, qué falta, qué hablar con el cliente…"
              className="block w-full resize-y rounded-field border border-hairline bg-paper-notas px-3.5 py-2.5 text-body-lg text-ink focus:border-ink"
            />
            {guardarNotas.isError && (
              <p role="alert" className="mt-1.5 text-label font-medium text-alerta">
                {mensajeDeSincronizacion(guardarNotas.error)}
              </p>
            )}
          </section>
        </div>

        <div className="min-w-0 lg:order-1">
          <section aria-label="Pagos recibidos" className="mt-5">
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <h2 className="text-section font-semibold">Pagos recibidos</h2>
              <span className="text-label text-text-2 tabular-nums">
                {pagos.length === 0
                  ? ''
                  : `${String(pagos.length)} ${pagos.length === 1 ? 'pago' : 'pagos'}`}
              </span>
            </div>
            {pagos.length === 0 ? (
              <p className="border-t border-hairline py-3.5 text-label text-text-2">
                Todavía no cobraste nada de este proyecto. La seña suele ir primero.
              </p>
            ) : (
              <ol className="list-none">
                {pagos.map((pago, indice) => (
                  <li key={pago.id} className="grid grid-cols-[20px_1fr_auto] items-start gap-x-3">
                    <span aria-hidden className="flex h-full flex-col items-center">
                      <span className="mt-3.5 size-2.5 flex-none rounded-pill bg-hogar" />
                      <span
                        className={`w-px flex-1 ${
                          indice === pagos.length - 1 ? 'bg-transparent' : 'bg-border'
                        }`}
                      />
                    </span>
                    <span className="py-2.5">
                      <span className="block text-body-lg font-medium">
                        {pago.concepto.trim() === '' ? 'Pago' : pago.concepto}
                      </span>
                      <span className="mt-0.5 block text-meta text-text-3">
                        {fechaLarga(pago.fecha, hoy)}
                      </span>
                    </span>
                    <span className="py-2.5 text-body-lg font-semibold tabular-nums whitespace-nowrap">
                      {formatearPesos(pago.monto_centavos)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section aria-label="Gastos e insumos" className="mt-6">
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <h2 className="text-section font-semibold">Gastos e insumos</h2>
              <span className="text-label text-text-2 tabular-nums">
                {gastos.length === 0
                  ? ''
                  : `${String(gastos.length)} ${gastos.length === 1 ? 'ítem' : 'ítems'}`}
              </span>
            </div>
            {gastos.length === 0 ? (
              <p className="border-t border-hairline py-3.5 text-label text-text-2">
                Sin gastos cargados. Todo lo que compres para este mueble va acá y se descuenta de
                la ganancia.
              </p>
            ) : (
              <>
                <ul className="list-none">
                  {gastos.map((gasto) => (
                    <li
                      key={gasto.id}
                      className="flex min-h-12 items-center gap-2.5 border-t border-hairline-soft text-body"
                    >
                      <span className="w-16 flex-none text-meta text-text-3 tabular-nums">
                        {fechaLarga(gasto.fecha, hoy)}
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        {gasto.descripcion.trim() === '' ? 'Insumo' : gasto.descripcion}
                      </span>
                      <span className="flex-none font-medium tabular-nums">
                        {formatearPesos(gasto.monto_centavos)}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="flex min-h-11 items-center justify-between border-t border-ink text-body font-semibold">
                  <span>Total de gastos</span>
                  <span className="tabular-nums">{formatearPesos(resumen.gastos)}</span>
                </div>
              </>
            )}
          </section>

          <Button
            variant="secundario"
            className="mt-4 w-full"
            disabled={liquidado}
            onClick={() => {
              void navegar(rutaDeEdicion(proyecto.id));
            }}
          >
            <Icono nombre="plus" tamano={16} />
            Cargar pagos y gastos
          </Button>
          {liquidado && (
            <p className="mt-1.5 text-meta leading-snug text-text-3">
              Este proyecto está {ESTADO[proyecto.estado].etiqueta.toLowerCase()}: sus pagos y sus
              gastos quedaron congelados con la distribución.
            </p>
          )}
        </div>
      </div>

      {confirmando && (
        <div className="fixed inset-0 z-40">
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => {
              setConfirmando(false);
            }}
            className="absolute inset-0 cursor-default bg-ink/35"
          />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label="Confirmar el borrado"
            className="absolute inset-x-0 bottom-0 flex flex-col gap-3.5 rounded-t-sheet bg-paper p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-sheet md:inset-auto md:top-1/2 md:left-1/2 md:w-[min(440px,calc(100%-40px))] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-dialog"
          >
            <h2 className="text-body-lg leading-snug font-semibold">
              ¿Borrás «{proyecto.titulo}»?
            </h2>
            <p className="text-label leading-relaxed text-text-2">
              Se va a llevar sus {String(pagos.length)} pagos y sus {String(gastos.length)} gastos,
              y con eso salen del libro mayor.
            </p>
            {borrar.isError && (
              <p role="alert" className="text-label font-medium text-alerta">
                {mensajeDeSincronizacion(borrar.error)}
              </p>
            )}
            <div className="flex gap-2.5">
              <Button
                variant="secundario"
                className="flex-1"
                onClick={() => {
                  setConfirmando(false);
                }}
              >
                Cancelar
              </Button>
              <Button
                variant="peligro"
                className="flex-1"
                cargando={borrar.isPending}
                onClick={() => {
                  borrar.mutate({
                    id: proyecto.id,
                    borradoEn: new Date().toISOString(),
                    previos: { proyecto, ...hijosDelProyecto(replica, proyecto.id) },
                  });
                  setConfirmando(false);
                  void navegar('/proyectos');
                }}
              >
                Borrar el proyecto
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
