import { fileURLToPath, URL } from 'node:url';

import { loadEnv } from 'vite';

export const RAIZ_DE_LA_APP = fileURLToPath(new URL('../..', import.meta.url));

export const ESTADO_DE_SESION = fileURLToPath(new URL('../.sesion/estado.json', import.meta.url));

export const PREFIJO_DE_PRUEBA = 'E2E';

export interface EntornoDePrueba {
  url: string;
  publishableKey: string;
  email: string;
  password: string;
}

function exigir(valores: Record<string, string>, nombre: string): string {
  const valor = valores[nombre];
  if (valor === undefined || valor === '') {
    throw new Error(
      `Falta ${nombre} en apps/web/.env. Es la cuenta de prueba con la que Playwright inicia sesión; va sin prefijo VITE_ porque no entra al bundle. Está en apps/web/.env.example.`,
    );
  }
  return valor;
}

export function entornoDePrueba(): EntornoDePrueba {
  const valores = { ...loadEnv('development', RAIZ_DE_LA_APP, ''), ...process.env } as Record<
    string,
    string
  >;
  return {
    url: exigir(valores, 'VITE_SUPABASE_URL'),
    publishableKey: exigir(valores, 'VITE_SUPABASE_PUBLISHABLE_KEY'),
    email: exigir(valores, 'E2E_EMAIL'),
    password: exigir(valores, 'E2E_PASSWORD'),
  };
}
