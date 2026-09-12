import { defineConfig, devices } from '@playwright/test';

import { ESTADO_DE_SESION } from './e2e/apoyo/entorno';

const PUERTO = 4173;
const enCI = Boolean(process.env.CI);

const CELULAR = {
  ...devices['Desktop Chrome'],
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
};

const ESCRITORIO = { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } };

export default defineConfig({
  testDir: './e2e',
  forbidOnly: enCI,
  retries: enCI ? 2 : 0,
  // Los cinco proyectos comparten el household de la cuenta de prueba, y cada test con sesión lo
  // deja vacío antes de empezar: en paralelo, el vaciado de uno se llevaría las filas del otro.
  workers: 1,
  use: {
    baseURL: `http://localhost:${PUERTO}`,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'setup', testMatch: /sesion\.setup\.ts/, use: ESCRITORIO },
    { name: 'acceso-celular', testDir: './e2e/sin-sesion', use: CELULAR },
    { name: 'acceso-escritorio', testDir: './e2e/sin-sesion', use: ESCRITORIO },
    {
      name: 'celular',
      testDir: './e2e/con-sesion',
      use: { ...CELULAR, storageState: ESTADO_DE_SESION },
      dependencies: ['setup'],
    },
    {
      name: 'escritorio',
      testDir: './e2e/con-sesion',
      use: { ...ESCRITORIO, storageState: ESTADO_DE_SESION },
      dependencies: ['setup'],
    },
  ],
  // Contra el build, no contra el dev server: el service worker solo existe en el artefacto real, y
  // sin él "cerrar la app y reabrirla sin señal" no se puede probar, que es medio producto.
  webServer: {
    command: `pnpm exec vite build && pnpm exec vite preview --port ${PUERTO} --strictPort`,
    url: `http://localhost:${PUERTO}`,
    reuseExistingServer: !enCI,
    timeout: 180_000,
  },
});
