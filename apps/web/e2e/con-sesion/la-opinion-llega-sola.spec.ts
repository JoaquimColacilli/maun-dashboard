import { expect, test, type Page } from '@playwright/test';

import {
  contestarComoCliente,
  crearCliente,
  encuestaComoCliente,
  encuestaPorRest,
  guardarProyectoPorRpc,
  iniciarSesionDePrueba,
  vaciarTaller,
  type SesionDePrueba,
} from '../apoyo/taller';

const CARGA = { timeout: 30_000 };
const SOLA = { timeout: 10_000 };

let sesion: SesionDePrueba;

test.beforeEach(async () => {
  sesion = await iniciarSesionDePrueba();
  await vaciarTaller(sesion);
});

async function encuestaLista(): Promise<string> {
  const clienteId = await crearCliente(sesion, 'Marcela Duarte', { telefono: '11 5523 4410' });
  const id = crypto.randomUUID();
  await guardarProyectoPorRpc(sesion, {
    proyecto: {
      id,
      version: null,
      cliente_id: clienteId,
      titulo: 'Placard 3 puertas',
      estado: 'entregado',
      presupuesto_centavos: 100_000_000,
      comprobante: 'sin_comprobante',
    },
    pagos: [],
    gastos: [],
  });
  const token = `e2e-${crypto.randomUUID().replaceAll('-', '')}`;
  await encuestaPorRest(sesion, id, token);
  return token;
}

async function contestar(token: string): Promise<void> {
  const encuesta = (await encuestaComoCliente(sesion, token)) as {
    preguntas: { id: string; tipo: string }[];
  };
  expect(
    await contestarComoCliente(sesion, token, {
      id: crypto.randomUUID(),
      renglones: encuesta.preguntas.map((pregunta) => ({
        pregunta: pregunta.id,
        valor: pregunta.tipo === 'texto' ? 'Impecable' : pregunta.tipo === 'sitalvezno' ? 3 : 5,
      })),
    }),
  ).toEqual({ estado: 'guardada' });
}

async function abrirInicio(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Inicio' })).toBeVisible(CARGA);
  await expect(page.getByRole('status').filter({ hasText: /Trayendo los datos/ })).toHaveCount(
    0,
    CARGA,
  );
}

async function ponerLaVisibilidad(page: Page, estado: 'visible' | 'hidden'): Promise<void> {
  await page.evaluate((valor) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => valor });
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => valor === 'hidden',
    });
    document.dispatchEvent(new Event('visibilitychange', { bubbles: true }));
  }, estado);
}

function laOpinion(page: Page) {
  return page.getByRole('link', { name: /Marcela Duarte opinó de su placard/ });
}

test('con la app a la vista, la opinión que contesta el cliente aparece sola en unos segundos', async ({
  page,
}) => {
  test.fail(true, 'hoy la app abierta no se entera: nada pide el delta mientras está a la vista');
  const token = await encuestaLista();
  await abrirInicio(page);

  await contestar(token);

  await expect(laOpinion(page)).toBeVisible(SOLA);
});

test('volver a la app trae lo nuevo enseguida, aunque la última carga sea de hace segundos', async ({
  page,
}) => {
  test.fail(true, 'hoy volver no pide el delta si la réplica tiene menos de un minuto');
  const token = await encuestaLista();
  await abrirInicio(page);
  await ponerLaVisibilidad(page, 'hidden');

  await contestar(token);
  await ponerLaVisibilidad(page, 'visible');

  await expect(laOpinion(page)).toBeVisible(SOLA);
});
