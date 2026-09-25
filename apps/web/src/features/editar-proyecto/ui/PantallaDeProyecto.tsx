import { entregaEstimada, estaLiquidado, faseDe, type EstadoProyecto } from '@maun/domain';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState } from 'react';
import { Controller, useFieldArray, useForm, useWatch, type SubmitHandler } from 'react-hook-form';

import { ClienteCombobox, CONDICION, enlaceDeMapa } from '@/entities/cliente';
import {
  COMPROBANTE,
  COMPROBANTES_EN_ORDEN,
  comprobanteDeLaCondicion,
  conLaVigenciaAlMandar,
  diasQueValeElPresupuesto,
  esquemaDeProyecto,
  ESTADO,
  ESTADOS_EN_ORDEN,
  estadosDisponibles,
  FORMA_DE_PAGO,
  FORMAS_EN_ORDEN,
  gastosDelProyecto,
  hijosDelProyecto,
  MUTACION_DE_PROYECTO,
  opcionesDelProyecto,
  opcionVacia,
  pagosDelProyecto,
  presupuestoDeLasOpciones,
  filaRevertida,
  MUTACION_DE_REVERSION,
  pedidoDeGuardado,
  pedidoDeReversion,
  rutaDeCierre,
  rutaDeCobro,
  rutaDelProyecto,
  totalDeLasFilas,
  valoresDelFormulario,
  type FormularioDeProyecto,
} from '@/entities/proyecto';
import { useReplicaDelTaller } from '@/entities/replica';
import {
  ajustesDe,
  aperturaDeLaReplica,
  filaPorId,
  filasDe,
  mensajeDeSincronizacion,
} from '@/shared/api';
import {
  formatearPesos,
  hoyLocal,
  metaDeAvisos,
  useAltoVisible,
  useAnchoDePantalla,
  uuidv7,
  useIr,
  useVolver,
} from '@/shared/lib';
import { Button, Campo, CamposJuntos, Icono, MoneyInput, SeccionesEnFilas } from '@/shared/ui';

import { FilasDeOpciones } from './FilasDeOpciones';
import { FilasDinamicas } from './FilasDinamicas';

const FECHA_ALINEADA = '@sm/datos:row-span-3 @sm/datos:grid @sm/datos:grid-rows-subgrid';

function rutaAlTerminar(id: string, volverALiquidar: 'cierre' | 'cobro' | null): string {
  if (volverALiquidar === 'cierre') return rutaDeCierre(id);
  if (volverALiquidar === 'cobro') return rutaDeCobro(id);
  return rutaDelProyecto(id);
}

export interface PantallaDeProyectoProps {
  proyectoId?: string;
  clienteInicial?: string;
  entregaInicial?: string;
  agregarUnaOpcion?: boolean;
}

