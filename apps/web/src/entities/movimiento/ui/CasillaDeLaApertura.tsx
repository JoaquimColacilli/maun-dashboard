import { esAnteriorALaApertura } from '@maun/domain';

export const TEXTO_DE_LA_APERTURA =
  'Esta plata ya estaba en tus saldos cuando empezaste con la app';

const UN_DIA = /^\d{4}-\d{2}-\d{2}$/;

export interface CasillaDeLaAperturaProps {
  fecha: string;
  apertura: string | null;
  marcada: boolean;
  alCambiar: (marcada: boolean) => void;
  etiqueta?: string;
  disabled?: boolean;
  className?: string;
}

export function CasillaDeLaApertura({
  fecha,
  apertura,
  marcada,
  alCambiar,
  etiqueta = TEXTO_DE_LA_APERTURA,
  disabled = false,
  className = '',
}: CasillaDeLaAperturaProps) {
  if (!UN_DIA.test(fecha) || !esAnteriorALaApertura(fecha, apertura)) return null;

  return (
    <label
      className={`flex min-h-tap items-center gap-2.5 text-label leading-snug text-text-2 ${className}`}
    >
      <input
        type="checkbox"
        checked={marcada}
        disabled={disabled}
        onChange={(evento) => {
          alCambiar(evento.target.checked);
        }}
        className="size-4 flex-none accent-ink"
      />
      {etiqueta}
    </label>
  );
}
