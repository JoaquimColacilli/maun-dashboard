import { expect, test, type Page } from '@playwright/test';

import {
  crearCliente,
  encuestaPorRest,
  guardarProyectoPorRpc,
  iniciarSesionDePrueba,
  ordenarLaEncuestaBase,
  revocarEncuestaPorRest,
  vaciarTaller,
  type SesionDePrueba,
} from '../apoyo/taller';

const CARGA = { timeout: 30_000 };

let sesion: SesionDePrueba;

test.beforeEach(async () => {
  sesion = await iniciarSesionDePrueba();
  await vaciarTaller(sesion);
});

function tokenDePrueba(): string {
  return `e2e-${crypto.randomUUID().replaceAll('-', '')}`;
}

async function trabajoConEncuesta(): Promise<{ encuestaId: string; token: string }> {
  const clienteId = await crearCliente(sesion, 'Marcela Duarte', { telefono: '11 5523 4410' });
  const id = crypto.randomUUID();
  await guardarProyectoPorRpc(sesion, {
    proyecto: {
      id,
      version: null,
      cliente_id: clienteId,
      titulo: 'Placard 3 puertas con interior en melamina',
      estado: 'entregado',
      presupuesto_centavos: 100_000_000,
      comprobante: 'sin_comprobante',
    },
    pagos: [],
    gastos: [],
  });
  const token = tokenDePrueba();
  const encuesta = await encuestaPorRest(sesion, id, token);
  return { encuestaId: encuesta.id, token };
}

function titulo(page: Page) {
  return page.getByRole('heading', { level: 1 });
}

async function elegir(page: Page, opcion: string): Promise<void> {
  const radio = page.getByRole('radio', { name: opcion, exact: true });
  await page.locator('label').filter({ has: radio }).click();
  await expect(radio).toBeChecked();
}

async function contestarLoObligatorio(page: Page): Promise<void> {
  await elegir(page, 'Muy conforme');
  await elegir(page, 'A tiempo');
  await elegir(page, 'Sí, sin dudarlo');
}

test('el cliente contesta una sola vez: le dan las gracias y al volver ve lo que puso', async ({
  page,
}) => {
  const { token } = await trabajoConEncuesta();

  await page.goto(`/o/${token}`);
  await expect(titulo(page)).toHaveText('¿Cómo te fue con tu placard?', CARGA);
  await expect(page.getByText('el taller va a saber que esto lo contestaste vos')).toBeVisible();

  await contestarLoObligatorio(page);
  await page
    .getByRole('textbox', { name: '¿Qué podríamos hacer mejor?' })
    .fill('Todo muy bien, llegó cuando dijeron.');
  await page.getByRole('button', { name: 'Mandar mi opinión' }).click();

  await expect(titulo(page)).toHaveText('Gracias, Marcela', CARGA);

  await page.reload();
  await expect(titulo(page)).toHaveText('Ya nos contaste, gracias', CARGA);
  await expect(page.getByText('Todo muy bien, llegó cuando dijeron.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mandar mi opinión' })).toHaveCount(0);
});

test('un enlace dado de baja y uno que nunca existió muestran exactamente lo mismo', async ({
  page,
}) => {
  const { encuestaId, token } = await trabajoConEncuesta();
  await revocarEncuestaPorRest(sesion, encuestaId);

  await page.goto(`/o/${token}`);
  await expect(titulo(page)).toHaveText('Este enlace ya no funciona', CARGA);
  const dadoDeBaja = await page.getByRole('main').innerText();

  await page.goto(`/o/${tokenDePrueba()}`);
  await expect(titulo(page)).toHaveText('Este enlace ya no funciona', CARGA);
  const inexistente = await page.getByRole('main').innerText();

  expect(dadoDeBaja).toBe(inexistente);
  expect(dadoDeBaja).not.toContain('Marcela');
  expect(dadoDeBaja).not.toContain('Placard');
});

test('si se corta la señal mientras abre, lo dice, y cuando vuelve la encuesta aparece sola', async ({
  page,
  context,
}) => {
  const { token } = await trabajoConEncuesta();
  let soltar = (): void => undefined;
  const retenida = new Promise<void>((resolver) => {
    soltar = resolver;
  });
  let primera = true;
  await page.route('**/rest/v1/rpc/encuesta_compartida', async (ruta) => {
    if (!primera) {
      await ruta.continue();
      return;
    }
    primera = false;
    await retenida;
    await ruta.abort('internetdisconnected');
  });

  await page.goto(`/o/${token}`);
  await expect(page.getByText('Abriendo la encuesta')).toBeAttached();
  await context.setOffline(true);
  soltar();

  await expect(titulo(page)).toHaveText('Sin conexión', CARGA);
  await expect(
    page.getByText('Necesitás señal para abrir la encuesta. Probá de nuevo cuando vuelva.'),
  ).toBeVisible();

  await context.setOffline(false);
  await expect(titulo(page)).toHaveText('¿Cómo te fue con tu placard?', CARGA);
});

test('el cliente que abre la encuesta no se baja la app ni queda nada guardado', async ({
  page,
}) => {
  const { token } = await trabajoConEncuesta();

  const pedidos: string[] = [];
  page.on('request', (pedido) => {
    const ruta = new URL(pedido.url()).pathname;
    if (/sw\.js|registerSW|manifest\.webmanifest/.test(ruta)) pedidos.push(ruta);
  });

  await page.goto(`/o/${token}`);
  await expect(titulo(page)).toHaveText('¿Cómo te fue con tu placard?', CARGA);
  await page.waitForTimeout(1_000);

  expect(await page.locator('link[rel="manifest"]').count()).toBe(0);
  expect(
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length),
  ).toBe(0);
  expect(pedidos, `la encuesta pidió ${pedidos.join(', ')}`).toEqual([]);
  const guardado = await page.evaluate(async () => ({
    local: Object.keys(localStorage),
    bases: (await indexedDB.databases()).map((base) => base.name ?? ''),
  }));
  expect(guardado.local.filter((clave) => clave !== 'maun:tema')).toEqual([]);
  expect(guardado.bases).toEqual([]);
});

test('se contesta entera con el teclado, y los errores se anuncian', async ({ page }, testInfo) => {
  await ordenarLaEncuestaBase(sesion);
  const { token } = await trabajoConEncuesta();

  await page.goto(`/o/${token}`);
  await expect(titulo(page)).toHaveText('¿Cómo te fue con tu placard?', CARGA);
  console.log(`\n=== árbol de accesibilidad de la encuesta (${testInfo.project.name}) ===`);
  console.log(await page.getByRole('main').ariaSnapshot());

  const mandar = page.getByRole('button', { name: 'Mandar mi opinión' });
  await mandar.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('alert')).toHaveText(
    'Te faltan 3 preguntas, están marcadas más arriba.',
  );
  await expect(page.getByRole('radio', { name: 'Nada' })).toBeFocused();

  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { name: 'Conforme', exact: true })).toBeChecked();

  await page.keyboard.press('Tab');
  await expect(page.getByRole('radio', { name: 'Muy tarde' })).toBeFocused();
  await page.keyboard.press('Space');
  await expect(page.getByRole('radio', { name: 'Muy tarde' })).toBeChecked();

  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('radio', { name: 'Sí, sin dudarlo' })).toBeFocused();
  await page.keyboard.press('Space');

  await page.keyboard.press('Tab');
  await page.keyboard.type('Contesto desde el teclado.');
  await page.keyboard.press('Tab');
  await expect(mandar).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(titulo(page)).toHaveText('Gracias, Marcela', CARGA);
  await expect(titulo(page)).toBeFocused();
});
