import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';

import {
  aprobacionDeUnaOpcion,
  MUTACION_DE_PROYECTO,
  opcionAprobada,
  opcionesDelProyecto,
  rutaDeEdicion,
  type OpcionDePresupuesto,
  type Proyecto,
} from '@/entities/proyecto';
import { useReplicaDelTaller } from '@/entities/replica';
import { avisarEnPantalla, formatearPesos, metaDeAvisos } from '@/shared/lib';
import { Button, Icono } from '@/shared/ui';

export interface OpcionesDelTrabajoProps {
  proyecto: Proyecto;
  ofreceCargarLaPrimera?: boolean;
}

export function OpcionesDelTrabajo({
  proyecto,
  ofreceCargarLaPrimera = false,
}: OpcionesDelTrabajoProps) {
  const replica = useReplicaDelTaller();
  const navegar = useNavigate();
  const opciones = opcionesDelProyecto(replica, proyecto.id);

  const ultimo = useRef({ proyecto, opciones });
  useEffect(() => {
    ultimo.current = { proyecto, opciones };
  });

  const guardar = useMutation({
    ...MUTACION_DE_PROYECTO,
    meta: metaDeAvisos('proyectoGuardado', { silencioso: true }),
  });

  if (opciones.length === 0) {
    if (!ofreceCargarLaPrimera) return null;
    return (
      <section aria-label="Opciones de presupuesto">
        <h2 className="text-section font-semibold">Opciones de presupuesto</h2>
        <p className="mt-1.5 text-meta leading-normal text-text-3">
          Si le presentás más de una variante, cargá cada una con su importe. Cuando elija, tildás
          la que aprobó.
        </p>
        <Button
          variant="secundario"
          className="mt-2.5"
          onClick={() => {
            void navegar(rutaDeEdicion(proyecto.id), { state: { primeraOpcion: true } });
          }}
        >
          <Icono nombre="plus" tamano={16} />
          Cargar las opciones
        </Button>
      </section>
    );
  }

  const aprobada = opcionAprobada(opciones);

  function tildar(id: string, valor: boolean): void {
    const actual = ultimo.current;
    guardar.mutate(aprobacionDeUnaOpcion(actual.proyecto, actual.opciones, id, valor));
  }

  function alTildar(opcion: OpcionDePresupuesto, valor: boolean): void {
    const previo = opcionAprobada(ultimo.current.opciones);
    tildar(opcion.id, valor);

    avisarEnPantalla({
      clave: `opcion:${proyecto.id}`,
      tono: 'hecho',
      texto: valor
        ? `Aprobaste ${formatearPesos(opcion.monto_centavos)}: es el presupuesto del trabajo.`
        : 'Sacaste la aprobación: el trabajo queda sin presupuesto.',
      accion: {
        etiqueta: 'Deshacer',
        alTocar: () => {
          if (previo === undefined) tildar(opcion.id, false);
          else tildar(previo.id, true);
        },
      },
    });
  }

  return (
    <section aria-label="Opciones de presupuesto">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <h2 className="text-section font-semibold">Opciones de presupuesto</h2>
        <span className="text-label text-text-2 tabular-nums">
          {opciones.length === 1 ? '1 opción' : `${String(opciones.length)} opciones`}
        </span>
      </div>
      <p className="mb-1 text-meta leading-normal text-text-3">
        {aprobada === undefined
          ? 'Tildá la que te aprobaron y ese importe pasa a ser el presupuesto del trabajo.'
          : 'Las que no eligió quedan acá, para saber qué le ofreciste.'}
      </p>

      <ul className="list-none">
        {opciones.map((opcion) => {
          const esLaAprobada = opcion.aprobada;
          return (
            <li
              key={opcion.id}
              className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t py-2.5 ${
                esLaAprobada ? 'border-hogar' : 'border-hairline'
              }`}
            >
              <span className="min-w-0 flex-1 basis-[12rem]">
                <span className="block text-body-lg leading-snug font-medium">
                  {opcion.descripcion.trim() === '' ? 'Opción sin detalle' : opcion.descripcion}
                </span>
                {esLaAprobada && (
                  <span className="mt-0.5 flex items-center gap-1 text-meta font-semibold text-hogar">
                    <Icono nombre="check" tamano={14} />
                    Aprobada: es el presupuesto del trabajo
                  </span>
                )}
              </span>
              <span
                className={`flex-none text-money font-semibold tabular-nums ${
                  esLaAprobada ? 'text-hogar' : ''
                }`}
              >
                {formatearPesos(opcion.monto_centavos)}
              </span>
              <button
                type="button"
                aria-pressed={esLaAprobada}
                onClick={() => {
                  alTildar(opcion, !esLaAprobada);
                }}
                className={`flex min-h-tap flex-none items-center gap-1.5 rounded-field border px-3 text-label font-medium ${
                  esLaAprobada
                    ? 'border-hogar bg-hogar-tint text-hogar'
                    : 'border-border text-text-2 hover:bg-surface'
                }`}
              >
                <Icono nombre={esLaAprobada ? 'check' : 'plus'} tamano={16} />
                {esLaAprobada ? 'Aprobada' : 'La aprobó'}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
