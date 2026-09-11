import { readFileSync } from 'node:fs';

import { expect, it } from 'vitest';

import { conectar } from '../scripts/conexion.ts';
import { ARCHIVO_ESQUEMA, generarEsquema } from '../scripts/esquema.ts';

it('supabase/esquema.sql coincide con la base viva: nada cambió por fuera de las migraciones', async () => {
  const cliente = await conectar();
  try {
    expect(
      await generarEsquema(cliente),
      'El esquema vivo difiere de supabase/esquema.sql. Si acabás de hacer db push, corré `pnpm --filter @maun/db db:esquema` y commitealo. Si no, alguien cambió la base por fuera del repo.',
    ).toBe(readFileSync(ARCHIVO_ESQUEMA, 'utf8'));
  } finally {
    await cliente.end();
  }
});
