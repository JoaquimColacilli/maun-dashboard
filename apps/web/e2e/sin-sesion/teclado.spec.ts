import { expect, test, type Locator, type Page } from '@playwright/test';

const ALTO_SIN_TECLADO = 844;
const ALTO_CON_TECLADO = 460;

async function aLaVista(page: Page, elemento: Locator): Promise<boolean> {
  const caja = await elemento.boundingBox();
  const alto = await page.evaluate(() => window.visualViewport?.height ?? window.innerHeight);
  return caja !== null && caja.y >= 0 && caja.y + caja.height <= alto + 0.5;
}

const FORMULARIOS = [
  { ruta: '/acceso', campos: ['Email', 'Contraseña'], enviar: 'Entrar' },
  { ruta: '/acceso/crear-cuenta', campos: ['Email', 'Contraseña'], enviar: 'Crear la cuenta' },
  { ruta: '/acceso/recuperar', campos: ['Email'], enviar: 'Mandarme el enlace' },
] as const;

test.describe('con el teclado del celular abierto', () => {
  test.skip(({ isMobile }) => !isMobile, 'el teclado en pantalla es del celular');

  for (const formulario of FORMULARIOS) {
    test(`${formulario.ruta}: el campo enfocado y el botón de enviar quedan a la vista`, async ({
      page,
    }) => {
      await page.goto(formulario.ruta);
      const enviar = page.getByRole('button', { name: formulario.enviar, exact: true });

      for (const campo of formulario.campos) {
        await page.setViewportSize({ width: 390, height: ALTO_SIN_TECLADO });
        const entrada = page.getByLabel(campo, { exact: true });
        await entrada.focus();
        await page.setViewportSize({ width: 390, height: ALTO_CON_TECLADO });

        await expect.poll(() => aLaVista(page, entrada)).toBe(true);
        await expect.poll(() => aLaVista(page, enviar)).toBe(true);
      }
    });
  }
});
