import {
  DIAS_QUE_VALE_UN_PRESUPUESTO,
  seMandaElPresupuesto,
  vencioElPresupuesto,
  vigenciaAlMandar,
} from '@maun/domain';

import type { CambiosDeProyecto, FilaDe } from '@/shared/api';

import type { Proyecto } from './catalogos';

type ConLaVigencia = { presupuesto_vale_hasta?: string | null };

type ConLosDias = { presupuesto_vale_dias?: number | null };

export function vigenciaDelPresupuesto(proyecto: Proyecto): string | null {
  return (proyecto as ConLaVigencia).presupuesto_vale_hasta ?? null;
}

export function diasQueValeElPresupuesto(ajustes: FilaDe<'ajustes'> | undefined): number {
  return (ajustes as ConLosDias | undefined)?.presupuesto_vale_dias ?? DIAS_QUE_VALE_UN_PRESUPUESTO;
}

export function conLaVigenciaAlMandar<T extends CambiosDeProyecto>(
  proyecto: Proyecto | undefined,
  cambios: T,
  hoy: string,
  dias: number,
): T & Pick<CambiosDeProyecto, 'presupuesto_vale_hasta'> {
  const hacia = cambios.estado ?? proyecto?.estado;
  if (hacia === undefined || !seMandaElPresupuesto(proyecto?.estado ?? null, hacia)) {
    return cambios;
  }
  const actual = proyecto === undefined ? null : vigenciaDelPresupuesto(proyecto);
  const puestaAMano =
    'presupuesto_vale_hasta' in cambios && (cambios.presupuesto_vale_hasta ?? null) !== actual;
  if (puestaAMano) return cambios;
  return { ...cambios, presupuesto_vale_hasta: vigenciaAlMandar(hoy, dias) };
}

export function presupuestoVencido(proyecto: Proyecto, hoy: string): boolean {
  return (
    proyecto.estado === 'presupuesto_enviado' &&
    vencioElPresupuesto(vigenciaDelPresupuesto(proyecto), hoy)
  );
}
