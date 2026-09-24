import { expect, test, type Page } from '@playwright/test';

import { apoyar, dedo, levantar, mover, tirarYSoltar } from '../apoyo/dedo';
import { indicadorDeSync, listoParaCortar } from '../apoyo/pantalla';
import { sinTransicionEnCurso } from '../apoyo/transiciones';
import {
  abrirLaVersionA,
  aviso,
  conElArnes,
  conLaBEsperando,
  entrarConLaSesion,
  hastaQueDejeDePreguntar,
  tallerVacio,
} from './apoyo';

const elArnes = conElArnes();

const ARRIBA = 260;
const PASADO_EL_UMBRAL = ARRIBA + 180;

function indicadorDelGesto(page: Page) {
  return page.locator('[data-tirar-para-actualizar]');
}

type VentanaConRechazos = Window & { rechazosSinAtrapar: string[] };

function anotarLosErrores(page: Page): string[] {
  const errores: string[] = [];
  page.on('pageerror', (error) => errores.push(`pageerror: ${error.message}`));
  page.on('console', (mensaje) => {
    if (mensaje.type() === 'error') errores.push(`consola: ${mensaje.text()}`);
  });
  return errores;
}

async function contarLosRechazos(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const ventana = window as unknown as VentanaConRechazos;
    ventana.rechazosSinAtrapar = [];
    window.addEventListener('unhandledrejection', (evento) => {
      ventana.rechazosSinAtrapar.push(String(evento.reason));
    });
  });
}

function rechazosSinAtrapar(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as VentanaConRechazos).rechazosSinAtrapar);
}

test('sin señal, tirar no deja errores ni rechazos sin atrapar, sincroniza como hoy y no sale a la red', async ({
  page,
  context,
}) => {
  test.skip(!test.info().project.use.isMobile, 'el gesto es del celular');
  const arnes = elArnes();
  await contarLosRechazos(page);
  await entrarConLaSesion(context, await tallerVacio());
  await abrirLaVersionA(page, arnes);
  arnes.publicar('b');
  await context.setOffline(true);
  await expect(indicadorDeSync(page)).toContainText('Sin conexión');
  const errores = anotarLosErrores(page);
  const antes = arnes.pedidosDelServiceWorker();

  await tirarYSoltar(await dedo(page), ARRIBA, PASADO_EL_UMBRAL);

  await expect(indicadorDelGesto(page)).toContainText(
    'Sin conexión. Estás viendo lo último que se sincronizó.',
  );
  await expect(indicadorDelGesto(page)).toHaveCount(0, { timeout: 5_000 });
  expect(arnes.pedidosDelServiceWorker()).toBe(antes);
  expect(errores).toEqual([]);
  expect(await rechazosSinAtrapar(page)).toEqual([]);
  await expect(aviso(page)).toHaveCount(0);
  await context.setOffline(false);
});

test('diez tirones en cinco segundos no salen como diez chequeos', async ({ page, context }) => {
  test.skip(!test.info().project.use.isMobile, 'el gesto es del celular');
  test.setTimeout(90_000);
  const arnes = elArnes();
  await entrarConLaSesion(context, await tallerVacio());
  await abrirLaVersionA(page, arnes);
  const antes = arnes.pedidosDelServiceWorker();
  const sincronizaciones: string[] = [];
  page.on('request', (pedido) => {
    if (/\/rest\/v1\/rpc\/(delta|bootstrap)/.test(pedido.url()))
      sincronizaciones.push(pedido.url());
  });
  const cdp = await dedo(page);

  const desde = Date.now();
  for (let vez = 0; vez < 10; vez += 1) {
    await apoyar(cdp, ARRIBA);
    await mover(cdp, ARRIBA, PASADO_EL_UMBRAL, 195, 30);
    await levantar(cdp);
    const espera = desde + (vez + 1) * 500 - Date.now();
    if (espera > 0) await page.waitForTimeout(espera);
  }
  const duraron = Date.now() - desde;
  const desdeElUltimo = Date.now();
  await hastaQueDejeDePreguntar(arnes, desdeElUltimo - 5_000);

  const pedidos = arnes.pedidosDelServiceWorker() - antes;
  console.log(
    `diez tirones en ${String(duraron)} ms: ${String(sincronizaciones.length)} sincronizaciones y ${String(pedidos)} pedidos a sw.js`,
  );
  expect(duraron).toBeLessThan(6_000);
  expect(pedidos).toBeGreaterThan(0);
  expect(pedidos).toBeLessThanOrEqual(sincronizaciones.length);
});

test('una descarga que falla y después una que sale bien: el aviso aparece sin recargar', async ({
  page,
  context,
}) => {
  test.skip(!test.info().project.use.isMobile, 'el gesto es del celular');
  test.setTimeout(90_000);
  const arnes = elArnes();
  await entrarConLaSesion(context, await tallerVacio());
  await abrirLaVersionA(page, arnes);
  await page.evaluate(() => {
    (window as unknown as { marcaDelDocumento: string }).marcaDelDocumento = 'el mismo';
  });
  arnes.fallarLoNuevoUnaVez();
  arnes.publicar('b');
  const cdp = await dedo(page);

  await tirarYSoltar(cdp, ARRIBA, PASADO_EL_UMBRAL);
  await expect.poll(() => arnes.pedidosDeLoNuevo()).toBeGreaterThan(0);
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const registro = await navigator.serviceWorker.getRegistration();
        return registro?.installing === null && registro.waiting === null;
      }),
    )
    .toBe(true);
  await expect(aviso(page)).toHaveCount(0);
  await expect(indicadorDelGesto(page)).toHaveCount(0, { timeout: 5_000 });

  await sinTransicionEnCurso(page);
  await tirarYSoltar(cdp, ARRIBA, PASADO_EL_UMBRAL);

  await expect(aviso(page)).toBeVisible({ timeout: 15_000 });
  expect(
    await page.evaluate(
      () => (window as unknown as { marcaDelDocumento?: string }).marcaDelDocumento,
    ),
  ).toBe('el mismo');
});

