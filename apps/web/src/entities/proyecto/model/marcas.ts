import { COLUMNAS_DE_MARCAS, type CambiosDeMarcas, type ColumnaDeMarca } from '@/shared/api';

import type { Proyecto } from './catalogos';

type FilaQuizasSinMarcas = Partial<Pick<Proyecto, ColumnaDeMarca>>;

export function marcaPuesta(proyecto: Proyecto, columna: ColumnaDeMarca): boolean {
  return (proyecto as FilaQuizasSinMarcas)[columna] === true;
}

export function marcaDeImportante(columna: ColumnaDeMarca, importante: boolean): CambiosDeMarcas {
  switch (columna) {
    case 'presupuesto_importante':
      return { presupuesto_importante: importante };
    case 'visita_importante':
      return { visita_importante: importante };
    case 'entrega_importante':
      return { entrega_importante: importante };
  }
}

export function cambiaAlgunaMarca(proyecto: Proyecto, cambios: CambiosDeMarcas): boolean {
  return COLUMNAS_DE_MARCAS.some(
    (columna) => columna in cambios && marcaPuesta(proyecto, columna) !== cambios[columna],
  );
}
