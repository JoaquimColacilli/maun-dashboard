import { expect, test } from '@playwright/test';

test('sin sesión, la app manda al login en vez de mostrar un tablero vacío', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/acceso$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('MAUN');
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByLabel('Contraseña')).toBeVisible();
});

test('el formulario avisa lo que falta antes de salir a la red', async ({ page }) => {
  await page.goto('/acceso');

  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('alert')).toHaveText('Escribí un mail válido.');

  await page.getByLabel('Email').fill('vos@taller.com.ar');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('alert')).toHaveText('Escribí tu contraseña.');
});

test('desde el login se llega a crear la cuenta y a recuperar el acceso', async ({ page }) => {
  await page.goto('/acceso');

  await page.getByRole('link', { name: 'Todavía no tengo cuenta' }).click();
  await expect(page).toHaveURL(/\/acceso\/crear-cuenta$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Crear cuenta');

  await page.getByRole('link', { name: 'Ya tengo cuenta' }).click();
  await page.getByRole('link', { name: 'Me olvidé la contraseña' }).click();
  await expect(page).toHaveURL(/\/acceso\/recuperar$/);
  await expect(page.getByRole('button', { name: 'Mandarme el enlace' })).toBeVisible();
});
