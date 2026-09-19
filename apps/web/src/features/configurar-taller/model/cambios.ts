import { COLUMNAS_DE_AJUSTES, type CambiosDeAjustes, type FilaDe } from '@/shared/api';

export interface DiferenciasDeAjustes {
  cambios: CambiosDeAjustes;
  previos: CambiosDeAjustes;
}

export function diferencias(
  ajustes: FilaDe<'ajustes'>,
  nuevos: CambiosDeAjustes,
): DiferenciasDeAjustes {
  const cambios: CambiosDeAjustes = {};
  const previos: CambiosDeAjustes = {};
  for (const columna of COLUMNAS_DE_AJUSTES) {
    const nuevo = nuevos[columna];
    if (nuevo === undefined || nuevo === ajustes[columna]) continue;
    Object.assign(cambios, { [columna]: nuevo });
    Object.assign(previos, { [columna]: ajustes[columna] });
  }
  return { cambios, previos };
}
