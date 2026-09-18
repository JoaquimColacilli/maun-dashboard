import {
  calcularMargen,
  CATEGORIAS_DE_COSTO,
  categoriasEstimadas,
  centavos,
  costoEstimado,
  type CategoriaDeCosto,
  type CostosEstimados,
  type MargenDelTrabajo,
} from '@maun/domain';

import { COLUMNAS_DE_COSTOS, type CambiosDeCostos, type ColumnaDeCosto } from '@/shared/api';

import type { Proyecto } from './catalogos';

export interface CostoDelTrabajo {
  categoria: CategoriaDeCosto;
  columna: ColumnaDeCosto;
  etiqueta: string;
}

export const COLUMNA_DEL_COSTO: Readonly<Record<CategoriaDeCosto, ColumnaDeCosto>> = {
  madera: 'costo_madera_centavos',
  herrajes: 'costo_herrajes_centavos',
  flete: 'costo_flete_centavos',
  ayudante: 'costo_ayudante_centavos',
};

export const COSTOS_DEL_TRABAJO: readonly CostoDelTrabajo[] = [
  { categoria: 'madera', columna: 'costo_madera_centavos', etiqueta: 'Madera' },
  { categoria: 'herrajes', columna: 'costo_herrajes_centavos', etiqueta: 'Herrajes' },
  { categoria: 'flete', columna: 'costo_flete_centavos', etiqueta: 'Flete' },
  { categoria: 'ayudante', columna: 'costo_ayudante_centavos', etiqueta: 'Ayudante' },
];

type FilaQuizasSinCostos = Partial<Pick<Proyecto, ColumnaDeCosto>>;

export function costoGuardado(proyecto: Proyecto, columna: ColumnaDeCosto): number | null {
  return (proyecto as FilaQuizasSinCostos)[columna] ?? null;
}

export function costosDelProyecto(proyecto: Proyecto): CostosEstimados {
  const armados = {} as Record<CategoriaDeCosto, ReturnType<typeof centavos> | null>;
  for (const categoria of CATEGORIAS_DE_COSTO) {
    const guardado = costoGuardado(proyecto, COLUMNA_DEL_COSTO[categoria]);
    armados[categoria] = guardado === null ? null : centavos(guardado);
  }
  return armados;
}

export function cambiaAlgunCosto(proyecto: Proyecto, cambios: CambiosDeCostos): boolean {
  return COLUMNAS_DE_COSTOS.some(
    (columna) => columna in cambios && costoGuardado(proyecto, columna) !== cambios[columna],
  );
}

export function cambiosDeCostos(
  valores: Readonly<Record<CategoriaDeCosto, number | null>>,
): CambiosDeCostos {
  return {
    costo_madera_centavos: valores.madera,
    costo_herrajes_centavos: valores.herrajes,
    costo_flete_centavos: valores.flete,
    costo_ayudante_centavos: valores.ayudante,
  };
}

export function costosGuardados(proyecto: Proyecto): CambiosDeCostos {
  return cambiosDeCostos({
    madera: costoGuardado(proyecto, 'costo_madera_centavos'),
    herrajes: costoGuardado(proyecto, 'costo_herrajes_centavos'),
    flete: costoGuardado(proyecto, 'costo_flete_centavos'),
    ayudante: costoGuardado(proyecto, 'costo_ayudante_centavos'),
  });
}

export function hayCostosEstimados(proyecto: Proyecto): boolean {
  return categoriasEstimadas(costosDelProyecto(proyecto)) > 0;
}

export function totalEstimado(proyecto: Proyecto): number {
  return costoEstimado(costosDelProyecto(proyecto));
}

export function margenDelTrabajo(proyecto: Proyecto): MargenDelTrabajo {
  return calcularMargen({
    presupuesto:
      proyecto.presupuesto_centavos === null ? null : centavos(proyecto.presupuesto_centavos),
    costos: costosDelProyecto(proyecto),
  });
}
