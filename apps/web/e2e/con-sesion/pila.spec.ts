import { expect, test, type Page } from '@playwright/test';

import {
  ajustarTaller,
  contestarComoCliente,
  crearCliente,
  encuestaComoCliente,
  encuestaPorRest,
  guardarProyectoPorRpc,
  hoyEnElTaller,
  iniciarSesionDePrueba,
  vaciarTaller,
  type SesionDePrueba,
} from '../apoyo/taller';

const CARGA = { timeout: 30_000 };

let sesion: SesionDePrueba;
let documentos = 0;
let aperturas = 0;

test.beforeEach(async ({ page }) => {
  sesion = await iniciarSesionDePrueba();
  await vaciarTaller(sesion);
  await ajustarTaller(sesion, {
    sueldo_mensual_centavos: 50_000_000,
    costos_fijos_centavos: 25_000_000,
  });
  documentos = 0;
  aperturas = 0;
  page.on('request', (pedido) => {
    if (pedido.resourceType() === 'document') documentos += 1;
  });
});

test.afterEach(() => {
  expect(documentos, 'ninguna navegación de la app recarga el documento').toBe(aperturas);
});

async function obra(
  titulo: string,
  opciones: { estado?: string; entrega?: string | null; pago?: number } = {},
): Promise<string> {
  const { estado = 'en_curso', entrega = null, pago = 0 } = opciones;
  const clienteId = await crearCliente(sesion, `Cliente de ${titulo}`);
  const id = crypto.randomUUID();
  await guardarProyectoPorRpc(sesion, {
    proyecto: {
      id,
      version: null,
      cliente_id: clienteId,
      titulo,
      estado,
      presupuesto_centavos: 90_000_000,
      comprobante: 'sin_comprobante',
      fecha_inicio: hoyEnElTaller(),
      entrega_estimada: entrega,
    },
    pagos:
      pago === 0
        ? []
        : [
            {
              id: crypto.randomUUID(),
              fecha: hoyEnElTaller(),
              concepto: 'Seña',
              monto_centavos: pago,
            },
          ],
    gastos: [],
  });
  return id;
}

function anterioresDelDocumento(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const actual = navigation.currentEntry;
    if (!actual) return [];
    const todas = navigation.entries();
    const anteriores: string[] = [];
    for (let indice = actual.index - 1; indice >= 0; indice -= 1) {
      const entrada = todas[indice];
      if (!entrada?.sameDocument) break;
      const url = new URL(entrada.url ?? '', location.origin);
      anteriores.push(`${url.pathname}${url.search}`);
    }
    return anteriores;
  });
}

function titulo(page: Page, texto: string) {
  return page.getByRole('heading', { level: 1, name: texto, exact: true });
}

async function abrir(page: Page, ruta: string, h1: string): Promise<void> {
  aperturas += 1;
  await page.goto(ruta);
  await expect(titulo(page, h1)).toBeVisible(CARGA);
}

test('de la agenda a una ficha, la flecha vuelve a la agenda y lo dice', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'la lista de la agenda con cada evento es la del celular');
  await obra('Vestidor en L', { entrega: hoyEnElTaller() });
  await abrir(page, '/agenda', 'Agenda');
  await page
    .getByRole('button', { name: /Vestidor en L/ })
    .first()
    .click();
  await expect(titulo(page, 'Vestidor en L')).toBeVisible();
  const flecha = page.getByRole('link', { name: 'Agenda', exact: true });
  await expect(flecha).toBeVisible();
  await flecha.click();
  await expect(titulo(page, 'Agenda')).toBeVisible();
  expect(await anterioresDelDocumento(page)).toEqual([]);
});

test('entrando directo a una ficha, la flecha reemplaza por su padre y en el celular deja Inicio abajo', async ({
  page,
  isMobile,
}) => {
  const id = await obra('Mesa ratona');
  await abrir(page, `/proyectos/${id}`, 'Mesa ratona');
  await page.getByRole('link', { name: 'Proyectos', exact: true }).first().click();
  await expect(titulo(page, 'Proyectos')).toBeVisible();
  await expect(page).toHaveURL(/\/proyectos$/);
  expect(await anterioresDelDocumento(page)).toEqual(isMobile ? ['/'] : []);
});

test('en el celular, cambiar de sección desde la barra deja la pila en Inicio y esa sección', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'las secciones son del celular');
  const barra = page.getByRole('navigation', { name: 'Principal' });
  await obra('Placard del pasillo');
  await abrir(page, '/', 'Inicio');

  await barra.getByRole('button', { name: 'Clientes', exact: true }).click();
  await expect(titulo(page, 'Clientes')).toBeVisible();
  await page.getByRole('button', { name: /Cliente de Placard del pasillo/ }).click();
  await expect(titulo(page, 'Cliente de Placard del pasillo')).toBeVisible();
  await barra.getByRole('button', { name: 'Finanzas', exact: true }).click();
  await expect(titulo(page, 'Finanzas')).toBeVisible();
  expect(await anterioresDelDocumento(page)).toEqual(['/']);

  await page.goBack();
  await expect(titulo(page, 'Inicio')).toBeVisible();
  expect(await anterioresDelDocumento(page)).toEqual([]);

  await page.getByRole('link', { name: 'Agenda', exact: true }).click();
  await expect(titulo(page, 'Agenda')).toBeVisible();
  await barra.getByRole('button', { name: 'Inicio', exact: true }).click();
  await expect(titulo(page, 'Inicio')).toBeVisible();
  expect(await anterioresDelDocumento(page)).toEqual([]);

  await barra.getByRole('button', { name: 'Proyectos', exact: true }).click();
  await expect(titulo(page, 'Proyectos')).toBeVisible();
  await page.getByRole('tab', { name: /Consultas/ }).click();
  await expect(page).toHaveURL(/\/consultas$/);
  await barra.getByRole('button', { name: 'Proyectos', exact: true }).click();
  await page.waitForTimeout(500);
  await expect(page).toHaveURL(/\/consultas$/);
  expect(await anterioresDelDocumento(page)).toEqual(['/']);
});

