import { expect, test } from '@playwright/test';

import { iniciarSesionDePrueba, vaciarClientes } from '../apoyo/taller';

// El alto que deja un teclado abierto en un celular de 844 de alto ronda los 380.
const ALTO_CON_TECLADO = 380;

test.skip(({ isMobile }) => !isMobile, 'solo tiene sentido en el viewport de celular');

test.beforeEach(async () => {
  await vaciarClientes(await iniciarSesionDePrueba());
});

test('con el formulario abierto la barra inferior se esconde y el botón de guardar no queda tapado', async ({
  page,
}) => {
  await page.goto('/clientes');
  await expect(page.getByRole('navigation', { name: 'Principal' })).toBeVisible();

  await page.getByRole('button', { name: 'Cargá tu primer cliente' }).click();
  const guardar = page.getByRole('button', { name: 'Guardar cliente' });
  await expect(guardar).toBeInViewport();

  // Escribir en el último campo es lo que abre el teclado y esconde la barra.
  await page.getByLabel('Notas').fill('Portón de dos hojas');
  await expect(page.getByRole('navigation', { name: 'Principal' })).toBeHidden();

  // El teclado no se puede abrir de verdad en Chromium: se emula el alto visible que deja.
  await page.setViewportSize({ width: 390, height: ALTO_CON_TECLADO });

  await expect(guardar).toBeInViewport();
  const caja = await guardar.boundingBox();
  expect(caja).not.toBeNull();
  expect((caja?.y ?? 0) + (caja?.height ?? 0)).toBeLessThanOrEqual(ALTO_CON_TECLADO);
  expect(caja?.height ?? 0).toBeGreaterThanOrEqual(44);

  await guardar.click();
  await expect(page.getByRole('alert')).toHaveText('El nombre es lo único que no puede faltar.');

  await page.getByLabel('Nombre', { exact: true }).fill('Ana Gómez');
  await guardar.click();
  await expect(page.getByRole('button', { name: /Ana Gómez/ })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Principal' })).toBeVisible();
});

test('los campos abren el teclado que corresponde', async ({ page }) => {
  await page.goto('/clientes');
  await page.getByRole('button', { name: 'Cargá tu primer cliente' }).click();

  await expect(page.getByLabel('Teléfono')).toHaveAttribute('inputmode', 'tel');
  await expect(page.getByLabel('Teléfono')).toHaveAttribute('autocomplete', 'tel');
  await expect(page.getByLabel('Email')).toHaveAttribute('inputmode', 'email');
  await expect(page.getByLabel('Email')).toHaveAttribute('autocomplete', 'email');
  await expect(page.getByLabel('Nombre', { exact: true })).toHaveAttribute('autocomplete', 'name');

  await page.getByRole('radio', { name: 'Responsable inscripto' }).click();
  await expect(page.getByLabel('CUIT', { exact: true })).toHaveAttribute('inputmode', 'numeric');
});

test('cada fila de la lista es un área táctil de al menos 44px', async ({ page }) => {
  await page.goto('/clientes');
  await page.getByRole('button', { name: 'Cargá tu primer cliente' }).click();
  await page.getByLabel('Nombre', { exact: true }).fill('Ana Gómez');
  await page.getByRole('button', { name: 'Guardar cliente' }).click();

  const fila = page.getByRole('button', { name: /Ana Gómez/ });
  const caja = await fila.boundingBox();
  expect(caja?.height ?? 0).toBeGreaterThanOrEqual(44);
});
