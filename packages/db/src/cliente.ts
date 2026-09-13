import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from './database.types.ts';

export type ClienteMaun = SupabaseClient<Database>;

export const CLAVE_DE_SESION = 'maun.sesion';

export interface OpcionesCliente {
  url: string;
  publishableKey: string;
}

export function crearClienteMaun({ url, publishableKey }: OpcionesCliente): ClienteMaun {
  return createClient<Database>(url, publishableKey, {
    auth: {
      flowType: 'pkce',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: CLAVE_DE_SESION,
      experimental: { passkey: true },
    },
  });
}
