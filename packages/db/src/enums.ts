import type { Database } from './database.types.ts';

export type Tesoro = Database['public']['Enums']['tesoro'];
export type TipoMovimiento = Database['public']['Enums']['tipo_movimiento'];

export const TESOROS: readonly Tesoro[] = ['hogar', 'maun', 'diezmo', 'cocos'];

export const TIPOS_DE_MOVIMIENTO: readonly TipoMovimiento[] = [
  'ingreso',
  'gasto',
  'transferencia',
  'pago_diezmo',
  'aporte_cocos',
  'ajuste',
];
