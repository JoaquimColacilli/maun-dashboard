import { estaLiquidado, type EstadoProyecto } from '@maun/domain';

import { diasHasta, hoyLocal, relativa } from '@/shared/lib';
import type { NombreDeIcono } from '@/shared/ui';

export type TonoDeEntrega = 'ok' | 'atencion' | 'vencida';

export interface Urgencia {
  texto: string;
  tono: TonoDeEntrega;
  dias: number;
  icono: NombreDeIcono;
}

const ICONO: Readonly<Record<TonoDeEntrega, NombreDeIcono>> = {
  ok: 'calendar',
  atencion: 'clock',
  vencida: 'circle-alert',
};

export const CLASE_DE_ENTREGA: Readonly<Record<TonoDeEntrega, string>> = {
  ok: 'text-text-2',
  atencion: 'font-semibold text-atencion',
  vencida: 'font-semibold text-alerta',
};

// La urgencia relativa, que es para lo que el dueño mira esta columna: decidir qué hace hoy. Un
// proyecto ya entregado, cobrado o perdido no es urgente aunque su fecha haya pasado, así que no
// devuelve nada y la pantalla muestra la fecha sin pintarla de rojo.
export function urgenciaDeEntrega(
  entregaEstimada: string | null,
  estado: EstadoProyecto,
  hoy: string = hoyLocal(),
): Urgencia | undefined {
  if (entregaEstimada === null || estado === 'entregado' || estaLiquidado(estado)) return undefined;

  const dias = diasHasta(entregaEstimada, hoy);
  if (dias < 0) {
    return {
      texto: `vencida ${relativa(entregaEstimada, hoy)}`,
      tono: 'vencida',
      dias,
      icono: ICONO.vencida,
    };
  }
  if (dias === 0) return { texto: 'vence hoy', tono: 'vencida', dias, icono: ICONO.vencida };
  if (dias === 1) return { texto: 'vence mañana', tono: 'atencion', dias, icono: ICONO.atencion };

  const tono: TonoDeEntrega = dias <= 7 ? 'atencion' : 'ok';
  return { texto: `en ${String(dias)} días`, tono, dias, icono: ICONO[tono] };
}
