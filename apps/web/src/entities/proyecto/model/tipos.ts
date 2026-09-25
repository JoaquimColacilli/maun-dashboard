import { claveDelNombre } from '@maun/domain';

import type { Proyecto } from './catalogos';
import { tipoDelTrabajo } from './entrega';

export const TIPOS_DE_ARRANQUE = [
  'Cocina',
  'Placard',
  'Vestidor',
  'Vanitory',
  'Mueble de TV',
  'Biblioteca',
  'Escritorio',
] as const;

export function tiposParaSugerir(proyectos: readonly Proyecto[]): string[] {
  const cuantos = new Map<string, { nombre: string; veces: number }>();
  for (const proyecto of proyectos) {
    const tipo = tipoDelTrabajo(proyecto)?.trim() ?? '';
    if (tipo === '') continue;
    const clave = claveDelNombre(tipo);
    const previo = cuantos.get(clave);
    cuantos.set(clave, { nombre: previo?.nombre ?? tipo, veces: (previo?.veces ?? 0) + 1 });
  }
  const usados = [...cuantos.values()]
    .sort((uno, otro) => otro.veces - uno.veces || uno.nombre.localeCompare(otro.nombre, 'es'))
    .map((tipo) => tipo.nombre);
  const deArranque = TIPOS_DE_ARRANQUE.filter((tipo) => !cuantos.has(claveDelNombre(tipo)));
  return [...usados, ...deArranque];
}
