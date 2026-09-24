import type { AnchoDeLaPolitica } from './politica';

export interface TransicionEnCurso {
  saltear: () => void;
  lista: Promise<boolean>;
  terminada: Promise<void>;
  cambiarTipos: (sacar: readonly string[], poner: readonly string[]) => void;
}

export type ActualizacionDeLaTransicion = () => Promise<void>;

export interface Pieza {
  selector: string;
  nombre: string;
  todas?: { clase: string };
}

export interface Escenario {
  nombrar: (donde: Element | Document, piezas: readonly Pieza[]) => void;
  olvidarLosNombres: () => void;
  conAlcanceEnElementos: () => boolean;
  conTransicionesDelDocumento: () => boolean;
  aLaVista: () => boolean;
  menosMovimiento: () => boolean;
  ancho: () => AnchoDeLaPolitica;
  empezar: (
    donde: Element | Document,
    tipos: readonly string[] | null,
    actualizar: ActualizacionDeLaTransicion,
  ) => TransicionEnCurso | null;
}

interface TiposDelNavegador {
  add: (tipo: string) => unknown;
  delete: (tipo: string) => boolean;
}

interface TransicionDelNavegador {
  ready: Promise<unknown>;
  finished: Promise<unknown>;
  updateCallbackDone: Promise<unknown>;
  skipTransition: () => void;
  types?: TiposDelNavegador;
}

type Empezar = (
  opciones: ActualizacionDeLaTransicion | { update: ActualizacionDeLaTransicion; types: string[] },
) => TransicionDelNavegador;

function empezarDe(donde: Element | Document): Empezar | null {
  const metodo: unknown = Reflect.get(donde, 'startViewTransition');
  return typeof metodo === 'function' ? (metodo as Empezar).bind(donde) : null;
}

function consulta(medio: string): boolean {
  return globalThis.matchMedia(medio).matches;
}

export function escenarioDelNavegador(): Escenario {
  const nombrados = new Set<HTMLElement>();
  const olvidar = () => {
    for (const elemento of nombrados) {
      elemento.style.viewTransitionName = '';
      elemento.style.removeProperty('view-transition-class');
    }
    nombrados.clear();
  };
  const ponerNombre = (elemento: Element | null, nombre: string, clase?: string) => {
    if (!(elemento instanceof HTMLElement)) return;
    elemento.style.viewTransitionName = nombre;
    if (clase !== undefined) elemento.style.setProperty('view-transition-class', clase);
    nombrados.add(elemento);
  };
  return {
    nombrar: (donde, piezas) => {
      olvidar();
      for (const { selector, nombre, todas } of piezas) {
        if (todas === undefined) {
          ponerNombre(donde.querySelector(selector), nombre);
          continue;
        }
        for (const [indice, elemento] of [...donde.querySelectorAll(selector)].entries()) {
          ponerNombre(elemento, `${nombre}-${String(indice + 1)}`, todas.clase);
        }
      }
    },
    olvidarLosNombres: olvidar,
    conAlcanceEnElementos: () =>
      typeof Reflect.get(Element.prototype, 'startViewTransition') === 'function',
    conTransicionesDelDocumento: () => empezarDe(document) !== null,
    aLaVista: () => document.visibilityState === 'visible',
    menosMovimiento: () => consulta('(prefers-reduced-motion: reduce)'),
    ancho: () =>
      consulta('(min-width: 1280px)')
        ? 'escritorio'
        : consulta('(min-width: 768px)')
          ? 'tablet'
          : 'movil',
    empezar: (donde, tipos, actualizar) => {
      const empezar = empezarDe(donde);
      if (!empezar) return null;
      const transicion =
        tipos === null ? empezar(actualizar) : empezar({ update: actualizar, types: [...tipos] });
      const lista = transicion.ready.then(
        () => true,
        () => false,
      );
      const terminada = transicion.finished.then(
        () => undefined,
        () => undefined,
      );
      transicion.updateCallbackDone.catch(() => undefined);
      return {
        saltear: () => {
          transicion.skipTransition();
        },
        lista,
        terminada,
        cambiarTipos: (sacar, poner) => {
          for (const tipo of sacar) transicion.types?.delete(tipo);
          for (const tipo of poner) transicion.types?.add(tipo);
        },
      };
    },
  };
}
