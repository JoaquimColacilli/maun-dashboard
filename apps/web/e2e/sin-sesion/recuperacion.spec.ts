import { expect, test } from '@playwright/test';

import { entornoDePrueba } from '../apoyo/entorno';

test('el enlace de recuperación abre el formulario aunque el código se canjee antes de que cargue la pantalla', async ({
  page,
}) => {
  const entorno = entornoDePrueba();
  const respuesta = await fetch(`${entorno.url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: entorno.publishableKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: entorno.email, password: entorno.password }),
  });
  expect(respuesta.ok).toBe(true);
  const sesion: unknown = await respuesta.json();

  await page.addInitScript(() => {
    if (localStorage.getItem('maun.sesion-code-verifier') === null) {
      localStorage.setItem(
        'maun.sesion-code-verifier',
        JSON.stringify('verificador-de-prueba-e2e/recovery'),
      );
    }
  });
  await page.route(
    (url) =>
      url.pathname.endsWith('/auth/v1/token') && url.searchParams.get('grant_type') === 'pkce',
    (ruta) => ruta.fulfill({ json: sesion }),
  );

  await page.goto('/acceso/nueva-contrasena?code=codigo-de-prueba-e2e');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Poné una contraseña nueva', {
    timeout: 20_000,
  });
  await expect(page.getByLabel('Contraseña nueva', { exact: true })).toHaveAttribute(
    'autocomplete',
    'new-password',
  );
});
