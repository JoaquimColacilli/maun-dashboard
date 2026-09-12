import { defineConfig } from 'vitest/config';

const CONDICIONES = ['@maun/source', 'module', 'node'];

export default defineConfig({
  resolve: { conditions: CONDICIONES },
  ssr: { resolve: { conditions: CONDICIONES } },
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
