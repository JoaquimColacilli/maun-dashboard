import { expect, test, type Page } from '@playwright/test';

import { entrarConLaSesion } from '../apoyo/sesion';
import { iniciarSesionDePrueba, type SesionDePrueba } from '../apoyo/taller';
import { abrirComparador } from './capturas';
import { sembrarElTaller, type TallerDeLasTransiciones } from './datos';
import { espiarLasTransiciones } from './espia';
import { medir } from './medida';

const CARGA = { timeout: 30_000 };

let sesion: SesionDePrueba;
let taller: TallerDeLasTransiciones;

test.beforeAll(async () => {
  sesion = await iniciarSesionDePrueba();
  taller = await sembrarElTaller(sesion);
});

test.beforeEach(async ({ context }) => {
  await entrarConLaSesion(context, sesion);
  await espiarLasTransiciones(context);
});

function titulo(page: Page, texto: string) {
  return page.getByRole('heading', { level: 1, name: texto, exact: true });
}

function scrollDelPrincipal(page: Page): Promise<number> {
  return page.getByRole('main').evaluate((principal) => Math.round(principal.scrollTop));
}

test('cada movimiento del celular sale con su tipo y su alcance, y al 0 y al 100 % es la pantalla quieta', async ({
  page,
  context,
}, testInfo) => {
  test.setTimeout(240_000);
  const comparador = await abrirComparador(context);
  const barra = page.getByRole('navigation', { name: 'Principal' });
  const [primerCliente] = taller.clientes;
  if (!primerCliente) throw new Error('faltan clientes sembrados');

  await page.goto('/');
  await expect(titulo(page, 'Inicio')).toBeVisible(CARGA);

  await medir(page, comparador, testInfo, {
    nombre: '01-fundido',
    alcance: 'main',
    tipos: ['fundido'],
    hacer: () => barra.getByRole('button', { name: 'Clientes', exact: true }).click(),
    listo: () => expect(titulo(page, 'Clientes')).toBeVisible(),
  });

  await page.getByRole('main').evaluate((principal) => {
    principal.scrollTop = 240;
    principal.dispatchEvent(new Event('scroll'));
  });
  const scrollDeLaLista = await scrollDelPrincipal(page);
  const cliente = taller.clientes[6] ?? primerCliente;

  await medir(page, comparador, testInfo, {
    nombre: '02-empuje',
    alcance: 'main',
    tipos: ['empuje'],
    hacer: () => page.getByRole('button', { name: new RegExp(cliente.titulo) }).click(),
    listo: () => expect(titulo(page, cliente.titulo)).toBeVisible(),
  });
  expect.soft(await scrollDelPrincipal(page), 'apilar arranca arriba').toBe(0);

  await medir(page, comparador, testInfo, {
    nombre: '03-vuelta',
    alcance: 'main',
    tipos: ['vuelta'],
    hacer: () => page.getByRole('link', { name: 'Clientes', exact: true }).click(),
    listo: () => expect(titulo(page, 'Clientes')).toBeVisible(),
  });
  expect
    .soft(await scrollDelPrincipal(page), 'atrás devuelve el scroll de la lista')
    .toBe(scrollDeLaLista);

  await medir(page, comparador, testInfo, {
    nombre: '04-fundido-a-proyectos',
    alcance: 'main',
    tipos: ['fundido'],
    hacer: () => barra.getByRole('button', { name: 'Proyectos', exact: true }).click(),
    listo: () => expect(titulo(page, 'Proyectos')).toBeVisible(),
  });

  const tarjeta = page.locator('a[data-tarjeta]').first();
  const tituloDeLaObra = (await tarjeta.innerText()).trim();

  await medir(page, comparador, testInfo, {
    nombre: '05-tarjeta',
    alcance: 'main',
    tipos: ['tarjeta'],
    hacer: () => tarjeta.click(),
    listo: () => expect(titulo(page, tituloDeLaObra)).toBeVisible(),
  });

  await medir(page, comparador, testInfo, {
    nombre: '06-subida',
    alcance: 'documento',
    tipos: ['subida'],
    hacer: () => page.getByRole('button', { name: 'Editar', exact: true }).first().click(),
    listo: () => expect(page.getByText('Editar proyecto', { exact: true })).toBeVisible(),
  });

  await medir(page, comparador, testInfo, {
    nombre: '07-bajada',
    alcance: 'documento',
    tipos: ['bajada'],
    hacer: () => page.getByRole('button', { name: 'Cancelar' }).click(),
    listo: () => expect(titulo(page, tituloDeLaObra)).toBeVisible(),
  });

  await medir(page, comparador, testInfo, {
    nombre: '08-tarjeta-vuelta',
    alcance: 'main',
    tipos: ['tarjeta-vuelta'],
    hacer: async () => {
      await page.goBack();
    },
    listo: () => expect(titulo(page, 'Proyectos')).toBeVisible(),
  });

  await medir(page, comparador, testInfo, {
    nombre: '09-pestana-adelante',
    alcance: 'main',
    tipos: ['pestana-adelante'],
    hacer: () => page.getByRole('tab', { name: /Historial/ }).click(),
    listo: () =>
      expect(page.getByRole('tab', { name: /Historial/ })).toHaveAttribute('aria-selected', 'true'),
  });

  await medir(page, comparador, testInfo, {
    nombre: '10-pestana-atras',
    alcance: 'main',
    tipos: ['pestana-atras'],
    hacer: () => page.getByRole('tab', { name: /Consultas/ }).click(),
    listo: () =>
      expect(page.getByRole('tab', { name: /Consultas/ })).toHaveAttribute('aria-selected', 'true'),
  });
});
