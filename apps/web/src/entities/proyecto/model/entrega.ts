import { estaLiquidado, type EstadoProyecto, type FranjaDeEntrega } from '@maun/domain';

import {
  COLUMNAS_DE_LA_ENTREGA,
  entregaComprometida,
  franjaDeLaEntrega,
  type CambiosDeLaEntrega,
} from '@/shared/api';
import { diasHasta, hoyLocal, relativa } from '@/shared/lib';
import type { NombreDeIcono } from '@/shared/ui';

import type { Proyecto } from './catalogos';

export function listoDelTrabajo(proyecto: Proyecto): string | null {
  return (proyecto as Partial<Proyecto>).listo_el ?? null;
}

export function tipoDelTrabajo(proyecto: Proyecto): string | null {
  return (proyecto as Partial<Proyecto>).tipo_de_proyecto ?? null;
}

export function entregaGuardada(proyecto: Proyecto): Required<CambiosDeLaEntrega> {
  return {
    listo_el: listoDelTrabajo(proyecto),
    entrega_comprometida: entregaComprometida(proyecto),
    entrega_comprometida_franja: franjaDeLaEntrega(proyecto),
  };
}

export function cambiaAlgoDeLaEntrega(proyecto: Proyecto, cambios: CambiosDeLaEntrega): boolean {
  const guardada = entregaGuardada(proyecto);
  return COLUMNAS_DE_LA_ENTREGA.some(
    (columna) => columna in cambios && guardada[columna] !== cambios[columna],
  );
}

export function cambiosDeLaComprometida(
  fecha: string | null,
  franja: FranjaDeEntrega | null,
): CambiosDeLaEntrega {
  return {
    entrega_comprometida: fecha,
    entrega_comprometida_franja: fecha === null ? null : franja,
  };
}

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
