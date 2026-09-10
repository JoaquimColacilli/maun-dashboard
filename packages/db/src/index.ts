import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from './database.types.ts';

export type { Database, Json } from './database.types.ts';

export type ClienteMaun = SupabaseClient<Database>;

export interface OpcionesCliente {
  url: string;
  publishableKey: string;
}

export function crearClienteMaun({ url, publishableKey }: OpcionesCliente): ClienteMaun {
  return createClient<Database>(url, publishableKey);
}
