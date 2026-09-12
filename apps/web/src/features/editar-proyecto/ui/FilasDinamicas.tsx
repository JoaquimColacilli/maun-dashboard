import { useEffect, useRef, useState } from 'react';
import type { Control, FieldErrors, UseFieldArrayReturn, UseFormRegister } from 'react-hook-form';
import { useWatch } from 'react-hook-form';

import { filaVacia, totalDeLasFilas, type FormularioDeProyecto } from '@/entities/proyecto';
import { formatearPesos, hoyLocal, parsearPesos, uuidv7 } from '@/shared/lib';
import { Button, Icono } from '@/shared/ui';

type Lista = 'pagos' | 'gastos';

export interface FilasDinamicasProps {
  lista: Lista;
  titulo: string;
  etiquetaDelDetalle: string;
  placeholderDelDetalle: string;
  textoDeAgregar: string;
  vacio: string;
  control: Control<FormularioDeProyecto>;
  register: UseFormRegister<FormularioDeProyecto>;
  errores: FieldErrors<FormularioDeProyecto>;
  campos: UseFieldArrayReturn<FormularioDeProyecto, Lista, 'clave'>;
  bloqueado: boolean;
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
  vacio,
  control,
  register,
  errores,
  campos,
  bloqueado,
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

  // Al agregar una fila el foco cae en su primer campo: si no, el usuario tiene que buscar dónde
  // escribir, y en el celular eso es buscar con el pulgar entre inputs de tres milímetros. Lo hace
  // el `shouldFocus` de useFieldArray, que corre junto con el render; poner otro foco propio en un
  // requestAnimationFrame compite con ese y puede llegar tarde, en medio de lo que el usuario ya
  // está escribiendo. Acá solo se acerca la fila a la vista.
  function agregar(): void {
    const nueva = filaVacia(uuidv7(), hoyLocal());
    campos.append(nueva);
    requestAnimationFrame(() => {
      contenedor.current
        ?.querySelector(`[data-fila="${nueva.id}"]`)
        ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  }

  function quitar(indice: number): void {
    const fila = filas[indice];
    const tieneDatos =
      fila !== undefined && (fila.detalle.trim() !== '' || parsearPesos(fila.monto) !== undefined);

    if (fila !== undefined && tieneDatos) {
      const monto = parsearPesos(fila.monto);
      setDeshacer({
        indice,
        fila,
        descripcion:
          fila.detalle.trim() === ''
            ? monto === undefined
              ? 'la fila'
              : formatearPesos(monto)
            : fila.detalle.trim(),
      });
    }
    campos.remove(indice);
  }

  const erroresDeLista = errores[lista];

  return (
    <section aria-label={titulo} className="flex flex-col gap-2" ref={contenedor}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-section font-semibold">{titulo}</h2>
        <span role="status" className="text-label text-text-2 tabular-nums">
          {total > 0 ? formatearPesos(total) : ''}
        </span>
      </div>

      {campos.fields.length === 0 && <p className="text-label text-text-2">{vacio}</p>}

      <ul className="flex list-none flex-col">
        {campos.fields.map((campo, indice) => {
          const errorDeFila = erroresDeLista?.[indice];
          return (
            <li
              key={campo.clave}
              data-fila={campo.id}
              className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_44px] items-center gap-2 border-t border-hairline-soft py-2.5 md:grid-cols-[minmax(0,2fr)_150px_150px_44px]"
            >
              <input
                {...register(`${lista}.${indice}.detalle` as const)}
                aria-label={`${etiquetaDelDetalle} ${String(indice + 1)}`}
                placeholder={placeholderDelDetalle}
                disabled={bloqueado}
                className="col-span-3 h-11 min-w-0 rounded-field border border-border bg-paper px-3 text-body-lg text-ink md:col-span-1"
              />
              <input
                {...register(`${lista}.${indice}.fecha` as const)}
                type="date"
                aria-label={`Fecha ${String(indice + 1)}`}
                disabled={bloqueado}
                className={`h-11 min-w-0 rounded-field border bg-paper px-2.5 text-body text-ink ${
                  errorDeFila?.fecha ? 'border-alerta' : 'border-border'
                }`}
              />
              <div
                className={`flex h-11 min-w-0 items-center gap-1 rounded-field border bg-paper px-2.5 ${
                  errorDeFila?.monto ? 'border-alerta' : 'border-border'
                }`}
              >
                <span aria-hidden className="text-text-3">
                  $
                </span>
                <input
                  {...register(`${lista}.${indice}.monto` as const)}
                  inputMode="decimal"
                  aria-label={`Monto ${String(indice + 1)}`}
                  placeholder="0"
                  disabled={bloqueado}
                  className="min-w-0 flex-1 bg-transparent text-right text-body font-semibold tabular-nums outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  quitar(indice);
                }}
                disabled={bloqueado}
                aria-label={`Quitar ${etiquetaDelDetalle.toLowerCase()} ${String(indice + 1)}`}
                className="flex size-11 items-center justify-center justify-self-center rounded-field text-text-3 hover:bg-surface hover:text-alerta"
              >
                <Icono nombre="trash-2" tamano={18} />
              </button>
              {(errorDeFila?.monto ?? errorDeFila?.fecha) && (
                <span
                  role="alert"
                  className="col-span-3 text-label font-medium text-alerta md:col-span-4"
                >
                  {errorDeFila.monto?.message ?? errorDeFila.fecha?.message}
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
        {textoDeAgregar}
      </Button>
    </section>
  );
}
