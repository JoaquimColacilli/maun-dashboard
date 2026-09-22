import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
  type PrecacheEntry,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: (PrecacheEntry | string)[];
};

function esPedidoDeActualizar(datos: unknown): boolean {
  return (
    typeof datos === 'object' && datos !== null && 'type' in datos && datos.type === 'SKIP_WAITING'
  );
}

interface CargaDelAviso {
  titulo: string;
  cuerpo: string;
  url: string;
  etiqueta: string;
}

const CARGA_SIN_DATOS: CargaDelAviso = {
  titulo: 'MAUN',
  cuerpo: 'Hay cosas en la agenda.',
  url: '/agenda',
  etiqueta: 'agenda',
};

function textoDe(datos: object, clave: keyof CargaDelAviso): string {
  const valor = (datos as Readonly<Record<string, unknown>>)[clave];
  return typeof valor === 'string' && valor !== '' ? valor : CARGA_SIN_DATOS[clave];
}

function cargaDelPush(datos: PushMessageData | null): CargaDelAviso {
  if (datos === null) return CARGA_SIN_DATOS;
  let valor: unknown;
  try {
    valor = datos.json();
  } catch {
    return CARGA_SIN_DATOS;
  }
  if (typeof valor !== 'object' || valor === null) return CARGA_SIN_DATOS;
  return {
    titulo: textoDe(valor, 'titulo'),
    cuerpo: textoDe(valor, 'cuerpo'),
    url: textoDe(valor, 'url'),
    etiqueta: textoDe(valor, 'etiqueta'),
  };
}

function urlDeLaApp(datos: unknown): string {
  const ruta =
    typeof datos === 'object' && datos !== null && 'url' in datos && typeof datos.url === 'string'
      ? datos.url
      : CARGA_SIN_DATOS.url;
  const destino = new URL(ruta, self.location.origin);
  return destino.origin === self.location.origin
    ? destino.href
    : new URL(CARGA_SIN_DATOS.url, self.location.origin).href;
}

const VUELTA_POR_UN_AVISO = 'MAUN_VUELTA_POR_UN_AVISO';
const ESPERA_DE_LA_VENTANA_MS = 500;

function avisarLaVuelta(ventana: WindowClient, url: string): Promise<void> {
  return new Promise((resolver) => {
    const canal = new MessageChannel();
    const reloj = setTimeout(() => {
      resolver();
    }, ESPERA_DE_LA_VENTANA_MS);
    canal.port1.onmessage = () => {
      clearTimeout(reloj);
      resolver();
    };
    ventana.postMessage({ type: VUELTA_POR_UN_AVISO, url }, [canal.port2]);
  });
}

async function abrirLaApp(url: string): Promise<void> {
  const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const ventana = ventanas.find((cliente) => new URL(cliente.url).origin === self.location.origin);
  if (ventana === undefined) {
    await self.clients.openWindow(url);
    return;
  }
  await avisarLaVuelta(ventana, url);
  await ventana.focus().catch(() => null);
}

self.addEventListener('message', (evento) => {
  if (esPedidoDeActualizar(evento.data)) void self.skipWaiting();
});

self.addEventListener('push', (evento) => {
  const carga = cargaDelPush(evento.data);
  evento.waitUntil(
    self.registration.showNotification(carga.titulo, {
      body: carga.cuerpo,
      tag: carga.etiqueta,
      icon: '/pwa-192x192.png',
      badge: '/pwa-64x64.png',
      lang: 'es-AR',
      data: { url: carga.url },
    }),
  );
});

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  evento.waitUntil(abrirLaApp(urlDeLaApp(evento.notification.data)));
});

const VISTA_PUBLICA = /^\/v\//;

const ENCUESTA_PUBLICA = /^\/o\//;

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('/index.html'), {
    denylist: [VISTA_PUBLICA, ENCUESTA_PUBLICA],
  }),
);
