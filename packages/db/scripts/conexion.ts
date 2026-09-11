import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';

import pg from 'pg';

export const RAIZ = path.resolve(import.meta.dirname, '../../..');
export const DIR_SUPABASE = path.join(RAIZ, 'supabase');

export const CA_DE_SUPABASE = path.resolve(
  import.meta.dirname,
  '../certs/supabase-root-2021-ca.crt',
);

export function hostDelPooler(): string {
  return new URL(urlDeLaBase()).hostname;
}

export function variableDeSupabase(nombre: string): string | undefined {
  if (process.env[nombre]) return process.env[nombre];
  const archivo = path.join(DIR_SUPABASE, '.env');
  if (!existsSync(archivo)) return undefined;
  return parseEnv(readFileSync(archivo, 'utf8'))[nombre];
}

export function entornoDelCli(): NodeJS.ProcessEnv {
  const token = variableDeSupabase('SUPABASE_ACCESS_TOKEN');
  if (!token) {
    throw new Error(
      'Falta SUPABASE_ACCESS_TOKEN en supabase/.env: sin él, el CLI usa la sesión global de la máquina, que puede ser de otra cuenta.',
    );
  }
  return { ...process.env, SUPABASE_ACCESS_TOKEN: token };
}

function leerPassword(): string | undefined {
  return variableDeSupabase('SUPABASE_DB_PASSWORD');
}

export function urlDeLaBase(): string {
  if (process.env.SUPABASE_DB_URL) return process.env.SUPABASE_DB_URL;

  const archivoPooler = path.join(DIR_SUPABASE, '.temp', 'pooler-url');
  if (!existsSync(archivoPooler)) {
    throw new Error(
      'Falta supabase/.temp/pooler-url: corré `supabase link --project-ref <ref>` desde la raíz del repo.',
    );
  }

  const password = leerPassword();
  if (!password) {
    throw new Error(
      'Falta la contraseña de la base: poné SUPABASE_DB_PASSWORD en supabase/.env (está en el .gitignore) o exportá SUPABASE_DB_URL.',
    );
  }

  const url = new URL(readFileSync(archivoPooler, 'utf8').trim());
  url.password = password;
  return url.toString();
}

export async function conectar(url = urlDeLaBase()): Promise<pg.Client> {
  const cliente = new pg.Client({
    connectionString: url,
    ssl: { ca: readFileSync(CA_DE_SUPABASE, 'utf8'), rejectUnauthorized: true },
    application_name: 'maun-db-herramientas',
  });
  await cliente.connect();
  return cliente;
}
