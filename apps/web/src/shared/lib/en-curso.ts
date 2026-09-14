import { useLayoutEffect, useSyncExternalStore } from 'react';

let enCurso = 0;
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

const hayAlgo = () => enCurso > 0;

export function useAlgoEnCurso(activo: boolean): void {
  useLayoutEffect(() => {
    if (!activo) return;
    enCurso += 1;
    avisar();
    return () => {
      enCurso -= 1;
      avisar();
    };
  }, [activo]);
}

export function useHayAlgoEnCurso(): boolean {
  return useSyncExternalStore(suscribir, hayAlgo, hayAlgo);
}
