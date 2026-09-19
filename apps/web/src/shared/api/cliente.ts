import { crearClienteAnonimo, crearClienteMaun, type ClienteMaun } from '@maun/db';

import { leerEnv } from '@/shared/config';

let cliente: ClienteMaun | undefined;
let anonimo: ClienteMaun | undefined;
let porRecuperacion = false;

export function clienteMaun(): ClienteMaun {
  if (!cliente) {
    const env = leerEnv(import.meta.env);
    cliente = crearClienteMaun({
      url: env.VITE_SUPABASE_URL,
      publishableKey: env.VITE_SUPABASE_PUBLISHABLE_KEY,
    });
    cliente.auth.onAuthStateChange((evento) => {
      if (evento === 'PASSWORD_RECOVERY') porRecuperacion = true;
      if (evento === 'SIGNED_OUT') porRecuperacion = false;
    });
  }
  return cliente;
}

export function clienteAnonimo(): ClienteMaun {
  if (!anonimo) {
    const env = leerEnv(import.meta.env);
    anonimo = crearClienteAnonimo({
      url: env.VITE_SUPABASE_URL,
      publishableKey: env.VITE_SUPABASE_PUBLISHABLE_KEY,
    });
  }
  return anonimo;
}

export function vinoPorRecuperacion(): boolean {
  return porRecuperacion;
}
