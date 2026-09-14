import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { fechaLarga, formatearPesos, rutaDelProyecto, TESORO } from '@/shared/lib';
import { Button, FilaDeAcciones, Hoja, Icono } from '@/shared/ui';

import { MOTIVO_DEL_BLOQUEO, type LineaDelTaller } from '../model/libro';

function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-hairline-soft py-2">
      <dt className="text-label text-text-2">{etiqueta}</dt>
      <dd className="text-body font-medium tabular-nums">{children}</dd>
    </div>
  );
}

export interface FichaDelMovimientoProps {
  linea: LineaDelTaller;
  hoy: string;
  alCerrar: () => void;
}

export function FichaDelMovimiento({ linea, hoy, alCerrar }: FichaDelMovimientoProps) {
  const motivo = linea.bloqueo === null ? null : MOTIVO_DEL_BLOQUEO[linea.bloqueo];

  return (
    <Hoja titulo={linea.etiqueta} alCerrar={alCerrar}>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4 md:px-6 md:py-5">
        <div>
          <span className="block text-money-lg font-semibold tabular-nums">
            {formatearPesos(linea.monto)}
          </span>
          {linea.detalle !== '' && (
            <span className="mt-0.5 block text-body text-text-2">{linea.detalle}</span>
          )}
        </div>

        <dl className="flex flex-col">
          <Dato etiqueta="Fecha">{fechaLarga(linea.fecha, hoy)}</Dato>
          <Dato etiqueta="Sale de">
            {linea.desde === null ? 'de afuera del taller' : TESORO[linea.desde].nombre}
          </Dato>
          <Dato etiqueta="Entra a">
            {linea.hacia === null ? 'se va del taller' : TESORO[linea.hacia].nombre}
          </Dato>
          {linea.categoria !== '' && <Dato etiqueta="Categoría">{linea.categoria}</Dato>}
        </dl>

        {motivo !== null && (
          <div className="flex items-start gap-2.5 rounded-field bg-surface px-3.5 py-3">
            <span aria-hidden className="mt-0.5 flex-none text-text-2">
              <Icono nombre="circle-alert" tamano={18} />
            </span>
            <p className="text-label leading-relaxed text-text-2">{motivo}</p>
          </div>
        )}
      </div>

      <footer className="flex flex-none flex-col gap-2.5 border-t border-hairline bg-paper px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:px-6 md:pb-3">
        <FilaDeAcciones>
          <Button variant="secundario" disabled>
            Editar
          </Button>
          <Button variant="secundario" disabled>
            Borrar
          </Button>
        </FilaDeAcciones>
        {linea.proyectoId !== null && (
          <Link
            to={rutaDelProyecto(linea.proyectoId)}
            className="flex h-button items-center justify-center gap-2 rounded-field bg-ink px-[18px] text-body font-medium text-paper"
          >
            Ver «{linea.proyectoTitulo ?? 'el trabajo'}»
          </Link>
        )}
      </footer>
    </Hoja>
  );
}
