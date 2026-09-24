import type { OpcionesDeIr, PuertoDeNavegacion } from '@/shared/lib';

import type { Compuerta } from './compuerta';
import type { Escenario, TransicionEnCurso } from './escenario';
import type { HistorialQueEscucha } from './historial';
import type { Memoria } from './memoria';
import {
  etiquetaDeVolver,
  planDeIr,
  planDeVolver,
  type Paso,
  type Plan,
  type Situacion,
} from './pila';
import {
  decidir,
  movimientoAlApilar,
  type Decision,
  type EntradaDeLaPolitica,
  type NavegacionDeLaPolitica,
} from './politica';

export const TOPE_DE_UN_PASO_MS = 1_500;
export const TOPE_DEL_MARCO_MS = 1_000;
export const TOPE_DE_LA_COLA_MS = 2_000;

export interface UbicacionDelRouter {
  pathname: string;
  search: string;
  key: string;
}

export interface RouterDelCoordinador {
  state: { location: UbicacionDelRouter };
  navigate: {
    (a: number): Promise<void>;
    (a: string, opciones: { replace: boolean; state?: unknown; flushSync: boolean }): Promise<void>;
  };
}

export interface DependenciasDelCoordinador {
  router: RouterDelCoordinador;
  historial: HistorialQueEscucha;
  escenario: Escenario;
  memoria: Memoria;
  compuerta: Compuerta;
}

export type OyenteDeLaSalida = (saliendoDe: string | null) => void;

export interface Coordinador extends PuertoDeNavegacion {
  escuchar: () => () => void;
  registrarElMain: (main: HTMLElement | null) => void;
  avisarDelMarco: (key: string) => void;
  escucharLaSalida: (oyente: OyenteDeLaSalida) => () => void;
}

function conTope(promesa: Promise<unknown>, milisegundos: number): Promise<void> {
  return new Promise<void>((listo) => {
    const reloj = setTimeout(listo, milisegundos);
    promesa.then(
      () => {
        clearTimeout(reloj);
        listo();
      },
      () => {
        clearTimeout(reloj);
        listo();
      },
    );
  });
}

export function destinoDelPlan(plan: Plan, situacion: Situacion): string {
  let pila = [situacion.actual, ...situacion.anteriores.map((entrada) => entrada.url)];
  let posicion = 0;
  for (const paso of plan.pasos) {
    if (paso.tipo === 'atras') {
      posicion = Math.min(posicion + paso.saltos, pila.length - 1);
    } else if (paso.tipo === 'reemplazar') {
      pila = pila.map((url, indice) => (indice === posicion ? paso.url : url));
    } else {
      pila = [paso.url, ...pila.slice(posicion)];
      posicion = 0;
    }
  }
  return pila[posicion] ?? situacion.actual;
}

function navegacionDelPlan(plan: Plan): NavegacionDeLaPolitica {
  const saltos = plan.pasos.reduce(
    (suma, paso) => suma + (paso.tipo === 'atras' ? paso.saltos : 0),
    0,
  );
  switch (plan.tipo) {
    case 'atras':
      return { tipo: 'atras', saltos };
    case 'seccion':
      return {
        tipo: 'seccion',
        saltos,
        cambiaDePestana: plan.pasos.some((paso) => paso.tipo === 'reemplazar'),
      };
    case 'terminar':
      return { tipo: 'terminar' };
    case 'reemplazar':
      return { tipo: 'reemplazar' };
    default:
      return { tipo: 'apilar' };
  }
}

