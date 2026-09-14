export interface DatosDeLaSuscripcion {
  endpoint: string;
  p256dh: string;
  auth: string;
}

const ESPERA_DEL_SERVICE_WORKER_MS = 4000;

export function avisosSoportados(): boolean {
  return (
    'serviceWorker' in navigator && 'PushManager' in globalThis && 'Notification' in globalThis
  );
}

export function permisoDeAvisos(): NotificationPermission | null {
  return 'Notification' in globalThis ? Notification.permission : null;
}

export function pedirPermisoDeAvisos(): Promise<NotificationPermission> {
  return Notification.requestPermission();
}

export function esIphoneOIpad(agente: string, toques: number): boolean {
  return /iPhone|iPad|iPod/.test(agente) || (/Macintosh/.test(agente) && toques > 1);
}

export function esteDispositivoEsIphone(): boolean {
  return esIphoneOIpad(navigator.userAgent, navigator.maxTouchPoints);
}

export function abiertaComoApp(): boolean {
  const deApple = 'standalone' in navigator && navigator.standalone === true;
  return deApple || globalThis.matchMedia('(display-mode: standalone)').matches;
}

export function claveComoBytes(clave: string) {
  const base64 = clave
    .replaceAll('-', '+')
    .replaceAll('_', '/')
    .padEnd(Math.ceil(clave.length / 4) * 4, '=');
  const texto = atob(base64);
  const bytes = new Uint8Array(texto.length);
  for (let indice = 0; indice < texto.length; indice += 1) {
    bytes[indice] = texto.charCodeAt(indice);
  }
  return bytes;
}

export function mismaClave(guardada: ArrayBuffer | null, clave: Uint8Array): boolean {
  if (guardada === null || guardada.byteLength !== clave.byteLength) return false;
  const bytes = new Uint8Array(guardada);
  return bytes.every((byte, indice) => byte === clave[indice]);
}

export function datosDeLaSuscripcion(
  suscripcion: Pick<PushSubscription, 'endpoint' | 'toJSON'>,
): DatosDeLaSuscripcion {
  const { keys } = suscripcion.toJSON();
  const p256dh = keys?.p256dh;
  const auth = keys?.auth;
  if (p256dh === undefined || auth === undefined) {
    throw new Error('La suscripción del navegador no trae sus claves.');
  }
  return { endpoint: suscripcion.endpoint, p256dh, auth };
}

async function registroDelServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  let reloj: ReturnType<typeof setTimeout> | undefined;
  const tope = new Promise<null>((resolver) => {
    reloj = setTimeout(() => {
      resolver(null);
    }, ESPERA_DEL_SERVICE_WORKER_MS);
  });
  try {
    return await Promise.race([navigator.serviceWorker.ready, tope]);
  } finally {
    clearTimeout(reloj);
  }
}

export async function suscripcionDelDispositivo(): Promise<PushSubscription | null> {
  const registro = await registroDelServiceWorker();
  return registro === null ? null : registro.pushManager.getSubscription();
}

export async function suscribirElDispositivo(clavePublica: string): Promise<PushSubscription> {
  const registro = await registroDelServiceWorker();
  if (registro === null) throw new Error('La app no tiene su service worker activo.');
  const clave = claveComoBytes(clavePublica);
  const existente = await registro.pushManager.getSubscription();
  if (existente !== null && !mismaClave(existente.options.applicationServerKey, clave)) {
    await existente.unsubscribe();
  }
  return registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: clave });
}
