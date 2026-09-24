import { ORIGEN_DE_LA_TARJETA } from '@/shared/lib';

import type { AnchoDeLaPolitica } from './politica';

export interface TransicionEnCurso {
  saltear: () => void;
  lista: Promise<boolean>;
  terminada: Promise<void>;
  cambiarTipos: (sacar: readonly string[], poner: readonly string[]) => void;
}

export type ActualizacionDeLaTransicion = () => Promise<void>;

export type Pieza =
  | { nombre: string; selector: string; todas?: { clase: string } }
  | { nombre: string; elemento: Element };

export interface TarjetaTocada {
  proyectoId: string;
  elemento: Element;
}

export interface Escenario {
  nombrar: (donde: Element | Document, piezas: readonly Pieza[]) => void;
  olvidarLosNombres: () => void;
  escucharLasTarjetas: (alTocar: (tarjeta: TarjetaTocada) => void) => () => void;
  primeraALaVista: (donde: Element | Document, selector: string) => Element | null;
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
      for (const pieza of piezas) {
        if ('elemento' in pieza) {
          ponerNombre(pieza.elemento, pieza.nombre);
        } else if (pieza.todas === undefined) {
          ponerNombre(donde.querySelector(pieza.selector), pieza.nombre);
        } else {
          for (const [indice, elemento] of [...donde.querySelectorAll(pieza.selector)].entries()) {
            ponerNombre(elemento, `${pieza.nombre}-${String(indice + 1)}`, pieza.todas.clase);
          }
        }
      }
    },
    olvidarLosNombres: olvidar,
    escucharLasTarjetas: (alTocar) => {
      const alHacerClic = (evento: Event) => {
        const elemento =
          evento.target instanceof Element
            ? evento.target.closest(`[${ORIGEN_DE_LA_TARJETA}]`)
            : null;
        const proyectoId = elemento?.getAttribute(ORIGEN_DE_LA_TARJETA);
        if (elemento && proyectoId) alTocar({ proyectoId, elemento });
      };
      document.addEventListener('click', alHacerClic, true);
      return () => {
        document.removeEventListener('click', alHacerClic, true);
      };
    },
    primeraALaVista: (donde, selector) => {
      const marco =
        donde instanceof Element
          ? donde.getBoundingClientRect()
          : new DOMRect(0, 0, window.innerWidth, window.innerHeight);
      for (const elemento of donde.querySelectorAll(selector)) {
        const caja = elemento.getBoundingClientRect();
        const alto = Math.min(caja.bottom, marco.bottom) - Math.max(caja.top, marco.top);
        if (caja.height > 0 && alto >= caja.height / 2) return elemento;
      }
      return null;
    },
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
