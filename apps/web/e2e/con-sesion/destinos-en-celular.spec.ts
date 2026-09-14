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

  test('la agenda y el avatar de Inicio se alcanzan con el teclado y dicen a dónde llevan', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(titulo(page, 'Inicio')).toBeVisible(CARGA);

    const agenda = page.getByRole('link', { name: 'Agenda', exact: true });
    const avatar = page.getByRole('link', { name: 'Ajustes y tu cuenta' });
    await expect(page.getByRole('main').locator('header').first()).toMatchAriaSnapshot(`
      - heading "Inicio" [level=1]
      - link "Agenda"
      - link "Ajustes y tu cuenta"
    `);

    let alcanzado = false;
    for (let paso = 0; paso < 10 && !alcanzado; paso += 1) {
      await page.keyboard.press('Tab');
      alcanzado = await agenda.evaluate((el) => el === document.activeElement);
    }
    expect(alcanzado).toBe(true);
    await page.keyboard.press('Tab');
    expect(await avatar.evaluate((el) => el === document.activeElement)).toBe(true);

    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Enter');
    await expect(titulo(page, 'Agenda')).toBeVisible();

    await aInicio(page);
    await avatar.focus();
    await page.keyboard.press('Enter');
    await expect(titulo(page, 'Ajustes')).toBeVisible();
  });

  test('el ícono de la agenda está al lado de la foto, mide lo que un dedo y no es una campana', async ({
    page,
  }, testInfo) => {
    await page.goto('/');
    await expect(titulo(page, 'Inicio')).toBeVisible(CARGA);

    const encabezado = page.getByRole('main').locator('header').first();
    const agenda = encabezado.getByRole('link', { name: 'Agenda', exact: true });
    const avatar = encabezado.getByRole('link', { name: 'Ajustes y tu cuenta' });
    const caja = await agenda.boundingBox();
    const cajaDelAvatar = await avatar.boundingBox();
    if (caja === null || cajaDelAvatar === null) throw new Error('el encabezado no se ve');

    expect(caja.width).toBeGreaterThanOrEqual(44);
    expect(caja.height).toBeGreaterThanOrEqual(44);
    expect(caja.x + caja.width).toBeLessThanOrEqual(cajaDelAvatar.x + 0.5);
    expect(
      Math.abs(caja.y + caja.height / 2 - (cajaDelAvatar.y + cajaDelAvatar.height / 2)),
    ).toBeLessThan(1);
    await expect(agenda.locator('svg.lucide-calendar-days')).toHaveAttribute('aria-hidden', 'true');
    await expect(encabezado.locator('svg.lucide-bell')).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Hoy en la agenda' })).toBeVisible();

    await encabezado.screenshot({ path: testInfo.outputPath('inicio-celular-encabezado.png') });
    console.log(
      `ícono de la agenda: ${String(caja.width)}×${String(caja.height)} px, avatar: ${String(cajaDelAvatar.width)}×${String(cajaDelAvatar.height)} px`,
    );
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
