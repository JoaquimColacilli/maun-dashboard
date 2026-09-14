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

self.addEventListener('message', (evento) => {
  if (esPedidoDeActualizar(evento.data)) void self.skipWaiting();
});

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')));
