import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import type pg from 'pg';

import { conectar, DIR_SUPABASE } from './conexion.ts';

export const DIR_TESTS = path.join(DIR_SUPABASE, 'tests');

export interface ArchivoSql {
  nombre: string;
  sql: string;
}

export interface ResultadoTap {
  planeados: number | null;
  pasaron: string[];
  fallaron: string[];
  diagnosticos: string[];
}

const CONTROL_DE_TRANSACCION = new Set([
  'begin',
  'commit',
  'rollback',
  'end',
  'abort',
  'start',
  'savepoint',
  'release',
  'prepare',
]);

function sinLiteralesNiComentarios(sql: string): string {
  return sql
    .replace(/\$([A-Za-z_][A-Za-z0-9_]*)?\$[\s\S]*?\$\1\$/g, "''")
    .replace(/'(?:[^']|'')*'/g, "''")
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n]*/g, ' ');
}

export function sentenciasDeTransaccion(sql: string): string[] {
  return sinLiteralesNiComentarios(sql)
    .split(';')
    .map((sentencia) => sentencia.trim())
    .filter((sentencia) => {
      const primera = /^[A-Za-z]+/.exec(sentencia)?.[0].toLowerCase();
      return primera !== undefined && CONTROL_DE_TRANSACCION.has(primera);
    });
}

export function exigirSinControlDeTransaccion(archivo: ArchivoSql): void {
  const encontradas = sentenciasDeTransaccion(archivo.sql);
  if (encontradas.length > 0) {
    throw new Error(
      `${archivo.nombre} controla la transacción (${encontradas.join('; ')}). La abre y la cierra con rollback el runner: los archivos no pueden hacer begin, commit ni rollback.`,
    );
  }
}

export function interpretarTap(lineas: readonly string[]): ResultadoTap {
  const resultado: ResultadoTap = { planeados: null, pasaron: [], fallaron: [], diagnosticos: [] };
  for (const linea of lineas) {
    const plan = /^1\.\.(\d+)/.exec(linea);
    if (plan) {
      resultado.planeados = Number(plan[1]);
    } else if (/^ok \d+/.test(linea)) {
      resultado.pasaron.push(linea);
    } else if (/^not ok \d+/.test(linea)) {
      resultado.fallaron.push(linea);
    } else if (linea.startsWith('#')) {
      resultado.diagnosticos.push(linea);
    }
  }
  return resultado;
}

function comoLista(valor: unknown): pg.QueryResult<Record<string, unknown>>[] {
  const lista: unknown[] = Array.isArray(valor) ? valor : [valor];
  return lista as pg.QueryResult<Record<string, unknown>>[];
}

export function lineasDeSalida(valor: unknown): string[] {
  return comoLista(valor).flatMap((resultado) =>
    resultado.rows.flatMap((fila) =>
      Object.values(fila).flatMap((celda) => (typeof celda === 'string' ? celda.split('\n') : [])),
    ),
  );
}

function ubicarError(error: unknown, archivo: ArchivoSql): Error {
  if (!(error instanceof Error)) return new Error(`${archivo.nombre}: ${String(error)}`);
  const posicion =
    'position' in error && typeof error.position === 'string' ? Number(error.position) : NaN;
  const linea = Number.isNaN(posicion) ? '?' : archivo.sql.slice(0, posicion).split('\n').length;
  const codigo = 'code' in error && typeof error.code === 'string' ? ` [${error.code}]` : '';
  return new Error(`${archivo.nombre}:${linea}${codigo} ${error.message}`, { cause: error });
}

export async function idDeTransaccion(cliente: pg.Client): Promise<string> {
  const { rows } = await cliente.query<{ xid: string }>('select pg_current_xact_id()::text as xid');
  const xid = rows[0]?.xid;
  if (xid === undefined) throw new Error('Postgres no devolvió el id de la transacción');
  return xid;
}

export async function ejecutarArchivo(cliente: pg.Client, archivo: ArchivoSql): Promise<string[]> {
  try {
    return lineasDeSalida(await cliente.query(archivo.sql));
  } catch (error) {
    throw ubicarError(error, archivo);
  }
}

export async function enTransaccionConRollback<T>(
  trabajo: (cliente: pg.Client) => Promise<T>,
  cliente?: pg.Client,
): Promise<T> {
  const conexion = cliente ?? (await conectar());
  try {
    await conexion.query('begin');
    const inicio = await idDeTransaccion(conexion);
    const resultado = await trabajo(conexion);
    const fin = await idDeTransaccion(conexion);
    if (fin !== inicio) {
      throw new Error(
        `La transacción ${inicio} se cerró a mitad de camino (ahora es ${fin}): algo hizo commit. Revisá la base.`,
      );
    }
    return resultado;
  } finally {
    await conexion.query('rollback');
    if (!cliente) await conexion.end();
  }
}

export function leerSql(ruta: string): ArchivoSql {
  return {
    nombre: path.relative(DIR_SUPABASE, ruta).replaceAll('\\', '/'),
    sql: readFileSync(ruta, 'utf8'),
  };
}

export function preludio(): ArchivoSql {
  return leerSql(path.join(DIR_TESTS, '_preludio.sql'));
}

export function migraciones(): ArchivoSql[] {
  const directorio = path.join(DIR_SUPABASE, 'migrations');
  return readdirSync(directorio)
    .filter((nombre) => /^\d+_.+\.sql$/.test(nombre))
    .sort()
    .map((nombre) => leerSql(path.join(directorio, nombre)));
}

export function seed(): ArchivoSql[] {
  return ['seed.sql', 'seed-borrar.sql'].map((nombre) => leerSql(path.join(DIR_SUPABASE, nombre)));
}

export function archivosDeTest(): ArchivoSql[] {
  return readdirSync(DIR_TESTS)
    .filter((nombre) => nombre.endsWith('.sql') && !nombre.startsWith('_'))
    .sort()
    .map((nombre) => leerSql(path.join(DIR_TESTS, nombre)));
}

export async function correrTest(cliente: pg.Client, archivo: ArchivoSql): Promise<ResultadoTap> {
  const previo = preludio();
  exigirSinControlDeTransaccion(previo);
  exigirSinControlDeTransaccion(archivo);
  await ejecutarArchivo(cliente, previo);
  return interpretarTap(await ejecutarArchivo(cliente, archivo));
}

export function describirFallas(archivo: ArchivoSql, resultado: ResultadoTap): string[] {
  const fallas = [...resultado.fallaron];
  const corridos = resultado.pasaron.length + resultado.fallaron.length;
  if (resultado.planeados === null) {
    fallas.push(`${archivo.nombre}: no declara plan()`);
  } else if (corridos !== resultado.planeados) {
    fallas.push(`${archivo.nombre}: planeó ${resultado.planeados} tests y corrió ${corridos}`);
  }
  return fallas.length > 0 ? [...fallas, ...resultado.diagnosticos] : [];
}
