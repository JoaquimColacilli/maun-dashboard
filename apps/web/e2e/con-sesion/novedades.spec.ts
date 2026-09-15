import { expect, test, type Locator, type Page } from '@playwright/test';

import { entornoDePrueba } from '../apoyo/entorno';

const CARGA = { timeout: 30_000 };
const CLAVE = 'maun:novedades-vistas';
const VERSION_VIEJA = '2000-01-01';

function novedades(page: Page): Locator {
  return page.getByRole('region', { name: 'Novedades de la app' });
}

function versionVista(page: Page): Promise<string | null> {
  return page.evaluate((clave) => localStorage.getItem(clave), CLAVE);
}

async function venirDeUnaVersionVieja(page: Page): Promise<void> {
  await page.addInitScript(
    ({ clave, vieja }) => {
      if (sessionStorage.getItem('e2e:novedades') !== null) return;
      sessionStorage.setItem('e2e:novedades', 'sembrada');
      localStorage.setItem(clave, vieja);
    },
    { clave: CLAVE, vieja: VERSION_VIEJA },
  );
}

async function abrirDesdeLaVersion(page: Page, isMobile: boolean): Promise<void> {
  if (isMobile) {
    await page.goto('/ajustes');
    await expect(page.getByRole('heading', { level: 1, name: 'Ajustes' })).toBeVisible(CARGA);
    await page
      .getByRole('main')
      .getByRole('button', { name: /^Versión del .+ Ver las novedades$/ })
      .click();
    return;
  }
  await page
    .getByRole('navigation', { name: 'Principal' })
    .getByRole('button', { name: /^Versión del / })
    .click();
}

test('después de actualizar aparecen solas una vez, sin bloquear la app, y después se abren desde la versión', async ({
  page,
  isMobile,
}) => {
  await venirDeUnaVersionVieja(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Inicio' })).toBeVisible(CARGA);

  const capa = novedades(page);
  await expect(capa).toBeVisible();
  await expect(capa.getByRole('heading', { level: 3 }).first()).toHaveText(/^Versión del /);
  await expect(capa.getByRole('listitem').first()).toBeVisible();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect.poll(() => versionVista(page)).not.toBe(VERSION_VIEJA);

  if (isMobile) {
    await page.getByRole('heading', { level: 1, name: 'Inicio' }).click();
    await expect(capa).toBeHidden();
  } else {
    await page
      .getByRole('navigation', { name: 'Principal' })
      .getByRole('button', { name: 'Clientes', exact: true })
      .click();
    await expect(page.getByRole('heading', { level: 1, name: 'Clientes' })).toBeVisible();
    await expect(capa).toBeHidden();
  }

  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible(CARGA);
  await expect(page.getByRole('navigation', { name: 'Principal' })).toBeVisible();
  await expect(capa).toHaveCount(0);

  await abrirDesdeLaVersion(page, isMobile);
  await expect(capa).toBeVisible();
  await capa.getByRole('button', { name: 'Cerrar las novedades' }).click();
  await expect(capa).toBeHidden();
});

test('desde Ajustes se vuelven a abrir, y Escape las cierra', async ({ page }) => {
  await page.goto('/ajustes');
  await expect(page.getByRole('heading', { level: 1, name: 'Ajustes' })).toBeVisible(CARGA);
  await expect(novedades(page)).toHaveCount(0);

  const version = page.getByRole('main').getByRole('button', { name: /Ver las novedades/ });
  await expect(version).toContainText(/^Versión del \d{1,2} de [a-z]+ de \d{4}/);
  await version.click();
  await expect(novedades(page)).toBeVisible();
  await expect(novedades(page).getByRole('listitem').first()).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(novedades(page)).toBeHidden();
});

test('la versión se ve en el pie de la barra lateral en la PC, y al final de Ajustes en los dos tamaños', async ({
  page,
  isMobile,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Inicio' })).toBeVisible(CARGA);
  const enLaBarra = page
    .getByRole('navigation', { name: 'Principal' })
    .getByRole('button', { name: /^Versión del / });
  await expect(enLaBarra).toHaveCount(isMobile ? 0 : 1);

  await page.goto('/ajustes');
  const seccion = page.getByRole('region', { name: 'Versión de la app' });
  await expect(seccion).toBeVisible(CARGA);
  await expect(seccion).toContainText(/Versión del \d{1,2} de [a-z]+ de \d{4}/);
});

test.describe('entrando con la contraseña en un navegador nuevo', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('no aparecen solas, y queda anotada la versión para la próxima', async ({ page }) => {
    const entorno = entornoDePrueba();
    await page.goto('/acceso');
    await page.getByLabel('Email').fill(entorno.email);
    await page.getByLabel('Contraseña', { exact: true }).fill(entorno.password);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();

    await expect(page.getByRole('heading', { level: 1, name: 'Inicio' })).toBeVisible(CARGA);
    await expect.poll(() => versionVista(page)).not.toBeNull();
    await expect(novedades(page)).toHaveCount(0);
  });
});
