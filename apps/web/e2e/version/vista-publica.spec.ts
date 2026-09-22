import { expect, test } from '@playwright/test';

import {
  abrirLaVersionA,
  aviso,
  conElArnes,
  conLaBEsperando,
  entrarConLaSesion,
  hastaQueDejeDePreguntar,
  tallerVacio,
} from './apoyo';

test.skip(({ isMobile }) => isMobile, 'una vez alcanza');

const elArnes = conElArnes();

test('la vista pública no muestra el aviso aunque haya una versión esperando, y el cliente no registra nada', async ({
  page,
  context,
  browser,
}) => {
  const arnes = elArnes();
  const token = crypto.randomUUID().replaceAll('-', '');
  await entrarConLaSesion(context, await tallerVacio());
  await abrirLaVersionA(page, arnes);
  await conLaBEsperando(page, arnes);

  const desde = Date.now();
  await page.goto(`/v/${token}`);
  await page.waitForLoadState('load');
  await page.waitForTimeout(2_000);
  await expect(aviso(page)).toHaveCount(0);
  await hastaQueDejeDePreguntar(arnes, desde);

  const cliente = await browser.newContext({ baseURL: arnes.origen });
  try {
    const pagina = await cliente.newPage();
    const antes = arnes.pedidosDelServiceWorker();
    await pagina.goto(`/v/${token}`);
    await pagina.waitForLoadState('load');
    await pagina.waitForTimeout(2_000);

    await expect(aviso(pagina)).toHaveCount(0);
    expect(
      await pagina.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length),
    ).toBe(0);
    expect(arnes.pedidosDelServiceWorker()).toBe(antes);
  } finally {
    await cliente.close();
  }
});
