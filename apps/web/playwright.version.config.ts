import { defineConfig, devices } from '@playwright/test';

import { ORIGEN_DEL_ARNES } from './e2e/version/arnes';

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
  testDir: './e2e/version',
  globalSetup: './e2e/version/preparar.ts',
  outputDir: './test-results/version',
  forbidOnly: enCI,
  retries: enCI ? 2 : 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: ORIGEN_DEL_ARNES,
    serviceWorkers: 'allow',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'version-celular', use: CELULAR },
    { name: 'version-escritorio', use: ESCRITORIO },
  ],
});
