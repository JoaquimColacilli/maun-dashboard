import type { FilaDe } from '@/shared/api';

export type Cliente = FilaDe<'clientes'>;
export type OrigenDeContacto = NonNullable<Cliente['origen_contacto']>;
export type CondicionFiscal = Cliente['condicion_fiscal'];

export interface DatosDelOrigen {
  id: OrigenDeContacto;
  etiqueta: string;
  detalle: string;
  color: string;
}

export const ORIGENES_EN_ORDEN = [
  'referido',
  'volvio',
  'redes',
  'cartel',
  'otro',
] as const satisfies readonly OrigenDeContacto[];

export const ORIGEN: Readonly<Record<OrigenDeContacto, DatosDelOrigen>> = {
  referido: {
    id: 'referido',
    etiqueta: 'Referido',
    detalle: 'Lo recomendó alguien que ya trabajó con el taller.',
    color: 'bg-ink',
  },
  volvio: {
    id: 'volvio',
    etiqueta: 'Cliente que volvió',
    detalle: 'Ya había hecho un trabajo y volvió por otro.',
    color: 'bg-hogar',
  },
  redes: {
    id: 'redes',
    etiqueta: 'Instagram',
    detalle: 'Escribió por las redes del taller.',
    color: 'bg-text-3',
  },
  cartel: {
    id: 'cartel',
    etiqueta: 'Cartel del taller',
    detalle: 'Pasó por la puerta y vio el cartel.',
    color: 'bg-border',
  },
  otro: {
    id: 'otro',
    etiqueta: 'Otro',
    detalle: 'Llegó por otro camino.',
    color: 'bg-hairline',
  },
};

export interface DatosDeLaCondicion {
  id: CondicionFiscal;
  etiqueta: string;
  corto: string;
  comprobante: string;
}

export const CONDICIONES_EN_ORDEN = [
  'consumidor_final',
  'monotributo',
  'responsable_inscripto',
  'exento',
] as const satisfies readonly CondicionFiscal[];

export const CONDICION: Readonly<Record<CondicionFiscal, DatosDeLaCondicion>> = {
  consumidor_final: {
    id: 'consumidor_final',
    etiqueta: 'Consumidor final',
    corto: 'CF',
    comprobante: 'remito o factura B',
  },
  monotributo: {
    id: 'monotributo',
    etiqueta: 'Monotributo',
    corto: 'MT',
    comprobante: 'factura C',
  },
  responsable_inscripto: {
    id: 'responsable_inscripto',
    etiqueta: 'Responsable inscripto',
    corto: 'RI',
    comprobante: 'factura A',
  },
  exento: { id: 'exento', etiqueta: 'Exento', corto: 'EX', comprobante: 'factura B' },
};

// Un monotributista puede facturar con su CUIL, así que el label del campo cambia con la condición.
export function etiquetaDeCuit(condicion: CondicionFiscal): string {
  return condicion === 'monotributo' ? 'CUIT o CUIL' : 'CUIT';
}

export function pideDatosFiscales(condicion: CondicionFiscal): boolean {
  return condicion !== 'consumidor_final';
}
