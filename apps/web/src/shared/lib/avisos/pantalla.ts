import { useSyncExternalStore } from 'react';

export type TonoDelAviso = 'hecho' | 'en-cola' | 'error';

export interface AvisoEnPantalla {
  id: number;
  clave: string;
  tono: TonoDelAviso;
  texto: string;
  detalle: string | null;
  veces: number;
}

export interface TextosDeAviso {
  hecho: string;
  enCola: string;
  error: string;
}

export interface AvisosDeUnaMutacion extends TextosDeAviso {
  que: QueSeGuarda;
  sujeto: string | null;
  errorEnPantalla: boolean;
}

export const TEXTOS_DE_AVISO = {
  movimientoNuevo: {
    hecho: 'Movimiento guardado.',
    enCola: 'Movimiento anotado sin señal: se guarda solo cuando vuelva.',
    error: 'No se guardó el movimiento.',
  },
  movimientoEditado: {
    hecho: 'Cambios del movimiento guardados.',
    enCola: 'Cambios del movimiento anotados sin señal: se guardan solos cuando vuelva.',
    error: 'No se guardaron los cambios del movimiento.',
  },
  movimientoBorrado: {
    hecho: 'Movimiento borrado.',
    enCola: 'Borrado anotado sin señal: se hace solo cuando vuelva.',
    error: 'No se borró el movimiento.',
  },
  clienteNuevo: {
    hecho: 'Cliente guardado.',
    enCola: 'Cliente anotado sin señal: se guarda solo cuando vuelva.',
    error: 'No se guardó el cliente.',
  },
  clienteEditado: {
    hecho: 'Cambios del cliente guardados.',
    enCola: 'Cambios del cliente anotados sin señal: se guardan solos cuando vuelva.',
    error: 'No se guardaron los cambios del cliente.',
  },
  clienteBorrado: {
    hecho: 'Cliente borrado.',
    enCola: 'Borrado anotado sin señal: se hace solo cuando vuelva.',
    error: 'No se borró el cliente.',
  },
  proyectoGuardado: {
    hecho: 'Proyecto guardado.',
    enCola: 'Proyecto anotado sin señal: se guarda solo cuando vuelva.',
    error: 'No se guardó el proyecto.',
  },
  proyectoBorrado: {
    hecho: 'Proyecto borrado.',
    enCola: 'Borrado anotado sin señal: se hace solo cuando vuelva.',
    error: 'No se borró el proyecto.',
  },
  proyectoAvanzado: {
    hecho: 'Cambio de estado guardado.',
    enCola: 'Cambio de estado anotado sin señal: se guarda solo cuando vuelva.',
    error: 'No se guardó el cambio de estado.',
  },
  contactoGuardado: {
    hecho: 'Contacto guardado.',
    enCola: 'Contacto anotado sin señal: se guarda solo cuando vuelva.',
    error: 'No se guardó el contacto.',
  },
  contactoAvanzado: {
    hecho: 'Paso del contacto guardado.',
    enCola: 'Paso del contacto anotado sin señal: se guarda solo cuando vuelva.',
    error: 'No se guardó el paso del contacto.',
  },
  contactoBorrado: {
    hecho: 'Contacto borrado.',
    enCola: 'Borrado anotado sin señal: se hace solo cuando vuelva.',
    error: 'No se borró el contacto.',
  },
  perfil: {
    hecho: 'Perfil guardado.',
    enCola: 'Perfil anotado sin señal: se guarda solo cuando vuelva.',
    error: 'No se guardó el perfil.',
  },
} as const satisfies Record<string, TextosDeAviso>;

export type QueSeGuarda = keyof typeof TEXTOS_DE_AVISO;

export function metaDeAvisos(
  que: QueSeGuarda,
  opciones: { errorEnPantalla?: boolean; sujeto?: string } = {},
): { avisos: AvisosDeUnaMutacion } {
  return {
    avisos: {
      ...TEXTOS_DE_AVISO[que],
      que,
      sujeto: opciones.sujeto ?? null,
      errorEnPantalla: opciones.errorEnPantalla ?? false,
    },
  };
}

