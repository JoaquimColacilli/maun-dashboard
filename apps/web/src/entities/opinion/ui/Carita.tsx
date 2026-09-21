import type { Paso } from '@maun/domain';

import { Icono } from '@/shared/ui';

import { colorDelPaso, ICONO_DE_LA_CARA } from '../model/polos';

export interface CaritaProps {
  paso: Paso | null;
  tamano?: number;
  className?: string;
}

export function Carita({ paso, tamano = 18, className = '' }: CaritaProps) {
  if (paso?.cara == null) return null;
  return (
    <span className={`inline-flex flex-none ${colorDelPaso(paso)} ${className}`}>
      <Icono nombre={ICONO_DE_LA_CARA[paso.cara]} tamano={tamano} />
    </span>
  );
}
