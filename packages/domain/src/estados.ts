export const ESTADOS = [
  'contacto',
  'presupuesto_estimativo',
  'relevamiento',
  'a_presupuestar',
  'presupuesto_enviado',
  'en_seguimiento',
  'perdido',
  'en_curso',
  'entregado',
  'cobrado',
] as const;

export type EstadoProyecto = (typeof ESTADOS)[number];

export type EstadoLiquidado = Extract<EstadoProyecto, 'cobrado' | 'perdido'>;

export type Fase = 'consultas' | 'seguimiento' | 'activos' | 'historial';

export const ESTADOS_DE_CONSULTA = [
  'contacto',
  'presupuesto_estimativo',
  'relevamiento',
  'a_presupuestar',
  'presupuesto_enviado',
] as const satisfies readonly EstadoProyecto[];

export type EstadoDeConsulta = (typeof ESTADOS_DE_CONSULTA)[number];

export const EN_SEGUIMIENTO = 'en_seguimiento' satisfies EstadoProyecto;

const FASES: Readonly<Record<EstadoProyecto, Fase>> = {
  contacto: 'consultas',
  presupuesto_estimativo: 'consultas',
  relevamiento: 'consultas',
  a_presupuestar: 'consultas',
  presupuesto_enviado: 'consultas',
  en_seguimiento: 'seguimiento',
  perdido: 'historial',
  en_curso: 'activos',
  entregado: 'activos',
  cobrado: 'historial',
};

export const TRANSICIONES: Readonly<Record<EstadoProyecto, readonly EstadoProyecto[]>> = {
  contacto: [
    'presupuesto_estimativo',
    'relevamiento',
    'a_presupuestar',
    'presupuesto_enviado',
    'en_seguimiento',
    'en_curso',
  ],
  presupuesto_estimativo: [
    'contacto',
    'relevamiento',
    'a_presupuestar',
    'presupuesto_enviado',
    'en_seguimiento',
    'en_curso',
  ],
  relevamiento: [
    'contacto',
    'presupuesto_estimativo',
    'a_presupuestar',
    'presupuesto_enviado',
    'en_seguimiento',
    'en_curso',
  ],
  a_presupuestar: [
    'contacto',
    'presupuesto_estimativo',
    'relevamiento',
    'presupuesto_enviado',
    'en_seguimiento',
    'en_curso',
  ],
  presupuesto_enviado: [
    'contacto',
    'presupuesto_estimativo',
    'relevamiento',
    'a_presupuestar',
    'en_seguimiento',
    'en_curso',
  ],
  en_seguimiento: [
    'contacto',
    'presupuesto_estimativo',
    'relevamiento',
    'a_presupuestar',
    'presupuesto_enviado',
  ],
  perdido: [],
  en_curso: ['presupuesto_enviado', 'entregado'],
  entregado: ['en_curso'],
  cobrado: [],
};

const ORIGENES_DE_LIQUIDACION: Readonly<Record<EstadoLiquidado, readonly EstadoProyecto[]>> = {
  cobrado: ['entregado'],
  perdido: [...ESTADOS_DE_CONSULTA, EN_SEGUIMIENTO, 'en_curso'],
};

const DESTINOS_DE_REVERSION: Readonly<Record<EstadoLiquidado, readonly EstadoProyecto[]>> = {
  cobrado: ['entregado'],
  perdido: ESTADOS_DE_CONSULTA,
};

export function esEstado(valor: string): valor is EstadoProyecto {
  return (ESTADOS as readonly string[]).includes(valor);
}

export function esEstadoDeConsulta(estado: EstadoProyecto): estado is EstadoDeConsulta {
  return (ESTADOS_DE_CONSULTA as readonly EstadoProyecto[]).includes(estado);
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

export function puedePasarASeguimiento(estado: EstadoProyecto): boolean {
  return puedeCambiarEstado(estado, EN_SEGUIMIENTO);
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
