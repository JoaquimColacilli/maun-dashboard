import { useEffect, useRef, useState } from 'react';
import type { Control, FieldErrors, UseFieldArrayReturn, UseFormRegister } from 'react-hook-form';
import { Controller, useWatch } from 'react-hook-form';

import {
  conLaOpcionAprobada,
  opcionVacia,
  type FilaDeOpcion,
  type FormularioDeProyecto,
} from '@/entities/proyecto';
import { formatearPesos, uuidv7 } from '@/shared/lib';
import { Button, Icono, MoneyInput } from '@/shared/ui';

export interface FilasDeOpcionesProps {
  control: Control<FormularioDeProyecto>;
  register: UseFormRegister<FormularioDeProyecto>;
  errores: FieldErrors<FormularioDeProyecto>;
  campos: UseFieldArrayReturn<FormularioDeProyecto, 'opciones', 'clave'>;
  bloqueado: boolean;
}

interface Deshacer {
  indice: number;
  fila: FilaDeOpcion;
  descripcion: string;
}

export function FilasDeOpciones({
  control,
  register,
  errores,
  campos,
  bloqueado,
}: FilasDeOpcionesProps) {
  const [deshacer, setDeshacer] = useState<Deshacer | null>(null);
  const contenedor = useRef<HTMLDivElement>(null);

  const filas = useWatch({ control, name: 'opciones' });
  const aprobada = filas.find((fila) => fila.aprobada);

  useEffect(() => {
    if (deshacer === null) return;
    const reloj = setTimeout(() => {
      setDeshacer(null);
    }, 7000);
    return () => {
      clearTimeout(reloj);
    };
  }, [deshacer]);

  function agregar(): void {
    const nueva = opcionVacia(uuidv7());
    campos.append(nueva);
    requestAnimationFrame(() => {
      contenedor.current
        ?.querySelector(`[data-opcion="${nueva.id}"]`)
        ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  }

  function quitar(indice: number): void {
    const fila = filas[indice];
    const tieneDatos = fila !== undefined && (fila.detalle.trim() !== '' || (fila.monto ?? 0) > 0);

    if (fila !== undefined && tieneDatos) {
      setDeshacer({
        indice,
        fila,
        descripcion:
          fila.detalle.trim() === ''
            ? fila.monto === null
              ? 'la opción'
              : formatearPesos(fila.monto)
            : fila.detalle.trim(),
      });
    }
    campos.remove(indice);
  }

  function tildar(id: string, valor: boolean): void {
    campos.replace(conLaOpcionAprobada(filas, id, valor));
  }

  const erroresDeLista = errores.opciones;

  return (
    <section
      aria-label="Opciones de presupuesto"
      className="@container/opciones flex flex-col gap-2"
      ref={contenedor}
    >
      <div className="flex flex-col gap-0.5 bg-paper md:sticky md:top-17 md:z-10 md:border-b md:border-hairline-soft md:pt-3 md:pb-2">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-section font-semibold">Opciones de presupuesto</h2>
          <span role="status" className="text-label text-text-2 tabular-nums">
            {aprobada === undefined || aprobada.monto === null
              ? ''
              : `Aprobada: ${formatearPesos(aprobada.monto)}`}
          </span>
        </div>
        <p className="text-meta leading-normal text-text-3">
          Los presupuestos que le presentaste. Tildá el que te aprobó y ese pasa a ser el
          presupuesto del trabajo.
        </p>
      </div>

      {campos.fields.length === 0 && (
        <p className="text-label text-text-2">
          Sin opciones. Si le pasás un solo precio, cargalo arriba en Presupuesto.
        </p>
      )}

      <ul className="flex list-none flex-col">
        {campos.fields.map((campo, indice) => {
          const errorDeFila = erroresDeLista?.[indice];
          const estaAprobada = filas[indice]?.aprobada ?? false;
          return (
            <li
              key={campo.clave}
              data-opcion={campo.id}
              className={`grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_44px] items-center gap-2 border-t py-2.5 @lg/opciones:grid-cols-[minmax(0,1fr)_10.5rem_9rem_44px] ${
                estaAprobada ? 'border-hogar bg-hogar-tint' : 'border-hairline-soft'
              }`}
            >
              <input
                {...register(`opciones.${indice}.detalle` as const)}
                aria-label={`Qué incluye la opción ${String(indice + 1)}`}
                placeholder="Solo el escritorio, los 2 escritorios…"
                disabled={bloqueado}
                className="col-span-2 h-11 min-w-0 rounded-field border border-border bg-paper px-3 text-body-lg text-ink @lg/opciones:col-span-1"
              />
              <label
                className={`col-span-2 flex h-11 min-w-0 cursor-pointer items-center gap-2 rounded-field border px-2.5 text-label font-medium @lg/opciones:col-span-1 ${
                  estaAprobada ? 'border-hogar text-hogar' : 'border-border text-text-2'
                }`}
              >
                <input
                  type="checkbox"
                  checked={estaAprobada}
                  disabled={bloqueado}
                  onChange={(evento) => {
                    tildar(campo.id, evento.target.checked);
                  }}
                  className="size-5 flex-none accent-hogar"
                />
                <span className="flex min-w-0 items-center gap-1 truncate">
                  {estaAprobada && <Icono nombre="check" tamano={16} />}
                  {estaAprobada ? 'Aprobada' : 'La aprobó'}
                </span>
              </label>
              <div
                className={`col-span-2 flex h-11 min-w-0 items-center gap-1 rounded-field border bg-paper px-2.5 @lg/opciones:col-span-1 ${
                  errorDeFila?.monto ? 'border-alerta' : 'border-border'
                }`}
              >
                <span aria-hidden className="text-text-3">
                  $
                </span>
                <Controller
                  control={control}
                  name={`opciones.${indice}.monto` as const}
                  render={({ field }) => (
                    <MoneyInput
                      ref={field.ref}
                      name={field.name}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      aria-label={`Importe de la opción ${String(indice + 1)}`}
                      placeholder="0"
                      disabled={bloqueado}
                      className="min-w-0 flex-1 bg-transparent text-right text-body font-semibold outline-none"
                    />
                  )}
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  quitar(indice);
                }}
                disabled={bloqueado}
                aria-label={`Quitar la opción ${String(indice + 1)}`}
                className="col-start-3 row-start-1 flex size-11 items-center justify-center justify-self-center rounded-field text-text-3 hover:bg-surface hover:text-alerta @lg/opciones:col-start-auto @lg/opciones:row-start-auto"
              >
                <Icono nombre="trash-2" tamano={18} />
              </button>
              {errorDeFila?.monto && (
                <span
                  role="alert"
                  className="col-span-3 text-label font-medium text-alerta @lg/opciones:col-span-4"
                >
                  {errorDeFila.monto.message}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {deshacer !== null && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-field bg-ink px-3 py-2 text-label text-paper"
        >
          <span className="min-w-0 truncate">Quité {deshacer.descripcion}.</span>
          <button
            type="button"
            onClick={() => {
              campos.insert(deshacer.indice, deshacer.fila);
              setDeshacer(null);
            }}
            className="min-h-tap flex-none px-2 font-semibold underline underline-offset-2"
          >
            Deshacer
          </button>
        </div>
      )}

      <Button
        type="button"
        variant="secundario"
        onClick={agregar}
        disabled={bloqueado}
        className="w-full border-dashed"
      >
        <Icono nombre="plus" tamano={16} />
        Agregar una opción
      </Button>
    </section>
  );
}
