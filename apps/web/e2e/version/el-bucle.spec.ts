import { expect, test, type CDPSession, type Page } from '@playwright/test';

import { dedo, tirarYSoltar } from '../apoyo/dedo';
import { listoParaCortar } from '../apoyo/pantalla';
import {
  abrirLaVersionA,
  aviso,
  conElArnes,
  entrarConLaSesion,
  HASTA_EL_AVISO,
  sinTransicionEnCurso,
  tallerVacio,
} from './apoyo';

test.skip(({ isMobile }) => !isMobile, 'el gesto es solo del celular');

const elArnes = conElArnes();

const ARRIBA = 260;
const PASADO_EL_UMBRAL = ARRIBA + 180;
const CADA_CUANTO_TIRA_MS = 3_000;
const DESPUES_DE_SOLTAR_MS = 5_000;

interface Tirones {
  cuantos: () => number;
  parar: () => Promise<void>;
}

function tirarSinParar(page: Page, cdp: CDPSession): Tirones {
  const estado = { sigue: true, cuantos: 0 };
  const bucle = (async () => {
    while (estado.sigue) {
      await sinTransicionEnCurso(page);
      await tirarYSoltar(cdp, ARRIBA, PASADO_EL_UMBRAL);
      estado.cuantos += 1;
      await page.waitForTimeout(CADA_CUANTO_TIRA_MS);
    }
  })();
  return {
    cuantos: () => estado.cuantos,
    parar: async () => {
      estado.sigue = false;
      await bucle;
    },
  };
}

async function marcarElDocumento(page: Page): Promise<string> {
  const marca = crypto.randomUUID();
  await page.evaluate((valor) => {
    (window as unknown as { marcaDelDocumento: string }).marcaDelDocumento = valor;
  }, marca);
  return marca;
}

function marcaDelDocumento(page: Page): Promise<string | undefined> {
  return page.evaluate(
    () => (window as unknown as { marcaDelDocumento?: string }).marcaDelDocumento,
  );
}

test('abriendo la app mientras se baja la versión nueva y tirando sin parar, el aviso aparece apenas termina la descarga', async ({
  page,
  context,
}) => {
  test.setTimeout(120_000);
  const arnes = elArnes();
  await entrarConLaSesion(context, await tallerVacio());
  await abrirLaVersionA(page, arnes);
  arnes.retenerLoNuevo();
  arnes.publicar('b');
  await page.goto('/');
  await listoParaCortar(page);
  await expect.poll(() => arnes.pedidosDeLoNuevo(), HASTA_EL_AVISO).toBeGreaterThan(0);

  const tirones = tirarSinParar(page, await dedo(page));
  await page.waitForTimeout(3 * CADA_CUANTO_TIRA_MS);
  const pedidosDeLoNuevo = arnes.pedidosDeLoNuevo();
  arnes.soltarLoNuevo();
  const soltado = Date.now();

  try {
    await expect(aviso(page)).toBeVisible({ timeout: 20_000 });
  } finally {
    await tirones.parar();
  }
  const tardo = Date.now() - soltado;
  console.log(
    `abriendo y tirando: ${String(tirones.cuantos())} tirones, ${String(pedidosDeLoNuevo)} pedido a lo nuevo mientras se retenía; el aviso apareció a los ${String(tardo)} ms de soltar`,
  );
  expect(pedidosDeLoNuevo).toBe(1);
  expect(tardo).toBeLessThan(DESPUES_DE_SOLTAR_MS);
});

test('recargando sin parar mientras se baja, el aviso aparece en la página que está abierta cuando termina', async ({
  page,
  context,
}) => {
  test.setTimeout(120_000);
  const arnes = elArnes();
  await entrarConLaSesion(context, await tallerVacio());
  await abrirLaVersionA(page, arnes);
  arnes.retenerLoNuevo();
  arnes.publicar('b');
  await page.goto('/');
  await expect.poll(() => arnes.pedidosDeLoNuevo(), HASTA_EL_AVISO).toBeGreaterThan(0);

  for (let vez = 0; vez < 4; vez += 1) {
    await page.waitForTimeout(CADA_CUANTO_TIRA_MS);
    await page.reload();
    await listoParaCortar(page);
  }
  const pedidosDeLoNuevo = arnes.pedidosDeLoNuevo();
  const marca = await marcarElDocumento(page);
  arnes.soltarLoNuevo();
  const soltado = Date.now();

  await expect(aviso(page)).toBeVisible({ timeout: 20_000 });
  const tardo = Date.now() - soltado;
  console.log(
    `recargando: ${String(pedidosDeLoNuevo)} pedido a lo nuevo en cuatro recargas; el aviso apareció a los ${String(tardo)} ms de soltar, en la misma página`,
  );
  expect(pedidosDeLoNuevo).toBe(1);
  expect(await marcaDelDocumento(page)).toBe(marca);
  expect(tardo).toBeLessThan(DESPUES_DE_SOLTAR_MS);
});
