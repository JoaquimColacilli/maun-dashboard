import { expect, test } from '@playwright/test';

import { listoParaCortar } from '../apoyo/pantalla';

const REFRESCO_DEL_TOKEN = /\/auth\/v1\/token\?grant_type=refresh_token/;

function sinRespuesta(): Promise<void> {
  return new Promise(() => undefined);
}

test('con la sesión vencida y un servidor que no contesta, la app abre con lo guardado en vez de quedarse abriendo', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Inicio' })).toBeVisible({
    timeout: 30_000,
  });
  await listoParaCortar(page);
  await page.close();

  await context.route(REFRESCO_DEL_TOKEN, sinRespuesta);
  await context.addInitScript(() => {
    const crudo = localStorage.getItem('maun.sesion');
    if (crudo === null) return;
    const guardada = JSON.parse(crudo) as Record<string, unknown>;
    localStorage.setItem(
      'maun.sesion',
      JSON.stringify({ ...guardada, expires_at: Math.floor(Date.now() / 1000) - 3600 }),
    );
  });

  const deNuevo = await context.newPage();
  await deNuevo.goto('/');
  await expect(deNuevo.getByRole('heading', { level: 1, name: 'Inicio' })).toBeVisible({
    timeout: 25_000,
  });
});

test('la primera carga del taller que no termina ofrece reintentar o cerrar sesión', async ({
  page,
}) => {
  await page.route('**/rest/v1/rpc/bootstrap**', sinRespuesta);
  await page.goto('/');

  await expect(page.getByRole('button', { name: 'Reintentar' })).toBeVisible({ timeout: 25_000 });
  await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
  await expect(page.getByText('Trayendo los datos del taller')).toBeAttached();
});
