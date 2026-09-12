import { expect, test } from '@playwright/test';

import {
  contarClientes,
  iniciarSesionDePrueba,
  upsertCliente,
  vaciarClientes,
} from '../apoyo/taller';

test.beforeEach(async () => {
  await vaciarClientes(await iniciarSesionDePrueba());
});

test('en modo avión el cliente aparece al instante, sobrevive a cerrar la app y se sincroniza una sola vez', async ({
  page,
  context,
}) => {
  const sesion = await iniciarSesionDePrueba();

  await page.goto('/clientes');
  await expect(page.getByRole('button', { name: 'Cargá tu primer cliente' })).toBeVisible();
  // El service worker tiene que estar activo antes de cortar la red: es el que sirve el shell.
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));

  await context.setOffline(true);

  await page.getByRole('button', { name: 'Cargá tu primer cliente' }).click();
  await page.getByLabel('Nombre', { exact: true }).fill('Sin señal');
  await page.getByRole('button', { name: 'Guardar cliente' }).click();

  // Aparece al instante, sin haber tocado la red.
  await expect(page.getByRole('button', { name: /Sin señal/ })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Sin conexión');
  await expect(page.getByRole('status')).toContainText('1 cambio');
  expect(await contarClientes(sesion, 'Sin señal')).toBe(0);

  // Cerrar la app y volver a abrirla, todavía sin señal.
  await page.close();
  const reabierta = await context.newPage();
  await reabierta.goto('/clientes');

  await expect(reabierta.getByRole('button', { name: /Sin señal/ })).toBeVisible();
  await expect(reabierta.getByRole('status')).toContainText('Sin conexión');
  await expect(reabierta.getByRole('status')).toContainText('1 cambio');
  expect(await contarClientes(sesion, 'Sin señal')).toBe(0);

  // Vuelve la señal: la cola drena y no duplica.
  await context.setOffline(false);
  await expect(reabierta.getByRole('status')).toBeHidden({ timeout: 20_000 });

  expect(await contarClientes(sesion, 'Sin señal')).toBe(1);
  await expect(reabierta.getByRole('listitem')).toHaveCount(1);

  await reabierta.reload();
  await expect(reabierta.getByRole('listitem')).toHaveCount(1);
});

test('drenar la cola dos veces con la misma mutación no duplica ni vuelve a tocar la fila', async () => {
  const sesion = await iniciarSesionDePrueba();
  const id = crypto.randomUUID();
  const datos = { id, nombre: 'Dos veces', zona: 'Olivos' };

  const primera = await upsertCliente(sesion, datos);
  const segunda = await upsertCliente(sesion, datos);

  expect(await contarClientes(sesion, 'Dos veces')).toBe(1);
  expect(segunda.id).toBe(primera.id);
  // Un upsert que no cambia ningún valor no toca updated_at ni version, así que no genera delta.
  expect(segunda.version).toBe(primera.version);
  expect(segunda.updated_at).toBe(primera.updated_at);
});
