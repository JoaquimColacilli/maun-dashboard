import { sumarDias, sumarMeses } from './fechas.ts';

export const PLAZOS_DEL_SEGUIMIENTO = ['una_semana', 'un_mes', 'tres_meses'] as const;

export type PlazoDelSeguimiento = (typeof PLAZOS_DEL_SEGUIMIENTO)[number];

export const RESULTADOS_DEL_CONTACTO = ['reactivado', 'perdido', 'otra_fecha'] as const;

export type ResultadoDelContacto = (typeof RESULTADOS_DEL_CONTACTO)[number];

export function fechaDelPlazo(hoy: string, plazo: PlazoDelSeguimiento): string {
  switch (plazo) {
    case 'una_semana':
      return sumarDias(hoy, 7);
    case 'un_mes':
      return sumarMeses(hoy, 1);
    case 'tres_meses':
      return sumarMeses(hoy, 3);
  }
}

export function plazoDeLaFecha(hoy: string, fecha: string): PlazoDelSeguimiento | null {
  return PLAZOS_DEL_SEGUIMIENTO.find((plazo) => fechaDelPlazo(hoy, plazo) === fecha) ?? null;
}
