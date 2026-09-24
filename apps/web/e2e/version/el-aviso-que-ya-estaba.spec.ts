import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';

import { RAIZ_DE_LA_APP } from '../apoyo/entorno';
import { dedo, tirarYSoltar } from '../apoyo/dedo';
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
import { sinTransicionEnCurso } from '../apoyo/transiciones';
import {
  abrirLaVersionA,
  aviso,
  conElArnes,
  conLaBEsperando,
  contarLosRegistros,
  entrarConLaSesion,
  registrosDelDocumento,
  tallerVacio,
} from './apoyo';
import { BUILD_A } from './arnes';

const elArnes = conElArnes();

test('si ya estaba lista, aparece apenas carga la app, sin esperar ningún chequeo', async ({
  page,
  context,
}, testInfo) => {
  const arnes = elArnes();
  await entrarConLaSesion(context, await tallerVacio());
  await abrirLaVersionA(page, arnes);
  await conLaBEsperando(page, arnes);

  arnes.retenerLosChequeos();
  const desde = Date.now();
  await page.reload();
  await expect(aviso(page)).toBeVisible({ timeout: 5_000 });
  const tardo = Date.now() - desde;
  const retenidos = arnes.pedidosDelServiceWorker();
  arnes.soltarLosChequeos();

  console.log(
    `${testInfo.project.name}: con los chequeos retenidos, el aviso apareció a los ${String(tardo)} ms de recargar`,
  );
  expect(retenidos).toBeGreaterThan(0);
});

test('tirar, cambiar de pantalla, bloquear, desbloquear y volver de segundo plano no borran el aviso, y el registro se hace una vez por documento', async ({
  page,
  context,
}) => {
  test.skip(!test.info().project.use.isMobile, 'el gesto y la huella son del celular');
  test.setTimeout(120_000);
  const arnes = elArnes();
  await visibilidadControlable(page);
  await contarLosRegistros(page);
  await entrarConLaSesion(context, await tallerVacio());
  await abrirLaVersionA(page, arnes);
  const telefono = await telefonoConHuella(page, true);
  await registrarHuellaEnElTelefono(telefono, await usuarioDeLaSesion(page));
  await activarBloqueoEnElDispositivo(page);
  await conLaBEsperando(page, arnes);
  await listoParaCortar(page);
  expect(await registrosDelDocumento(page)).toBe(1);

  const cdp = await dedo(page);
  for (let vez = 0; vez < 3; vez += 1) {
    await sinTransicionEnCurso(page);
    await tirarYSoltar(cdp, 260, 440);
    await page.waitForTimeout(2_500);
    await expect(aviso(page)).toBeVisible();
  }

  await page.getByRole('button', { name: 'Clientes', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Clientes' })).toBeVisible();
  await expect(aviso(page)).toBeVisible();
  await page.getByRole('button', { name: 'Inicio', exact: true }).click();
  await listoParaCortar(page);
  await expect(aviso(page)).toBeVisible();

  await huellaQueVerifica(telefono, false);
  await aSegundoPlano(page);
  await alFrente(page);
  const bloqueo = page.getByRole('dialog', { name: 'La app está bloqueada' });
  await expect(bloqueo).toBeVisible();
  await huellaQueVerifica(telefono, true);
  await page.getByRole('button', { name: 'Probar con la huella' }).click();
  await expect(bloqueo).toHaveCount(0);
  await expect(aviso(page)).toBeVisible();

  expect(await registrosDelDocumento(page)).toBe(1);
});

test('el build no trae un registro propio del plugin: el único que registra es el módulo de la versión nueva', () => {
  test.skip(test.info().project.use.isMobile === true, 'el build es uno solo');
  const archivos = readdirSync(BUILD_A);
  const html = readFileSync(path.join(BUILD_A, 'index.html'), 'utf8');
  const configuracion = readFileSync(path.join(RAIZ_DE_LA_APP, 'vite.config.ts'), 'utf8');

  expect(archivos).not.toContain('registerSW.js');
  expect(html).not.toContain('registerSW');
  expect(html).not.toContain('vite-plugin-pwa:');
  expect(html).not.toContain('serviceWorker');
  expect(configuracion).toContain('injectRegister: false');
});
