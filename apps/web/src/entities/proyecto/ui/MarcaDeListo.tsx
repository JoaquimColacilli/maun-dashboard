import { estaListo } from '../model/entrega';
import type { Proyecto } from '../model/catalogos';

export interface MarcaDeListoProps {
  proyecto: Proyecto;
}

export function MarcaDeListo({ proyecto }: MarcaDeListoProps) {
  if (!estaListo(proyecto)) return null;
  return (
    <span className="inline-block rounded-pill border border-hogar bg-hogar-tint px-2 py-0.5 text-badge font-semibold whitespace-nowrap text-hogar">
      Listo
    </span>
  );
}
