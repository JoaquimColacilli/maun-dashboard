import { useSyncExternalStore } from 'react';

import { NOVEDADES, type Novedad } from './novedades';

export interface NovedadesAbiertas {
  novedades: readonly Novedad[];
  solas: boolean;
}

let abiertas: NovedadesAbiertas | null = null;
const oyentes = new Set<() => void>();

function avisar(): void {
  for (const oyente of oyentes) oyente();
}

function suscribir(oyente: () => void): () => void {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}

function leer(): NovedadesAbiertas | null {
  return abiertas;
}

export function abrirNovedades(novedades: readonly Novedad[] = NOVEDADES, solas = false): void {
  abiertas = { novedades, solas };
  avisar();
}

export function cerrarNovedades(): void {
  if (abiertas === null) return;
  abiertas = null;
  avisar();
}

export function useNovedadesAbiertas(): NovedadesAbiertas | null {
  return useSyncExternalStore(suscribir, leer, leer);
}
