import { ESTADOS, ESTADOS_DE_CONSULTA, type EstadoProyecto, type Fase } from '@maun/domain';

import type { FilaDe } from '@/shared/api';

export type Proyecto = FilaDe<'proyectos'>;
export type Pago = FilaDe<'pagos'>;
export type Gasto = FilaDe<'gastos'>;
export type FormaDePago = NonNullable<Proyecto['forma_pago']>;
export type Comprobante = Proyecto['comprobante'];

export interface DatosDelEstado {
  id: EstadoProyecto;
  etiqueta: string;
  tono: string;
}

export const ESTADO: Readonly<Record<EstadoProyecto, DatosDelEstado>> = {
  contacto: { id: 'contacto', etiqueta: 'Contacto', tono: 'border-border text-text-2' },
  presupuesto_estimativo: {
    id: 'presupuesto_estimativo',
    etiqueta: 'Estimativo enviado',
    tono: 'border-border text-text-2',
  },
  relevamiento: { id: 'relevamiento', etiqueta: 'Relevamiento', tono: 'border-border text-text-2' },
  a_presupuestar: {
    id: 'a_presupuestar',
    etiqueta: 'A presupuestar',
    tono: 'border-border text-text-2',
  },
  presupuesto_enviado: {
    id: 'presupuesto_enviado',
    etiqueta: 'Presupuesto enviado',
    tono: 'border-border text-text-2',
  },
  en_seguimiento: {
    id: 'en_seguimiento',
    etiqueta: 'En seguimiento',
    tono: 'border-border text-text-2',
  },
  perdido: { id: 'perdido', etiqueta: 'Perdido', tono: 'border-border text-text-3' },
  en_curso: { id: 'en_curso', etiqueta: 'En curso', tono: 'border-ink bg-ink text-paper' },
  entregado: {
    id: 'entregado',
    etiqueta: 'Entregado',
    tono: 'border-atencion bg-atencion-tint text-atencion',
  },
  cobrado: { id: 'cobrado', etiqueta: 'Cobrado', tono: 'border-hogar bg-hogar-tint text-hogar' },
};

export const ESTADOS_EN_ORDEN: readonly EstadoProyecto[] = ESTADOS;

export const FORMA_DE_PAGO: Readonly<Record<FormaDePago, string>> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  cuotas: 'En cuotas',
  mixto: 'Mixto',
};

export const FORMAS_EN_ORDEN = [
  'efectivo',
  'transferencia',
  'cuotas',
  'mixto',
] as const satisfies readonly FormaDePago[];

export const COMPROBANTE: Readonly<Record<Comprobante, string>> = {
  factura_a: 'Factura A',
  factura_b: 'Factura B',
  factura_c: 'Factura C',
  remito: 'Remito',
  sin_comprobante: 'Sin comprobante',
};

export const COMPROBANTES_EN_ORDEN = [
  'factura_a',
  'factura_b',
  'factura_c',
  'remito',
  'sin_comprobante',
] as const satisfies readonly Comprobante[];

const POR_CONDICION: Readonly<Record<string, Comprobante>> = {
  consumidor_final: 'remito',
  monotributo: 'factura_c',
  responsable_inscripto: 'factura_a',
  exento: 'factura_b',
};

export function comprobanteDeLaCondicion(condicion: string): Comprobante {
  return POR_CONDICION[condicion] ?? 'sin_comprobante';
}

export interface Etapa {
  id: Fase;
  etiqueta: string;
  ruta: string;
}

export const ETAPAS: readonly Etapa[] = [
  { id: 'consultas', etiqueta: 'Consultas', ruta: '/consultas' },
  { id: 'activos', etiqueta: 'Activos', ruta: '/proyectos' },
  { id: 'historial', etiqueta: 'Historial', ruta: '/proyectos?etapa=historial' },
];

export const FILTROS_POR_ETAPA: Readonly<Record<Fase, readonly EstadoProyecto[]>> = {
  consultas: ESTADOS_DE_CONSULTA,
  seguimiento: ['en_seguimiento'],
  activos: ['en_curso', 'entregado'],
  historial: ['cobrado', 'perdido'],
};
