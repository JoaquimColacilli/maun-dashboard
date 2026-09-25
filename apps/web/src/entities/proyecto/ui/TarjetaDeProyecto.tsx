import type { ReactNode } from 'react';

import { Ir, origenDeLaTarjeta } from '@/shared/lib';
import { Tablero } from '@/shared/ui';

import type { ResumenDeProyecto } from '../model/resumen';
import { rutaDelProyecto } from '../model/rutas';
import { EstadoBadge } from './EstadoBadge';
import { MarcaDeListo } from './MarcaDeListo';
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
      {...origenDeLaTarjeta(proyecto.id)}
      className={`relative flex flex-col gap-2 rounded-panel border bg-paper px-4 pt-4 pb-3.5 hover:bg-surface-3 has-[a[data-tarjeta]:focus-visible]:outline-2 has-[a[data-tarjeta]:focus-visible]:outline-offset-2 has-[a[data-tarjeta]:focus-visible]:outline-ink ${
        atencion ? 'border-atencion' : 'border-hairline'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="relative z-10 min-w-0">{cliente}</div>
        <span className="flex flex-none items-center gap-1.5">
          <MarcaDeListo proyecto={proyecto} />
          <EstadoBadge estado={proyecto.estado} />
        </span>
      </div>

      <MarcaDeLiquidacion proyectoId={proyecto.id} />

      <Ir
        a={rutaDelProyecto(proyecto.id)}
        data-tarjeta
        className="text-body-lg leading-snug font-medium text-pretty after:absolute after:inset-0 after:rounded-panel after:content-[''] focus-visible:outline-none"
      >
        {proyecto.titulo}
      </Ir>

      {children}

      {pie !== undefined && (
        <div className="relative z-10 -mx-4 mt-1 -mb-3.5 rounded-b-panel border-t border-hairline-soft px-4 pt-2.5 pb-3.5 @min-[1px]/tablero:mt-auto">
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
    <Tablero
      tarjetaMinima="19rem"
      como="ul"
      etiqueta={etiqueta}
      className="list-none grid-cols-1 gap-3 md:gap-4"
    >
      {children}
    </Tablero>
  );
}
