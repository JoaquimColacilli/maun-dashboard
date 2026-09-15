import { expect, test, type Locator, type Page } from '@playwright/test';

import {
  crearCliente,
  iniciarSesionDePrueba,
  leerCliente,
  vaciarTaller,
  type SesionDePrueba,
} from '../apoyo/taller';

const CARGA = { timeout: 30_000 };

let sesion: SesionDePrueba;

test.beforeEach(async () => {
  sesion = await iniciarSesionDePrueba();
  await vaciarTaller(sesion);
});

function pregunta(page: Page): Locator {
  return page.getByRole('alertdialog', { name: '¿Cerrar sin guardar?' });
}

async function tocarAfuera(page: Page): Promise<void> {
  await page.mouse.click(8, 8);
}

async function abrirPorRuta(page: Page, ruta: string, titulo: string): Promise<Locator> {
  await page.goto(ruta);
  const hoja = page.getByRole('dialog', { name: titulo });
  await expect(hoja).toBeVisible(CARGA);
  return hoja;
}

test('anotar algo: sin escribir se cierra de una, y con algo escrito pregunta con Escape, tocando afuera y con la cruz', async ({
  page,
}) => {
  let hoja = await abrirPorRuta(page, '/agenda/anotar', 'Anotar algo');
  await page.keyboard.press('Escape');
  await expect(hoja).toBeHidden();
  await expect(pregunta(page)).toHaveCount(0);

  hoja = await abrirPorRuta(page, '/agenda/anotar', 'Anotar algo');
  await tocarAfuera(page);
  await expect(hoja).toBeHidden();
  await expect(pregunta(page)).toHaveCount(0);

  hoja = await abrirPorRuta(page, '/agenda/anotar', 'Anotar algo');
  const texto = hoja.getByLabel('Qué hay que hacer');
  await texto.fill('Comprar tornillos');

  await page.keyboard.press('Escape');
  await expect(pregunta(page)).toBeVisible();
  await expect(pregunta(page).getByRole('button', { name: 'Seguir editando' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(pregunta(page)).toBeHidden();
  await expect(hoja).toBeVisible();
  await expect(texto).toHaveValue('Comprar tornillos');

  await tocarAfuera(page);
  await expect(pregunta(page)).toBeVisible();
  await pregunta(page).getByRole('button', { name: 'Seguir editando' }).click();
  await expect(hoja).toBeVisible();
  await expect(texto).toHaveValue('Comprar tornillos');

  await hoja.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await expect(pregunta(page)).toBeVisible();
  await pregunta(page).getByRole('button', { name: 'Descartar' }).click();
  await expect(hoja).toBeHidden();
});

test('un movimiento: la cruz lo cierra de una si no se tocó, y pregunta si ya se escribió algo', async ({
  page,
}) => {
  let hoja = await abrirPorRuta(page, '/finanzas/nuevo', 'Cargar un movimiento');
  await hoja.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await expect(hoja).toBeHidden();
  await expect(pregunta(page)).toHaveCount(0);

  hoja = await abrirPorRuta(page, '/finanzas/nuevo', 'Cargar un movimiento');
  await hoja.getByLabel('Qué fue').fill('Tornillos para la mesada');
  await hoja.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await expect(pregunta(page)).toBeVisible();
  await pregunta(page).getByRole('button', { name: 'Descartar' }).click();
  await expect(hoja).toBeHidden();
});

test('editar un cliente sin cambiar nada no pregunta, y con un cambio pregunta con Cancelar y con Escape', async ({
  page,
}) => {
  const clienteId = await crearCliente(sesion, 'Rosa Ibarra');
  await page.goto(`/clientes/${clienteId}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Rosa Ibarra', CARGA);

  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  const edicion = page.getByRole('dialog', { name: 'Editar cliente' });
  await expect(edicion).toBeVisible();
  await tocarAfuera(page);
  await expect(edicion).toBeHidden();
  await expect(pregunta(page)).toHaveCount(0);

  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  await expect(edicion).toBeVisible();
  await edicion.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(edicion).toBeHidden();
  await expect(pregunta(page)).toHaveCount(0);

  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  await expect(edicion).toBeVisible();
  const zona = edicion.getByLabel('Zona');
  await zona.fill('Olivos');
  await edicion.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(pregunta(page)).toBeVisible();
  await pregunta(page).getByRole('button', { name: 'Seguir editando' }).click();
  await expect(zona).toHaveValue('Olivos');

  await page.keyboard.press('Escape');
  await expect(pregunta(page)).toBeVisible();
  await pregunta(page).getByRole('button', { name: 'Descartar' }).click();
  await expect(edicion).toBeHidden();
  expect((await leerCliente(sesion, 'Rosa Ibarra'))?.zona).not.toBe('Olivos');
});

test('cargar contacto: con lo que pide escrito, tocar afuera pregunta; si se borra lo escrito, Cancelar cierra de una', async ({
  page,
}) => {
  const hoja = await abrirPorRuta(page, '/seguimiento/nuevo', 'Cargar contacto');
  const quePide = hoja.getByLabel('Qué pide');
  await quePide.fill('Placard');

  await tocarAfuera(page);
  await expect(pregunta(page)).toBeVisible();
  await pregunta(page).getByRole('button', { name: 'Seguir editando' }).click();
  await expect(quePide).toHaveValue('Placard');

  await quePide.fill('');
  await hoja.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(hoja).toBeHidden();
  await expect(pregunta(page)).toHaveCount(0);
});
