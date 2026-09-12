import { useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { Button } from '@maun/ui';

import { descartarAviso, type AvisoAnotado } from '@/shared/lib';

const TONO: Readonly<Record<AvisoAnotado['tipo'], string>> = {
  rechazo: 'border-alerta bg-alerta-tint',
  ajuste: 'border-atencion bg-atencion-tint',
};

const TEXTO: Readonly<Record<AvisoAnotado['tipo'], string>> = {
  rechazo: 'text-alerta',
  ajuste: 'text-atencion',
};

export interface PanelDeAvisosProps {
  avisos: readonly AvisoAnotado[];
  children?: (aviso: AvisoAnotado) => ReactNode;
}

export function PanelDeAvisos({ avisos, children }: PanelDeAvisosProps) {
  const queryClient = useQueryClient();
  if (avisos.length === 0) return null;

  return (
    <ul className="flex list-none flex-col gap-2.5">
      {avisos.map((aviso) => (
        <li
          key={aviso.id}
          className={`rounded-panel border px-4 py-3.5 ${TONO[aviso.tipo]}`}
          role={aviso.tipo === 'rechazo' ? 'alert' : undefined}
        >
          <p className={`text-meta font-semibold uppercase ${TEXTO[aviso.tipo]}`}>
            {aviso.operacion}
            {aviso.codigo === '' ? '' : ` · ${aviso.codigo}`}
          </p>
          <p className="mt-1 text-body font-semibold">{aviso.titulo}</p>
          <p className="mt-1 text-label leading-relaxed text-text-2">{aviso.detalle}</p>
          {children?.(aviso)}
          <Button
            variant="terciario"
            size="chico"
            className="mt-1.5 -ml-3"
            onClick={() => {
              void descartarAviso(queryClient, aviso.id);
            }}
          >
            Entendido, sacalo de acá
          </Button>
        </li>
      ))}
    </ul>
  );
}