test('guardar un proyecto nuevo, cobrar y borrar no dejan un formulario ni una ficha para volver', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await crearCliente(sesion, 'Ramiro Díaz');
  const cobrable = await obra('Mesada de cocina', { estado: 'entregado', pago: 30_000_000 });
  await abrir(page, '/proyectos', 'Proyectos');

  await page.getByRole('button', { name: 'Nuevo proyecto' }).click();
  await page.getByRole('combobox', { name: 'Cliente' }).fill('Ramiro');
  await page
    .getByRole('option', { name: /Ramiro Díaz/ })
    .first()
    .click();
  await page.getByLabel('Trabajo').fill('Biblioteca nueva');
  await page.getByRole('button', { name: 'Guardar proyecto' }).click();
  await expect(titulo(page, 'Biblioteca nueva')).toBeVisible(CARGA);
  await page.goBack();
  await expect(titulo(page, 'Proyectos')).toBeVisible();
  expect(await anterioresDelDocumento(page)).toEqual([]);

  await page.getByRole('link', { name: 'Mesada de cocina', exact: true }).click();
  await page.getByRole('button', { name: /^Cobrar/ }).click();
  await page.getByRole('button', { name: /^Cobrar y repartir/ }).click();
  await expect(page).toHaveURL(new RegExp(`/proyectos/${cobrable}$`));
  const corte = page
    .getByRole('region', { name: 'Distribución de la ganancia' })
    .locator('[style*="maun-corte"]');
  await expect(corte.first()).toBeAttached();
  await page.goBack();
  await expect(titulo(page, 'Proyectos')).toBeVisible();
  await page.goForward();
  await expect(titulo(page, 'Mesada de cocina')).toBeVisible();
  await expect(corte).toHaveCount(0);
  await page.goBack();
  await expect(titulo(page, 'Proyectos')).toBeVisible();

  await page.getByRole('link', { name: 'Biblioteca nueva', exact: true }).click();
  await expect(titulo(page, 'Biblioteca nueva')).toBeVisible();
  await page.getByRole('button', { name: 'Borrar' }).first().click();
  await page.getByRole('button', { name: /^Borrar el proyecto/ }).click();
  await expect(titulo(page, 'Proyectos')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Biblioteca nueva', exact: true })).toHaveCount(0);
  expect(await anterioresDelDocumento(page)).toEqual([]);
});

test('las pestañas de Proyectos y de Opiniones, y la ficha de una respuesta, no dejan rastro', async ({
  page,
}) => {
  const entregado = await obra('Mueble de TV', { estado: 'entregado' });
  const token = `e2e-${crypto.randomUUID().replaceAll('-', '')}`;
  await encuestaPorRest(sesion, entregado, token);
  const encuesta = (await encuestaComoCliente(sesion, token)) as {
    preguntas: { id: string; tipo: string }[];
  };
  await contestarComoCliente(sesion, token, {
    id: crypto.randomUUID(),
    renglones: encuesta.preguntas.map((pregunta) => ({
      pregunta: pregunta.id,
      valor: pregunta.tipo === 'texto' ? 'Quedó muy bien.' : pregunta.tipo === 'sitalvezno' ? 3 : 5,
    })),
  });

  await abrir(page, '/proyectos', 'Proyectos');
  for (const pestana of [/Consultas/, /Seguimiento/, /Historial/, /Activos/]) {
    await page.getByRole('tab', { name: pestana }).click();
    await expect(page.getByRole('tab', { name: pestana })).toHaveAttribute('aria-selected', 'true');
  }
  expect(await anterioresDelDocumento(page)).toEqual([]);

  await abrir(page, '/opiniones', 'Resultados');
  await page.getByRole('link', { name: 'Preguntas', exact: true }).click();
  await expect(titulo(page, 'Preguntas')).toBeVisible();
  await page.getByRole('link', { name: 'Resultados', exact: true }).click();
  await expect(titulo(page, 'Resultados')).toBeVisible();
  expect(await anterioresDelDocumento(page)).toEqual([]);

  await page.getByRole('button', { name: 'Cliente de Mueble de TV', exact: true }).first().click();
  const ficha = page.getByRole('dialog');
  await expect(ficha).toBeVisible();
  await ficha.getByRole('button', { name: 'Cerrar' }).click();
  await expect(ficha).toBeHidden();
  await expect(page).toHaveURL(/\/opiniones$/);
  expect(await anterioresDelDocumento(page)).toEqual([]);
});
