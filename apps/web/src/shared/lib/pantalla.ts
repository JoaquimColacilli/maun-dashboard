import { useSyncExternalStore } from 'react';

export type AnchoDePantalla = 'movil' | 'tablet' | 'escritorio';

const CORTE_DE_CELULAR = 768;
const TABLET = `(min-width: ${String(CORTE_DE_CELULAR)}px)`;
const ESCRITORIO = '(min-width: 1280px)';

let celularAlAbrir: boolean | undefined;

function suscribir(avisar: () => void): () => void {
  const consultas = [globalThis.matchMedia(TABLET), globalThis.matchMedia(ESCRITORIO)];
  for (const consulta of consultas) consulta.addEventListener('change', avisar);
  return () => {
    for (const consulta of consultas) consulta.removeEventListener('change', avisar);
  };
}

function leer(): AnchoDePantalla {
  if (globalThis.matchMedia(ESCRITORIO).matches) return 'escritorio';
  if (globalThis.matchMedia(TABLET).matches) return 'tablet';
  return 'movil';
}

export function useAnchoDePantalla(): AnchoDePantalla {
  return useSyncExternalStore(suscribir, leer, leer);
}

export function esMedidaDeCelular(ancho: number, alto: number): boolean {
  return Math.min(ancho, alto) < CORTE_DE_CELULAR;
}

export function esCelular(): boolean {
  celularAlAbrir ??= esMedidaDeCelular(globalThis.screen.width, globalThis.screen.height);
  return celularAlAbrir;
}
