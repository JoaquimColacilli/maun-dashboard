import { useSyncExternalStore } from 'react';

export interface VentanaVisible {
  alto: number;
  arriba: number;
}

let ultimaVentana: VentanaVisible | undefined;

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

function leerVentana(): VentanaVisible | undefined {
  const viewport = globalThis.visualViewport;
  if (!viewport) return undefined;
  if (ultimaVentana?.alto !== viewport.height || ultimaVentana.arriba !== viewport.offsetTop) {
    ultimaVentana = { alto: viewport.height, arriba: viewport.offsetTop };
  }
  return ultimaVentana;
}

function enElServidor(): undefined {
  return undefined;
}

export function useAltoVisible(): number | undefined {
  return useSyncExternalStore(suscribir, leer, enElServidor);
}

export function useVentanaVisible(): VentanaVisible | undefined {
  return useSyncExternalStore(suscribir, leerVentana, enElServidor);
}
