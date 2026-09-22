import { expect, test, type Page } from '@playwright/test';

import {
  activarBloqueoEnElDispositivo,
  contarPedidosDeHuella,
  pedidosDeHuella,
  registrarHuellaEnElTelefono,
  telefonoConHuella,
  usuarioDeLaSesion,
} from '../apoyo/huella';
import { listoParaCortar } from '../apoyo/pantalla';
import {
  abrirLaVersionA,
  aviso,
  conElArnes,
  conLaBEsperando,
  controlada,
  entrarConLaSesion,
  tallerVacio,
} from './apoyo';
import { NOVEDAD_DE_LA_B } from './arnes';

const elArnes = conElArnes();

const DESPUES_DE_LA_RECARGA_MS = 3_000;

function contarLasNavegaciones(page: Page): () => number {
  let navegaciones = 0;
  page.on('framenavigated', (marco) => {
    if (marco === page.mainFrame()) navegaciones += 1;
  });
  return () => navegaciones;
}

function novedadesDeLaB(page: Page) {
  return page.getByRole('listitem').filter({ hasText: NOVEDAD_DE_LA_B });
}

test('tocar «Actualizar» recarga una sola vez, arranca la versión nueva con sus novedades una vez, y la huella queda como hoy', async ({
  page,
  context,
}) => {
  test.skip(!test.info().project.use.isMobile, 'la huella es del celular');
  test.setTimeout(120_000);
  const arnes = elArnes();
  await contarPedidosDeHuella(page);
  await entrarConLaSesion(context, await tallerVacio());
  await abrirLaVersionA(page, arnes);
  const telefono = await telefonoConHuella(page, true);
  await registrarHuellaEnElTelefono(telefono, await usuarioDeLaSesion(page));
  await activarBloqueoEnElDispositivo(page);
  await conLaBEsperando(page, arnes);
  await listoParaCortar(page);
  await expect(novedadesDeLaB(page)).toHaveCount(0);

  const navegaciones = contarLasNavegaciones(page);
  await aviso(page).getByRole('button', { name: 'Actualizar' }).click();

  await expect(novedadesDeLaB(page)).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(DESPUES_DE_LA_RECARGA_MS);
  expect(navegaciones()).toBe(1);
  expect(await pedidosDeHuella(page)).toBe(0);
  await expect(page.getByRole('heading', { level: 1, name: /^Hola/ })).toHaveCount(0);
  await expect(aviso(page)).toHaveCount(0);
  expect(await controlada(page)).toBe(true);

  await page.getByRole('button', { name: 'Cerrar las novedades' }).click();
  await page.reload();
  await listoParaCortar(page);
  await page.waitForTimeout(1_000);
  await expect(novedadesDeLaB(page)).toHaveCount(0);
});

test('desde una pestaña sin controlar, como después de Ctrl+Shift+R, tocar «Actualizar» también recarga una sola vez, y la otra pestaña que mostraba el aviso recarga como hoy', async ({
  page,
  context,
}) => {
  test.skip(test.info().project.use.isMobile === true, 'la recarga forzada es de la compu');
  const arnes = elArnes();
  await entrarConLaSesion(context, await tallerVacio());
  await abrirLaVersionA(page, arnes);
  await conLaBEsperando(page, arnes);

  const forzada = await context.newPage();
  await forzada.goto('/');
  await listoParaCortar(forzada);
  const cdp = await context.newCDPSession(forzada);
  const recargada = forzada.waitForEvent('load');
  await cdp.send('Page.reload', { ignoreCache: true });
  await recargada;
  await listoParaCortar(forzada);
  expect(await controlada(forzada)).toBe(false);
  await expect(aviso(forzada)).toBeVisible();

  const navegacionesDeLaForzada = contarLasNavegaciones(forzada);
  const navegacionesDeLaOtra = contarLasNavegaciones(page);
  await aviso(forzada).getByRole('button', { name: 'Actualizar' }).click();

  await expect.poll(() => navegacionesDeLaForzada(), { timeout: 15_000 }).toBe(1);
  await listoParaCortar(forzada);
  await forzada.waitForTimeout(DESPUES_DE_LA_RECARGA_MS);
  expect(navegacionesDeLaForzada()).toBe(1);
  expect(await controlada(forzada)).toBe(true);
  await expect(aviso(forzada)).toHaveCount(0);
  expect(navegacionesDeLaOtra()).toBe(1);
});

test('con una sola pestaña, Ctrl+Shift+R deja a la versión vieja sin nadie que la use, y la que esperaba entra sola', async ({
  page,
  context,
}) => {
  test.skip(test.info().project.use.isMobile === true, 'la recarga forzada es de la compu');
  const arnes = elArnes();
  await entrarConLaSesion(context, await tallerVacio());
  await abrirLaVersionA(page, arnes);
  await conLaBEsperando(page, arnes);

  const cdp = await context.newCDPSession(page);
  const recargada = page.waitForEvent('load');
  await cdp.send('Page.reload', { ignoreCache: true });
  await recargada;
  await listoParaCortar(page);

  expect(await controlada(page)).toBe(false);
  expect(
    await page.evaluate(async () => {
      const registro = await navigator.serviceWorker.getRegistration();
      return registro?.waiting ?? null;
    }),
  ).toBeNull();
  await expect(aviso(page)).toHaveCount(0);
});
