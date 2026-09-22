import { expect, test } from '@playwright/test';

import {
  abrirLaVersionA,
  aviso,
  conElArnes,
  entrarConLaSesion,
  esperarElAviso,
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
  const desde = Date.now();
  await page.goto('/');

  const tardo = await esperarElAviso(page, desde);
  console.log(`${testInfo.project.name}: el aviso apareció a los ${String(tardo)} ms de abrir`);
  expect(arnes.pedidosDelServiceWorker()).toBeGreaterThan(0);
  expect(arnes.pedidosDeLoNuevo()).toBeGreaterThan(0);
});
