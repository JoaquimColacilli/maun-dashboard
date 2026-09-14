import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const RAIZ = path.resolve(import.meta.dirname, '../../..');
const DENO = createRequire(import.meta.url).resolve('deno/bin.cjs');
const FUNCION = 'supabase/functions/avisos';
const CONFIGURACION = `${FUNCION}/deno.json`;
const TOPE_MS = 300_000;

function deno(argumentos: string[]): { codigo: number | null; salida: string } {
  const resultado = spawnSync(process.execPath, [DENO, ...argumentos], {
    cwd: RAIZ,
    encoding: 'utf8',
    timeout: TOPE_MS,
    env: { ...process.env, NO_COLOR: '1' },
  });
  return { codigo: resultado.status, salida: `${resultado.stdout}\n${resultado.stderr}` };
}

describe('la función de borde de los avisos, en su runtime', () => {
  it(
    'pasa el chequeo de tipos de Deno, dominio incluido',
    () => {
      const { codigo, salida } = deno(['check', '--config', CONFIGURACION, `${FUNCION}/index.ts`]);
      expect(codigo, salida).toBe(0);
    },
    TOPE_MS,
  );

  it(
    'pasa sus tests con Deno',
    () => {
      const { codigo, salida } = deno([
        'test',
        '--config',
        CONFIGURACION,
        '--allow-env',
        '--no-prompt',
        FUNCION,
      ]);
      expect(codigo, salida).toBe(0);
    },
    TOPE_MS,
  );
});
