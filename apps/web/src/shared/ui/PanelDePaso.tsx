import type { ReactNode } from 'react';

import { Icono, type NombreDeIcono } from '@maun/ui';

export type TonoDelPaso = 'normal' | 'atencion' | 'alerta';

const TONO: Readonly<Record<TonoDelPaso, string>> = {
  normal: 'text-text-2',
  atencion: 'font-semibold text-atencion',
  alerta: 'font-semibold text-alerta',
};

export interface PanelDePasoProps {
  titulo: string;
  paso: string;
  detalle: string;
  icono: NombreDeIcono;
  tono?: TonoDelPaso;
  children: ReactNode;
}

export function PanelDePaso({
  titulo,
  paso,
  detalle,
  icono,
  tono = 'normal',
  children,
}: PanelDePasoProps) {
  return (
    <section
      aria-label={titulo}
      className="@container rounded-panel border border-hairline px-4 py-3.5"
    >
      <h2 className="text-meta font-medium text-text-2">{titulo}</h2>
      <p className="mt-0.5 text-body-lg leading-snug font-semibold">{paso}</p>
      <p className={`mt-1 flex items-center gap-1.5 text-label ${TONO[tono]}`}>
        <Icono nombre={icono} tamano={15} />
        {detalle}
      </p>
      {children}
    </section>
  );
}
