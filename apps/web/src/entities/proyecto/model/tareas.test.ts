import { describe, expect, it } from 'vitest';

import { COLUMNAS_DE_TAREAS } from '@/shared/api';

import type { Proyecto } from './catalogos';
import {
  cambiaAlgunaTarea,
  marcaDeLaTarea,
  presupuestoArmado,
  TAREAS_DEL_PRESUPUESTO,
  tareaHecha,
  tareasHechas,
} from './tareas';

function fila(tildadas: Partial<Proyecto> = {}): Proyecto {
  return {
    presupuesto_diseno: false,
    presupuesto_despiece: false,
    presupuesto_cotizacion: false,
    presupuesto_pdf: false,
    ...tildadas,
  } as unknown as Proyecto;
}

describe('las tareas de presupuestar', () => {
  it('son las cuatro columnas de la base, en el orden en que se hacen', () => {
    expect(TAREAS_DEL_PRESUPUESTO.map((tarea) => tarea.columna)).toEqual([...COLUMNAS_DE_TAREAS]);
    expect(TAREAS_DEL_PRESUPUESTO.map((tarea) => tarea.etiqueta)).toEqual([
      'Diseñar',
      'Despiezar',
      'Cotizar',
      'Armar el PDF',
    ]);
  });

  it('cuenta las tildadas y dice que está armado recién con las cuatro', () => {
    const dos = fila({ presupuesto_diseno: true, presupuesto_despiece: true });
    expect(tareasHechas(dos)).toBe(2);
    expect(presupuestoArmado(dos)).toBe(false);

    const cuatro = fila({
      presupuesto_diseno: true,
      presupuesto_despiece: true,
      presupuesto_cotizacion: true,
      presupuesto_pdf: true,
    });
    expect(tareasHechas(cuatro)).toBe(4);
    expect(presupuestoArmado(cuatro)).toBe(true);
  });

  it('una fila guardada en el dispositivo antes de que existieran las tareas no tiene ninguna tildada', () => {
    const vieja = {} as Proyecto;
    expect(tareasHechas(vieja)).toBe(0);
    expect(tareaHecha(vieja, 'presupuesto_pdf')).toBe(false);
  });

  it('tildar una tarea cambia solo su columna', () => {
    for (const columna of COLUMNAS_DE_TAREAS) {
      expect(marcaDeLaTarea(columna, true)).toEqual({ [columna]: true });
    }
    expect(cambiaAlgunaTarea(fila(), { presupuesto_pdf: true })).toBe(true);
    expect(cambiaAlgunaTarea(fila(), { presupuesto_pdf: false })).toBe(false);
    expect(cambiaAlgunaTarea({} as Proyecto, { presupuesto_diseno: false })).toBe(false);
  });
});
