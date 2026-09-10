import { expect, test } from '@playwright/test';

test('la pantalla de verificación arranca con los tokens portados', async ({ page }) => {
  await page.goto('/');

  const titulo = page.getByRole('heading', { level: 1 });
  await expect(titulo).toHaveText('Verificación del sistema de diseño');
  await expect(titulo).toHaveCSS('font-family', /Young Serif/);
  await expect(page.locator('body')).toHaveCSS('font-family', /IBM Plex Sans/);
  await expect(page.locator('body')).toHaveCSS('color', 'rgb(20, 20, 20)');
  await expect(page.getByText('Hogar', { exact: true })).toHaveCSS('color', 'rgb(15, 110, 86)');
});
