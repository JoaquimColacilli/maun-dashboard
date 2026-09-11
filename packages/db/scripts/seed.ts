import path from 'node:path';

import { conectar, DIR_SUPABASE } from './conexion.ts';
import { ejecutarArchivo, leerSql } from './pgtap.ts';

const borrar = process.argv.includes('--borrar');
const archivo = leerSql(path.join(DIR_SUPABASE, borrar ? 'seed-borrar.sql' : 'seed.sql'));
const cliente = await conectar();

try {
  await cliente.query('begin');
  await ejecutarArchivo(cliente, archivo);
  await cliente.query('commit');
  console.log(
    borrar
      ? 'Seed borrado: household 5eed0000-0000-7000-8000-000000000001 y todo lo que colgaba de él.'
      : 'Seed cargado en el household 5eed0000-0000-7000-8000-000000000001.',
  );
} catch (error) {
  await cliente.query('rollback');
  throw error;
} finally {
  await cliente.end();
}
