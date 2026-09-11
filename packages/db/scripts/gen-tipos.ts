import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

import * as prettier from 'prettier';

import { entornoDelCli, RAIZ } from './conexion.ts';

const DESTINO = path.join(RAIZ, 'packages', 'db', 'src', 'database.types.ts');

const generado = spawnSync(
  'supabase',
  ['gen', 'types', 'typescript', '--linked', '--schema', 'public'],
  {
    cwd: RAIZ,
    encoding: 'utf8',
    env: entornoDelCli(),
  },
);

if (generado.error) throw generado.error;
if (generado.status !== 0) {
  console.error(generado.stderr);
  throw new Error(
    'supabase gen types falló. Si es un 403, la sesión del CLI no es la de la org de maun.',
  );
}

const opciones = (await prettier.resolveConfig(DESTINO)) ?? {};
writeFileSync(DESTINO, await prettier.format(generado.stdout, { ...opciones, filepath: DESTINO }));
console.log(`Escrito ${path.relative(process.cwd(), DESTINO)}`);
