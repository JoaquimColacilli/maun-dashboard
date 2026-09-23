import { defineConfig, devices } from '@playwright/test';

const PUERTO = 4177;
const enCI = Boolean(process.env.CI);

const CELULAR = {
  ...devices['Desktop Chrome'],
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
};

const COMPU = { ...devices['Desktop Chrome'], deviceScaleFactor: 1 };

export default defineConfig({
  testDir: './e2e/transiciones',
  outputDir: './test-results/transiciones',
  forbidOnly: enCI,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${String(PUERTO)}`,
    trace: 'off',
  },
  projects: [
    {
      name: 'celular-claro',
      testMatch: /movimientos\.spec\.ts/,
      use: { ...CELULAR, colorScheme: 'light' },
    },
    {
      name: 'celular-oscuro',
      testMatch: /movimientos\.spec\.ts/,
      use: { ...CELULAR, colorScheme: 'dark' },
    },
    {
      name: 'tablet-768',
      testMatch: /compu\.spec\.ts/,
      use: { ...COMPU, viewport: { width: 768, height: 1024 } },
    },
    {
      name: 'compu-1024',
      testMatch: /compu\.spec\.ts/,
      use: { ...COMPU, viewport: { width: 1024, height: 768 } },
    },
    {
      name: 'compu-1440',
      testMatch: /compu\.spec\.ts/,
      use: { ...COMPU, viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command: `pnpm exec vite preview --port ${String(PUERTO)} --strictPort`,
    url: `http://localhost:${String(PUERTO)}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
