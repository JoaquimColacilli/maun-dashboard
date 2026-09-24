import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';

import { listoParaCortar } from '../apoyo/pantalla';
import { entrarConLaSesion } from '../apoyo/sesion';
import { iniciarSesionDePrueba, vaciarTaller, type SesionDePrueba } from '../apoyo/taller';
import { levantarArnes, type Arnes } from './arnes';

export { entrarConLaSesion };

export const HASTA_EL_AVISO = { timeout: 30_000 };

export function conElArnes(): () => Arnes {
  let arnes: Arnes | undefined;
  test.beforeAll(async () => {
    arnes = await levantarArnes();
  });
  test.afterAll(async () => {
    await arnes?.cerrar();
  });
  test.beforeEach(() => {
    arnes?.reiniciar();
  });
  test.afterEach(() => {
    arnes?.reiniciar();
  });
  return () => {
    if (arnes === undefined) throw new Error('El arnés no se levantó.');
    return arnes;
  };
}

export async function tallerVacio(): Promise<SesionDePrueba> {
  const sesion = await iniciarSesionDePrueba();
  await vaciarTaller(sesion);
  return sesion;
}

export function controlada(page: Page): Promise<boolean> {
  return page.evaluate(() => navigator.serviceWorker.controller !== null);
}

const SILENCIO_DESPUES_DE_PREGUNTAR_MS = 3_000;

export async function hastaQueDejeDePreguntar(arnes: Arnes, desde: number): Promise<void> {
  await expect
    .poll(
      () => {
        const ultimo = arnes.pedidos.filter(
          (pedido) => pedido.ruta === '/sw.js' && pedido.cuando >= desde,
        );
        const cuando = ultimo.at(-1)?.cuando;
        return cuando !== undefined && Date.now() - cuando > SILENCIO_DESPUES_DE_PREGUNTAR_MS;
      },
      { timeout: 30_000 },
    )
    .toBe(true);
}

export async function abrirLaVersionA(page: Page, arnes: Arnes, ruta = '/'): Promise<void> {
  await page.goto(ruta);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  const desde = Date.now();
  await page.reload();
  await expect.poll(() => controlada(page)).toBe(true);
  await listoParaCortar(page);
  await hastaQueDejeDePreguntar(arnes, desde);
}

export function aviso(page: Page): Locator {
  return page.getByRole('status').filter({ hasText: 'Hay una versión nueva' });
}

export async function momentoDelAviso(page: Page): Promise<number> {
  const manija = await page.waitForFunction(
    () =>
      [...document.querySelectorAll('[role="status"]')].some((estado) =>
        estado.textContent.includes('Hay una versión nueva'),
      )
        ? performance.now()
        : null,
    undefined,
    { polling: 50, timeout: HASTA_EL_AVISO.timeout },
  );
  return Math.round(Number(await manija.jsonValue()));
}

export function ahoraEnLaPagina(page: Page): Promise<number> {
  return page.evaluate(() => performance.now());
}

export async function conLaBEsperando(page: Page, arnes: Arnes): Promise<void> {
  arnes.publicar('b');
  await page.goto('/');
  await expect(aviso(page)).toBeVisible(HASTA_EL_AVISO);
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const registro = await navigator.serviceWorker.getRegistration();
        return registro?.waiting !== null && registro?.waiting !== undefined;
      }),
    )
    .toBe(true);
}

type VentanaQueCuenta = Window & { registrosDelServiceWorker: number };

export async function contarLosRegistros(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const ventana = window as unknown as VentanaQueCuenta;
    ventana.registrosDelServiceWorker = 0;
    const contenedor = navigator.serviceWorker;
    const registrar = contenedor.register.bind(contenedor);
    contenedor.register = (...argumentos) => {
      ventana.registrosDelServiceWorker += 1;
      return registrar(...argumentos);
    };
  });
}

export function registrosDelDocumento(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as VentanaQueCuenta).registrosDelServiceWorker);
}

type VentanaConChequeos = Window & { chequeosDeLaApp: number[] };

export async function contarLosChequeosDeLaApp(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const ventana = window as unknown as VentanaConChequeos;
    ventana.chequeosDeLaApp = [];
    const prototipo = ServiceWorkerRegistration.prototype;
    const original: unknown = Object.getOwnPropertyDescriptor(prototipo, 'update')?.value;
    if (typeof original !== 'function') return;
    Object.defineProperty(prototipo, 'update', {
      configurable: true,
      writable: true,
      value: function (this: ServiceWorkerRegistration) {
        ventana.chequeosDeLaApp.push(performance.now());
        return Reflect.apply(original, this, []) as Promise<ServiceWorkerRegistration>;
      },
    });
  });
}

export function chequeosDeLaApp(page: Page): Promise<number[]> {
  return page.evaluate(() => (window as unknown as VentanaConChequeos).chequeosDeLaApp);
}
