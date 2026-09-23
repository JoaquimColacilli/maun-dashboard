import type { MouseEvent } from 'react';
import { Link, type LinkProps } from 'react-router';

import { useIr, type ComoIr, type SenalDeUnaVez } from './puerta';

export interface IrProps extends Omit<
  LinkProps,
  'to' | 'replace' | 'state' | 'viewTransition' | 'reloadDocument' | 'relative'
> {
  a: string;
  como?: ComoIr;
  state?: unknown;
  senal?: SenalDeUnaVez;
  desdeLaNavegacion?: boolean;
  alTocar?: () => void;
}

function esUnToqueComun(evento: MouseEvent<HTMLAnchorElement>, destino?: string): boolean {
  return (
    evento.button === 0 &&
    !evento.metaKey &&
    !evento.altKey &&
    !evento.ctrlKey &&
    !evento.shiftKey &&
    (destino === undefined || destino === '_self')
  );
}

export function Ir({
  a,
  como,
  state,
  senal,
  desdeLaNavegacion,
  alTocar,
  onClick,
  target,
  ...resto
}: IrProps) {
  const ir = useIr();
  return (
    <Link
      {...resto}
      to={a}
      target={target}
      onClick={(evento) => {
        onClick?.(evento);
        if (evento.defaultPrevented || !esUnToqueComun(evento, target)) return;
        evento.preventDefault();
        if (alTocar) {
          alTocar();
          return;
        }
        ir(a, { como, state, senal, desdeLaNavegacion });
      }}
    />
  );
}
