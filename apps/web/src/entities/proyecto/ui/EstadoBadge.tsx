import type { EstadoProyecto } from '@maun/domain';

import { ESTADO } from '../model/catalogos';

export function EstadoBadge({ estado }: { estado: EstadoProyecto }) {
  const datos = ESTADO[estado];
  return (
    <span
      className={`inline-block rounded-control border px-1.5 py-0.5 text-badge font-semibold whitespace-nowrap ${datos.tono}`}
    >
      {datos.etiqueta}
    </span>
  );
}
