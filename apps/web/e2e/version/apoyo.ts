import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';

import { listoParaCortar } from '../apoyo/pantalla';
import { iniciarSesionDePrueba, vaciarTaller, type SesionDePrueba } from '../apoyo/taller';
import { levantarArnes, type Arnes } from './arnes';

const VISTA_ANTES_DE_LA_A = '2099-12-30';

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

export async function entrarConLaSesion(
  context: BrowserContext,
  sesion: SesionDePrueba,
): Promise<void> {
  await context.addInitScript(
    ({ guardada, vista }) => {
      if (localStorage.getItem('maun.sesion') === null) {
        localStorage.setItem('maun.sesion', guardada);
      }
      if (localStorage.getItem('maun:novedades-vistas') === null) {
        localStorage.setItem('maun:novedades-vistas', vista);
      }
    },
    { guardada: sesion.guardada, vista: VISTA_ANTES_DE_LA_A },
  );
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

export async function esperarElAviso(page: Page, desde: number): Promise<number> {
  await expect(aviso(page)).toBeVisible(HASTA_EL_AVISO);
  return Date.now() - desde;
}
