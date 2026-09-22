import { expect, test } from '@playwright/test';

import {
  abrirLaVersionA,
  aviso,
  conElArnes,
  entrarConLaSesion,
  momentoDelAviso,
  tallerVacio,
} from './apoyo';

const elArnes = conElArnes();

test('con la app quieta, el aviso aparece cuando hay una versión nueva', async ({
  page,
  context,
}, testInfo) => {
  const arnes = elArnes();
  await entrarConLaSesion(context, await tallerVacio());
  await abrirLaVersionA(page, arnes);
  await expect(aviso(page)).toHaveCount(0);

  arnes.publicar('b');
  await page.goto('/');

  const tardo = await momentoDelAviso(page);
  await expect(aviso(page)).toBeVisible();
  console.log(
    `${testInfo.project.name}: el aviso apareció a los ${String(tardo)} ms de empezar a abrir`,
  );
  expect(arnes.pedidosDelServiceWorker()).toBeGreaterThan(0);
  expect(arnes.pedidosDeLoNuevo()).toBeGreaterThan(0);
});
