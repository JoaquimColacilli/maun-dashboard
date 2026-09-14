import type { Page, Worker } from '@playwright/test';

const CLAVE = 'e2e:push';

export const CLAVE_PUBLICA_DE_PRUEBA = `B${'A'.repeat(86)}`;

const CORS = { 'Access-Control-Allow-Origin': '*' };

export interface OpcionesDelPush {
  permiso?: NotificationPermission;
  respuesta?: NotificationPermission;
}

interface AlcanceEspiado {
  registration: {
    showNotification: (titulo: string, opciones?: NotificationOptions) => Promise<void>;
  };
  __notificaciones?: unknown[];
}

export async function simularPush(
  page: Page,
  { permiso = 'default', respuesta = 'granted' }: OpcionesDelPush = {},
): Promise<void> {
  await page.addInitScript(
    ({ clave, permisoInicial, respuestaAlPedir }) => {
      const pedidos: boolean[] = [];
      Object.defineProperty(globalThis, '__pedidosDePermiso', {
        value: pedidos,
        configurable: true,
      });

      const leerPermiso = (): NotificationPermission => {
        const guardado = localStorage.getItem(`${clave}:permiso`);
        return guardado === 'granted' || guardado === 'denied' ? guardado : permisoInicial;
      };
      Object.defineProperty(Notification, 'permission', { configurable: true, get: leerPermiso });
      Notification.requestPermission = () => {
        pedidos.push(navigator.userActivation.isActive);
        if (leerPermiso() === 'default') localStorage.setItem(`${clave}:permiso`, respuestaAlPedir);
        return Promise.resolve(leerPermiso());
      };

      const creados = (): string[] =>
        JSON.parse(localStorage.getItem(`${clave}:todos`) ?? '[]') as string[];
      const suscripcion = (endpoint: string) => ({
        endpoint,
        expirationTime: null,
        options: { applicationServerKey: null, userVisibleOnly: true },
        getKey: () => null,
        toJSON: () => ({
          endpoint,
          expirationTime: null,
          keys: { p256dh: `B${'x'.repeat(86)}`, auth: 'y'.repeat(22) },
        }),
        unsubscribe: () => {
          localStorage.removeItem(`${clave}:endpoint`);
          return Promise.resolve(true);
        },
      });

      PushManager.prototype.getSubscription = function () {
        const endpoint = localStorage.getItem(`${clave}:endpoint`);
        return Promise.resolve(
          (endpoint === null ? null : suscripcion(endpoint)) as unknown as PushSubscription | null,
        );
      };
      PushManager.prototype.subscribe = function () {
        const endpoint = `https://push.example/e2e-${crypto.randomUUID()}`;
        localStorage.setItem(`${clave}:endpoint`, endpoint);
        localStorage.setItem(`${clave}:todos`, JSON.stringify([...creados(), endpoint]));
        return Promise.resolve(suscripcion(endpoint) as unknown as PushSubscription);
      };
    },
    { clave: CLAVE, permisoInicial: permiso, respuestaAlPedir: respuesta },
  );
}

export async function pedidosDePermiso(page: Page): Promise<boolean[]> {
  return page.evaluate(() => [
    ...(globalThis as unknown as { __pedidosDePermiso: boolean[] }).__pedidosDePermiso,
  ]);
}

export async function endpointDelDispositivo(page: Page): Promise<string | null> {
  return page.evaluate((clave) => localStorage.getItem(`${clave}:endpoint`), CLAVE);
}

export async function endpointsCreados(page: Page): Promise<string[]> {
  return page
    .evaluate(
      (clave) => JSON.parse(localStorage.getItem(`${clave}:todos`) ?? '[]') as string[],
      CLAVE,
    )
    .catch(() => []);
}

export async function servidorDeAvisosSimulado(page: Page, configurado: boolean): Promise<void> {
  await page.route('**/functions/v1/avisos', async (ruta) => {
    if (ruta.request().method() !== 'GET') {
      await ruta.fallback();
      return;
    }
    await ruta.fulfill({
      status: 200,
      headers: CORS,
      json: { configurado, clavePublica: configurado ? CLAVE_PUBLICA_DE_PRUEBA : null },
    });
  });
}

export async function sinPreferenciasLaPrimeraVez(page: Page): Promise<void> {
  let respondidas = 0;
  await page.route('**/rest/v1/rpc/estado_de_mis_avisos', async (ruta) => {
    if (ruta.request().method() !== 'POST' || respondidas > 0) {
      await ruta.fallback();
      return;
    }
    respondidas += 1;
    await ruta.fulfill({
      status: 200,
      headers: CORS,
      json: { suscripto: false, ultimo_envio: null, dispositivos: 0, preferencias: null },
    });
  });
}

export async function espiarNotificaciones(trabajador: Worker): Promise<void> {
  await trabajador.evaluate(() => {
    const alcance = self as unknown as AlcanceEspiado;
    const armadas: unknown[] = [];
    alcance.__notificaciones = armadas;
    alcance.registration.showNotification = (titulo, opciones = {}) => {
      armadas.push({ titulo, ...opciones });
      return Promise.resolve();
    };
  });
}

export async function notificacionesArmadas(trabajador: Worker): Promise<unknown[]> {
  return trabajador.evaluate(() => (self as unknown as AlcanceEspiado).__notificaciones ?? []);
}
