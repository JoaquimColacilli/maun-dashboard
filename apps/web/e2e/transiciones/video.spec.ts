import path from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { entrarConLaSesion } from '../apoyo/sesion';
import { iniciarSesionDePrueba, type SesionDePrueba } from '../apoyo/taller';
import { sembrarElTaller } from './datos';
import { sinTransicionEnCurso } from './espia';

const CARGA = { timeout: 30_000 };

const RECORRIDOS = [
  { nombre: 'normal', direccion: '/', pausa: 700 },
  { nombre: 'camara-lenta', direccion: '/?camara-lenta', pausa: 2_000 },
] as const;

test.skip(!process.env.GRABAR_EL_VIDEO, 'Se graba a pedido: GRABAR_EL_VIDEO=1.');
test.use({ video: { mode: 'on', size: { width: 390, height: 844 } } });

let sesion: SesionDePrueba;

test.beforeAll(async () => {
  sesion = await iniciarSesionDePrueba();
  await sembrarElTaller(sesion);
});

test.beforeEach(async ({ context }) => {
  await entrarConLaSesion(context, sesion);
});

function titulo(page: Page, texto: string) {
  return page.getByRole('heading', { level: 1, name: texto, exact: true });
}

for (const { nombre, direccion, pausa } of RECORRIDOS) {
  test(`el recorrido del celular, ${nombre}`, async ({ page }, testInfo) => {
    test.setTimeout(5 * 60_000);
    const barra = page.getByRole('navigation', { name: 'Principal' });
    const paso = async (hacer: () => Promise<unknown>) => {
      await hacer();
      await sinTransicionEnCurso(page);
      await page.waitForTimeout(pausa);
    };

    await page.goto(direccion);
    await expect(titulo(page, 'Inicio')).toBeVisible(CARGA);
    await page.waitForTimeout(pausa);

    await paso(() => barra.getByRole('button', { name: 'Proyectos', exact: true }).click());
    await paso(() => page.locator('a[data-tarjeta]').first().click());
    await paso(() => page.getByRole('button', { name: 'Editar', exact: true }).first().click());
    await paso(() => page.getByRole('button', { name: 'Cancelar' }).click());
    await paso(() => page.locator('[data-destino-de] a').first().click());
    await paso(() => page.goBack());
    await paso(() => page.goBack());
    for (const pestana of [/Consultas/, /Seguimiento/, /Activos/, /Historial/]) {
      await paso(() => page.getByRole('tab', { name: pestana }).click());
    }
    await paso(() => barra.getByRole('button', { name: 'Finanzas', exact: true }).click());
    await paso(() => page.goBack());

    const video = page.video();
    await page.close();
    const carpeta = process.env.VIDEOS_DE_TRANSICIONES ?? testInfo.outputPath();
    const destino = path.join(carpeta, `recorrido-${nombre}.webm`);
    await video?.saveAs(destino);
    console.log(`video: ${destino}`);
  });
}
