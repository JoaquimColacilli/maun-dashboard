import { expect, test, type Page } from '@playwright/test';

import { dedo, tirarYSoltar } from '../apoyo/dedo';
import { alFrente, aSegundoPlano, visibilidadControlable } from '../apoyo/huella';
import { indicadorDeSync, listoParaCortar } from '../apoyo/pantalla';
import {
  abrirLaVersionA,
  ahoraEnLaPagina,
  aviso,
  chequeosDeLaApp,
  conElArnes,
  contarLosChequeosDeLaApp,
  entrarConLaSesion,
  HASTA_EL_AVISO,
  hastaQueDejeDePreguntar,
  momentoDelAviso,
  tallerVacio,
} from './apoyo';

const elArnes = conElArnes();

const ARRIBA = 260;
const PASADO_EL_UMBRAL = ARRIBA + 180;

function finDeLaCarga(page: Page): Promise<number> {
  return page.evaluate(() => {
    const navegacion = performance.getEntriesByType('navigation')[0];
    return navegacion instanceof PerformanceNavigationTiming ? navegacion.loadEventEnd : -1;
  });
}

test('al arrancar pregunta una sola vez, y recién después de que terminó de cargar la página', async ({
  page,
  context,
}) => {
  const arnes = elArnes();
  await contarLosChequeosDeLaApp(context);
  await entrarConLaSesion(context, await tallerVacio());
  await abrirLaVersionA(page, arnes);

  const chequeos = await chequeosDeLaApp(page);
  const cargo = await finDeLaCarga(page);
  console.log(
    `al arrancar: chequeos de la app a los ${JSON.stringify(chequeos.map(Math.round))} ms, la carga terminó a los ${String(Math.round(cargo))} ms`,
  );
  expect(chequeos).toHaveLength(1);
  expect(cargo).toBeGreaterThan(0);
  expect(chequeos[0]).toBeGreaterThanOrEqual(cargo);
});

test('volver a la app abierta de antes pregunta, y el aviso aparece sin tocar nada', async ({
  page,
  context,
}, testInfo) => {
  const arnes = elArnes();
  await page.clock.install();
  await visibilidadControlable(page);
  await entrarConLaSesion(context, await tallerVacio());
  await abrirLaVersionA(page, arnes);
  arnes.publicar('b');

  await aSegundoPlano(page);
  await page.clock.fastForward('01:05');
  const antes = arnes.pedidosDelServiceWorker();
  const desde = await ahoraEnLaPagina(page);
  await alFrente(page);

  const aparecio = await momentoDelAviso(page);
  await expect(aviso(page)).toBeVisible(HASTA_EL_AVISO);
  console.log(
    `${testInfo.project.name}: al volver de segundo plano, el aviso apareció a los ${String(Math.round(aparecio - desde))} ms`,
  );
  expect(arnes.pedidosDelServiceWorker()).toBeGreaterThan(antes);
});

test('volver a la app muchas veces seguidas pregunta como mucho una vez por minuto', async ({
  page,
  context,
}) => {
  const arnes = elArnes();
  await page.clock.install();
  await visibilidadControlable(page);
  await contarLosChequeosDeLaApp(context);
  await entrarConLaSesion(context, await tallerVacio());
  await abrirLaVersionA(page, arnes);
  await page.clock.fastForward('01:05');
  const chequeosAntes = (await chequeosDeLaApp(page)).length;
  const pedidosAntes = arnes.pedidosDelServiceWorker();
  const desde = Date.now();

  for (let vez = 0; vez < 6; vez += 1) {
    await aSegundoPlano(page);
    await page.waitForTimeout(300);
    await alFrente(page);
    await page.waitForTimeout(700);
  }
  await hastaQueDejeDePreguntar(arnes, desde);

  const chequeos = (await chequeosDeLaApp(page)).length - chequeosAntes;
  const pedidos = arnes.pedidosDelServiceWorker() - pedidosAntes;
  console.log(
    `seis vueltas en seis segundos: ${String(chequeos)} chequeo y ${String(pedidos)} pedido a sw.js`,
  );
  expect(chequeos).toBe(1);
  expect(pedidos).toBe(1);
});

test('lo que se pidió sin señal se pregunta cuando vuelve la red', async ({ page, context }) => {
  test.skip(!test.info().project.use.isMobile, 'el gesto es del celular');
  const arnes = elArnes();
  await contarLosChequeosDeLaApp(context);
  await entrarConLaSesion(context, await tallerVacio());
  await abrirLaVersionA(page, arnes);
  await context.setOffline(true);
  await expect(indicadorDeSync(page)).toContainText('Sin conexión');
  const chequeosSinRed = (await chequeosDeLaApp(page)).length;

  await tirarYSoltar(await dedo(page), ARRIBA, PASADO_EL_UMBRAL);
  await page.waitForTimeout(2_500);
  expect((await chequeosDeLaApp(page)).length).toBe(chequeosSinRed);

  arnes.publicar('b');
  await context.setOffline(false);

  await expect(aviso(page)).toBeVisible(HASTA_EL_AVISO);
  expect((await chequeosDeLaApp(page)).length).toBe(chequeosSinRed + 1);
});

test('una vez por hora mientras se ve, y nunca mientras está oculta', async ({ page, context }) => {
  test.skip(
    test.info().project.use.isMobile === true,
    'es la pestaña que queda abierta en la compu',
  );
  const arnes = elArnes();
  await page.clock.install();
  await visibilidadControlable(page);
  await contarLosChequeosDeLaApp(context);
  await entrarConLaSesion(context, await tallerVacio());
  await abrirLaVersionA(page, arnes);
  const alAbrir = (await chequeosDeLaApp(page)).length;
  arnes.publicar('b');

  await page.clock.fastForward('01:00:01');
  await expect(aviso(page)).toBeVisible(HASTA_EL_AVISO);
  expect((await chequeosDeLaApp(page)).length).toBe(alAbrir + 1);

  await aSegundoPlano(page);
  await page.clock.fastForward('01:00:01');
  await page.waitForTimeout(1_000);
  expect((await chequeosDeLaApp(page)).length).toBe(alAbrir + 1);
  await alFrente(page);
  await listoParaCortar(page);
});
