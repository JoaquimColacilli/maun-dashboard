export interface EntradaDelHistorial {
  key: string;
  url: string;
}

export interface Historial {
  disponible: () => boolean;
  actual: () => EntradaDelHistorial | null;
  anteriores: () => EntradaDelHistorial[];
}

interface EntradaDelNavegador {
  key: string;
  url: string | null;
  index: number;
  sameDocument: boolean;
}

interface NavegacionDelNavegador {
  currentEntry: EntradaDelNavegador | null;
  entries: () => EntradaDelNavegador[];
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

export function historialDelNavegador(): Historial {
  const navegacion =
    'navigation' in globalThis
      ? (globalThis.navigation as unknown as NavegacionDelNavegador)
      : undefined;
  return historialDe(navegacion, globalThis.location.origin);
}
