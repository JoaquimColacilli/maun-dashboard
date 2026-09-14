import type { ReactNode } from 'react';

import { FilaDeAcciones } from '@maun/ui';

export function Aviso({
  titulo,
  mensaje,
  detalle,
  children,
}: {
  titulo: string;
  mensaje: string;
  detalle?: string;
  children?: ReactNode;
}) {
  return (
    <main className="mx-auto flex max-w-[520px] flex-col gap-3 px-(--page-pad-mobile) py-12">
      <div role="alert" className="flex flex-col gap-3">
        <h1 className="font-display text-h1 leading-tight">{titulo}</h1>
        <p className="text-body leading-relaxed text-text-2">{mensaje}</p>
        {detalle !== undefined && (
          <p className="text-meta leading-relaxed text-text-3">{detalle}</p>
        )}
      </div>
      {children !== undefined && <FilaDeAcciones className="mt-2">{children}</FilaDeAcciones>}
    </main>
  );
}
