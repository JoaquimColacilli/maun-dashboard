import type { CSSProperties, ReactNode } from 'react';

interface Comun {
  children: ReactNode;
  como?: 'div' | 'ul' | 'section';
  etiqueta?: string;
  className?: string;
}

interface PorTarjeta extends Comun {
  tarjetaMinima: string;
  completar?: boolean;
  enUnaFila?: never;
}

interface EnUnaFila extends Comun {
  enUnaFila: true;
  tarjetaMinima?: never;
  completar?: never;
}

export type TableroProps = PorTarjeta | EnUnaFila;

type ConLaTarjeta = CSSProperties & Record<'--tarjeta-minima', string>;

function columnas(props: TableroProps): string {
  if (props.enUnaFila) {
    return '@min-[54rem]/tablero:grid-flow-col @min-[54rem]/tablero:grid-cols-none @min-[54rem]/tablero:auto-cols-fr';
  }
  return props.completar
    ? '@min-[1px]/tablero:grid-cols-[repeat(auto-fit,minmax(min(var(--tarjeta-minima),100%),1fr))]'
    : '@min-[1px]/tablero:grid-cols-[repeat(auto-fill,minmax(min(var(--tarjeta-minima),100%),1fr))]';
}

export function Tablero(props: TableroProps) {
  const { children, como: Etiqueta = 'div', etiqueta, className = '' } = props;
  const estilo: ConLaTarjeta | undefined =
    props.tarjetaMinima === undefined ? undefined : { '--tarjeta-minima': props.tarjetaMinima };
  return (
    <div data-reparto="tablero" className="min-w-0 md:@container/tablero">
      <Etiqueta
        aria-label={etiqueta}
        style={estilo}
        className={['grid', columnas(props), className].join(' ')}
      >
        {children}
      </Etiqueta>
    </div>
  );
}

export interface CeldaAnchaProps {
  children: ReactNode;
  className?: string;
}

export function CeldaAncha({ children, className = '' }: CeldaAnchaProps) {
  return <div className={['col-span-full min-w-0', className].join(' ')}>{children}</div>;
}
