import { defineConfig } from 'vitest/config';

const CONDICIONES = ['@maun/source', 'module', 'node'];

export default defineConfig({
  resolve: { conditions: CONDICIONES },
  ssr: { resolve: { conditions: CONDICIONES } },
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // Los archivos corren de a uno. Hay una sola base y varios archivos la tocan a la vez: el
    // comparador trabaja sobre el household del seed y los tests de concurrencia también, así que
    // en paralelo la liquidación de uno queda esperando un lock del otro y
    // `una liquidación espera a una edición de los ajustes en curso` falla con un pid que no es el
    // que esperaba. No es flakiness de timing: es la misma fila desde dos archivos.
    //
    // Los tests de concurrencia abren sus propias conexiones, así que no pierden nada; lo único que
    // se paga es que la suite deja de solaparse.
    fileParallelism: false,
  },
});
