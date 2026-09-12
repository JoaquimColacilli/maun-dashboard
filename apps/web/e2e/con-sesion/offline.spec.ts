import { expect, test } from '@playwright/test';

import { avisosEnPantalla, indicadorDeSync } from '../apoyo/pantalla';
import {
  contarClientes,
  contarHijos,
  crearCliente,
  iniciarSesionDePrueba,
  leerProyecto,
  upsertCliente,
  vaciarTaller,
} from '../apoyo/taller';

test.beforeEach(async () => {
  await vaciarTaller(await iniciarSesionDePrueba());
});

test('en modo avión el cliente aparece al instante, sobrevive a cerrar la app y se sincroniza una sola vez', async ({
  page,
  context,
}) => {
  const sesion = await iniciarSesionDePrueba();

  await page.goto('/clientes');
  await expect(page.getByRole('button', { name: 'Cargá tu primer cliente' })).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));

  await context.setOffline(true);

  await page.getByRole('button', { name: 'Cargá tu primer cliente' }).click();
  await page.getByLabel('Nombre', { exact: true }).fill('Sin señal');
  await page.getByRole('button', { name: 'Guardar cliente' }).click();

  await expect(page.getByRole('button', { name: /Sin señal/ })).toBeVisible();
  await expect(indicadorDeSync(page)).toContainText('Sin conexión');
  await expect(indicadorDeSync(page)).toContainText('1 cambio');
  await expect(avisosEnPantalla(page)).toContainText(
    'Cliente anotado sin señal: se guarda solo cuando vuelva.',
  );
  await expect(avisosEnPantalla(page)).not.toContainText('Cliente guardado.');
  expect(await contarClientes(sesion, 'Sin señal')).toBe(0);

  await page.close();
  const reabierta = await context.newPage();
  await reabierta.goto('/clientes');

  await expect(reabierta.getByRole('button', { name: /Sin señal/ })).toBeVisible();
  await expect(indicadorDeSync(reabierta)).toContainText('Sin conexión');
  await expect(indicadorDeSync(reabierta)).toContainText('1 cambio');
  expect(await contarClientes(sesion, 'Sin señal')).toBe(0);

  await context.setOffline(false);
  await expect(indicadorDeSync(reabierta)).toBeHidden({ timeout: 20_000 });
  await expect(avisosEnPantalla(reabierta)).toContainText('Estaba anotado sin señal.');

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
  expect(segunda.version).toBe(primera.version);
  expect(segunda.updated_at).toBe(primera.updated_at);
});

test('en modo avión un proyecto con pagos y gastos es un solo cambio pendiente, no seis', async ({
  page,
  context,
}) => {
  const sesion = await iniciarSesionDePrueba();
  await crearCliente(sesion, 'Marcela Sosa');

  await page.goto('/proyectos');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await expect(page.getByRole('button', { name: 'Nuevo proyecto' })).toBeVisible();
  await expect(indicadorDeSync(page)).toBeHidden({ timeout: 20_000 });

  await context.setOffline(true);

  await page.getByRole('button', { name: 'Nuevo proyecto' }).click();
  await page.getByRole('combobox', { name: 'Cliente' }).fill('Marcela');
  await page
    .getByRole('option', { name: /Marcela Sosa/ })
    .first()
    .click();
  await page.getByLabel('Trabajo').fill('Placard sin señal');
  await page.getByLabel('Presupuesto').fill('1200000');

  const pagos = page.getByRole('region', { name: 'Pagos recibidos' });
  for (const numero of [1, 2]) {
    await pagos.getByRole('button', { name: 'Agregar un pago' }).click();
    await pagos
      .getByLabel(`Concepto ${String(numero)}`, { exact: true })
      .fill(`Pago ${String(numero)}`);
    await pagos.getByLabel(`Monto ${String(numero)}`, { exact: true }).fill('200000');
  }
  const gastos = page.getByRole('region', { name: 'Gastos e insumos' });
  for (const numero of [1, 2]) {
    await gastos.getByRole('button', { name: 'Agregar un gasto' }).click();
    await gastos
      .getByLabel(`Descripción ${String(numero)}`, { exact: true })
      .fill(`Gasto ${String(numero)}`);
    await gastos.getByLabel(`Monto ${String(numero)}`, { exact: true }).fill('50000');
  }

  await page.getByRole('button', { name: 'Guardar proyecto' }).click();

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Placard sin señal');
  await expect(indicadorDeSync(page)).toContainText('Sin conexión');
  await expect(indicadorDeSync(page)).toContainText('1 cambio');
  expect(await leerProyecto(sesion, 'Placard sin señal')).toBeUndefined();

  await page.close();
  const reabierta = await context.newPage();
  await reabierta.goto('/proyectos');
  await expect(reabierta.getByRole('link', { name: 'Placard sin señal' })).toBeVisible();
  await expect(indicadorDeSync(reabierta)).toContainText('1 cambio');
  await reabierta.getByRole('link', { name: 'Placard sin señal' }).click();
  await expect(reabierta.getByRole('region', { name: 'Pagos recibidos' })).toContainText('Pago 2');
  await expect(reabierta.getByRole('region', { name: 'Gastos e insumos' })).toContainText(
    'Gasto 2',
  );

  await context.setOffline(false);
  await expect(indicadorDeSync(reabierta)).toBeHidden({ timeout: 20_000 });

  const guardado = await leerProyecto(sesion, 'Placard sin señal');
  expect(guardado).toBeDefined();
  expect(await contarHijos(sesion, 'pagos', guardado?.id ?? '')).toBe(2);
  expect(await contarHijos(sesion, 'gastos', guardado?.id ?? '')).toBe(2);

  await reabierta.reload();
  await expect(reabierta.getByRole('region', { name: 'Pagos recibidos' })).toContainText('Pago 1');
});
