import { expect, test } from '@playwright/test';

import { iniciarSesionDePrueba, vaciarTaller } from '../apoyo/taller';

test.beforeEach(async () => {
  await vaciarTaller(await iniciarSesionDePrueba());
});

function mesEnCurso(): string {
  const hoy = new Date();
  return `${String(hoy.getFullYear())}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
}

test('cada tarjeta de tesoro llega a Finanzas con su filtro puesto y el mes en curso, y atrás vuelve a Inicio', async ({
  page,
}) => {
  await page.goto('/');
  const tesoros = page.getByRole('region', { name: 'Tesoros' });
  await expect(tesoros).toBeVisible();

  for (const [nombre, id] of [
    ['Hogar', 'hogar'],
    ['Maun', 'maun'],
    ['Cocos', 'cocos'],
  ] as const) {
    await tesoros.getByRole('button', { name: new RegExp(`^${nombre}`) }).click();
    await expect(page).toHaveURL(new RegExp(`/finanzas\\?tesoro=${id}$`));
    await expect(page.getByRole('button', { name: nombre, exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByRole('button', { name: 'Todos', exact: true })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await expect(page.getByRole('main').locator('select').first()).toHaveValue(mesEnCurso());

    await page.goBack();
    await expect(page.getByRole('heading', { level: 1, name: 'Inicio' })).toBeVisible();
  }

  await tesoros.getByRole('button', { name: /^Diezmo/ }).click();
  await expect(page).toHaveURL(/\/diezmo$/);
});

test('cambiar el tesoro en Finanzas cambia la URL sin sumar pasos al botón atrás, y el enlace se puede abrir directo', async ({
  page,
}) => {
  await page.goto('/');
  await page
    .getByRole('region', { name: 'Tesoros' })
    .getByRole('button', { name: /^Maun/ })
    .click();
  await expect(page).toHaveURL(/\/finanzas\?tesoro=maun$/);

  await page.getByRole('button', { name: 'Cocos', exact: true }).click();
  await expect(page).toHaveURL(/\/finanzas\?tesoro=cocos$/);
  await page.getByRole('button', { name: 'Todos', exact: true }).click();
  await expect(page).toHaveURL(/\/finanzas$/);

  await page.goBack();
  await expect(page.getByRole('heading', { level: 1, name: 'Inicio' })).toBeVisible();

  await page.goto('/finanzas?tesoro=hogar');
  await expect(page.getByRole('button', { name: 'Hogar', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});