export function PantallaDeProyecto({
  proyectoId,
  clienteInicial,
  entregaInicial,
  agregarUnaOpcion = false,
}: PantallaDeProyectoProps) {
  const replica = useReplicaDelTaller();
  const ir = useIr();
  const cancelar = useVolver(
    proyectoId === undefined ? '/proyectos' : rutaDelProyecto(proyectoId),
    'Cancelar',
    { fija: true },
  );
  const ancho = useAnchoDePantalla();
  const altoVisible = useAltoVisible();
  const idCampos = useId();

  const hoy = hoyLocal();
  const proyecto =
    proyectoId === undefined ? undefined : filaPorId(replica, 'proyectos', proyectoId);
  const clientes = filasDe(replica, 'clientes');

  const alAbrir = useRef({
    id: proyectoId ?? uuidv7(),
    version: proyecto?.version ?? null,
    pagos: proyectoId === undefined ? [] : pagosDelProyecto(replica, proyectoId).map((p) => p.id),
    gastos: proyectoId === undefined ? [] : gastosDelProyecto(replica, proyectoId).map((g) => g.id),
    opciones:
      proyectoId === undefined ? [] : opcionesDelProyecto(replica, proyectoId).map((o) => o.id),
  });

  const guardar = useMutation({
    ...MUTACION_DE_PROYECTO,
    meta: metaDeAvisos('proyectoGuardado', { errorEnPantalla: true }),
  });
  const [rechazo, setRechazo] = useState<unknown>(null);
  const [volverALiquidar, setVolverALiquidar] = useState<'cierre' | 'cobro' | null>(null);
  const revertir = useMutation(MUTACION_DE_REVERSION);

  const clienteDeArranque =
    clienteInicial === undefined ? undefined : filaPorId(replica, 'clientes', clienteInicial);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<FormularioDeProyecto>({
    resolver: zodResolver(esquemaDeProyecto),
    defaultValues: valoresDelFormulario(
      proyecto,
      proyectoId === undefined ? [] : pagosDelProyecto(replica, proyectoId),
      proyectoId === undefined ? [] : gastosDelProyecto(replica, proyectoId),
      proyectoId === undefined ? [] : opcionesDelProyecto(replica, proyectoId),
      {
        clienteId: clienteDeArranque?.id,
        comprobante:
          clienteDeArranque === undefined
            ? undefined
            : comprobanteDeLaCondicion(clienteDeArranque.condicion_fiscal),
        direccion: clienteDeArranque?.direccion,
        entrega: entregaInicial,
        hoy,
      },
    ),
  });

  const pagos = useFieldArray({ control, name: 'pagos', keyName: 'clave' });
  const gastos = useFieldArray({ control, name: 'gastos', keyName: 'clave' });
  const opciones = useFieldArray({ control, name: 'opciones', keyName: 'clave' });
  const { append: agregarOpcion } = opciones;
  const [agregarLaPrimeraOpcion] = useState(
    () =>
      agregarUnaOpcion &&
      proyectoId !== undefined &&
      opcionesDelProyecto(replica, proyectoId).length === 0,
  );

  useEffect(() => {
    if (!agregarLaPrimeraOpcion) return;
    const cuadro = requestAnimationFrame(() => {
      agregarOpcion(opcionVacia(uuidv7()));
    });
    return () => {
      cancelAnimationFrame(cuadro);
    };
  }, [agregarLaPrimeraOpcion, agregarOpcion]);

  const clienteId = useWatch({ control, name: 'cliente_id' });
  const inicio = useWatch({ control, name: 'fecha_inicio' });
  const direccion = useWatch({ control, name: 'direccion_entrega' });
  const presupuesto = useWatch({ control, name: 'presupuesto' });
  const formaDePago = useWatch({ control, name: 'forma_pago' });
  const filasDePagos = useWatch({ control, name: 'pagos' });
  const filasDeGastos = useWatch({ control, name: 'gastos' });
  const filasDeOpciones = useWatch({ control, name: 'opciones' });

  const cliente = clientes.find((fila) => fila.id === clienteId);
  const [entregaAuto, setEntregaAuto] = useState(
    proyecto?.entrega_estimada == null && entregaInicial === undefined,
  );
  const [comprobanteAuto, setComprobanteAuto] = useState(proyecto === undefined);

  useEffect(() => {
    if (!entregaAuto || inicio.trim() === '') return;
    setValue('entrega_estimada', entregaEstimada(inicio), { shouldDirty: true });
  }, [entregaAuto, inicio, setValue]);

  useEffect(() => {
    if (!comprobanteAuto || cliente === undefined) return;
    setValue('comprobante', comprobanteDeLaCondicion(cliente.condicion_fiscal), {
      shouldDirty: true,
    });
  }, [comprobanteAuto, cliente, setValue]);

  const liquidado = proyecto !== undefined && estaLiquidado(proyecto.estado);

  const opcionesDeEstado: EstadoProyecto[] =
    proyecto === undefined
      ? ESTADOS_EN_ORDEN.filter((estado) => faseDe(estado) === 'activos')
      : estadosDisponibles(proyecto.estado);

  const hayOpciones = filasDeOpciones.length > 0;
  const presupuestoEfectivo = hayOpciones ? presupuestoDeLasOpciones(filasDeOpciones) : presupuesto;

  const totalCobrado = totalDeLasFilas(filasDePagos);
  const totalGastos = totalDeLasFilas(filasDeGastos);
  const saldo =
    presupuestoEfectivo === null ? null : Math.max(0, presupuestoEfectivo - totalCobrado);
  const neta = totalCobrado - totalGastos;

  function reabrirParaEditar(fila: NonNullable<typeof proyecto>): void {
    const hacia = fila.estado === 'perdido' ? 'presupuesto_enviado' : 'entregado';
    revertir.mutate({
      pedido: pedidoDeReversion(fila, hacia),
      optimista: filaRevertida(fila, hacia, new Date().toISOString()),
      previo: fila,
      titulo: fila.titulo,
    });
    alAbrir.current.version = fila.version + 1;
    setValue('estado', hacia);
    setVolverALiquidar(fila.estado === 'perdido' ? 'cierre' : 'cobro');
  }

  useEffect(() => {
    if (guardar.isPaused) {
      ir(rutaAlTerminar(alAbrir.current.id, volverALiquidar), { como: 'terminar' });
    }
  }, [guardar.isPaused, ir, volverALiquidar]);

  const enviar: SubmitHandler<FormularioDeProyecto> = (valores) => {
    const previos = hijosDelProyecto(replica, alAbrir.current.id);
    const armado = pedidoDeGuardado(
      alAbrir.current.id,
      alAbrir.current.version,
      valores,
      {
        pagos: alAbrir.current.pagos,
        gastos: alAbrir.current.gastos,
        opciones: alAbrir.current.opciones,
      },
      aperturaDeLaReplica(replica),
    );
    const pedido = {
      ...armado,
      datos: conLaVigenciaAlMandar(
        proyecto,
        armado.datos,
        hoy,
        diasQueValeElPresupuesto(ajustesDe(replica)),
      ),
    };

    setRechazo(null);
    guardar.mutate(
      { pedido, previos: { proyecto: proyecto ?? null, ...previos } },
      {
        onSuccess: () => {
          ir(rutaAlTerminar(alAbrir.current.id, volverALiquidar), { como: 'terminar' });
        },
        onError: setRechazo,
      },
    );
  };

  const enCelular = ancho === 'movil';
  const titulo = proyecto === undefined ? 'Proyecto nuevo' : 'Editar proyecto';

  return (
    <div
      style={enCelular && altoVisible !== undefined ? { height: altoVisible } : undefined}
      className={
        enCelular
          ? 'fixed inset-x-0 top-0 z-30 flex h-[100dvh] flex-col bg-mesa'
          : 'flex min-h-full flex-col'
      }
    >
      <header className="flex-none border-b border-hairline bg-mesa md:sticky md:top-0 md:z-20">
        <div className="mx-auto grid w-full max-w-content grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-2 md:h-17 md:px-(--page-pad-tablet) md:py-0 lg:px-(--page-pad-desktop)">
          <Button variant="terciario" className="justify-self-start" onClick={cancelar.volver}>
            <Icono nombre="x" tamano={20} />
            Cancelar
          </Button>
          <span className="text-center text-body-lg font-semibold">{titulo}</span>
        </div>
      </header>

      <form
        noValidate
        onSubmit={(evento) => {
          void handleSubmit(enviar)(evento);
        }}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div
          data-pagina=""
          className={`mx-auto min-h-0 w-full max-w-content flex-1 px-(--page-pad-mobile) py-4 md:px-(--page-pad-tablet) md:py-6 lg:px-(--page-pad-desktop) lg:py-7 ${
            enCelular
              ? 'overflow-y-auto'
              : '[&_:is(input,select,textarea,button)]:scroll-mt-40 [&_:is(input,select,textarea,button)]:scroll-mb-28'
          }`}
        >
          <SeccionesEnFilas separacion="gap-3 @min-[40rem]/secciones:gap-4">
            <div className="@container/datos flex min-w-0 flex-col gap-5 rounded-panel border border-hairline bg-paper px-4 py-4 md:px-5">
              <CamposJuntos separacion="gap-5">
                <ClienteCombobox
                  clientes={clientes}
                  elegidoId={clienteId === '' ? null : clienteId}
                  alElegir={(elegido) => {
                    setValue('cliente_id', elegido?.id ?? '', { shouldValidate: true });
                    if (elegido === null) return;
                    if (direccion.trim() === '') {
                      setValue('direccion_entrega', elegido.direccion, { shouldDirty: true });
                    }
                  }}
                  error={errors.cliente_id?.message}
                />

                <Campo
                  {...register('titulo')}
                  etiqueta="Trabajo"
                  placeholder="Placard 3 puertas, mesada de cocina…"
                  error={errors.titulo?.message}
                />
              </CamposJuntos>

              <CamposJuntos separacion="gap-5" campoMinimo="14rem">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`${idCampos}-presupuesto`} className="text-label text-text-2">
                    Presupuesto
                  </label>
                  <div
                    className={`flex h-15 items-center gap-1.5 rounded-field border px-3.5 ${
                      errors.presupuesto ? 'border-alerta' : 'border-border'
                    } ${hayOpciones ? 'bg-surface' : ''}`}
                  >
                    <span aria-hidden className="text-money-lg text-text-3">
                      $
                    </span>
                    {hayOpciones ? (
                      <output
                        id={`${idCampos}-presupuesto`}
                        className="min-w-0 flex-1 text-money-lg font-semibold text-text-2"
                      >
                        {presupuestoEfectivo === null
                          ? 'Sin definir'
                          : formatearPesos(presupuestoEfectivo)}
                      </output>
                    ) : (
                      <Controller
                        control={control}
                        name="presupuesto"
                        render={({ field }) => (
                          <MoneyInput
                            ref={field.ref}
                            name={field.name}
                            value={field.value}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            id={`${idCampos}-presupuesto`}
                            placeholder="0"
                            className="min-w-0 flex-1 bg-transparent text-money-lg font-semibold outline-none"
                          />
                        )}
                      />
                    )}
                  </div>
                  {errors.presupuesto ? (
                    <span role="alert" className="text-label font-medium text-alerta">
                      {errors.presupuesto.message}
                    </span>
                  ) : (
                    <span className="text-meta text-text-3">
                      {hayOpciones
                        ? 'Sale de la opción que tildes, abajo. Para escribirlo a mano, sacá las opciones.'
                        : 'Dejalo vacío mientras no esté presupuestado.'}
                    </span>
                  )}
                </div>

                <Campo
                  {...register('sena')}
                  etiqueta="Seña propia (%)"
                  className="@min-[29rem]/campos:h-15"
                  inputMode="decimal"
                  placeholder="La del taller"
                  ayuda="Dejalo vacío para pedir la seña de siempre. Completalo solo si a este le pedís otra."
                  error={errors.sena?.message}
                />
              </CamposJuntos>

              <fieldset className="flex flex-col gap-1.5">
                <legend className="mb-1.5 text-label text-text-2">Forma de pago</legend>
                <div className="grid grid-cols-2 gap-1 rounded-panel bg-ink/6 p-1 @sm/datos:grid-cols-4">
                  {FORMAS_EN_ORDEN.map((forma) => (
                    <BotonDeOpcion
                      key={forma}
                      elegido={formaDePago === forma}
                      etiqueta={FORMA_DE_PAGO[forma]}
                      alElegir={() => {
                        setValue('forma_pago', forma, { shouldDirty: true });
                      }}
                    />
                  ))}
                </div>
              </fieldset>

              <div
                data-fila="fechas"
                className="grid grid-cols-1 gap-4 @sm/datos:grid-cols-2 @sm/datos:gap-x-3 @sm/datos:gap-y-1.5 @min-[44rem]/datos:grid-cols-3 @min-[44rem]/datos:gap-x-4"
              >
                <Campo
                  {...register('fecha_inicio')}
                  etiqueta="Fecha de inicio"
                  type="date"
                  error={errors.fecha_inicio?.message}
                  contenedor={FECHA_ALINEADA}
                />
                <Campo
                  {...register('entrega_estimada', {
                    onChange: () => {
                      setEntregaAuto(false);
                    },
                  })}
                  etiqueta="Entrega estimada"
                  type="date"
                  ayuda={entregaAuto ? 'Calculada a 21 días hábiles del inicio.' : undefined}
                  contenedor={FECHA_ALINEADA}
                />
                <Campo
                  {...register('entrega_hora')}
                  etiqueta="Hora de la entrega"
                  type="time"
                  ayuda="Opcional. Con hora, la entrega cae en su renglón del día en la agenda."
                  contenedor={FECHA_ALINEADA}
                />
              </div>

              <CamposJuntos columnas={3} separacion="gap-5">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`${idCampos}-estado`} className="text-label text-text-2">
                    Estado
                  </label>
                  <select
                    {...register('estado')}
                    id={`${idCampos}-estado`}
                    disabled={liquidado}
                    className="h-field rounded-field border border-border bg-paper px-3 text-body-lg text-ink disabled:text-text-3"
                  >
                    {opcionesDeEstado.map((estado) => (
                      <option key={estado} value={estado}>
                        {ESTADO[estado].etiqueta}
                      </option>
                    ))}
                  </select>
                  {liquidado && (
                    <span className="text-meta text-text-3">
                      Un proyecto {ESTADO[proyecto.estado].etiqueta.toLowerCase()} tiene la
                      distribución congelada: su estado se cambia reabriéndolo.
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor={`${idCampos}-direccion`}
                    className="flex items-center justify-between gap-2 text-label text-text-2"
                  >
                    Dirección de entrega
                    {cliente !== undefined && direccion.trim() !== cliente.direccion.trim() && (
                      <button
                        type="button"
                        onClick={() => {
                          setValue('direccion_entrega', cliente.direccion, { shouldDirty: true });
                        }}
                        className="min-h-tap px-1 underline underline-offset-3 @min-[50rem]/campos:-my-3"
                      >
                        Usar la del cliente
                      </button>
                    )}
                  </label>
                  <div className="flex gap-2">
                    <input
                      {...register('direccion_entrega')}
                      id={`${idCampos}-direccion`}
                      placeholder="Calle y número, localidad"
                      className="h-field min-w-0 flex-1 rounded-field border border-border bg-paper px-3.5 text-body-lg text-ink"
                    />
                    <a
                      href={enlaceDeMapa(direccion, '') ?? '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Abrir la dirección en el mapa"
                      aria-disabled={direccion.trim() === '' ? true : undefined}
                      className={`flex size-field flex-none items-center justify-center rounded-pill border border-border ${
                        direccion.trim() === ''
                          ? 'pointer-events-none text-text-3'
                          : 'hover:bg-surface'
                      }`}
                    >
                      <Icono nombre="map-pin" tamano={18} />
                    </a>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor={`${idCampos}-comprobante`}
                    className="flex items-baseline justify-between gap-2 text-label text-text-2"
                  >
                    Comprobante a emitir
                    {comprobanteAuto && cliente !== undefined && (
                      <span className="text-meta text-text-3">
                        Por {CONDICION[cliente.condicion_fiscal].etiqueta.toLowerCase()}
                      </span>
                    )}
                  </label>
                  <select
                    {...register('comprobante', {
                      onChange: () => {
                        setComprobanteAuto(false);
                      },
                    })}
                    id={`${idCampos}-comprobante`}
                    className="h-field rounded-field border border-border bg-paper px-3 text-body-lg text-ink"
                  >
                    {COMPROBANTES_EN_ORDEN.map((comprobante) => (
                      <option key={comprobante} value={comprobante}>
                        {COMPROBANTE[comprobante]}
                      </option>
                    ))}
                  </select>
                </div>
              </CamposJuntos>

              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${idCampos}-notas`} className="text-label text-text-2">
                  Notas de obra
                </label>
                <textarea
                  {...register('notas')}
                  id={`${idCampos}-notas`}
                  rows={3}
                  placeholder="Medidas, qué falta, qué hablar con el cliente…"
                  className="rounded-field border border-border bg-paper px-3.5 py-2.5 text-body-lg text-ink"
                />
              </div>
            </div>

            <div className="flex min-w-0 flex-col gap-3 md:gap-4">
              {liquidado && (
                <div
                  role="alert"
                  className="rounded-panel border border-hairline bg-paper px-4 py-4 text-label leading-snug text-text-2 md:px-5"
                >
                  <p>
                    Este proyecto está {ESTADO[proyecto.estado].etiqueta.toLowerCase()} y su reparto
                    quedó cerrado: sus pagos y sus gastos no se tocan.
                  </p>
                  <Button
                    variant="secundario"
                    size="chico"
                    className="mt-2"
                    onClick={() => {
                      reabrirParaEditar(proyecto);
                    }}
                  >
                    <Icono nombre="arrow-left-right" tamano={16} />
                    {proyecto.estado === 'perdido'
                      ? 'Reactivarlo para poder cargarlo'
                      : 'Reabrir el cobro para corregirlo'}
                  </Button>
                  <p className="mt-1.5 text-meta text-text-3">
                    {proyecto.estado === 'perdido'
                      ? 'Los campos se desbloquean acá mismo. Al guardar te llevo a cerrarlo de nuevo, con la seña repartida contando lo que cargaste.'
                      : 'Los campos se desbloquean acá mismo. Al guardar te llevo a cobrarlo de nuevo, con el reparto rehecho.'}
                  </p>
                </div>
              )}
              <FilasDeOpciones
                control={control}
                register={register}
                errores={errors}
                campos={opciones}
                bloqueado={false}
              />
              <FilasDinamicas
                lista="pagos"
                titulo="Pagos recibidos"
                etiquetaDelDetalle="Concepto"
                placeholderDelDetalle="Seña, adelanto, saldo…"
                textoDeAgregar="Agregar un pago"
                ayuda="Lo que te pagó el cliente por este trabajo. Entra a la caja del taller."
                vacio="Todavía no cobraste nada de este trabajo. La seña suele ir primero."
                control={control}
                register={register}
                errores={errors}
                campos={pagos}
                bloqueado={liquidado}
                apertura={aperturaDeLaReplica(replica)}
              />
              <FilasDinamicas
                lista="gastos"
                titulo="Gastos e insumos"
                etiquetaDelDetalle="Descripción"
                placeholderDelDetalle="Melamina, herrajes, flete…"
                textoDeAgregar="Agregar un gasto"
                ayuda="Materiales y compras de este mueble. Se descuentan de la ganancia."
                vacio="Todavía no cargaste gastos para este mueble."
                control={control}
                register={register}
                errores={errors}
                campos={gastos}
                bloqueado={liquidado}
              />
            </div>
          </SeccionesEnFilas>
        </div>

        <footer className="flex-none border-t border-hairline bg-mesa md:sticky md:bottom-0 md:z-20">
          <div className="@container/barra mx-auto flex w-full max-w-content flex-wrap items-center gap-3 px-(--page-pad-mobile) py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] md:px-(--page-pad-tablet) md:py-3.5 lg:px-(--page-pad-desktop)">
            {rechazo !== null && (
              <p role="alert" className="basis-full text-label font-medium text-alerta">
                {mensajeDeSincronizacion(rechazo, {
                  operacion: 'proyecto',
                  sujeto: proyecto?.titulo,
                  estado: proyecto?.estado === 'perdido' ? 'perdido' : 'cobrado',
                })}
              </p>
            )}
            <dl className="grid w-full grid-cols-2 gap-x-4 gap-y-1 tabular-nums @min-[21rem]/barra:flex @min-[21rem]/barra:w-auto @min-[21rem]/barra:min-w-[210px] @min-[21rem]/barra:flex-1 md:gap-6 lg:gap-8">
              <Total
                etiqueta="Presupuesto"
                valor={presupuestoEfectivo === null ? '—' : formatearPesos(presupuestoEfectivo)}
              />
              <Total etiqueta="Cobrado" valor={formatearPesos(totalCobrado)} tono="text-hogar" />
              <Total etiqueta="Saldo" valor={saldo === null ? '—' : formatearPesos(saldo)} />
              <Total
                etiqueta="Neta"
                valor={formatearPesos(neta)}
                tono={neta < 0 ? 'text-alerta' : 'text-maun'}
              />
            </dl>
            <Button
              type="submit"
              cargando={guardar.isPending}
              className="min-w-[170px] flex-1 md:flex-none"
            >
              {proyecto === undefined ? 'Guardar proyecto' : 'Guardar los cambios'}
            </Button>
          </div>
        </footer>
      </form>
    </div>
  );
}

function Total({ etiqueta, valor, tono = '' }: { etiqueta: string; valor: string; tono?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-meta text-text-3 lg:text-label">{etiqueta}</dt>
      <dd
        className={`text-label font-semibold whitespace-nowrap md:text-body-lg lg:text-money-lg ${tono}`}
      >
        {valor}
      </dd>
    </div>
  );
}

function BotonDeOpcion({
  elegido,
  etiqueta,
  alElegir,
}: {
  elegido: boolean;
  etiqueta: string;
  alElegir: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={elegido}
      onClick={alElegir}
      className={`min-h-tap rounded-[16px] text-label ${
        elegido ? 'bg-elevado font-semibold text-ink shadow-float' : 'font-medium text-text-2'
      }`}
    >
      {etiqueta}
    </button>
  );
}
