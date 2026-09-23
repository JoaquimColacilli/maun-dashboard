import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { format, resolveConfig } from 'prettier';

import { conLosResortes } from '../src/resortes.ts';

const tema = fileURLToPath(new URL('../src/styles/theme.css', import.meta.url));
const antes = readFileSync(tema, 'utf8');
const opciones = (await resolveConfig(tema)) ?? {};
const despues = await format(conLosResortes(antes), { ...opciones, filepath: tema });
writeFileSync(tema, despues, 'utf8');
console.log(
  antes === despues ? 'Los resortes ya estaban al día.' : 'Resortes escritos en theme.css.',
);
