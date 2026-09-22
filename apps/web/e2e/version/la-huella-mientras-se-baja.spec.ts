import { expect, test } from '@playwright/test';

import {
  activarBloqueoEnElDispositivo,
  alFrente,
  aSegundoPlano,
  huellaQueVerifica,
  registrarHuellaEnElTelefono,
  telefonoConHuella,
  usuarioDeLaSesion,
  visibilidadControlable,
} from '../apoyo/huella';
import { listoParaCortar } from '../apoyo/pantalla';
import {
  abrirLaVersionA,
  aviso,
  conElArnes,
  entrarConLaSesion,
  HASTA_EL_AVISO,
  tallerVacio,
} from './apoyo';

test.skip(({ isMobile }) => !isMobile, 'la huella es del celular');

const elArnes = conElArnes();

test('bloquear y desbloquear con la huella mientras se baja la versión nueva: el aviso aparece igual', async ({
  page,
  context,
}) => {
  test.setTimeout(120_000);
  const arnes = elArnes();
  await visibilidadControlable(page);
  await entrarConLaSesion(context, await tallerVacio());
  await abrirLaVersionA(page, arnes);
  const telefono = await telefonoConHuella(page, true);
  await registrarHuellaEnElTelefono(telefono, await usuarioDeLaSesion(page));
  await activarBloqueoEnElDispositivo(page);

  arnes.retenerLoNuevo();
  arnes.publicar('b');
  await page.goto('/');
  await listoParaCortar(page);
  await expect.poll(() => arnes.pedidosDeLoNuevo(), HASTA_EL_AVISO).toBeGreaterThan(0);
  await expect(aviso(page)).toHaveCount(0);

  await huellaQueVerifica(telefono, false);
  await aSegundoPlano(page);
  await alFrente(page);
  const bloqueo = page.getByRole('dialog', { name: 'La app está bloqueada' });
  await expect(bloqueo).toBeVisible();

  arnes.soltarLoNuevo();
  await expect.poll(() => arnes.entregasDeLoNuevo(), HASTA_EL_AVISO).toBeGreaterThan(0);
  await page.waitForTimeout(1_000);

  await huellaQueVerifica(telefono, true);
  await page.getByRole('button', { name: 'Probar con la huella' }).click();
  await expect(bloqueo).toHaveCount(0);
  await expect(aviso(page)).toBeVisible({ timeout: 5_000 });
});
