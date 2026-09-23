import { useEffect, useRef, useState } from 'react';
import type { Control, FieldErrors, UseFieldArrayReturn, UseFormRegister } from 'react-hook-form';
import { Controller, useWatch } from 'react-hook-form';

import { CasillaDeLaApertura } from '@/entities/movimiento';
import { filaVacia, totalDeLasFilas, type FormularioDeProyecto } from '@/entities/proyecto';
import { formatearPesos, hoyEnElTaller, uuidv7 } from '@/shared/lib';
import { Button, Icono, MoneyInput } from '@/shared/ui';

type Lista = 'pagos' | 'gastos';

export interface FilasDinamicasProps {
  lista: Lista;
  titulo: string;
  etiquetaDelDetalle: string;
  placeholderDelDetalle: string;
  textoDeAgregar: string;
  ayuda: string;
  vacio: string;
  control: Control<FormularioDeProyecto>;
  register: UseFormRegister<FormularioDeProyecto>;
  errores: FieldErrors<FormularioDeProyecto>;
  campos: UseFieldArrayReturn<FormularioDeProyecto, Lista, 'clave'>;
  bloqueado: boolean;
  apertura?: string | null;
}

interface Deshacer {
  indice: number;
  fila: FormularioDeProyecto['pagos'][number];
  descripcion: string;
}

export function FilasDinamicas({
  lista,
  titulo,
  etiquetaDelDetalle,
  placeholderDelDetalle,
  textoDeAgregar,
  ayuda,
  vacio,
  control,
  register,
  errores,
  campos,
  bloqueado,
  apertura = null,
}: FilasDinamicasProps) {
  const [deshacer, setDeshacer] = useState<Deshacer | null>(null);
  const contenedor = useRef<HTMLDivElement>(null);

  const filas = useWatch({ control, name: lista });
  const total = totalDeLasFilas(filas);

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
    const nueva = filaVacia(uuidv7(), hoyEnElTaller());
    campos.append(nueva);
    requestAnimationFrame(() => {
      contenedor.current
        ?.querySelector(`[data-fila="${nueva.id}"]`)
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
              ? 'la fila'
              : formatearPesos(fila.monto)
            : fila.detalle.trim(),
      });
    }
    campos.remove(indice);
  }

  const erroresDeLista = errores[lista];

  return (
    <section aria-label={titulo} className="@container/filas flex flex-col gap-2" ref={contenedor}>
      <div className="flex flex-col gap-2 bg-paper md:sticky md:top-17 md:z-10 md:border-b md:border-hairline-soft md:pt-3 md:pb-2.5">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-section font-semibold">{titulo}</h2>
            <span role="status" className="text-label text-text-2 tabular-nums">
              {total > 0 ? formatearPesos(total) : ''}
            </span>
          </div>
          <p className="text-meta leading-normal text-text-3">{ayuda}</p>
        </div>
        <Button
          type="button"
          variant="secundario"
          size="chico"
          onClick={agregar}
          disabled={bloqueado}
          className="w-full border-dashed md:w-auto md:self-start"
        >
          <Icono nombre="plus" tamano={16} />
          {textoDeAgregar}
        </Button>
      </div>

      {campos.fields.length === 0 && <p className="text-label text-text-2">{vacio}</p>}

      <ul className="flex list-none flex-col">
        {campos.fields.map((campo, indice) => {
          const errorDeFila = erroresDeLista?.[indice];
          return (
            <li
              key={campo.clave}
              data-fila={campo.id}
              className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_44px] items-center gap-2 border-t border-hairline-soft py-2.5 @lg/filas:grid-cols-[minmax(0,1fr)_10.5rem_9rem_44px]"
            >
              <input
                {...register(`${lista}.${indice}.detalle` as const)}
                aria-label={`${etiquetaDelDetalle} ${String(indice + 1)}`}
                placeholder={placeholderDelDetalle}
                disabled={bloqueado}
                className="col-span-2 h-11 min-w-0 rounded-field border border-border bg-paper px-3 text-body-lg text-ink @lg/filas:col-span-1"
              />
              <input
                {...register(`${lista}.${indice}.fecha` as const)}
                type="date"
                max={lista === 'pagos' ? hoyEnElTaller() : undefined}
                aria-label={`Fecha ${String(indice + 1)}`}
                disabled={bloqueado}
                className={`h-11 min-w-0 rounded-field border bg-paper px-2.5 text-body text-ink ${
                  errorDeFila?.fecha ? 'border-alerta' : 'border-border'
                }`}
              />
              <div
                className={`col-span-2 flex h-11 min-w-0 items-center gap-1 rounded-field border bg-paper px-2.5 @lg/filas:col-span-1 ${
                  errorDeFila?.monto ? 'border-alerta' : 'border-border'
                }`}
              >
                <span aria-hidden className="text-text-3">
                  $
                </span>
                <Controller
                  control={control}
                  name={`${lista}.${indice}.monto` as const}
                  render={({ field }) => (
                    <MoneyInput
                      ref={field.ref}
                      name={field.name}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      aria-label={`Monto ${String(indice + 1)}`}
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
                aria-label={`Quitar ${etiquetaDelDetalle.toLowerCase()} ${String(indice + 1)}`}
                className="col-start-3 row-start-1 flex size-11 items-center justify-center justify-self-center rounded-field text-text-3 hover:bg-surface hover:text-alerta @lg/filas:col-start-auto @lg/filas:row-start-auto"
              >
                <Icono nombre="trash-2" tamano={18} />
              </button>
              {(errorDeFila?.monto ?? errorDeFila?.fecha) && (
                <span
                  role="alert"
                  className="col-span-3 text-label font-medium text-alerta @lg/filas:col-span-4"
                >
                  {errorDeFila.monto?.message ?? errorDeFila.fecha?.message}
                </span>
              )}
              {lista === 'pagos' && (
                <Controller
                  control={control}
                  name={`pagos.${indice}.enLaApertura` as const}
                  render={({ field }) => (
                    <CasillaDeLaApertura
                      className="col-span-3 @lg/filas:col-span-4"
                      fecha={filas[indice]?.fecha ?? ''}
                      apertura={apertura}
                      marcada={field.value}
                      alCambiar={field.onChange}
                      disabled={bloqueado}
                    />
                  )}
                />
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
    </section>
  );
}
