export interface EntradaDelHistorial {
  key: string;
  url: string;
}

export interface Historial {
  disponible: () => boolean;
  actual: () => EntradaDelHistorial | null;
  anteriores: () => EntradaDelHistorial[];
}

export interface Traslado {
  desde: string;
  saltos: number;
  navegadorYaAnimo: boolean;
}

export interface HistorialQueEscucha extends Historial {
  escucharLosTraslados: () => () => void;
  olvidarElTraslado: () => Traslado | null;
}

interface EntradaDelNavegador {
  key: string;
  url: string | null;
  index: number;
  sameDocument: boolean;
}

interface EventoDeNavegar {
  navigationType: string;
  hasUAVisualTransition?: boolean;
  destination: { index: number };
}

interface NavegacionDelNavegador {
  currentEntry: EntradaDelNavegador | null;
  entries: () => EntradaDelNavegador[];
  addEventListener?: (tipo: 'navigate', oyente: (evento: EventoDeNavegar) => void) => void;
  removeEventListener?: (tipo: 'navigate', oyente: (evento: EventoDeNavegar) => void) => void;
}

function caminoDe(url: string | null, origen: string): string | null {
  if (url === null || url === '') return null;
  try {
    const leida = new URL(url, origen);
    if (leida.origin !== origen) return null;
    return `${leida.pathname}${leida.search}${leida.hash}`;
  } catch {
    return null;
  }
}

export function historialQueEscucha(
  navegacion: NavegacionDelNavegador | undefined,
  origen: string,
): HistorialQueEscucha {
  let ultimo: Traslado | null = null;
  const alNavegar = (evento: EventoDeNavegar) => {
    const desde = navegacion?.currentEntry;
    if (evento.navigationType !== 'traverse' || !desde) {
      ultimo = null;
      return;
    }
    ultimo = {
      desde: desde.key,
      saltos: evento.destination.index - desde.index,
      navegadorYaAnimo: evento.hasUAVisualTransition === true,
    };
  };
  return {
    ...historialDe(navegacion, origen),
    escucharLosTraslados: () => {
      navegacion?.addEventListener?.('navigate', alNavegar);
      return () => {
        navegacion?.removeEventListener?.('navigate', alNavegar);
      };
    },
    olvidarElTraslado: () => {
      const traslado = ultimo;
      ultimo = null;
      return traslado;
    },
  };
}

export function historialDe(
  navegacion: NavegacionDelNavegador | undefined,
  origen: string,
): Historial {
  const actual = (): EntradaDelHistorial | null => {
    const entrada = navegacion?.currentEntry;
    const url = caminoDe(entrada?.url ?? null, origen);
    return entrada && url !== null ? { key: entrada.key, url } : null;
  };
  return {
    disponible: () => navegacion !== undefined && navegacion.currentEntry !== null,
    actual,
    anteriores: () => {
      const entrada = navegacion?.currentEntry;
      if (!navegacion || !entrada) return [];
      const todas = navegacion.entries();
      const anteriores: EntradaDelHistorial[] = [];
      for (let indice = entrada.index - 1; indice >= 0; indice -= 1) {
        const una = todas[indice];
        if (!una?.sameDocument) break;
        const url = caminoDe(una.url, origen);
        if (url === null) break;
        anteriores.push({ key: una.key, url });
      }
      return anteriores;
    },
  };
}

function navegacionDelNavegador(): NavegacionDelNavegador | undefined {
  return 'navigation' in globalThis ? globalThis.navigation : undefined;
}

export function historialDelNavegador(): HistorialQueEscucha {
  return historialQueEscucha(navegacionDelNavegador(), globalThis.location.origin);
}
