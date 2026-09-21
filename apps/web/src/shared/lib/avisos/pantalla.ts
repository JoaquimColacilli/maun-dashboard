import { useSyncExternalStore } from 'react';

export type TonoDelAviso = 'hecho' | 'en-cola' | 'error';

export interface AccionDelAviso {
  etiqueta: string;
  alTocar: () => void;
}

export interface AvisoEnPantalla {
  id: number;
  clave: string;
  tono: TonoDelAviso;
  texto: string;
  detalle: string | null;
  veces: number;
  accion: AccionDelAviso | null;
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
  silencioso: boolean;
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
  tareaDelPresupuesto: {
    hecho: 'Tarea del presupuesto guardada.',
    enCola: 'Tarea del presupuesto anotada sin señal: se guarda sola cuando vuelva.',
    error: 'No se guardó la tarea del presupuesto.',
  },
  marcaDeLaAgenda: {
    hecho: 'Marca guardada.',
    enCola: 'Marca anotada sin señal: se guarda sola cuando vuelva.',
    error: 'No se guardó la marca de importante.',
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
  anotacion: {
    hecho: 'Anotación guardada.',
    enCola: 'Anotación hecha sin señal: se guarda sola cuando vuelva.',
    error: 'No se guardó la anotación.',
  },
  anotacionBorrada: {
    hecho: 'Anotación borrada.',
    enCola: 'Borrado anotado sin señal: se hace solo cuando vuelva.',
    error: 'No se borró la anotación.',
  },
  archivo: {
    hecho: 'Archivo guardado.',
    enCola: 'Archivo anotado sin señal: se guarda solo cuando vuelva.',
    error: 'No se guardó el archivo.',
  },
  archivoBorrado: {
    hecho: 'Archivo borrado.',
    enCola: 'Borrado anotado sin señal: se hace solo cuando vuelva.',
    error: 'No se borró el archivo.',
  },
  eventoMovido: {
    hecho: 'Movido en la agenda.',
    enCola: 'Movido sin señal: se guarda solo cuando vuelva.',
    error: 'No se pudo mover.',
  },
  costosEstimados: {
    hecho: 'Costos estimados guardados.',
    enCola: 'Costos estimados anotados sin señal: se guardan solos cuando vuelva.',
    error: 'No se guardaron los costos estimados.',
  },
  loQueHaceFalta: {
    hecho: 'Lo que hace falta guardado.',
    enCola: 'Anotado sin señal: se guarda solo cuando vuelva.',
    error: 'No se guardó lo que hace falta.',
  },
  enlaceDelCliente: {
    hecho: 'Enlace creado.',
    enCola: 'Para crear el enlace hace falta señal.',
    error: 'No se creó el enlace.',
  },
  bajaDelEnlace: {
    hecho: 'El enlace ya no funciona.',
    enCola: 'Para darlo de baja hace falta señal.',
    error: 'No se dio de baja el enlace.',
  },
  formasDeCobro: {
    hecho: 'Listo: ya sabe cómo pagarte.',
    enCola: 'Anotado sin señal: se guarda solo cuando vuelva.',
    error: 'No se pudo cambiar cómo te paga.',
  },
  archivoCompartido: {
    hecho: 'Listo: ya lo ve tu cliente.',
    enCola: 'Anotado sin señal: se guarda solo cuando vuelva.',
    error: 'No se pudo cambiar qué ve tu cliente.',
  },
  archivoNoCompartido: {
    hecho: 'Listo: ya no lo ve tu cliente.',
    enCola: 'Anotado sin señal: se guarda solo cuando vuelva.',
    error: 'No se pudo cambiar qué ve tu cliente.',
  },
  pregunta: {
    hecho: 'Pregunta guardada.',
    enCola: 'Pregunta anotada sin señal: se guarda sola cuando vuelva.',
    error: 'No se guardó la pregunta.',
  },
  preguntaPropia: {
    hecho: 'La sumamos a la encuesta de este trabajo.',
    enCola: 'Pregunta anotada sin señal: se guarda sola cuando vuelva.',
    error: 'No se guardó la pregunta de este trabajo.',
  },
  opinionLeida: {
    hecho: 'Opinión leída.',
    enCola: 'Anotado sin señal: se guarda solo cuando vuelva.',
    error: 'No se pudo marcar la opinión como leída.',
  },
  encuesta: {
    hecho: 'El enlace de la encuesta está listo.',
    enCola: 'Para crear el enlace de la encuesta hace falta señal.',
    error: 'No se creó el enlace de la encuesta.',
  },
  bajaDeLaEncuesta: {
    hecho: 'El enlace de la encuesta ya no funciona.',
    enCola: 'Para darlo de baja hace falta señal.',
    error: 'No se dio de baja el enlace de la encuesta.',
  },
  recordatorio: {
    hecho: 'Queda anotado que se lo recordaste.',
    enCola: 'Recordatorio anotado sin señal: se guarda solo cuando vuelva.',
    error: 'No se anotó el recordatorio.',
  },
} as const satisfies Record<string, TextosDeAviso>;

export type QueSeGuarda = keyof typeof TEXTOS_DE_AVISO;

export function metaDeAvisos(
  que: QueSeGuarda,
  opciones: { errorEnPantalla?: boolean; sujeto?: string; silencioso?: boolean } = {},
): { avisos: AvisosDeUnaMutacion } {
  return {
    avisos: {
      ...TEXTOS_DE_AVISO[que],
      que,
      sujeto: opciones.sujeto ?? null,
      errorEnPantalla: opciones.errorEnPantalla ?? false,
      silencioso: opciones.silencioso ?? false,
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
    silencioso: posible.silencioso === true,
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
  reemplaza?: string;
  accion?: AccionDelAviso;
}

export function avisoEnPantalla(id: number): AvisoEnPantalla | undefined {
  return avisos.find((aviso) => aviso.id === id);
}

export function avisarEnPantalla({
  clave,
  tono,
  texto,
  detalle,
  textoParaVarios,
  reemplaza,
  accion,
}: NuevoAviso): number {
  const previo =
    avisos.find((aviso) => aviso.clave === clave) ??
    (reemplaza === undefined ? undefined : avisos.find((aviso) => aviso.clave === reemplaza));
  const veces = previo?.clave === clave && previo.tono === tono ? previo.veces + 1 : 1;
  const aviso: AvisoEnPantalla = {
    id: previo?.id ?? proximoId,
    clave,
    tono,
    texto: veces > 1 && textoParaVarios !== undefined ? textoParaVarios(veces) : texto,
    detalle: detalle ?? null,
    veces,
    accion: accion ?? null,
  };

  if (previo === undefined) proximoId += 1;
  else cancelarReloj(previo.id);
  const siguientes =
    previo === undefined
      ? [...avisos, aviso]
      : avisos.map((otro) => (otro === previo ? aviso : otro));
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
  return aviso.id;
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
