import type { Cara, Paso, Polo } from '@maun/domain';

import type { NombreDeIcono } from '@/shared/ui';

export const ICONO_DE_LA_CARA: Readonly<Record<Cara, NombreDeIcono>> = {
  enojada: 'angry',
  triste: 'frown',
  seria: 'meh',
  contenta: 'smile',
  riendo: 'laugh',
  'pulgar-arriba': 'thumbs-up',
  'pulgar-abajo': 'thumbs-down',
};

export const TEXTO_DEL_POLO: Readonly<Record<Polo, string>> = {
  bien: 'text-op-bien',
  neutro: 'text-op-neutro',
  mal: 'text-op-mal',
};

export const FONDO_DEL_POLO: Readonly<Record<Polo, string>> = {
  bien: 'bg-op-bien',
  neutro: 'bg-op-neutro',
  mal: 'bg-op-mal',
};

export const BORDE_DEL_POLO: Readonly<Record<Polo, string>> = {
  bien: 'border-t-op-bien',
  neutro: 'border-t-op-neutro',
  mal: 'border-t-op-mal',
};

export function colorDelPaso(paso: Paso | null): string {
  return paso?.polo ? TEXTO_DEL_POLO[paso.polo] : 'text-text-3';
}
