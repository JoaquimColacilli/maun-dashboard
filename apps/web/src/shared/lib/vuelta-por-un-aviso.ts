import { useEffect } from 'react';
import { useNavigate } from 'react-router';

import { anotarVueltaPorUnAviso } from './huella';

export const VUELTA_POR_UN_AVISO = 'MAUN_VUELTA_POR_UN_AVISO';

export interface MensajeDeVueltaPorUnAviso {
  type: typeof VUELTA_POR_UN_AVISO;
  url: string;
}

export function esVueltaPorUnAviso(datos: unknown): datos is MensajeDeVueltaPorUnAviso {
  return (
    typeof datos === 'object' &&
    datos !== null &&
    'type' in datos &&
    datos.type === VUELTA_POR_UN_AVISO &&
    'url' in datos &&
    typeof datos.url === 'string'
  );
}

export function rutaDelAviso(url: string, origen: string): string | null {
  let destino: URL;
  try {
    destino = new URL(url, origen);
  } catch {
    return null;
  }
  if (destino.origin !== origen) return null;
  return `${destino.pathname}${destino.search}${destino.hash}`;
}

export function useVueltaPorUnAviso(): void {
  const navegar = useNavigate();

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const trabajador = navigator.serviceWorker;
    const alRecibir = (evento: MessageEvent<unknown>) => {
      if (!esVueltaPorUnAviso(evento.data)) return;
      anotarVueltaPorUnAviso();
      evento.ports[0]?.postMessage(true);
      const ruta = rutaDelAviso(evento.data.url, globalThis.location.origin);
      if (ruta !== null) void navegar(ruta);
    };
    trabajador.addEventListener('message', alRecibir);
    return () => {
      trabajador.removeEventListener('message', alRecibir);
    };
  }, [navegar]);
}
