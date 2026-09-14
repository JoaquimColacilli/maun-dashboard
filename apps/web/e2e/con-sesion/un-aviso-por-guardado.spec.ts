import { expect, test, type BrowserContext, type Page } from '@playwright/test';

import { listoParaCortar } from '../apoyo/pantalla';
import {
  contactoPorRpc,
  crearCliente,
  iniciarSesionDePrueba,
  vaciarTaller,
  type SesionDePrueba,
} from '../apoyo/taller';

const CARGA = { timeout: 30_000 };

type VentanaConAvisos = Window & { avisosVistos: string[] };

let sesion: SesionDePrueba;

test.beforeEach(async ({ page }) => {
  sesion = await iniciarSesionDePrueba();
  await vaciarTaller(sesion);
  await page.addInitScript(() => {
    const vistos: string[] = [];
    (window as unknown as VentanaConAvisos).avisosVistos = vistos;
    new MutationObserver(() => {
      for (const parrafo of document.querySelectorAll(
        '[role="status"] > div > div > p:first-child',
      )) {
        const texto = parrafo.textContent.trim();
        if (texto !== '' && !vistos.includes(texto)) vistos.push(texto);
      }
    }).observe(document, { subtree: true, childList: true, characterData: true });
  });
});

function regionDeAvisos(page: Page) {
  return page
    .getByRole('status')
    .filter({ has: page.getByRole('button', { name: 'Cerrar el aviso' }) });
}

async function avisosEnPantalla(page: Page): Promise<string[]> {
  const textos = await regionDeAvisos(page).locator(':scope > div p:first-child').allInnerTexts();
  return textos.map((texto) => texto.trim());
}

async function avisosVistos(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as VentanaConAvisos).avisosVistos);
}

async function sinSenalYDeVuelta(
  page: Page,
  context: BrowserContext,
  proyecto: string,
  guardar: () => Promise<void>,
  textos: { enCola: string; hecho: string },
): Promise<void> {
  await listoParaCortar(page);
  await context.setOffline(true);
  await guardar();

  await expect.poll(() => avisosEnPantalla(page)).toEqual([textos.enCola]);
  console.log(`[${proyecto}] sin señal: ${(await avisosEnPantalla(page)).join(' | ')}`);

  await context.setOffline(false);
  await expect(regionDeAvisos(page).getByText(textos.hecho)).toBeVisible(CARGA);
  expect(await avisosEnPantalla(page)).toEqual([textos.hecho]);
  console.log(`[${proyecto}] al volver: ${(await avisosEnPantalla(page)).join(' | ')}`);
  expect(await avisosVistos(page)).toEqual([textos.enCola, textos.hecho]);
}

test('con señal, guardar un contacto cambiándole el teléfono deja un solo aviso, y dice que se guardó', async ({
  page,
}, testInfo) => {
  const { id } = await contactoPorRpc(sesion, {
    titulo: 'Biblioteca',
    estado: 'a_presupuestar',
    telefono: '11 5555-0000',
  });

  await page.goto(`/proyectos/${id}`);
  await expect(page.getByRole('region', { name: 'Qué falta' })).toBeVisible(CARGA);
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  const hoja = page.getByRole('dialog', { name: 'Editar el contacto' });
  await hoja.getByLabel('Teléfono').fill('11 5555-9999');
  await hoja.getByLabel('Notas').fill('Pasó un teléfono nuevo');
  await hoja.getByRole('button', { name: 'Guardar los cambios' }).click();

  await expect(regionDeAvisos(page).getByText('Contacto guardado.')).toBeVisible(CARGA);
  expect(await avisosEnPantalla(page)).toEqual(['Contacto guardado.']);
  expect(await avisosVistos(page)).toEqual(['Contacto guardado.']);
  console.log(
    `[${testInfo.project.name}] con señal: ${(await avisosEnPantalla(page)).join(' | ')}`,
  );
});

