import { crearClienteMaun, type ClienteMaun } from '@maun/db';

import { leerEnv } from '@/shared/config';

let cliente: ClienteMaun | undefined;

export function clienteMaun(): ClienteMaun {
  if (!cliente) {
    const env = leerEnv(import.meta.env);
    cliente = crearClienteMaun({
      url: env.VITE_SUPABASE_URL,
      publishableKey: env.VITE_SUPABASE_PUBLISHABLE_KEY,
    });
  }
  return cliente;
}
