import { useSyncExternalStore } from 'react';

export const URL_DEL_SERVICE_WORKER = '/sw.js';

export const PEDIDO_DE_ACTUALIZAR = 'SKIP_WAITING';

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
  recargar: () => void;
}

export interface VigiaDeLaVersion {
  lista: () => TrabajadorDeLaVersion | null;
  suscribir: (avisar: () => void) => () => void;
  aplicar: () => void;
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

  entorno.registroActual().then(conocer, () => undefined);
  entorno.alCargar(() => {
    entorno.registrar().then(conocer, () => undefined);
  });
  entorno.alCambiarElControlador(() => {
    if (huboUnaLista) recargarUnaVez();
  });

  return {
    lista: () => lista,
    suscribir: (avisar) => {
      suscriptores.add(avisar);
      return () => {
        suscriptores.delete(avisar);
      };
    },
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
