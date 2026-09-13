import { expect, test } from '@playwright/test';

interface PedidoDeCredencial {
  mediation: string | null;
  rpId: string | null;
}

type VentanaConPedidos = Window & { pedidosDeCredencial: PedidoDeCredencial[] };

test('el login ofrece la huella en el autocompletado del mail, sin botón aparte', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const ventana = window as unknown as VentanaConPedidos;
    ventana.pedidosDeCredencial = [];
    const original = navigator.credentials.get.bind(navigator.credentials);
    navigator.credentials.get = (opciones?: CredentialRequestOptions) => {
      ventana.pedidosDeCredencial.push({
        mediation: opciones?.mediation ?? null,
        rpId: opciones?.publicKey?.rpId ?? null,
      });
      return original(opciones);
    };
    PublicKeyCredential.isConditionalMediationAvailable = () => Promise.resolve(true);
  });

  let desafios = 0;
  await page.route('**/auth/v1/passkeys/authentication/options', (ruta) => {
    desafios += 1;
    return ruta.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        challenge_id: 'desafio-e2e',
        expires_at: Math.floor(Date.now() / 1000) + 300,
        options: {
          challenge: 'ZGVzYWZpby1kZS1wcnVlYmEtZTJlLTAxMjM0NTY3',
          rpId: 'localhost',
          allowCredentials: [],
          userVerification: 'preferred',
          timeout: 300000,
        },
      }),
    });
  });

  await page.goto('/acceso');

  await expect(page.getByLabel('Email')).toHaveAttribute('autocomplete', 'username webauthn');
  await expect
    .poll(() => page.evaluate(() => (window as unknown as VentanaConPedidos).pedidosDeCredencial))
    .toContainEqual({ mediation: 'conditional', rpId: 'localhost' });
  expect(desafios).toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: /huella|passkey/i })).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('con las passkeys apagadas en el servidor, el login no muestra ningún error', async ({
  page,
}) => {
  await page.route('**/auth/v1/passkeys/authentication/options', (ruta) =>
    ruta.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 404,
        error_code: 'passkey_disabled',
        msg: 'Passkeys are disabled',
      }),
    }),
  );

  await page.goto('/acceso');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Entrá al taller');
  await page.waitForTimeout(500);
  await expect(page.getByRole('alert')).toHaveCount(0);
});
