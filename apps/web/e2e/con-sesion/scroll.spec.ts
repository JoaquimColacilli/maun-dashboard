import { expect, test, type Page } from '@playwright/test';

import { ajustarTaller, iniciarSesionDePrueba, vaciarTaller } from '../apoyo/taller';

test.skip(({ isMobile }) => !isMobile, 'Inicio scrollea en el ancho del celular');

test.beforeEach(async () => {
  const sesion = await iniciarSesionDePrueba();
  await vaciarTaller(sesion);
  await ajustarTaller(sesion, {
    sueldo_mensual_centavos: 50_000_000,
    costos_fijos_centavos: 25_000_000,
  });
});

function scrollDelPrincipal(page: Page): Promise<number> {
  return page.getByRole('main').evaluate((principal) => Math.round(principal.scrollTop));
}

async function bajarHastaElFondo(page: Page): Promise<number> {
  return page.getByRole('main').evaluate((principal) => {
    principal.scrollTop = principal.scrollHeight;
    principal.dispatchEvent(new Event('scroll'));
    return Math.round(principal.scrollTop);
  });
}

test('ir a otra pantalla arranca arriba, y el botón atrás vuelve adonde estaba', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Inicio' })).toBeVisible();
  const abajo = await bajarHastaElFondo(page);
  expect(abajo).toBeGreaterThan(100);

  await page.getByRole('button', { name: 'Finanzas', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Finanzas' })).toBeVisible();
  expect(await scrollDelPrincipal(page)).toBe(0);

  await page.getByRole('button', { name: 'Clientes', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Clientes' })).toBeVisible();
  expect(await scrollDelPrincipal(page)).toBe(0);

  // Cambiar de sección desde la barra deja la pila en Inicio y esa sección: atrás vuelve a
  // Inicio, no a Finanzas (ADR 0066).
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1, name: 'Inicio' })).toBeVisible();
  await expect.poll(() => scrollDelPrincipal(page)).toBe(abajo);
});

test('abrir una hoja encima de la pantalla no toca el scroll del fondo', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Inicio' })).toBeVisible();
  const abajo = await bajarHastaElFondo(page);
  expect(abajo).toBeGreaterThan(100);

  await page.getByRole('button', { name: 'Cargar algo nuevo' }).click();
  await page.getByRole('menuitem', { name: 'Movimiento' }).click();
  const hoja = page.getByRole('dialog', { name: 'Cargar un movimiento' });
  await expect(hoja).toBeVisible();
  expect(await scrollDelPrincipal(page)).toBe(abajo);

  await page.keyboard.press('Escape');
  await expect(hoja).toBeHidden();
  await expect(page).toHaveURL(/\/$/);
  expect(await scrollDelPrincipal(page)).toBe(abajo);
});
