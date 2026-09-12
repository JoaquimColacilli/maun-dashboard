import { useSyncExternalStore } from 'react';

export type AnchoDePantalla = 'movil' | 'tablet' | 'escritorio';

const TABLET = '(min-width: 768px)';
const ESCRITORIO = '(min-width: 1280px)';

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
