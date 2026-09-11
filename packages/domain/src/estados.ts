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

export type Fase = 'seguimiento' | 'activos' | 'historial';

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
  contacto: ['relevamiento', 'a_presupuestar', 'presupuesto_enviado', 'en_curso', 'perdido'],
  relevamiento: ['contacto', 'a_presupuestar', 'presupuesto_enviado', 'en_curso', 'perdido'],
  a_presupuestar: ['contacto', 'relevamiento', 'presupuesto_enviado', 'en_curso', 'perdido'],
  presupuesto_enviado: ['contacto', 'relevamiento', 'a_presupuestar', 'en_curso', 'perdido'],
  perdido: ['contacto', 'relevamiento', 'a_presupuestar', 'presupuesto_enviado'],
  en_curso: ['presupuesto_enviado', 'entregado', 'perdido'],
  entregado: ['en_curso'],
  cobrado: [],
};

export function esEstado(valor: string): valor is EstadoProyecto {
  return (ESTADOS as readonly string[]).includes(valor);
}

export function faseDe(estado: EstadoProyecto): Fase {
  return FASES[estado];
}

export function puedeCambiarEstado(desde: EstadoProyecto, hasta: EstadoProyecto): boolean {
  return TRANSICIONES[desde].includes(hasta);
}

export function puedeCobrar(estado: EstadoProyecto): boolean {
  return estado === 'entregado';
}

export function puedeReabrir(estado: EstadoProyecto): boolean {
  return estado === 'cobrado';
}