export function crearCoordinador(d: DependenciasDelCoordinador): Coordinador {
  let main: HTMLElement | null = null;
  let claveDelMarco: string | null = null;
  const esperandoAlMarco = new Set<() => void>();
  let enCurso: TransicionEnCurso | null = null;
  let cola: Promise<void> = Promise.resolve();
  let enLaCola = 0;
  let popsPropios = 0;
  const oyentesDeLaSalida = new Set<OyenteDeLaSalida>();

  const avisarLaSalida = (saliendoDe: string | null) => {
    for (const oyente of oyentesDeLaSalida) oyente(saliendoDe);
  };

  const urlDelRouter = () => {
    const { pathname, search } = d.router.state.location;
    return `${pathname}${search}`;
  };

  const situacion = (): Situacion => ({
    actual: urlDelRouter(),
    anteriores: d.historial.anteriores(),
    movil: d.escenario.ancho() === 'movil',
    conHistorial: d.historial.disponible(),
  });

  const entradaBase = (): Omit<
    EntradaDeLaPolitica,
    'desde' | 'hacia' | 'navegacion' | 'memoria'
  > => ({
    ancho: d.escenario.ancho(),
    alcanceEnElementos: d.escenario.conAlcanceEnElementos(),
    transicionesDelDocumento: d.escenario.conTransicionesDelDocumento(),
    aLaVista: d.escenario.aLaVista(),
    menosMovimiento: d.escenario.menosMovimiento(),
    navegadorYaAnimo: false,
    desdeLaNavegacion: false,
    sinTransicion: false,
    desdeUnaTarjeta: false,
  });

  const esperarAlMarco = (claveAntes: string | null): Promise<void> => {
    if (claveDelMarco !== claveAntes) return Promise.resolve();
    return conTope(
      new Promise<void>((listo) => {
        esperandoAlMarco.add(listo);
      }),
      TOPE_DEL_MARCO_MS,
    );
  };

  const ejecutar = async (pasos: readonly Paso[], sincronico: boolean) => {
    for (const [indice, paso] of pasos.entries()) {
      if (paso.tipo === 'atras') {
        popsPropios += 1;
        await conTope(d.router.navigate(-paso.saltos), TOPE_DE_UN_PASO_MS);
        popsPropios = 0;
        continue;
      }
      await conTope(
        d.router.navigate(paso.url, {
          replace: paso.tipo === 'reemplazar',
          state: paso.state,
          flushSync: sincronico || indice > 0,
        }),
        TOPE_DE_UN_PASO_MS,
      );
    }
  };

  const animar = async (decision: Decision, actualizar: () => Promise<void>) => {
    if (decision.tipo === 'ninguno') {
      await actualizar();
      return;
    }
    const donde = decision.tipo === 'movimiento' && decision.alcance === 'main' ? main : document;
    const tipos = decision.tipo === 'movimiento' ? [decision.movimiento] : null;
    let terminarLaActualizacion: () => void = () => undefined;
    const actualizada = new Promise<void>((listo) => {
      terminarLaActualizacion = listo;
    });
    const transicion =
      donde === null
        ? null
        : d.escenario.empezar(donde, tipos, async () => {
            try {
              await actualizar();
            } finally {
              terminarLaActualizacion();
            }
          });
    if (transicion === null) {
      await actualizar();
      return;
    }
    enCurso = transicion;
    void transicion.terminada.then(() => {
      if (enCurso === transicion) enCurso = null;
    });
    await actualizada;
  };

  const anotarLaMemoria = (plan: Plan, desdeUnaTarjeta: boolean) => {
    const ultimo = plan.pasos.at(-1);
    if (!ultimo || ultimo.tipo === 'atras') return;
    const actual = d.historial.actual();
    const [debajo] = d.historial.anteriores();
    if (!actual || !debajo) return;
    const apilarSimple = plan.pasos.length === 1 && ultimo.tipo === 'apilar';
    d.memoria.anotar(
      actual.key,
      movimientoAlApilar(debajo.url, actual.url, apilarSimple && desdeUnaTarjeta),
    );
  };

  const correr = (
    armar: (situacion: Situacion) => Plan,
    opciones: OpcionesDeIr,
    desdeUnaTarjeta: boolean,
  ) => {
    d.compuerta.entregarLoRetenido();
    enCurso?.saltear();
    const anterior = cola;
    enLaCola += 1;
    cola = (async () => {
      await conTope(anterior, TOPE_DE_LA_COLA_MS);
      const ahora = situacion();
      const plan = armar(ahora);
      if (plan.pasos.length === 0) return;
      const hacia = destinoDelPlan(plan, ahora);
      const [debajo] = ahora.anteriores;
      const actual = d.historial.actual();
      const decision =
        main === null
          ? ({ tipo: 'ninguno' } as const)
          : decidir({
              ...entradaBase(),
              desde: ahora.actual,
              hacia,
              navegacion: navegacionDelPlan(plan),
              desdeLaNavegacion: opciones.desdeLaNavegacion === true,
              sinTransicion: opciones.sinTransicion === true,
              desdeUnaTarjeta,
              memoria: {
                deLaQueSeVa: actual ? d.memoria.leer(actual.key) : undefined,
                deLaQueLlega: debajo ? d.memoria.leer(debajo.key) : undefined,
              },
            });
      const claveAntes = claveDelMarco;
      if (decision.tipo === 'ninguno') {
        await ejecutar(plan.pasos, false);
      } else {
        await animar(decision, async () => {
          await ejecutar(plan.pasos, true);
          await esperarAlMarco(claveAntes);
        });
      }
      anotarLaMemoria(plan, desdeUnaTarjeta);
    })()
      .catch(() => undefined)
      .finally(() => {
        enLaCola -= 1;
        if (enLaCola === 0) avisarLaSalida(null);
      });
  };

  d.compuerta.alVolver(() => {
    if (popsPropios > 0) {
      popsPropios -= 1;
      d.historial.olvidarElTraslado();
      return 'ahora';
    }
    enCurso?.saltear();
    const traslado = d.historial.olvidarElTraslado();
    const destino = d.historial.actual();
    if (!traslado || !destino || main === null) return 'ahora';
    const decision = decidir({
      ...entradaBase(),
      desde: urlDelRouter(),
      hacia: destino.url,
      navegacion: {
        tipo: traslado.saltos < 0 ? 'atras' : 'adelante',
        saltos: Math.abs(traslado.saltos),
      },
      navegadorYaAnimo: traslado.navegadorYaAnimo,
      memoria: {
        deLaQueSeVa: d.memoria.leer(traslado.desde),
        deLaQueLlega: d.memoria.leer(destino.key),
      },
    });
    if (decision.tipo !== 'movimiento') return 'ahora';
    const claveAntes = claveDelMarco;
    void animar(decision, async () => {
      d.compuerta.entregarLoRetenido();
      d.historial.olvidarElTraslado();
      await esperarAlMarco(claveAntes);
    });
    return 'retener';
  });

  return {
    ir: (destino, opciones) => {
      correr((ahora) => planDeIr(destino, opciones, ahora), opciones, false);
    },
    volver: (padre) => {
      correr((ahora) => planDeVolver(padre, ahora), {}, false);
    },
    etiquetaDeVolver: (padre, etiqueta) =>
      etiquetaDeVolver(padre, etiqueta, d.historial.anteriores()),
    hayUnaTransicion: () => enCurso !== null,
    cerrarLasHojasAntes: () => d.escenario.ancho() === 'movil',
    anunciarLaSalida: () => {
      avisarLaSalida(d.router.state.location.key);
    },
    escucharLaSalida: (oyente) => {
      oyentesDeLaSalida.add(oyente);
      return () => {
        oyentesDeLaSalida.delete(oyente);
      };
    },
    escuchar: () => d.historial.escucharLosTraslados(),
    registrarElMain: (elemento) => {
      main = elemento;
    },
    avisarDelMarco: (key) => {
      claveDelMarco = key;
      for (const listo of esperandoAlMarco) listo();
      esperandoAlMarco.clear();
    },
  };
}
