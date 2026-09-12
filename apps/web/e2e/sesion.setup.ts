import { expect, test as setup } from '@playwright/test';

import { ESTADO_DE_SESION } from './apoyo/entorno';
import { iniciarSesionDePrueba, vaciarTaller } from './apoyo/taller';

setup('la cuenta de prueba entra una vez y deja su sesión guardada', async ({ page }) => {
  const sesion = await iniciarSesionDePrueba();
  await vaciarTaller(sesion);

  await page.goto('/acceso');
  await page.getByLabel('Email').fill(sesion.entorno.email);
  await page.getByLabel('Contraseña').fill(sesion.entorno.password);
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Inicio' })).toBeVisible();

  await page.context().storageState({ path: ESTADO_DE_SESION });
});
