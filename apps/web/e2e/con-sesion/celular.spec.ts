import { expect, test } from '@playwright/test';

import { crearCliente, iniciarSesionDePrueba, vaciarTaller } from '../apoyo/taller';

const ALTO_CON_TECLADO = 380;

test.skip(({ isMobile }) => !isMobile, 'solo tiene sentido en el viewport de celular');

test.beforeEach(async () => {
  await vaciarTaller(await iniciarSesionDePrueba());
});

test('con el formulario abierto la barra inferior se esconde y el botón de guardar no queda tapado', async ({
  page,
}) => {
  await page.goto('/clientes');
  await expect(page.getByRole('navigation', { name: 'Principal' })).toBeVisible();

  await page.getByRole('button', { name: 'Cargá tu primer cliente' }).click();
  const guardar = page.getByRole('button', { name: 'Guardar cliente' });
  await expect(guardar).toBeInViewport();

  await page.getByLabel('Notas').fill('Portón de dos hojas');
  await expect(page.getByRole('navigation', { name: 'Principal' })).toBeHidden();

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

test('tirar hacia abajo no recarga la app: la raíz no encadena el overscroll', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('main')).toBeVisible({ timeout: 30_000 });

  const overscroll = await page.evaluate(() => ({
    html: getComputedStyle(document.documentElement).overscrollBehaviorY,
    body: getComputedStyle(document.body).overscrollBehaviorY,
  }));
  expect(overscroll).toEqual({ html: 'none', body: 'none' });
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

test('la hoja de ordenar del celular cambia el orden de las cards', async ({ page }) => {
  const sesion = await iniciarSesionDePrueba();
  await crearCliente(sesion, 'Ana Gómez');
  await crearCliente(sesion, 'Zulema Paz');

  for (const [cliente, titulo, presupuesto] of [
    ['Ana Gómez', 'Alacena', '300000'],
    ['Zulema Paz', 'Zapatero', '900000'],
  ] as const) {
    await page.goto('/proyectos/nuevo');
    await page.getByRole('combobox', { name: 'Cliente' }).fill(cliente);
    await page
      .getByRole('option', { name: new RegExp(cliente) })
      .first()
      .click();
    await page.getByLabel('Trabajo').fill(titulo);
    await page.getByLabel('Presupuesto').fill(presupuesto);
    await page.getByRole('button', { name: 'Guardar proyecto' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(titulo);
  }

  await page.goto('/proyectos');
  await expect(page.getByRole('table')).toHaveCount(0);

  await page.getByRole('button', { name: /Entrega estimada|Ordenar/ }).click();
  const hoja = page.getByRole('dialog', { name: 'Ordenar por' });
  await expect(hoja).toBeVisible();
  await hoja.getByRole('button', { name: 'Presupuesto' }).click();
  await expect(hoja).toBeHidden();

  await expect(
    page.getByRole('list', { name: 'Proyectos' }).getByRole('listitem').first(),
  ).toContainText('Zapatero');

  await page
    .getByRole('button', { name: /Presupuesto/ })
    .first()
    .click();
  await page
    .getByRole('dialog', { name: 'Ordenar por' })
    .getByRole('button', { name: 'Cliente' })
    .click();
  await expect(
    page.getByRole('list', { name: 'Proyectos' }).getByRole('listitem').first(),
  ).toContainText('Alacena');
});

test('agregar tres pagos seguidos deja el foco en la fila nueva y el guardar alcanzable', async ({
  page,
}) => {
  const sesion = await iniciarSesionDePrueba();
  await crearCliente(sesion, 'Marcela Sosa');

  await page.goto('/proyectos/nuevo');
  await page.getByRole('combobox', { name: 'Cliente' }).fill('Marcela');
  await page
    .getByRole('option', { name: /Marcela Sosa/ })
    .first()
    .click();
  await page.getByLabel('Trabajo').fill('Mueble bajo mesada');

  const pagos = page.getByRole('region', { name: 'Pagos recibidos' });
  for (const numero of [1, 2, 3]) {
    await pagos.getByRole('button', { name: 'Agregar un pago' }).click();
    await expect(pagos.getByLabel(`Concepto ${String(numero)}`, { exact: true })).toBeFocused();
    await page.keyboard.type(`Pago ${String(numero)}`);
    await pagos.getByLabel(`Monto ${String(numero)}`, { exact: true }).fill('100000');
  }

  await expect(pagos.getByRole('button', { name: /^Quitar concepto/ })).toHaveCount(3);

  await expect(pagos.getByRole('status').first()).toContainText('300.000');

  await page.setViewportSize({ width: 390, height: ALTO_CON_TECLADO });
  const guardar = page.getByRole('button', { name: 'Guardar proyecto' });
  await expect(guardar).toBeInViewport();
  const caja = await guardar.boundingBox();
  expect((caja?.y ?? 0) + (caja?.height ?? 0)).toBeLessThanOrEqual(ALTO_CON_TECLADO);

  await expect(pagos.getByLabel('Monto 1', { exact: true })).toHaveAttribute(
    'inputmode',
    'decimal',
  );
  await expect(pagos.getByLabel('Fecha 1', { exact: true })).toHaveAttribute('type', 'date');
});

test('quitar una fila con datos ofrece deshacer y la devuelve donde estaba', async ({ page }) => {
  const sesion = await iniciarSesionDePrueba();
  await crearCliente(sesion, 'Marcela Sosa');

  await page.goto('/proyectos/nuevo');
  await page.getByRole('combobox', { name: 'Cliente' }).fill('Marcela');
  await page
    .getByRole('option', { name: /Marcela Sosa/ })
    .first()
    .click();

  const pagos = page.getByRole('region', { name: 'Pagos recibidos' });
  await pagos.getByRole('button', { name: 'Agregar un pago' }).click();
  await pagos.getByLabel('Concepto 1', { exact: true }).fill('Seña');
  await pagos.getByLabel('Monto 1', { exact: true }).fill('250000');

  const borrar = pagos.getByRole('button', { name: 'Quitar concepto 1' });
  const caja = await borrar.boundingBox();
  expect(caja?.height ?? 0).toBeGreaterThanOrEqual(44);
  expect(caja?.width ?? 0).toBeGreaterThanOrEqual(44);

  await borrar.click();
  await expect(pagos.getByRole('status').filter({ hasText: 'Quité' })).toContainText('Quité Seña');

  await pagos.getByRole('button', { name: 'Deshacer' }).click();
  await expect(pagos.getByLabel('Concepto 1', { exact: true })).toHaveValue('Seña');
});