function esTexto(valor: unknown): valor is string {
  return typeof valor === 'string' && valor !== '';
}

function esQueSeGuarda(valor: unknown): valor is QueSeGuarda {
  return typeof valor === 'string' && Object.hasOwn(TEXTOS_DE_AVISO, valor);
}

export function avisosDeLaMeta(meta: unknown): AvisosDeUnaMutacion | undefined {
  if (typeof meta !== 'object' || meta === null || !('avisos' in meta)) return undefined;
  const { avisos } = meta;
  if (typeof avisos !== 'object' || avisos === null) return undefined;
  const posible = avisos as Partial<Record<keyof AvisosDeUnaMutacion, unknown>>;
  if (
    !esQueSeGuarda(posible.que) ||
    !esTexto(posible.hecho) ||
    !esTexto(posible.enCola) ||
    !esTexto(posible.error)
  ) {
    return undefined;
  }
  return {
    que: posible.que,
    sujeto: esTexto(posible.sujeto) ? posible.sujeto : null,
    hecho: posible.hecho,
    enCola: posible.enCola,
    error: posible.error,
    errorEnPantalla: posible.errorEnPantalla === true,
  };
}

const DURACION_MS: Readonly<Record<TonoDelAviso, number | null>> = {
  hecho: 5000,
  'en-cola': 8000,
  error: null,
};

const MAXIMO_DE_TRANSITORIOS = 3;

let avisos: readonly AvisoEnPantalla[] = [];
let proximoId = 1;
const relojes = new Map<number, ReturnType<typeof setTimeout>>();
const oyentes = new Set<() => void>();

function publicar(nuevos: readonly AvisoEnPantalla[]): void {
  avisos = nuevos;
  for (const avisar of oyentes) avisar();
}

function cancelarReloj(id: number): void {
  const reloj = relojes.get(id);
  if (reloj !== undefined) clearTimeout(reloj);
  relojes.delete(id);
}

export function descartarDePantalla(id: number): void {
  cancelarReloj(id);
  publicar(avisos.filter((aviso) => aviso.id !== id));
}

export interface NuevoAviso {
  clave: string;
  tono: TonoDelAviso;
  texto: string;
  detalle?: string;
  textoParaVarios?: (veces: number) => string;
}

export function avisarEnPantalla({
  clave,
  tono,
  texto,
  detalle,
  textoParaVarios,
}: NuevoAviso): void {
  const previo = avisos.find((aviso) => aviso.clave === clave && aviso.tono === tono);
  const veces = previo === undefined ? 1 : previo.veces + 1;
  const aviso: AvisoEnPantalla = {
    id: proximoId,
    clave,
    tono,
    texto: veces > 1 && textoParaVarios !== undefined ? textoParaVarios(veces) : texto,
    detalle: detalle ?? null,
    veces,
  };
  proximoId += 1;

  if (previo !== undefined) cancelarReloj(previo.id);
  const siguientes = [...avisos.filter((otro) => otro !== previo), aviso];
  const transitorios = siguientes.filter((otro) => otro.tono !== 'error');
  const sobran = new Set(
    transitorios.slice(0, Math.max(0, transitorios.length - MAXIMO_DE_TRANSITORIOS)),
  );
  for (const viejo of sobran) cancelarReloj(viejo.id);
  publicar(siguientes.filter((otro) => !sobran.has(otro)));

  const duracion = DURACION_MS[tono];
  if (duracion !== null) {
    relojes.set(
      aviso.id,
      setTimeout(() => {
        descartarDePantalla(aviso.id);
      }, duracion),
    );
  }
}

export function vaciarAvisosEnPantalla(): void {
  for (const id of relojes.keys()) cancelarReloj(id);
  publicar([]);
}

function suscribir(avisar: () => void): () => void {
  oyentes.add(avisar);
  return () => {
    oyentes.delete(avisar);
  };
}

function leer(): readonly AvisoEnPantalla[] {
  return avisos;
}

export function useAvisosEnPantalla(): readonly AvisoEnPantalla[] {
  return useSyncExternalStore(suscribir, leer, leer);
}
