import { useSyncExternalStore } from 'react';

export const URL_DEL_SERVICE_WORKER = '/sw.js';

export const PEDIDO_DE_ACTUALIZAR = 'SKIP_WAITING';

export const ESPERA_ENTRE_CHEQUEOS_SOLOS_MS = 60_000;

export const CADA_CUANTO_PREGUNTA_SOLA_MS = 60 * 60_000;

export type MotivoDelChequeo = 'a-mano' | 'arranque' | 'vuelta' | 'red' | 'hora';

export interface TrabajadorDeLaVersion extends EventTarget {
  readonly state: ServiceWorkerState;
  postMessage(mensaje: unknown): void;
}

export interface RegistroDeLaVersion extends EventTarget {
  readonly installing: TrabajadorDeLaVersion | null;
  readonly waiting: TrabajadorDeLaVersion | null;
  readonly active: TrabajadorDeLaVersion | null;
  update(): Promise<unknown>;
}

export interface EntornoDeLaVersion {
  registroActual: () => Promise<RegistroDeLaVersion | undefined>;
  registrar: () => Promise<RegistroDeLaVersion>;
  alCargar: (accion: () => void) => void;
  alCambiarElControlador: (accion: () => void) => void;
  alVolverAVerse: (accion: () => void) => void;
  alVolverLaRed: (accion: () => void) => void;
  cadaTanto: (accion: () => void, milisegundos: number) => void;
  seVe: () => boolean;
  hayRed: () => boolean;
  ahora: () => number;
  recargar: () => void;
}

export interface VigiaDeLaVersion {
  lista: () => TrabajadorDeLaVersion | null;
  suscribir: (avisar: () => void) => () => void;
  buscar: (motivo: MotivoDelChequeo) => Promise<void>;
  aplicar: () => void;
}

export type DecisionDelChequeo = 'preguntar' | 'sumarse' | 'no' | 'cuando-haya-red';

export interface SituacionDelChequeo {
  motivo: MotivoDelChequeo;
  hayRegistro: boolean;
  hayUnoEnCurso: boolean;
  seEstaBajando: boolean;
  hayRed: boolean;
  quedoUnoPendiente: boolean;
  desdeElUltimo: number | null;
}

export function decidirElChequeo(situacion: SituacionDelChequeo): DecisionDelChequeo {
  if (situacion.hayUnoEnCurso) return 'sumarse';
  if (!situacion.hayRegistro || situacion.seEstaBajando) return 'no';
  if (!situacion.hayRed) return 'cuando-haya-red';
  if (situacion.motivo === 'a-mano') return 'preguntar';
  if (situacion.motivo === 'red' && situacion.quedoUnoPendiente) return 'preguntar';
  const recien =
    situacion.desdeElUltimo !== null && situacion.desdeElUltimo < ESPERA_ENTRE_CHEQUEOS_SOLOS_MS;
  return recien ? 'no' : 'preguntar';
}

export function versionLista(registro: RegistroDeLaVersion): TrabajadorDeLaVersion | null {
  return registro.waiting !== null && registro.active !== null ? registro.waiting : null;
}

