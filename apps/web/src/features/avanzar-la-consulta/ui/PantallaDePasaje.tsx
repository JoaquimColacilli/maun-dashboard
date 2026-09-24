import { entregaEstimada, esAnteriorALaApertura, porcentajeDeLaSena } from '@maun/domain';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState, type SyntheticEvent } from 'react';

import { CONDICION, EnlaceACliente } from '@/entities/cliente';
import { CasillaDeLaApertura } from '@/entities/movimiento';
import {
  COMPROBANTE,
  COMPROBANTES_EN_ORDEN,
  comprobanteDeLaCondicion,
  FORMA_DE_PAGO,
  FORMAS_EN_ORDEN,
  formasDelTrabajo,
  MUTACION_DE_PROYECTO,
  opcionAprobada,
  rutaDeEdicion,
  rutaDelProyecto,
  senaDelProyecto,
  senaDelTaller,
  type Comprobante,
  type FormaDePago,
  type OpcionDePresupuesto,
  type ResumenDeProyecto,
} from '@/entities/proyecto';
import { useReplicaDelTaller } from '@/entities/replica';
import { ajustesDe, aperturaDeLaReplica, mensajeDeSincronizacion } from '@/shared/api';
import {
  errorDeLaFechaDeLaPlata,
  formatearPesos,
  formatearPorcentaje,
  hoyEnElTaller,
  uuidv7,
  Ir,
  useIr,
  useVolver,
} from '@/shared/lib';
import { Button, Campo, CamposJuntos, Icono, MoneyInput, Pagina } from '@/shared/ui';

import {
  errorDelPasaje,
  formaSugerida,
  guardadoDelPasaje,
  haySenaAhora,
  presupuestoDelPasaje,
  resumenDelPasaje,
  senaDelPasaje,
  senaSugerida,
} from '../model/pasaje';

export interface PantallaDePasajeProps {
  resumen: ResumenDeProyecto;
  opciones: readonly OpcionDePresupuesto[];
}

const CIFRA = 'contents @min-[44rem]:flex @min-[44rem]:flex-col @min-[44rem]:gap-0.5';

