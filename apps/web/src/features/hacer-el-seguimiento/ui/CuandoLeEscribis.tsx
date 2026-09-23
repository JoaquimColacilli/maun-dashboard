import { fechaDelPlazo, PLAZOS_DEL_SEGUIMIENTO, type PlazoDelSeguimiento } from '@maun/domain';
import { useId } from 'react';

import { fechaLarga } from '@/shared/lib';

const ETIQUETA_DEL_PLAZO: Readonly<Record<PlazoDelSeguimiento, string>> = {
  una_semana: 'En una semana',
  un_mes: 'En un mes',
  tres_meses: 'En tres meses',
};

export interface CuandoLeEscribisProps {
  hoy: string;
  fecha: string;
  error: string | undefined;
  alCambiar: (fecha: string) => void;
  leyenda?: string;
}

export function CuandoLeEscribis({
  hoy,
  fecha,
  error,
  alCambiar,
  leyenda = '¿Cuándo le volvés a escribir?',
}: CuandoLeEscribisProps) {
  const ids = useId();

  return (
    <fieldset
      className="flex flex-col gap-1.5"
      aria-describedby={error === undefined ? undefined : `${ids}-error`}
    >
      <legend className="mb-1.5 text-label text-text-2">{leyenda}</legend>
      <div className="grid grid-cols-1 gap-2 min-[22rem]:grid-cols-3">
        {PLAZOS_DEL_SEGUIMIENTO.map((plazo) => {
          const dia = fechaDelPlazo(hoy, plazo);
          const elegido = fecha === dia;
          return (
            <button
              key={plazo}
              type="button"
              aria-pressed={elegido}
              onClick={() => {
                alCambiar(dia);
              }}
              className={`flex min-h-[52px] flex-col items-start justify-center rounded-field border px-3 py-1.5 text-left ${
                elegido ? 'border-ink bg-ink text-paper' : 'border-border bg-paper text-ink'
              }`}
            >
              <span className="text-body leading-tight font-medium">
                {ETIQUETA_DEL_PLAZO[plazo]}
              </span>
              <span className={`text-meta ${elegido ? 'text-paper' : 'text-text-2'}`}>
                {fechaLarga(dia, hoy)}
              </span>
            </button>
          );
        })}
      </div>
      <input
        type="date"
        aria-label="Otro día"
        min={hoy}
        value={fecha}
        onChange={(evento) => {
          alCambiar(evento.target.value);
        }}
        aria-invalid={error !== undefined}
        className={`h-11 w-full rounded-field border bg-paper px-3 text-body text-ink ${
          error === undefined ? 'border-border' : 'border-alerta'
        }`}
      />
      {error !== undefined && (
        <span id={`${ids}-error`} role="alert" className="text-label font-medium text-alerta">
          {error}
        </span>
      )}
    </fieldset>
  );
}
