import { spawnSync } from 'node:child_process';

import { entornoDelCli, RAIZ } from './conexion.ts';

const resultado = spawnSync('supabase', process.argv.slice(2), {
  cwd: RAIZ,
  env: entornoDelCli(),
  stdio: 'inherit',
});

if (resultado.error) throw resultado.error;
process.exitCode = resultado.status ?? 1;