export function PantallaDePasaje({ resumen, opciones }: PantallaDePasajeProps) {
  const ir = useIr();
  const idCampos = useId();
  const replica = useReplicaDelTaller();
  const { proyecto, cliente } = resumen;
  const vuelta = useVolver(rutaDelProyecto(proyecto.id), 'Volver sin aprobar', { fija: true });
  const hoy = hoyEnElTaller();
  const apertura = aperturaDeLaReplica(replica);

  const guardar = useMutation(MUTACION_DE_PROYECTO);
  const [rechazo, setRechazo] = useState<unknown>(null);

  const [presupuesto, setPresupuesto] = useState<number | null>(proyecto.presupuesto_centavos);
  const [opcion, setOpcion] = useState<string | null>(() => opcionAprobada(opciones)?.id ?? null);
  const [falta, setFalta] = useState<string | undefined>(undefined);
  const primeraOpcion = useRef<HTMLInputElement>(null);
  const campoDelPresupuesto = useRef<HTMLInputElement>(null);
  const [forma, setForma] = useState<FormaDePago>(() =>
    formaSugerida(proyecto.forma_pago, formasDelTrabajo(proyecto, 'sena', ajustesDe(replica))),
  );
  const [inicio, setInicio] = useState(proyecto.fecha_inicio ?? hoy);
  const [entrega, setEntrega] = useState(
    () => proyecto.entrega_estimada ?? entregaEstimada(proyecto.fecha_inicio ?? hoy),
  );
  const [entregaAuto, setEntregaAuto] = useState(proyecto.entrega_estimada === null);
  const [direccion, setDireccion] = useState(
    proyecto.direccion_entrega.trim() === ''
      ? (cliente?.direccion ?? '')
      : proyecto.direccion_entrega,
  );
  const [comprobante, setComprobante] = useState<Comprobante>(
    proyecto.comprobante === 'sin_comprobante' && cliente !== undefined
      ? comprobanteDeLaCondicion(cliente.condicion_fiscal)
      : proyecto.comprobante,
  );

  const hayOpciones = opciones.length > 0;
  const aprobado = presupuestoDelPasaje(opciones, { presupuesto, opcion });

  const porcentaje = porcentajeDeLaSena(
    senaDelProyecto(proyecto),
    senaDelTaller(ajustesDe(replica)),
  );
  const esperada = senaDelPasaje(
    aprobado,
    resumen.cobrado,
    senaDelTaller(ajustesDe(replica)),
    senaDelProyecto(proyecto),
  );
  const [sena, setSena] = useState<number | null>(() => senaSugerida(esperada));
  const [senaAMano, setSenaAMano] = useState(false);
  const cuenta = resumenDelPasaje(aprobado, resumen.cobrado, sena);
  const [idDelPago] = useState(uuidv7);
  const [diaDeLaSena, setDiaDeLaSena] = useState(hoy);
  const [senaMarcada, setSenaMarcada] = useState(true);
  const [errorDelDia, setErrorDelDia] = useState<string | undefined>(undefined);
  const campoDelDia = useRef<HTMLInputElement>(null);

  function elegirOpcion(id: string): void {
    setOpcion(id);
    setFalta(undefined);
    if (senaAMano) return;
    const otra = opciones.find((una) => una.id === id);
    setSena(
      senaSugerida(
        senaDelPasaje(
          otra?.monto_centavos ?? null,
          resumen.cobrado,
          senaDelTaller(ajustesDe(replica)),
          senaDelProyecto(proyecto),
        ),
      ),
    );
  }

  useEffect(() => {
    if (guardar.isPaused) {
      ir(rutaDelProyecto(proyecto.id), { como: 'terminar', senal: 'recienAprobado' });
    }
  }, [guardar.isPaused, ir, proyecto.id]);

  function aprobar(evento: SyntheticEvent<HTMLFormElement>): void {
    evento.preventDefault();
    const encontrado = errorDelPasaje(opciones, { presupuesto, opcion });
    setFalta(encontrado);
    if (encontrado !== undefined) {
      (hayOpciones ? primeraOpcion : campoDelPresupuesto).current?.focus();
      return;
    }
    const delDia = haySenaAhora(sena) ? errorDeLaFechaDeLaPlata(diaDeLaSena, hoy) : undefined;
    setErrorDelDia(delDia);
    if (delDia !== undefined) {
      campoDelDia.current?.focus();
      return;
    }

    setRechazo(null);
    guardar.mutate(
      guardadoDelPasaje(
        proyecto,
        opciones,
        {
          presupuesto,
          opcion,
          sena,
          forma,
          comprobante,
          inicio,
          entrega,
          direccion,
          diaDeLaSena,
          senaEnLaApertura: esAnteriorALaApertura(diaDeLaSena, apertura) && senaMarcada,
        },
        hoy,
        idDelPago,
      ),
      {
        onSuccess: () => {
          ir(rutaDelProyecto(proyecto.id), { como: 'terminar', senal: 'recienAprobado' });
        },
        onError: setRechazo,
      },
    );
  }

  const campoDeLaSena = (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={`${idCampos}-sena`}
        className="flex items-baseline justify-between gap-2 text-label text-text-2"
      >
        Seña que cobrás ahora
        <span className="text-meta text-text-3">
          {formatearPorcentaje(porcentaje)}% del presupuesto
        </span>
      </label>
      <div className="flex h-15 items-center gap-1.5 rounded-field border border-border px-3.5">
        <span aria-hidden className="text-money-lg text-text-3">
          $
        </span>
        <MoneyInput
          id={`${idCampos}-sena`}
          placeholder="0"
          value={sena}
          aria-describedby={`${idCampos}-sena-ayuda`}
          onChange={(centavos) => {
            setSena(centavos);
            setSenaAMano(true);
          }}
          className="min-w-0 flex-1 bg-transparent text-money-lg font-semibold outline-none"
        />
      </div>
      <p id={`${idCampos}-sena-ayuda`} className="text-meta leading-normal text-text-3">
        {esperada.situacion === 'cubierta'
          ? `Con lo que ya cobraste la seña está cubierta. Dejalo en blanco si hoy no cobrás nada más.`
          : `Entra como un pago del trabajo, con el día en que te la dieron y la forma de pago de acá. Si todavía no cobraste, dejalo en blanco.`}
      </p>
      {haySenaAhora(sena) && (
        <>
          <Campo
            ref={campoDelDia}
            etiqueta="Día en que entró la seña"
            type="date"
            contenedor="mt-2"
            max={hoy}
            value={diaDeLaSena}
            error={errorDelDia}
            onChange={(evento) => {
              setDiaDeLaSena(evento.target.value);
              setErrorDelDia(undefined);
            }}
          />
          <CasillaDeLaApertura
            fecha={diaDeLaSena}
            apertura={apertura}
            marcada={senaMarcada}
            alCambiar={setSenaMarcada}
          />
        </>
      )}
    </div>
  );

  return (
    <Pagina>
      <Ir
        a={rutaDelProyecto(proyecto.id)}
        alTocar={vuelta.volver}
        className="mb-2.5 flex min-h-tap w-fit items-center gap-1 rounded-field pr-2 text-body font-medium text-text-2 hover:bg-surface"
      >
        <Icono nombre="chevron-left" tamano={20} />
        {vuelta.etiqueta}
      </Ir>

      <header>
        <p aria-hidden className="mb-2 flex items-center gap-1.5 text-meta text-text-2">
          <span className="rounded-control border border-border px-1.5">Consultas</span>
          <Icono nombre="chevron-right" tamano={14} />
          <span className="rounded-control border border-ink px-1.5 font-semibold text-ink">
            Activos
          </span>
        </p>
        <p className="text-label text-text-2">
          {cliente === undefined ? (
            resumen.nombreDelCliente
          ) : (
            <EnlaceACliente id={cliente.id} nombre={cliente.nombre} />
          )}
        </p>
        <h1 className="mt-0.5 font-display text-h1 leading-tight lg:text-h1-lg">
          Pasar «{proyecto.titulo}» a Proyectos
        </h1>
        <p className="mt-1.5 max-w-[560px] text-body leading-relaxed text-text-2">
          Lo aprobó: ahora sí van los datos de la obra. Lo que ya cobraste no se vuelve a cargar,
          sigue siendo el mismo pago.
        </p>
      </header>

      <form noValidate onSubmit={aprobar} className="@container mt-5 flex flex-col gap-5">
        {hayOpciones ? (
          <fieldset
            aria-describedby={
              falta === undefined
                ? `${idCampos}-opciones-ayuda`
                : `${idCampos}-opciones-ayuda ${idCampos}-opciones-error`
            }
            className="flex flex-col gap-1.5"
          >
            <legend className="mb-1.5 text-label text-text-2">Qué opción aprobó</legend>
            <div className="flex flex-col gap-2">
              {opciones.map((una, indice) => (
                <label
                  key={una.id}
                  className={`flex min-h-tap cursor-pointer items-center gap-3 rounded-field border px-3.5 py-3 has-checked:border-ink has-checked:bg-surface ${
                    falta === undefined ? 'border-border' : 'border-alerta'
                  }`}
                >
                  <input
                    ref={indice === 0 ? primeraOpcion : undefined}
                    type="radio"
                    name={`${idCampos}-opcion`}
                    value={una.id}
                    checked={opcion === una.id}
                    onChange={() => {
                      elegirOpcion(una.id);
                    }}
                    className="size-5 flex-none accent-ink"
                  />
                  <span className="min-w-0 flex-1 text-body-lg leading-snug font-medium">
                    {una.descripcion.trim() === '' ? 'Opción sin detalle' : una.descripcion}
                  </span>
                  <span className="flex-none text-money font-semibold tabular-nums">
                    {formatearPesos(una.monto_centavos)}
                  </span>
                </label>
              ))}
            </div>
            <p id={`${idCampos}-opciones-ayuda`} className="text-meta leading-normal text-text-3">
              El presupuesto del trabajo es el importe de la que elijas. Si aprobó otro importe,{' '}
              <Ir
                a={rutaDeEdicion(proyecto.id)}
                className="font-medium text-text-2 underline underline-offset-3"
              >
                corregí la opción
              </Ir>{' '}
              antes de pasarlo.
            </p>
            {falta !== undefined && (
              <span
                id={`${idCampos}-opciones-error`}
                role="alert"
                className="text-label font-medium text-alerta"
              >
                {falta}
              </span>
            )}
          </fieldset>
        ) : (
          <CamposJuntos separacion="gap-5">
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${idCampos}-presupuesto`} className="text-label text-text-2">
                Presupuesto aprobado
              </label>
              <div
                className={`flex h-15 items-center gap-1.5 rounded-field border px-3.5 ${
                  falta === undefined ? 'border-ink' : 'border-alerta'
                }`}
              >
                <span aria-hidden className="text-money-lg text-text-3">
                  $
                </span>
                <MoneyInput
                  ref={campoDelPresupuesto}
                  id={`${idCampos}-presupuesto`}
                  placeholder="0"
                  value={presupuesto}
                  aria-invalid={falta === undefined ? undefined : true}
                  aria-describedby={
                    falta === undefined ? undefined : `${idCampos}-presupuesto-error`
                  }
                  onChange={(centavos) => {
                    setPresupuesto(centavos);
                    setFalta(undefined);
                    if (!senaAMano) {
                      setSena(
                        senaSugerida(
                          senaDelPasaje(
                            centavos,
                            resumen.cobrado,
                            senaDelTaller(ajustesDe(replica)),
                            senaDelProyecto(proyecto),
                          ),
                        ),
                      );
                    }
                  }}
                  className="min-w-0 flex-1 bg-transparent text-money-lg font-semibold outline-none"
                />
              </div>
              {falta !== undefined && (
                <span
                  id={`${idCampos}-presupuesto-error`}
                  role="alert"
                  className="text-label font-medium text-alerta"
                >
                  {falta}
                </span>
              )}
            </div>
            {campoDeLaSena}
          </CamposJuntos>
        )}
        {hayOpciones && campoDeLaSena}

        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 rounded-field bg-surface px-3.5 py-3 text-body tabular-nums @min-[44rem]:auto-cols-fr @min-[44rem]:grid-flow-col @min-[44rem]:grid-cols-none @min-[44rem]:gap-x-6">
          {hayOpciones && (
            <div className={CIFRA}>
              <dt className="text-text-2">Presupuesto aprobado</dt>
              <dd className="text-right font-semibold @min-[44rem]:text-left">
                {aprobado === null ? '—' : formatearPesos(aprobado)}
              </dd>
            </div>
          )}
          <div className={CIFRA}>
            <dt className="text-text-2">Ya cobrado antes</dt>
            <dd className="text-right font-medium text-hogar @min-[44rem]:text-left">
              {formatearPesos(cuenta.antes)}
            </dd>
          </div>
          <div className={CIFRA}>
            <dt className="text-text-2">Seña que cobrás ahora</dt>
            <dd className="text-right font-medium text-hogar @min-[44rem]:text-left">
              {formatearPesos(cuenta.ahora)}
            </dd>
          </div>
          <div className={CIFRA}>
            <dt className="text-text-2">Cobrado en total</dt>
            <dd className="text-right font-semibold text-hogar @min-[44rem]:text-left">
              {formatearPesos(cuenta.cobrado)}
            </dd>
          </div>
          <div className={CIFRA}>
            <dt className="text-text-2">Saldo a cobrar</dt>
            <dd className="text-right font-semibold @min-[44rem]:text-left">
              {cuenta.saldo === null ? '—' : formatearPesos(cuenta.saldo)}
            </dd>
          </div>
          {resumen.gastos > 0 && (
            <div className={CIFRA}>
              <dt className="text-text-2">Gastos ya cargados</dt>
              <dd className="text-right font-medium @min-[44rem]:text-left">
                {formatearPesos(resumen.gastos)}
              </dd>
            </div>
          )}
        </dl>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-label text-text-2">Forma de pago</legend>
          <div className="grid grid-cols-2 gap-0.5 rounded-field bg-surface p-1 @sm:grid-cols-4">
            {FORMAS_EN_ORDEN.map((opcion) => (
              <button
                key={opcion}
                type="button"
                role="radio"
                aria-checked={forma === opcion}
                onClick={() => {
                  setForma(opcion);
                }}
                className={`min-h-tap rounded-control text-label ${
                  forma === opcion
                    ? 'bg-elevado font-semibold text-ink shadow-float'
                    : 'font-medium text-text-2'
                }`}
              >
                {FORMA_DE_PAGO[opcion]}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="grid grid-cols-1 gap-4 @sm:grid-cols-2 @sm:gap-x-4 @sm:gap-y-1.5">
          <Campo
            etiqueta="Fecha de inicio"
            type="date"
            contenedor="@sm:row-span-3 @sm:grid @sm:grid-rows-subgrid"
            value={inicio}
            onChange={(evento) => {
              setInicio(evento.target.value);
              if (entregaAuto && evento.target.value !== '') {
                setEntrega(entregaEstimada(evento.target.value));
              }
            }}
          />
          <Campo
            etiqueta="Entrega estimada"
            type="date"
            contenedor="@sm:row-span-3 @sm:grid @sm:grid-rows-subgrid"
            value={entrega}
            ayuda={entregaAuto ? 'Calculada a 21 días hábiles del inicio.' : undefined}
            onChange={(evento) => {
              setEntrega(evento.target.value);
              setEntregaAuto(false);
            }}
          />
        </div>

        <CamposJuntos separacion="gap-5">
          <Campo
            etiqueta="Dirección de entrega"
            placeholder="Calle y número, localidad"
            maxLength={500}
            value={direccion}
            onChange={(evento) => {
              setDireccion(evento.target.value);
            }}
          />

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={`${idCampos}-comprobante`}
              className="flex items-baseline justify-between gap-2 text-label text-text-2"
            >
              Comprobante a emitir
              {cliente !== undefined && (
                <span className="text-meta text-text-3">
                  {CONDICION[cliente.condicion_fiscal].etiqueta}
                </span>
              )}
            </label>
            <select
              id={`${idCampos}-comprobante`}
              value={comprobante}
              onChange={(evento) => {
                setComprobante(evento.target.value as Comprobante);
              }}
              className="h-field rounded-field border border-border bg-paper px-3 text-body-lg text-ink"
            >
              {COMPROBANTES_EN_ORDEN.map((opcion) => (
                <option key={opcion} value={opcion}>
                  {COMPROBANTE[opcion]}
                </option>
              ))}
            </select>
          </div>
        </CamposJuntos>

        <div>
          <Button
            type="submit"
            className="w-full sm:w-auto"
            cargando={guardar.isPending && !guardar.isPaused}
          >
            <Icono nombre="hammer" tamano={18} />
            Pasar a Proyectos
          </Button>
          {rechazo !== null && (
            <p role="alert" className="mt-2 text-label font-medium text-alerta">
              {mensajeDeSincronizacion(rechazo, {
                operacion: 'proyecto',
                sujeto: proyecto.titulo,
              })}
            </p>
          )}
        </div>
      </form>
    </Pagina>
  );
}
