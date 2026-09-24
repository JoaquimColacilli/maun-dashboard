import type { EstadoProyecto } from './estados.ts';
import { sumarDias } from './fechas.ts';

export const DIAS_QUE_VALE_UN_PRESUPUESTO = 15;

const ANTES_DE_MANDAR_EL_PRESUPUESTO: readonly EstadoProyecto[] = [
  'contacto',
  'presupuesto_estimativo',
  'relevamiento',
  'a_presupuestar',
];

export function seMandaElPresupuesto(desde: EstadoProyecto | null, hacia: EstadoProyecto): boolean {
  return (
    hacia === 'presupuesto_enviado' &&
    (desde === null || ANTES_DE_MANDAR_EL_PRESUPUESTO.includes(desde))
  );
}

export function vigenciaAlMandar(mandado: string, dias: number): string {
  return sumarDias(mandado, dias);
}

export function vencioElPresupuesto(valeHasta: string | null, hoy: string): boolean {
  return valeHasta !== null && valeHasta < hoy;
}
