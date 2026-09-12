import path from 'node:path';

import type pg from 'pg';

import { compararDominioYSql, compararLibroDelSeed, compararSeed } from './comparacion.ts';
import { conectar, DIR_SUPABASE } from './conexion.ts';
import {
  archivosDeTest,
  correrTest,
  describirFallas,
  ejecutarArchivo,
  enTransaccionConRollback,
  exigirSinControlDeTransaccion,
  idDeTransaccion,
  leerSql,
  migraciones,
  type ArchivoSql,
} from './pgtap.ts';

type ModoSeed = 'sin' | 'cargar' | 'recargar';

function version(migracion: ArchivoSql): string {
  return path.basename(migracion.nombre).split('_')[0] ?? '';
}

function modoSeed(argumentos: readonly string[]): ModoSeed {
  if (argumentos.includes('--recargar-seed')) return 'recargar';
  if (argumentos.includes('--seed')) return 'cargar';
  return 'sin';
}

async function versionesAplicadas(cliente: pg.Client): Promise<Set<string>> {
  const { rows: existe } = await cliente.query<{ existe: boolean }>(
    "select to_regclass('supabase_migrations.schema_migrations') is not null as existe",
  );
  if (!existe[0]?.existe) return new Set();
  const { rows } = await cliente.query<{ version: string }>(
    'select version from supabase_migrations.schema_migrations',
  );
  return new Set(rows.map((fila) => fila.version));
}

async function aplicar(cliente: pg.Client, archivo: ArchivoSql, xid: string): Promise<void> {
  await ejecutarArchivo(cliente, archivo);
  if ((await idDeTransaccion(cliente)) !== xid) {
    throw new Error(
      `${archivo.nombre} cerró la transacción del ensayo. Lo que corrió hasta ahí puede haber quedado aplicado: revisá la base antes de seguir.`,
    );
  }
  console.log(`  ok  ${archivo.nombre}`);
}

async function ensayar(cliente: pg.Client, seed: ModoSeed): Promise<number> {
  const xid = await idDeTransaccion(cliente);
  const aplicadas = await versionesAplicadas(cliente);
  const pendientes = migraciones().filter((migracion) => !aplicadas.has(version(migracion)));
  const antes = seed === 'recargar' ? [leerSql(path.join(DIR_SUPABASE, 'seed-borrar.sql'))] : [];
  const despues = seed === 'sin' ? [] : [leerSql(path.join(DIR_SUPABASE, 'seed.sql'))];
  const archivos = [...antes, ...pendientes, ...despues];

  for (const archivo of archivos) exigirSinControlDeTransaccion(archivo);

  console.log(
    `Migraciones ya aplicadas: ${aplicadas.size}. Pendientes a ensayar: ${pendientes.length}.`,
  );
  for (const archivo of archivos) await aplicar(cliente, archivo, xid);

  let fallidos = 0;
  for (const test of archivosDeTest()) {
    await cliente.query('savepoint ensayo_test');
    try {
      const resultado = await correrTest(cliente, test);
      const fallas = describirFallas(test, resultado);
      if (fallas.length > 0) {
        fallidos += 1;
        console.log(`  MAL ${test.nombre}`);
        for (const falla of fallas) console.log(`      ${falla}`);
      } else {
        console.log(`  ok  ${test.nombre} (${resultado.pasaron.length} tests)`);
      }
    } catch (error) {
      fallidos += 1;
      console.log(
        `  MAL ${test.nombre}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    await cliente.query('rollback to savepoint ensayo_test');
  }

  await cliente.query('savepoint ensayo_comparacion');
  const diferencias = [
    ...(await compararDominioYSql(cliente)),
    ...(seed === 'sin' ? [] : await compararSeed(cliente)),
    ...(seed === 'sin' ? [] : await compararLibroDelSeed(cliente)),
  ];
  await cliente.query('rollback to savepoint ensayo_comparacion');
  if (diferencias.length > 0) {
    fallidos += 1;
    console.log(`  MAL @maun/domain contra SQL (${String(diferencias.length)} diferencias)`);
    for (const diferencia of diferencias.slice(0, 20)) console.log(`      ${diferencia}`);
  } else {
    console.log(
      `  ok  @maun/domain contra SQL: cascada, topes, rangos, estados, transiciones, liquidaciones y libro mayor${seed === 'sin' ? '' : ', y el seed'}`,
    );
  }

  return fallidos;
}

const seed = modoSeed(process.argv);
const cliente = await conectar();

try {
  const fallidos = await enTransaccionConRollback((conexion) => ensayar(conexion, seed), cliente);
  console.log(
    fallidos === 0
      ? 'Ensayo en verde. La transacción terminó en rollback: nada quedó aplicado.'
      : `Ensayo con ${fallidos} archivo(s) de test en rojo. La transacción terminó en rollback: nada quedó aplicado.`,
  );
  process.exitCode = fallidos === 0 ? 0 : 1;
} catch (error) {
  console.error(`Ensayo cortado: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  await cliente.end();
}
