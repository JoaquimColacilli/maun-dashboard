import { useSyncExternalStore } from 'react';

function suscribir(avisar: () => void): () => void {
  const viewport = globalThis.visualViewport;
  if (!viewport) return () => undefined;
  viewport.addEventListener('resize', avisar);
  viewport.addEventListener('scroll', avisar);
  return () => {
    viewport.removeEventListener('resize', avisar);
    viewport.removeEventListener('scroll', avisar);
  };
}

function leer(): number | undefined {
  return globalThis.visualViewport?.height;
}

function enElServidor(): number | undefined {
  return undefined;
}

export function useAltoVisible(): number | undefined {
  return useSyncExternalStore(suscribir, leer, enElServidor);
}
