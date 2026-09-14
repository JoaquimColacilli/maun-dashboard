import { expect, test, type Page } from '@playwright/test';

const CARGA = { timeout: 30_000 };

function barra(page: Page) {
  return page.getByRole('navigation', { name: 'Principal' });
}

function titulo(page: Page, nombre: string) {
  return page.getByRole('heading', { level: 1, name: nombre });
}

async function aInicio(page: Page): Promise<void> {
  await barra(page).getByRole('button', { name: 'Inicio' }).click();
  await expect(titulo(page, 'Inicio')).toBeVisible();
}

test.describe('los siete destinos del sidebar, en el celular', () => {
  test.skip(({ isMobile }) => !isMobile, 'la barra de cuatro destinos es del celular');

  test('la barra inferior sigue con sus cuatro destinos y el botón de cargar', async ({ page }) => {
    await page.goto('/');
    await expect(titulo(page, 'Inicio')).toBeVisible(CARGA);

    const botones = await barra(page)
      .getByRole('button')
      .evaluateAll((todos) =>
        todos.map((boton) => (boton.getAttribute('aria-label') ?? boton.textContent).trim()),
      );
    expect(botones).toEqual(['Inicio', 'Proyectos', 'Clientes', 'Finanzas', 'Cargar algo nuevo']);

    const tapados = await barra(page)
      .getByRole('button')
      .evaluateAll((todos) =>
        todos
          .filter((boton) => {
            const caja = boton.getBoundingClientRect();
            const encima = document.elementFromPoint(
              caja.left + caja.width / 2,
              caja.top + caja.height / 2,
            );
            return encima === null || !boton.contains(encima);
          })
          .map((boton) => (boton.getAttribute('aria-label') ?? boton.textContent).trim()),
      );
    expect(tapados).toEqual([]);
  });

  test('cada destino tiene un camino tocando la pantalla, sin escribir la dirección', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(titulo(page, 'Inicio')).toBeVisible(CARGA);

    await barra(page).getByRole('button', { name: 'Proyectos' }).click();
    await expect(titulo(page, 'Proyectos')).toBeVisible();
    await page.getByRole('tab', { name: /^Seguimiento/ }).click();
    await expect(page).toHaveURL(/\/seguimiento$/);

    await barra(page).getByRole('button', { name: 'Clientes' }).click();
    await expect(titulo(page, 'Clientes')).toBeVisible();

    await barra(page).getByRole('button', { name: 'Finanzas' }).click();
    await expect(titulo(page, 'Finanzas')).toBeVisible();

    await aInicio(page);
    await page
      .getByRole('region', { name: 'Tesoros' })
      .getByRole('button', { name: /^Diezmo/ })
      .click();
    await expect(titulo(page, 'Diezmo')).toBeVisible();

    await aInicio(page);
    await page.getByRole('link', { name: 'Ajustes y tu cuenta' }).click();
    await expect(titulo(page, 'Ajustes')).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Lo que la base rechazó o ajustó' }),
    ).toBeVisible();

    await aInicio(page);
    await page
      .getByRole('region', { name: 'Hoy en la agenda' })
      .getByRole('link', { name: 'Ver la agenda' })
      .click();
    await expect(titulo(page, 'Agenda')).toBeVisible();
  });

  test('el avatar de Inicio se alcanza con el teclado y dice a dónde lleva', async ({ page }) => {
    await page.goto('/');
    await expect(titulo(page, 'Inicio')).toBeVisible(CARGA);

    const avatar = page.getByRole('link', { name: 'Ajustes y tu cuenta' });
    await expect(page.getByRole('main').locator('header').first()).toMatchAriaSnapshot(`
      - heading "Inicio" [level=1]
      - link "Ajustes y tu cuenta"
    `);

    let alcanzado = false;
    for (let paso = 0; paso < 10 && !alcanzado; paso += 1) {
      await page.keyboard.press('Tab');
      alcanzado = await avatar.evaluate((el) => el === document.activeElement);
    }
    expect(alcanzado).toBe(true);

    await page.keyboard.press('Enter');
    await expect(titulo(page, 'Ajustes')).toBeVisible();
  });
});

test.describe('en escritorio', () => {
  test.skip(({ isMobile }) => isMobile, 'esto es de la PC');

  test('Inicio no suma el avatar: Ajustes ya está en la barra lateral', async ({ page }) => {
    await page.goto('/');
    await expect(titulo(page, 'Inicio')).toBeVisible(CARGA);

    await expect(page.getByRole('link', { name: 'Ajustes y tu cuenta' })).toHaveCount(0);
    await expect(barra(page).getByRole('button', { name: 'Ajustes' })).toBeVisible();
  });

  test('la Agenda está en la barra lateral y no suma un bloque en Inicio', async ({ page }) => {
    await page.goto('/');
    await expect(titulo(page, 'Inicio')).toBeVisible(CARGA);

    await expect(page.getByRole('region', { name: 'Hoy en la agenda' })).toHaveCount(0);
    await barra(page).getByRole('button', { name: 'Agenda' }).click();
    await expect(titulo(page, 'Agenda')).toBeVisible();
  });
});