test('sin señal, guardar un contacto deja un solo aviso, que cambia cuando vuelve la señal', async ({
  page,
  context,
}, testInfo) => {
  const { id } = await contactoPorRpc(sesion, { titulo: 'Escritorio', estado: 'a_presupuestar' });
  await page.goto(`/proyectos/${id}`);
  await expect(page.getByRole('region', { name: 'Qué falta' })).toBeVisible(CARGA);

  await sinSenalYDeVuelta(
    page,
    context,
    testInfo.project.name,
    async () => {
      await page.getByRole('button', { name: 'Editar', exact: true }).click();
      const hoja = page.getByRole('dialog', { name: 'Editar el contacto' });
      await hoja.getByLabel('Notas').fill('Anotado en el taller');
      await hoja.getByRole('button', { name: 'Guardar los cambios' }).click();
      await expect(hoja).toBeHidden();
    },
    {
      enCola: 'Contacto anotado sin señal: se guarda solo cuando vuelva.',
      hecho: 'Contacto guardado. Estaba anotado sin señal.',
    },
  );
});

test('sin señal, un cliente nuevo deja un solo aviso que cambia', async ({
  page,
  context,
}, testInfo) => {
  await page.goto('/clientes');
  await expect(page.getByRole('button', { name: 'Cargá tu primer cliente' })).toBeVisible(CARGA);

  await sinSenalYDeVuelta(
    page,
    context,
    testInfo.project.name,
    async () => {
      await page.getByRole('button', { name: 'Cargá tu primer cliente' }).click();
      await page.getByLabel('Nombre', { exact: true }).fill('Sin señal');
      await page.getByRole('button', { name: 'Guardar cliente' }).click();
    },
    {
      enCola: 'Cliente anotado sin señal: se guarda solo cuando vuelva.',
      hecho: 'Cliente guardado. Estaba anotado sin señal.',
    },
  );
});

test('sin señal, un movimiento deja un solo aviso que cambia', async ({
  page,
  context,
}, testInfo) => {
  await page.goto('/finanzas');
  await expect(page.getByRole('button', { name: 'Cargar movimiento' })).toBeVisible(CARGA);

  await sinSenalYDeVuelta(
    page,
    context,
    testInfo.project.name,
    async () => {
      await page.getByRole('button', { name: 'Cargar movimiento' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.getByRole('radio', { name: 'Gasto' }).click();
      await page
        .getByRole('group', { name: 'Detalle del tipo' })
        .getByRole('button', { name: 'Del hogar', exact: true })
        .click();
      await page.getByLabel('Cuánta plata').fill('33.000');
      await page.getByLabel('Qué fue').fill('Súper sin señal');
      await page.getByRole('button', { name: 'Cargar el movimiento' }).click();
      await expect(page.getByRole('dialog')).toBeHidden();
    },
    {
      enCola: 'Movimiento anotado sin señal: se guarda solo cuando vuelva.',
      hecho: 'Movimiento guardado. Estaba anotado sin señal.',
    },
  );
});

test('sin señal, un proyecto nuevo deja un solo aviso que cambia', async ({
  page,
  context,
}, testInfo) => {
  await crearCliente(sesion, 'Marcela Sosa');
  await page.goto('/proyectos/nuevo');
  await expect(page.getByRole('button', { name: 'Guardar proyecto' })).toBeVisible(CARGA);

  await sinSenalYDeVuelta(
    page,
    context,
    testInfo.project.name,
    async () => {
      await page.getByRole('combobox', { name: 'Cliente' }).fill('Marcela');
      await page
        .getByRole('option', { name: /Marcela Sosa/ })
        .first()
        .click();
      await page.getByLabel('Trabajo').fill('Placard sin señal');
      await page.getByLabel('Presupuesto').fill('1200000');
      await page.getByRole('button', { name: 'Guardar proyecto' }).click();
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Placard sin señal');
    },
    {
      enCola: 'Proyecto anotado sin señal: se guarda solo cuando vuelva.',
      hecho: 'Proyecto guardado. Estaba anotado sin señal.',
    },
  );
});
