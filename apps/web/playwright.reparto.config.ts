import { defineConfig, devices } from '@playwright/test';

const PUERTO = 4175;
const enCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: './e2e/reparto',
  outputDir: './test-results/reparto',
  forbidOnly: enCI,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 900 },
    baseURL: `http://localhost:${String(PUERTO)}`,
    trace: 'off',
  },
  webServer: {
    command: `pnpm exec vite preview --port ${String(PUERTO)} --strictPort`,
    url: `http://localhost:${String(PUERTO)}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
