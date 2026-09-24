import { expect, test, type Page, type TestInfo } from '@playwright/test';

import { listoParaCortar } from '../apoyo/pantalla';
import {
  ajustarTaller,
  contactoPorRpc,
  guardarProyectoPorRpc,
  hoyEnElTaller,
  iniciarSesionDePrueba,
  leerAjustes,
  leerProyecto,
  vaciarTaller,
  type SesionDePrueba,
} from '../apoyo/taller';

const CARGA = { timeout: 30_000 };
const TEMAS = ['light', 'dark'] as const;

let sesion: SesionDePrueba;

test.beforeEach(async () => {
  sesion = await iniciarSesionDePrueba();
  await vaciarTaller(sesion);
  await ajustarTaller(sesion, { presupuesto_vale_dias: 15 });
});

test.afterEach(async () => {
  await ajustarTaller(sesion, { presupuesto_vale_dias: 15 });
});

function sumarDias(fecha: string, dias: number): string {
  const dia = new Date(`${fecha}T12:00:00Z`);
  dia.setUTCDate(dia.getUTCDate() + dias);
  return dia.toISOString().slice(0, 10);
}

async function abrir(page: Page, ruta: string): Promise<void> {
  await page.goto(ruta);
  await listoParaCortar(page);
}

async function vigenciaEnLaBase(titulo: string): Promise<string | null | undefined> {
  return (await leerProyecto(sesion, titulo))?.presupuesto_vale_hasta;
}

async function presupuestoMandado(titulo: string, valeHasta: string | null): Promise<string> {
  const { id, clienteId } = await contactoPorRpc(sesion, { titulo, estado: 'a_presupuestar' });
  const proyecto = await leerProyecto(sesion, titulo);
  await guardarProyectoPorRpc(sesion, {
    proyecto: {
      id,
      version: proyecto?.version ?? null,
      cliente_id: clienteId,
      titulo,
      estado: 'presupuesto_enviado',
      presupuesto_centavos: 90_000_000,
      comprobante: 'sin_comprobante',
      presupuesto_vale_hasta: valeHasta,
    },
    pagos: [],
    gastos: [],
  });
  return id;
}

async function capturarEnLosDosTemas(
  page: Page,
  testInfo: TestInfo,
  nombre: string,
): Promise<void> {
  for (const tema of TEMAS) {
    await page.emulateMedia({ colorScheme: tema });
    await page.waitForTimeout(500);
    await page.screenshot({
      path: testInfo.outputPath(`${nombre}-${tema}-${testInfo.project.name}.png`),
    });
  }
  await page.emulateMedia({ colorScheme: 'light' });
}

test('«Mandé el presupuesto» le pone la fecha con los días de Ajustes, y la ficha la muestra', async ({
  page,
}) => {
  const titulo = 'Rack de living';
  await ajustarTaller(sesion, { presupuesto_vale_dias: 10 });
  const { id } = await contactoPorRpc(sesion, { titulo, estado: 'a_presupuestar' });

  await abrir(page, `/proyectos/${id}`);
  await page.getByRole('button', { name: 'Mandé el presupuesto' }).click();
  await page.getByLabel('Cuánto presupuestaste').fill('900.000');
  await page.getByRole('button', { name: 'Marcar como enviado' }).click();

  await expect(page.getByRole('region', { name: 'Qué falta' })).toContainText(
    'Falta llamar para saber',
  );
  await expect.poll(() => vigenciaEnLaBase(titulo), CARGA).toBe(sumarDias(hoyEnElTaller(), 10));

  const datos = page.getByRole('region', { name: 'Datos del contacto' });
  await expect(datos).toContainText('Vale hasta');
  await expect(datos).toContainText('en 10 días');
});

test('la fecha se cambia desde la ficha, en la hoja del contacto, y el cliente lee la nueva', async ({
  page,
}, testInfo) => {
  const titulo = 'Vestidor en L';
  const hoy = hoyEnElTaller();
  const id = await presupuestoMandado(titulo, sumarDias(hoy, 5));

  await abrir(page, `/proyectos/${id}`);
  await page.getByRole('button', { name: 'Cambiar hasta cuándo vale el presupuesto' }).click();

  const hoja = page.getByRole('dialog', { name: 'Editar el contacto' });
  const campo = hoja.getByLabel('El presupuesto vale hasta');
  await expect(campo).toBeFocused();
  await expect(campo).toHaveValue(sumarDias(hoy, 5));
  await expect(hoja).toContainText('si deja la seña antes de ese día');

  await capturarEnLosDosTemas(page, testInfo, 'vigencia-en-la-hoja');

  await campo.fill(sumarDias(hoy, 20));
  await hoja.getByRole('button', { name: 'Guardar los cambios' }).click();
  await expect(hoja).toBeHidden(CARGA);
  await expect.poll(() => vigenciaEnLaBase(titulo), CARGA).toBe(sumarDias(hoy, 20));
  await expect(page.getByRole('region', { name: 'Datos del contacto' })).toContainText(
    'en 20 días',
  );

  await capturarEnLosDosTemas(page, testInfo, 'vigencia-en-la-ficha');

  await abrir(page, `/proyectos/${id}/vista-cliente`);
  await expect(page.getByRole('region', { name: 'Para cuándo' })).toContainText(
    'Si dejás la seña antes del',
  );
});

test('vencido: la tarjeta de Consultas, la ficha y la página del cliente lo dicen', async ({
  page,
}, testInfo) => {
  const titulo = 'Biblioteca con escalera';
  const hoy = hoyEnElTaller();
  const id = await presupuestoMandado(titulo, sumarDias(hoy, -2));

  await abrir(page, '/consultas');
  const tarjeta = page
    .getByRole('list', { name: 'Contactos' })
    .getByRole('listitem')
    .filter({ hasText: titulo });
  await expect(tarjeta).toContainText('Venció el presupuesto: actualizalo o cambiale la fecha');
  await expect(tarjeta).toContainText('Valía hasta el');
  await capturarEnLosDosTemas(page, testInfo, 'vencido-en-consultas');

  await abrir(page, `/proyectos/${id}`);
  await expect(page.getByRole('region', { name: 'Qué falta' })).toContainText(
    'Venció el presupuesto',
  );
  await expect(page.getByRole('region', { name: 'Datos del contacto' })).toContainText(
    'Vale hastaVenció el',
  );
  await capturarEnLosDosTemas(page, testInfo, 'vencido-en-la-ficha');

  await abrir(page, `/proyectos/${id}/vista-cliente`);
  await expect(page.getByRole('region', { name: 'Para cuándo' })).toContainText(
    'Este presupuesto venció el',
  );
});

test('en Ajustes se eligen los días que vale un presupuesto', async ({ page }, testInfo) => {
  await abrir(page, '/ajustes');
  const campo = page.getByLabel('Días que vale un presupuesto');
  await expect(campo).toHaveValue('15', CARGA);

  await campo.fill('0');
  await page.getByRole('button', { name: 'Guardar la configuración' }).click();
  await expect(
    page.getByText('Escribí cuántos días vale un presupuesto, entre 1 y 365.'),
  ).toBeVisible();

  await campo.fill('30');
  await page.getByRole('button', { name: 'Guardar la configuración' }).click();
  await expect.poll(async () => (await leerAjustes(sesion)).presupuesto_vale_dias, CARGA).toBe(30);

  await campo.scrollIntoViewIfNeeded();
  await capturarEnLosDosTemas(page, testInfo, 'dias-en-ajustes');
});
