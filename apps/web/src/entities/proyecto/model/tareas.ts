import type { CambiosDeTareas, ColumnaDeTarea } from '@/shared/api';

import type { Proyecto } from './catalogos';

export interface TareaDelPresupuesto {
  columna: ColumnaDeTarea;
  etiqueta: string;
  detalle: string | null;
}

export const TAREAS_DEL_PRESUPUESTO: readonly TareaDelPresupuesto[] = [
  { columna: 'presupuesto_diseno', etiqueta: 'Diseñar', detalle: null },
  { columna: 'presupuesto_despiece', etiqueta: 'Despiezar', detalle: null },
  {
    columna: 'presupuesto_cotizacion',
    etiqueta: 'Cotizar',
    detalle: 'Madera y herrajes, flete, ayudante',
  },
  { columna: 'presupuesto_pdf', etiqueta: 'Armar el PDF', detalle: null },
];

type FilaQuizasSinTareas = Partial<Pick<Proyecto, ColumnaDeTarea>>;

export function tareaHecha(proyecto: Proyecto, columna: ColumnaDeTarea): boolean {
  return (proyecto as FilaQuizasSinTareas)[columna] === true;
}

export function tareasHechas(proyecto: Proyecto): number {
  return TAREAS_DEL_PRESUPUESTO.filter((tarea) => tareaHecha(proyecto, tarea.columna)).length;
}

export function presupuestoArmado(proyecto: Proyecto): boolean {
  return tareasHechas(proyecto) === TAREAS_DEL_PRESUPUESTO.length;
}

export function marcaDeLaTarea(columna: ColumnaDeTarea, hecha: boolean): CambiosDeTareas {
  switch (columna) {
    case 'presupuesto_diseno':
      return { presupuesto_diseno: hecha };
    case 'presupuesto_despiece':
      return { presupuesto_despiece: hecha };
    case 'presupuesto_cotizacion':
      return { presupuesto_cotizacion: hecha };
    case 'presupuesto_pdf':
      return { presupuesto_pdf: hecha };
  }
}

export function cambiaAlgunaTarea(proyecto: Proyecto, cambios: CambiosDeTareas): boolean {
  return TAREAS_DEL_PRESUPUESTO.some(
    ({ columna }) => columna in cambios && tareaHecha(proyecto, columna) !== cambios[columna],
  );
}
