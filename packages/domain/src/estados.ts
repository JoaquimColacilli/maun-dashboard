export const ESTADOS = [
  'contacto',
  'relevamiento',
  'a_presupuestar',
  'presupuesto_enviado',
  'perdido',
  'en_curso',
  'entregado',
  'cobrado',
] as const;

export type EstadoProyecto = (typeof ESTADOS)[number];

export type EstadoLiquidado = Extract<EstadoProyecto, 'cobrado' | 'perdido'>;

export type Fase = 'seguimiento' | 'activos' | 'historial';

export const ESTADOS_DE_SEGUIMIENTO = [
  'contacto',
  'relevamiento',
  'a_presupuestar',
  'presupuesto_enviado',
] as const satisfies readonly EstadoProyecto[];

const FASES: Readonly<Record<EstadoProyecto, Fase>> = {
  contacto: 'seguimiento',
  relevamiento: 'seguimiento',
  a_presupuestar: 'seguimiento',
  presupuesto_enviado: 'seguimiento',
  perdido: 'historial',
  en_curso: 'activos',
  entregado: 'activos',
  cobrado: 'historial',
};

export const TRANSICIONES: Readonly<Record<EstadoProyecto, readonly EstadoProyecto[]>> = {
  contacto: ['relevamiento', 'a_presupuestar', 'presupuesto_enviado', 'en_curso'],
  relevamiento: ['contacto', 'a_presupuestar', 'presupuesto_enviado', 'en_curso'],
  a_presupuestar: ['contacto', 'relevamiento', 'presupuesto_enviado', 'en_curso'],
  presupuesto_enviado: ['contacto', 'relevamiento', 'a_presupuestar', 'en_curso'],
  perdido: [],
  en_curso: ['presupuesto_enviado', 'entregado'],
  entregado: ['en_curso'],
  cobrado: [],
};

const ORIGENES_DE_LIQUIDACION: Readonly<Record<EstadoLiquidado, readonly EstadoProyecto[]>> = {
  cobrado: ['entregado'],
  perdido: [...ESTADOS_DE_SEGUIMIENTO, 'en_curso'],
};

const DESTINOS_DE_REVERSION: Readonly<Record<EstadoLiquidado, readonly EstadoProyecto[]>> = {
  cobrado: ['entregado'],
  perdido: ESTADOS_DE_SEGUIMIENTO,
};

export function esEstado(valor: string): valor is EstadoProyecto {
  return (ESTADOS as readonly string[]).includes(valor);
}

export function faseDe(estado: EstadoProyecto): Fase {
  return FASES[estado];
}

export function estaLiquidado(estado: EstadoProyecto): estado is EstadoLiquidado {
  return estado === 'cobrado' || estado === 'perdido';
}

export function puedeCambiarEstado(desde: EstadoProyecto, hasta: EstadoProyecto): boolean {
  return TRANSICIONES[desde].includes(hasta);
}

export function puedeLiquidar(desde: EstadoProyecto, hacia: EstadoProyecto): boolean {
  return estaLiquidado(hacia) && ORIGENES_DE_LIQUIDACION[hacia].includes(desde);
}

export function puedeRevertir(desde: EstadoProyecto, hacia: EstadoProyecto): boolean {
  return estaLiquidado(desde) && DESTINOS_DE_REVERSION[desde].includes(hacia);
}

export function puedeCobrar(estado: EstadoProyecto): boolean {
  return puedeLiquidar(estado, 'cobrado');
}

export function puedeCerrarPerdido(estado: EstadoProyecto): boolean {
  return puedeLiquidar(estado, 'perdido');
}

export function puedeReabrir(estado: EstadoProyecto): boolean {
  return puedeRevertir(estado, 'entregado');
}

export function puedeReactivar(estado: EstadoProyecto): boolean {
  return estado === 'perdido';
}
