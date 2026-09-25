import type { ReactNode } from 'react';

import { FilaDeAcciones, Ilustracion, TarjetaConLamina } from '@maun/ui';

import { ESCENA_EN_LA_LAMINA, TITULO_DE_LAMINA } from './lamina';

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
    <main className="mx-auto flex min-h-[70vh] w-full max-w-[520px] flex-col justify-center px-(--page-pad-mobile) py-12">
      <TarjetaConLamina
        como="div"
        dibujo={<Ilustracion nombre="se-corto" />}
        lamina={ESCENA_EN_LA_LAMINA}
      >
        <div role="alert" className="flex flex-col gap-2">
          <h1 className={TITULO_DE_LAMINA}>{titulo}</h1>
          <p className="text-body leading-relaxed text-text-2">{mensaje}</p>
          {detalle !== undefined && (
            <p className="text-meta leading-relaxed text-text-3">{detalle}</p>
          )}
        </div>
        {children !== undefined && (
          <div className="w-full pt-2">
            <FilaDeAcciones>{children}</FilaDeAcciones>
          </div>
        )}
      </TarjetaConLamina>
    </main>
  );
}
