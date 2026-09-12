import { expect, test } from '@playwright/test';

import { iniciarSesionDePrueba, leerCliente, vaciarTaller } from '../apoyo/taller';

test.beforeEach(async () => {
  await vaciarTaller(await iniciarSesionDePrueba());
});

async function cargarCliente(
  page: import('@playwright/test').Page,
  datos: { nombre: string; zona?: string; telefono?: string; cuit?: string },
): Promise<void> {
  await page.getByLabel('Nombre', { exact: true }).fill(datos.nombre);
  if (datos.zona !== undefined) await page.getByLabel('Zona').fill(datos.zona);
  if (datos.telefono !== undefined) await page.getByLabel('Teléfono').fill(datos.telefono);
  if (datos.cuit !== undefined) {
    await page.getByRole('radio', { name: 'Monotributo' }).click();
    await page.getByLabel('CUIT o CUIL').fill(datos.cuit);
  }
  await page.getByRole('button', { name: 'Guardar cliente' }).click();
}

test('la agenda vacía invita a cargar el primero, no muestra una lista en blanco', async ({
  page,
}) => {
  await page.goto('/clientes');

  await expect(page.getByRole('heading', { level: 2 })).toHaveText(
    'La agenda del taller, todavía vacía',
  );
  await expect(page.getByRole('button', { name: 'Cargá tu primer cliente' })).toBeVisible();
  await expect(page.getByRole('searchbox', { name: 'Buscar cliente' })).toBeHidden();
});

test('un cliente cargado sobrevive a recargar la página, y su edición también', async ({
  page,
}) => {
  const sesion = await iniciarSesionDePrueba();
  await page.goto('/clientes');

  await page.getByRole('button', { name: 'Cargá tu primer cliente' }).click();
  await cargarCliente(page, { nombre: 'Ana Gómez', zona: 'Vicente López' });

  await expect(page.getByRole('button', { name: /Ana Gómez/ })).toBeVisible();
  await expect
    .poll(async () => (await leerCliente(sesion, 'Ana Gómez'))?.zona, { timeout: 20_000 })
    .toBe('Vicente López');

  await page.reload();
  await expect(page.getByRole('button', { name: /Ana Gómez/ })).toBeVisible();

  await page.getByRole('button', { name: /Ana Gómez/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ana Gómez');

  await page.getByRole('button', { name: 'Editar' }).click();
  await page.getByLabel('Zona').fill('Martínez');
  await page.getByRole('button', { name: 'Guardar los cambios' }).click();
  await expect
    .poll(async () => (await leerCliente(sesion, 'Ana Gómez'))?.zona, { timeout: 20_000 })
    .toBe('Martínez');

  await page.reload();
  await expect(page.getByText('Martínez')).toBeVisible();
});

test('solo el nombre es obligatorio: un desconocido que llama por teléfono se carga igual', async ({
  page,
}) => {
  await page.goto('/clientes');
  await page.getByRole('button', { name: 'Cargá tu primer cliente' }).click();

  await page.getByRole('button', { name: 'Guardar cliente' }).click();
  await expect(page.getByRole('alert')).toHaveText('El nombre es lo único que no puede faltar.');

  await cargarCliente(page, { nombre: 'El del portón' });
  await expect(page.getByRole('button', { name: /El del portón/ })).toBeVisible();
});

test('el CUIT con el verificador mal avisa pero deja guardar; el incompleto no pasa', async ({
  page,
}) => {
  await page.goto('/clientes');
  await page.getByRole('button', { name: 'Cargá tu primer cliente' }).click();

  await page.getByLabel('Nombre', { exact: true }).fill('Carpintería Sosa');
  await page.getByRole('radio', { name: 'Monotributo' }).click();

  await page.getByLabel('CUIT o CUIL').fill('20-1234');
  await page.getByRole('button', { name: 'Guardar cliente' }).click();
  await expect(page.getByRole('alert')).toContainText('11 dígitos');

  await page.getByLabel('CUIT o CUIL').fill('20-12345678-0');
  await page.getByLabel('Nombre', { exact: true }).click();
  await expect(page.getByLabel('CUIT o CUIL')).toHaveAccessibleDescription(/verificador no cierra/);

  await page.getByRole('button', { name: 'Guardar cliente' }).click();
  await expect(page.getByRole('button', { name: /Carpintería Sosa/ })).toBeVisible();
});

test('la búsqueda responde desde la primera letra y ofrece crear lo que no encuentra', async ({
  page,
}) => {
  await page.goto('/clientes');

  await page.getByRole('button', { name: 'Cargá tu primer cliente' }).click();
  await cargarCliente(page, { nombre: 'Ana Gómez', zona: 'Olivos', telefono: '11 5555-1111' });
  await page.getByRole('button', { name: 'Nuevo cliente' }).click();
  await cargarCliente(page, { nombre: 'Bruno Díaz', zona: 'Martínez' });

  const buscador = page.getByRole('searchbox', { name: 'Buscar cliente' });

  await buscador.fill('a');
  await expect(page.getByRole('listitem')).toHaveCount(2);

  await buscador.fill('ana');
  await expect(page.getByRole('listitem')).toHaveCount(1);
  await expect(page.getByText('1 de 2')).toBeVisible();

  await buscador.fill('5555');
  await expect(page.getByRole('button', { name: /Ana Gómez/ })).toBeVisible();

  await buscador.fill('zzz');
  await expect(page.getByText('Nadie coincide con «zzz».')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Crear «zzz» como cliente nuevo' })).toBeVisible();
});

test('el corte de orígenes cuenta de dónde viene cada cliente', async ({ page }) => {
  await page.goto('/clientes');

  await page.getByRole('button', { name: 'Cargá tu primer cliente' }).click();
  await page.getByLabel('Nombre', { exact: true }).fill('Ana Gómez');
  await page.getByLabel('Cómo llegó').selectOption('referido');
  await page.getByRole('button', { name: 'Guardar cliente' }).click();

  const corte = page.getByRole('region', { name: 'De dónde vienen los trabajos' });
  await expect(corte).toContainText('Referido');
  await expect(corte).toContainText('1 cliente');
});

test('el nombre del cliente lleva a su ficha, con las acciones de contacto listas', async ({
  page,
}) => {
  await page.goto('/clientes');
  await page.getByRole('button', { name: 'Cargá tu primer cliente' }).click();
  await cargarCliente(page, {
    nombre: 'Ana Gómez',
    zona: 'Olivos',
    telefono: '11 5555-1111',
  });

  await page.getByRole('button', { name: /Ana Gómez/ }).click();

  await expect(page).toHaveURL(/\/clientes\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('link', { name: 'Llamar' })).toHaveAttribute(
    'href',
    'tel:1155551111',
  );
  await expect(page.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute(
    'href',
    'https://wa.me/5491155551111',
  );
  await expect(page.getByRole('link', { name: 'Mapa' })).toHaveAttribute(
    'href',
    /maps\/search.*Olivos/,
  );
  await expect(page.getByText('Sin saldo')).toBeVisible();
  await expect(page.getByText('Todavía no hay trabajos con Ana')).toBeVisible();
});
