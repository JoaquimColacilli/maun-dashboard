import { useId, type ReactNode } from 'react';

import { Ilustracion, type NombreDeIlustracion } from '../ilustracion/Ilustracion.tsx';
import { TarjetaConLamina } from './TarjetaConLamina.tsx';

export interface EstadoVacioProps {
  ilustracion: NombreDeIlustracion;
  titulo: string;
  detalle: ReactNode;
  etiqueta?: string;
  className?: string;
  children?: ReactNode;
}

export function EstadoVacio({
  ilustracion,
  titulo,
  detalle,
  etiqueta,
  className = '',
  children,
}: EstadoVacioProps) {
  const id = useId();
  return (
    <TarjetaConLamina
      dibujo={<Ilustracion nombre={ilustracion} />}
      lamina="[&>svg]:w-52 @min-[40rem]/con-lamina:[&>svg]:w-60"
      className={className}
      {...(etiqueta === undefined ? { 'aria-labelledby': id } : { 'aria-label': etiqueta })}
    >
      <h2
        id={id}
        className="font-display text-lema leading-tight text-pretty @min-[40rem]/con-lamina:text-portada"
      >
        {titulo}
      </h2>
      <p className="max-w-[44ch] text-body leading-relaxed text-text-2">{detalle}</p>
      {children !== undefined && <div className="w-full pt-2">{children}</div>}
    </TarjetaConLamina>
  );
}
