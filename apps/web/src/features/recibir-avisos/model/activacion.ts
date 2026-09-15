import {
  activarAvisosEnElServidor,
  apagarAvisosEnElServidor,
  esFalloDeRed,
  mensajeDeSincronizacion,
  type EstadoDeLosAvisos,
} from '@/shared/api';
import {
  datosDeLaSuscripcion,
  suscribirElDispositivo,
  suscripcionDelDispositivo,
  type DatosDeLaSuscripcion,
} from '@/shared/lib';

export type DesenlaceDeLaActivacion =
  | { tipo: 'activos'; estado: EstadoDeLosAvisos; endpoint: string }
  | { tipo: 'denegado' }
  | { tipo: 'no-se-pudo'; mensaje: string };

export type DesenlaceDelApagado = { tipo: 'apagados' } | { tipo: 'no-se-pudo'; mensaje: string };

export const SIN_RESPUESTA =
  'No elegiste nada en el aviso del sistema. Cuando quieras, tocá de nuevo.';
export const SIN_PERMISO_DEL_NAVEGADOR = 'El navegador no dejó pedir el permiso. Probá de nuevo.';
export const SIN_SUSCRIPCION =
  'El navegador no pudo anotarse en su servicio de avisos. Si estás sin señal, probá cuando vuelva.';
export const SIN_SENAL_PARA_ACTIVAR =
  'Sin señal no se pueden activar los avisos. Probá cuando vuelva.';
export const SIN_SENAL_PARA_APAGAR =
  'Sin señal no se pueden apagar los avisos: este dispositivo los sigue recibiendo. Probá cuando vuelva.';

interface SuscripcionDelNavegador {
  endpoint: string;
  toJSON: () => PushSubscriptionJSON;
}

interface SuscripcionQueSeCancela {
  unsubscribe: () => Promise<boolean>;
}

export interface PasosDeLaActivacion {
  suscribir: (clavePublica: string) => Promise<SuscripcionDelNavegador>;
  registrar: (suscripcion: DatosDeLaSuscripcion, zona: string) => Promise<EstadoDeLosAvisos>;
}

export interface PasosDelApagado {
  darDeBaja: (endpoint: string) => Promise<boolean>;
  suscripcionLocal: () => Promise<SuscripcionQueSeCancela | null>;
}

const PASOS_DE_LA_ACTIVACION: PasosDeLaActivacion = {
  suscribir: suscribirElDispositivo,
  registrar: activarAvisosEnElServidor,
};

const PASOS_DEL_APAGADO: PasosDelApagado = {
  darDeBaja: apagarAvisosEnElServidor,
  suscripcionLocal: suscripcionDelDispositivo,
};

export async function terminarDeActivar(
  permiso: Promise<NotificationPermission>,
  clavePublica: string,
  zona: string,
  pasos: PasosDeLaActivacion = PASOS_DE_LA_ACTIVACION,
): Promise<DesenlaceDeLaActivacion> {
  let respuesta: NotificationPermission;
  try {
    respuesta = await permiso;
  } catch {
    return { tipo: 'no-se-pudo', mensaje: SIN_PERMISO_DEL_NAVEGADOR };
  }
  if (respuesta === 'denied') return { tipo: 'denegado' };
  if (respuesta !== 'granted') return { tipo: 'no-se-pudo', mensaje: SIN_RESPUESTA };

  let suscripcion: DatosDeLaSuscripcion;
  try {
    suscripcion = datosDeLaSuscripcion(await pasos.suscribir(clavePublica));
  } catch {
    return { tipo: 'no-se-pudo', mensaje: SIN_SUSCRIPCION };
  }

  try {
    const estado = await pasos.registrar(suscripcion, zona);
    return { tipo: 'activos', estado, endpoint: suscripcion.endpoint };
  } catch (error) {
    return {
      tipo: 'no-se-pudo',
      mensaje: esFalloDeRed(error) ? SIN_SENAL_PARA_ACTIVAR : mensajeDeSincronizacion(error),
    };
  }
}

export async function olvidarLaSuscripcionLocal(
  pasos: PasosDelApagado = PASOS_DEL_APAGADO,
): Promise<void> {
  await pasos
    .suscripcionLocal()
    .then((local) => local?.unsubscribe())
    .catch(() => false);
}

export async function apagarEnEsteDispositivo(
  endpoint: string,
  pasos: PasosDelApagado = PASOS_DEL_APAGADO,
): Promise<DesenlaceDelApagado> {
  try {
    await pasos.darDeBaja(endpoint);
  } catch (error) {
    return {
      tipo: 'no-se-pudo',
      mensaje: esFalloDeRed(error) ? SIN_SENAL_PARA_APAGAR : mensajeDeSincronizacion(error),
    };
  }
  await olvidarLaSuscripcionLocal(pasos);
  return { tipo: 'apagados' };
}
