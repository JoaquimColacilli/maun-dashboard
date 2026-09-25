import type { ComponentPropsWithoutRef, ReactNode } from 'react';

import { Lamina } from '../ilustracion/Lamina.tsx';

export interface TarjetaConLaminaProps extends Omit<
  ComponentPropsWithoutRef<'section'>,
  'children'
> {
  dibujo: ReactNode;
  children: ReactNode;
  como?: 'section' | 'div';
  lamina?: string;
}

export function TarjetaConLamina({
  dibujo,
  children,
  como: Como = 'section',
  lamina = '',
  className = '',
  ...resto
}: TarjetaConLaminaProps) {
  return (
    <Como
      {...resto}
      data-tarjeta-con-lamina=""
      className={[
        '@container/con-lamina rounded-panel border border-hairline bg-paper p-1.5',
        className,
      ].join(' ')}
    >
      <div className="grid grid-cols-1 gap-1.5 @min-[40rem]/con-lamina:grid-cols-2">
        <Lamina
          className={[
            'h-49 @min-[40rem]/con-lamina:h-auto @min-[40rem]/con-lamina:min-h-70',
            lamina,
          ].join(' ')}
        >
          {dibujo}
        </Lamina>
        <div className="@container flex min-w-0 flex-col items-start gap-2 px-3.5 pt-4 pb-3.5 @min-[40rem]/con-lamina:justify-center @min-[40rem]/con-lamina:px-8 @min-[40rem]/con-lamina:py-8">
          {children}
        </div>
      </div>
    </Como>
  );
}