export function crearVigiaDeLaVersion(entorno: EntornoDeLaVersion): VigiaDeLaVersion {
  const suscriptores = new Set<() => void>();
  const seguidos = new WeakSet<TrabajadorDeLaVersion>();
  const conocidos = new WeakSet<RegistroDeLaVersion>();
  let registro: RegistroDeLaVersion | null = null;
  let lista: TrabajadorDeLaVersion | null = null;
  let enCurso: Promise<void> | null = null;
  let ultimoIntento: number | null = null;
  let quedoUnoPendiente = false;
  let huboUnaLista = false;
  let recargando = false;

  const recargarUnaVez = () => {
    if (recargando) return;
    recargando = true;
    entorno.recargar();
  };

  const recalcular = () => {
    const actual = registro;
    if (actual === null) return;
    if (actual.installing !== null) seguir(actual.installing);
    if (actual.waiting !== null) seguir(actual.waiting);
    const siguiente = versionLista(actual);
    if (siguiente === lista) return;
    lista = siguiente;
    if (siguiente !== null) huboUnaLista = true;
    for (const avisar of suscriptores) avisar();
  };

  function seguir(trabajador: TrabajadorDeLaVersion): void {
    if (seguidos.has(trabajador)) return;
    seguidos.add(trabajador);
    trabajador.addEventListener('statechange', recalcular);
  }

  const conocer = (encontrado: RegistroDeLaVersion | undefined) => {
    if (encontrado === undefined) return;
    registro = encontrado;
    if (!conocidos.has(encontrado)) {
      conocidos.add(encontrado);
      encontrado.addEventListener('updatefound', recalcular);
    }
    recalcular();
  };

  const buscar = (motivo: MotivoDelChequeo): Promise<void> => {
    const actual = registro;
    const ahora = entorno.ahora();
    const decision = decidirElChequeo({
      motivo,
      hayRegistro: actual !== null,
      hayUnoEnCurso: enCurso !== null,
      seEstaBajando: actual !== null && actual.installing !== null,
      hayRed: entorno.hayRed(),
      quedoUnoPendiente,
      desdeElUltimo: ultimoIntento === null ? null : ahora - ultimoIntento,
    });
    if (decision === 'sumarse' && enCurso !== null) return enCurso;
    if (decision === 'cuando-haya-red') quedoUnoPendiente = true;
    if (decision !== 'preguntar' || actual === null) return Promise.resolve();
    ultimoIntento = ahora;
    const chequeo = actual
      .update()
      .then(
        () => {
          quedoUnoPendiente = false;
        },
        () => {
          quedoUnoPendiente = true;
        },
      )
      .finally(() => {
        enCurso = null;
        recalcular();
      });
    enCurso = chequeo;
    return chequeo;
  };

  entorno.registroActual().then(conocer, () => undefined);
  entorno.alCargar(() => {
    entorno.registrar().then(
      (encontrado) => {
        conocer(encontrado);
        void buscar('arranque');
      },
      () => undefined,
    );
  });
  entorno.alCambiarElControlador(() => {
    if (huboUnaLista) recargarUnaVez();
  });
  entorno.alVolverAVerse(() => {
    void buscar('vuelta');
  });
  entorno.alVolverLaRed(() => {
    void buscar('red');
  });
  entorno.cadaTanto(() => {
    if (entorno.seVe()) void buscar('hora');
  }, CADA_CUANTO_PREGUNTA_SOLA_MS);

  return {
    lista: () => lista,
    suscribir: (avisar) => {
      suscriptores.add(avisar);
      return () => {
        suscriptores.delete(avisar);
      };
    },
    buscar,
    aplicar: () => {
      const esperando = registro?.waiting ?? null;
      if (esperando === null) {
        recargarUnaVez();
        return;
      }
      huboUnaLista = true;
      esperando.addEventListener('statechange', () => {
        if (esperando.state === 'activated') recargarUnaVez();
      });
      esperando.postMessage({ type: PEDIDO_DE_ACTUALIZAR });
    },
  };
}

function entornoDelNavegador(): EntornoDeLaVersion {
  const trabajadores = navigator.serviceWorker;
  return {
    registroActual: () => trabajadores.getRegistration(),
    registrar: () => trabajadores.register(URL_DEL_SERVICE_WORKER, { scope: '/', type: 'classic' }),
    alCargar: (accion) => {
      if (document.readyState === 'complete') {
        setTimeout(accion, 0);
        return;
      }
      window.addEventListener('load', accion, { once: true });
    },
    alCambiarElControlador: (accion) => {
      trabajadores.addEventListener('controllerchange', accion);
    },
    alVolverAVerse: (accion) => {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') accion();
      });
    },
    alVolverLaRed: (accion) => {
      window.addEventListener('online', accion);
    },
    cadaTanto: (accion, milisegundos) => {
      setInterval(accion, milisegundos);
    },
    seVe: () => document.visibilityState === 'visible',
    hayRed: () => navigator.onLine,
    ahora: () => Date.now(),
    recargar: () => {
      globalThis.location.reload();
    },
  };
}

const CLAVE_DEL_VIGIA = Symbol.for('maun:vigia-de-la-version');

function vigiaActual(): VigiaDeLaVersion | undefined {
  return Reflect.get(globalThis, CLAVE_DEL_VIGIA) as VigiaDeLaVersion | undefined;
}

export function vigilarLaVersionNueva(): void {
  if (vigiaActual() !== undefined || !('serviceWorker' in navigator)) return;
  Reflect.set(globalThis, CLAVE_DEL_VIGIA, crearVigiaDeLaVersion(entornoDelNavegador()));
}

export function buscarVersionNueva(): Promise<void> {
  return vigiaActual()?.buscar('a-mano') ?? Promise.resolve();
}

export function aplicarLaVersionNueva(): void {
  const vigia = vigiaActual();
  if (vigia === undefined) {
    globalThis.location.reload();
    return;
  }
  vigia.aplicar();
}

function suscribir(avisar: () => void): () => void {
  return vigiaActual()?.suscribir(avisar) ?? (() => undefined);
}

function leer(): TrabajadorDeLaVersion | null {
  return vigiaActual()?.lista() ?? null;
}

export function useVersionNueva(): boolean {
  return useSyncExternalStore(suscribir, leer, leer) !== null;
}
