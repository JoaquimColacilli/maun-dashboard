import { useSyncExternalStore } from 'react';

// El alto que el usuario ve de verdad. Con el teclado abierto, el viewport visual se achica pero el
// de layout no: una hoja anclada con `bottom: 0` queda debajo del teclado, con el botón de guardar
// adentro. `env(keyboard-inset-height)` no tiene soporte parejo; visualViewport sí.
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
