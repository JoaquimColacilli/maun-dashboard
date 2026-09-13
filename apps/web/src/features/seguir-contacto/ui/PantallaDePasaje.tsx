import { entregaEstimada } from '@maun/domain';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useId, useState, type SyntheticEvent } from 'react';
import { Link, useNavigate } from 'react-router';

import { CONDICION } from '@/entities/cliente';
import {
  COMPROBANTE,
  COMPROBANTES_EN_ORDEN,
  comprobanteDeLaCondicion,
  datosActualesDelProyecto,
  FORMA_DE_PAGO,
  FORMAS_EN_ORDEN,
  MUTACION_DE_PROYECTO,
  rutaDelProyecto,
  ultimoContactoAlGuardar,
  type Comprobante,
  type FormaDePago,
  type ResumenDeProyecto,
} from '@/entities/proyecto';
import { mensajeDeSincronizacion } from '@/shared/api';
import { formatearPesos, hoyLocal } from '@/shared/lib';
import { Button, Campo, Icono, MoneyInput, Pagina } from '@/shared/ui';

export interface PantallaDePasajeProps {
  resumen: ResumenDeProyecto;
}

export function PantallaDePasaje({ resumen }: PantallaDePasajeProps) {
  const navegar = useNavigate();
  const idCampos = useId();
  const { proyecto, cliente } = resumen;
  const hoy = hoyLocal();

  const guardar = useMutation(MUTACION_DE_PROYECTO);
  const [rechazo, setRechazo] = useState<unknown>(null);

  const [presupuesto, setPresupuesto] = useState<number | null>(proyecto.presupuesto_centavos);
  const [errorDelPresupuesto, setErrorDelPresupuesto] = useState<string | undefined>(undefined);
  const [forma, setForma] = useState<FormaDePago>(proyecto.forma_pago ?? 'transferencia');
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

  const saldo = Math.max(0, (presupuesto ?? 0) - resumen.cobrado);

  useEffect(() => {
    if (guardar.isPaused) {
      void navegar(rutaDelProyecto(proyecto.id), {
        replace: true,
        state: { recienAprobado: true },
      });
    }
  }, [guardar.isPaused, navegar, proyecto.id]);

  function aprobar(evento: SyntheticEvent<HTMLFormElement>): void {
    evento.preventDefault();
    if (presupuesto === null) {
      setErrorDelPresupuesto('Poné el presupuesto que aprobó, en pesos.');
      return;
    }

    setErrorDelPresupuesto(undefined);
    setRechazo(null);
    guardar.mutate(
      {
        pedido: {
          id: proyecto.id,
          version: proyecto.version,
          datos: {
            ...datosActualesDelProyecto(proyecto),
            estado: 'en_curso',
            ultimo_contacto: ultimoContactoAlGuardar(proyecto, 'en_curso', hoy),
            presupuesto_centavos: presupuesto,
            forma_pago: forma,
            comprobante,
            fecha_inicio: inicio === '' ? null : inicio,
            entrega_estimada: entrega === '' ? null : entrega,
            direccion_entrega: direccion.trim(),
          },
          pagos: [],
          gastos: [],
        },
        previos: { proyecto, pagos: [], gastos: [] },
      },
      {
        onSuccess: () => {
          void navegar(rutaDelProyecto(proyecto.id), {
            replace: true,
            state: { recienAprobado: true },
          });
        },
        onError: setRechazo,
      },
    );
  }

  return (
    <Pagina className="[&>*]:max-w-[720px]">
      <Link
        to={rutaDelProyecto(proyecto.id)}
        className="mb-2.5 flex min-h-tap w-fit items-center gap-1 rounded-field pr-2 text-body font-medium text-text-2 hover:bg-surface"
      >
        <Icono nombre="chevron-left" tamano={20} />
        Volver sin aprobar
      </Link>

      <header>
        <p aria-hidden className="mb-2 flex items-center gap-1.5 text-meta text-text-2">
          <span className="rounded-control border border-border px-1.5">Seguimiento</span>
          <Icono nombre="chevron-right" tamano={14} />
          <span className="rounded-control border border-ink px-1.5 font-semibold text-ink">
            Activos
          </span>
        </p>
        <p className="text-label text-text-2">{resumen.nombreDelCliente}</p>
        <h1 className="mt-0.5 font-display text-h1 leading-tight lg:text-h1-lg">
          Pasar «{proyecto.titulo}» a Proyectos
        </h1>
        <p className="mt-1.5 max-w-[560px] text-body leading-relaxed text-text-2">
          Lo aprobó: ahora sí van los datos de la obra. Lo que ya cobraste no se vuelve a cargar,
          sigue siendo el mismo pago.
        </p>
      </header>

      <form noValidate onSubmit={aprobar} className="@container mt-5 flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${idCampos}-presupuesto`} className="text-label text-text-2">
            Presupuesto aprobado
          </label>
          <div
            className={`flex h-15 items-center gap-1.5 rounded-field border px-3.5 ${
              errorDelPresupuesto === undefined ? 'border-ink' : 'border-alerta'
            }`}
          >
            <span aria-hidden className="text-money-lg text-text-3">
              $
            </span>
            <MoneyInput
              id={`${idCampos}-presupuesto`}
              placeholder="0"
              value={presupuesto}
              aria-invalid={errorDelPresupuesto === undefined ? undefined : true}
              aria-describedby={
                errorDelPresupuesto === undefined ? undefined : `${idCampos}-presupuesto-error`
              }
              onChange={(centavos) => {
                setPresupuesto(centavos);
                setErrorDelPresupuesto(undefined);
              }}
              className="min-w-0 flex-1 bg-transparent text-money-lg font-semibold outline-none"
            />
          </div>
          {errorDelPresupuesto !== undefined && (
            <span
              id={`${idCampos}-presupuesto-error`}
              role="alert"
              className="text-label font-medium text-alerta"
            >
              {errorDelPresupuesto}
            </span>
          )}
        </div>

        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 rounded-field bg-surface px-3.5 py-3 text-body tabular-nums">
          <dt className="text-text-2">Seña ya cobrada</dt>
          <dd className="text-right font-medium text-hogar">{formatearPesos(resumen.cobrado)}</dd>
          <dt className="text-text-2">Saldo a cobrar</dt>
          <dd className="text-right font-semibold">{formatearPesos(saldo)}</dd>
          {resumen.gastos > 0 && (
            <>
              <dt className="text-text-2">Gastos ya cargados</dt>
              <dd className="text-right font-medium">{formatearPesos(resumen.gastos)}</dd>
            </>
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

        <div className="grid grid-cols-1 gap-4 @sm:grid-cols-2 @sm:gap-x-3 @sm:gap-y-1.5">
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
