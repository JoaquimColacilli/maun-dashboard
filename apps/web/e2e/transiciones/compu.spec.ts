import { expect, test, type Page } from '@playwright/test';

import { entrarConLaSesion } from '../apoyo/sesion';
import { iniciarSesionDePrueba, type SesionDePrueba } from '../apoyo/taller';
import { abrirComparador } from './capturas';
import { sembrarElTaller, type TallerDeLasTransiciones } from './datos';
import { espiarLasTransiciones } from './espia';
import { medir, sinTransicion } from './medida';

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

test('en la tablet y en la compu, la navegación funde con el fundido del navegador y lo de adentro no se mueve', async ({
  page,
  context,
}, testInfo) => {
  test.setTimeout(180_000);
  const comparador = await abrirComparador(context);
  const barra = page.getByRole('navigation', { name: 'Principal' });
  const [cliente] = taller.clientes;
  if (!cliente) throw new Error('faltan clientes sembrados');

  await page.goto('/');
  await expect(titulo(page, 'Inicio')).toBeVisible(CARGA);

  await medir(page, comparador, testInfo, {
    nombre: '01-navegacion',
    alcance: 'documento',
    tipos: [],
    hacer: () => barra.getByRole('button', { name: 'Clientes', exact: true }).click(),
    listo: () => expect(titulo(page, 'Clientes')).toBeVisible(),
  });

  await sinTransicion(page, async () => {
    await page.getByRole('button', { name: new RegExp(cliente.titulo) }).click();
    await expect(titulo(page, cliente.titulo)).toBeVisible();
  });

  await sinTransicion(page, async () => {
    await page.getByRole('link', { name: 'Clientes', exact: true }).click();
    await expect(titulo(page, 'Clientes')).toBeVisible();
  });

  await medir(page, comparador, testInfo, {
    nombre: '02-hoja-desde-la-navegacion',
    alcance: 'documento',
    tipos: [],
    hacer: async () => {
      await barra.getByRole('button', { name: 'Cargar algo nuevo' }).click();
      await page.getByRole('menuitem', { name: 'Movimiento' }).click();
    },
    listo: () => expect(page.getByRole('dialog', { name: 'Cargar un movimiento' })).toBeVisible(),
  });
});
