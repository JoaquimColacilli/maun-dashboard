import { expect, test } from '@playwright/test';

function usuarioSinConfirmar(email: string): Record<string, unknown> {
  const ahora = new Date().toISOString();
  const id = '00000000-0000-4000-8000-00000000e2e0';
  return {
    id,
    aud: 'authenticated',
    role: '',
    email,
    phone: '',
    confirmation_sent_at: ahora,
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: {},
    identities: [
      {
        identity_id: '00000000-0000-4000-8000-00000000e2e1',
        id,
        user_id: id,
        identity_data: { email, sub: id },
        provider: 'email',
        created_at: ahora,
        updated_at: ahora,
        email,
      },
    ],
    created_at: ahora,
    updated_at: ahora,
    is_anonymous: false,
  };
}

test('sin sesión, la app manda al login en vez de mostrar un tablero vacío', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/acceso$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Entrá al taller');
  await expect(page.getByLabel('Email')).toHaveAttribute('autocomplete', /^username/);
  await expect(page.getByLabel('Contraseña', { exact: true })).toHaveAttribute(
    'autocomplete',
    'current-password',
  );
  await expect(page.getByRole('button', { name: 'Mostrar la contraseña' })).toBeVisible();
});

test('la primera vez, el canto de los tesoros se corta', async ({ page }) => {
  await page.goto('/acceso');

  await expect
    .poll(() =>
      page
        .locator('[data-canto]')
        .evaluate((canto) =>
          canto
            .getAnimations({ subtree: true })
            .some(
              (animacion) =>
                animacion instanceof CSSAnimation && animacion.animationName === 'maun-corte',
            ),
        ),
    )
    .toBe(true);
});

test('el formulario avisa lo que falta antes de salir a la red', async ({ page }) => {
  await page.goto('/acceso');

  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('alert')).toHaveText('Escribí un mail válido.');

  await page.getByLabel('Email').fill('vos@taller.com.ar');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('alert')).toHaveText('Escribí tu contraseña.');
});

test('desde el login se llega a crear la cuenta y a recuperar el acceso', async ({ page }) => {
  await page.goto('/acceso');

  await page.getByRole('link', { name: 'Creá una' }).click();
  await expect(page).toHaveURL(/\/acceso\/crear-cuenta$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Creá tu cuenta');
  await expect(page.getByLabel('Contraseña', { exact: true })).toHaveAttribute(
    'autocomplete',
    'new-password',
  );

  await page.getByRole('link', { name: 'Entrá', exact: true }).click();
  await page.getByRole('link', { name: '¿La olvidaste?' }).click();
  await expect(page).toHaveURL(/\/acceso\/recuperar$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Recuperá el acceso');
  await expect(page.getByRole('button', { name: 'Mandarme el enlace' })).toBeVisible();
});

test('al crear la cuenta queda escrito a dónde fue el mail, y se puede cambiar', async ({
  page,
}) => {
  await page.route('**/auth/v1/signup**', (ruta) =>
    ruta.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(usuarioSinConfirmar('nuevo@taller.com.ar')),
    }),
  );
  await page.goto('/acceso/crear-cuenta');

  await page.getByLabel('Email').fill('nuevo@taller.com.ar');
  await page.getByLabel('Contraseña', { exact: true }).fill('clave-segura');
  await page.getByRole('button', { name: 'Crear la cuenta' }).click();

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Revisá tu correo');
  await expect(page.getByText('nuevo@taller.com.ar')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Reenviar en \d:\d\d$/ })).toBeDisabled();

  await page.getByRole('button', { name: 'Cambiar' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Creá tu cuenta');
  await expect(page.getByLabel('Email')).toHaveValue('nuevo@taller.com.ar');
});
