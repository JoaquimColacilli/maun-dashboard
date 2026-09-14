import type { ReactNode } from 'react';
import { Link } from 'react-router';

import type { ResumenDeProyecto } from '../model/resumen';
import { rutaDelProyecto } from '../model/rutas';
import { EstadoBadge } from './EstadoBadge';
import { MarcaDeLiquidacion } from './MarcaDeLiquidacion';

export interface TarjetaDeProyectoProps {
  resumen: ResumenDeProyecto;
  cliente: ReactNode;
  atencion?: boolean;
  pie?: ReactNode;
  children?: ReactNode;
}

export function TarjetaDeProyecto({
  resumen,
  cliente,
  atencion = false,
  pie,
  children,
}: TarjetaDeProyectoProps) {
  const { proyecto } = resumen;

  return (
    <li
      className={`relative flex flex-col gap-2 rounded-panel border px-3.5 pt-3.5 pb-3 hover:bg-surface-3 has-[a[data-tarjeta]:focus-visible]:outline-2 has-[a[data-tarjeta]:focus-visible]:outline-offset-2 has-[a[data-tarjeta]:focus-visible]:outline-ink ${
        atencion ? 'border-atencion' : 'border-hairline'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="relative z-10 min-w-0">{cliente}</div>
        <EstadoBadge estado={proyecto.estado} />
      </div>

      <MarcaDeLiquidacion proyectoId={proyecto.id} />

      <Link
        to={rutaDelProyecto(proyecto.id)}
        data-tarjeta
        className="text-body-lg leading-snug font-medium text-pretty after:absolute after:inset-0 after:rounded-panel after:content-[''] focus-visible:outline-none"
      >
        {proyecto.titulo}
      </Link>

      {children}

      {pie !== undefined && (
        <div className="relative z-10 -mx-3.5 mt-1 -mb-3 rounded-b-panel border-t border-hairline-soft px-3.5 pt-2.5 pb-3">
          {pie}
        </div>
      )}
    </li>
  );
}

export function TarjetasDeProyectos({
  etiqueta,
  children,
}: {
  etiqueta: string;
  children: ReactNode;
}) {
  return (
    <ul
      aria-label={etiqueta}
      className="grid list-none grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3"
    >
      {children}
    </ul>
  );
}