test('en la compu, «Sincronizar ahora» de Ajustes también pregunta por la versión nueva', async ({
  page,
  context,
}) => {
  test.skip(test.info().project.use.isMobile === true, 'es el camino sin gesto');
  const arnes = elArnes();
  await entrarConLaSesion(context, await tallerVacio());
  await abrirLaVersionA(page, arnes, '/ajustes');
  arnes.publicar('b');
  const antes = arnes.pedidosDelServiceWorker();

  await page.getByRole('button', { name: 'Sincronizar ahora' }).click();

  await expect(aviso(page)).toBeVisible({ timeout: 15_000 });
  expect(arnes.pedidosDelServiceWorker()).toBeGreaterThan(antes);
});

interface Cajas {
  aviso: { arriba: number; abajo: number };
  pastilla: { arriba: number; abajo: number };
  tapada: boolean;
}

function medirLasCajas(page: Page): Promise<Cajas> {
  return page.evaluate(() => {
    const cartel = document.querySelector('[data-aviso-de-version]')?.getBoundingClientRect();
    const pastilla = document.querySelector<HTMLElement>('[data-tirar-para-actualizar] > div');
    const envoltorio = pastilla?.parentElement;
    if (!cartel || !pastilla || !envoltorio) throw new Error('falta el aviso o el indicador');
    const caja = pastilla.getBoundingClientRect();
    envoltorio.style.setProperty('pointer-events', 'auto');
    const centro = document.elementFromPoint(
      caja.left + caja.width / 2,
      caja.top + caja.height / 2,
    );
    envoltorio.style.removeProperty('pointer-events');
    return {
      aviso: { arriba: Math.round(cartel.top), abajo: Math.round(cartel.bottom) },
      pastilla: { arriba: Math.round(caja.top), abajo: Math.round(caja.bottom) },
      tapada: !pastilla.contains(centro),
    };
  });
}

test('el aviso y el indicador del gesto no se pisan, en claro y en oscuro', async ({
  page,
  context,
}, testInfo) => {
  test.setTimeout(120_000);
  const arnes = elArnes();
  await entrarConLaSesion(context, await tallerVacio());
  await abrirLaVersionA(page, arnes);
  await conLaBEsperando(page, arnes);
  await page.route('**/rest/v1/rpc/delta*', async (ruta) => {
    await new Promise((resolver) => setTimeout(resolver, 1_500));
    await ruta.continue();
  });
  const ancho = testInfo.project.use.viewport?.width ?? 390;

  for (const tema of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: tema });
    await page.goto('/');
    await listoParaCortar(page);
    await expect(aviso(page)).toBeVisible();
    const foto = (estado: string) =>
      page.screenshot({
        path: testInfo.outputPath(`aviso-${String(ancho)}-${tema}-${estado}.png`),
        clip: { x: 0, y: 0, width: ancho, height: 200 },
      });

    if (testInfo.project.use.isMobile !== true) {
      await foto('solo');
      continue;
    }

    const cdp = await dedo(page);
    await sinTransicionEnCurso(page);
    await apoyar(cdp, ARRIBA);
    await mover(cdp, ARRIBA, ARRIBA + 90);
    await expect(indicadorDelGesto(page)).toHaveAttribute('data-tirar-para-actualizar', 'tirando');
    await foto('1-tirando');
    const tirando = await medirLasCajas(page);

    await mover(cdp, ARRIBA + 90, PASADO_EL_UMBRAL);
    await expect(indicadorDelGesto(page)).toHaveAttribute(
      'data-tirar-para-actualizar',
      'listo-para-soltar',
    );
    await foto('2-listo-para-soltar');
    const listo = await medirLasCajas(page);

    await levantar(cdp);
    await expect(indicadorDelGesto(page)).toHaveAttribute(
      'data-tirar-para-actualizar',
      'sincronizando',
    );
    await page.waitForTimeout(300);
    await foto('3-sincronizando');
    const sincronizando = await medirLasCajas(page);

    await expect(indicadorDelGesto(page)).toContainText('Todo sincronizado.', { timeout: 8_000 });
    await foto('4-desenlace');
    const desenlace = await medirLasCajas(page);
    await expect(indicadorDelGesto(page)).toHaveCount(0, { timeout: 5_000 });

    console.log(`${tema}: ${JSON.stringify({ tirando, listo, sincronizando, desenlace })}`);
    for (const cajas of [tirando, listo, sincronizando, desenlace]) {
      expect(cajas.pastilla.arriba).toBeGreaterThanOrEqual(cajas.aviso.abajo);
      expect(cajas.tapada).toBe(false);
    }
  }
});
