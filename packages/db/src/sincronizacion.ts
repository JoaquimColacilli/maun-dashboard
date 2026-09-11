import type { ClienteMaun } from './cliente.ts';
import type { Database } from './database.types.ts';
import { leerLote, type FilaDe, type Lote } from './replica.ts';

export type MovimientoNuevo = Pick<
  Database['public']['Tables']['movimientos']['Insert'],
  | 'id'
  | 'fecha'
  | 'tipo'
  | 'tesoro_origen'
  | 'tesoro_destino'
  | 'monto_centavos'
  | 'categoria'
  | 'descripcion'
> & { id: string };

export async function traerBootstrap(cliente: ClienteMaun): Promise<Lote> {
  const { data, error } = await cliente.rpc('bootstrap');
  if (error) throw error;
  return leerLote(data);
}

export async function traerDelta(cliente: ClienteMaun, cursor: string): Promise<Lote> {
  const { data, error } = await cliente.rpc('delta', { p_desde: cursor });
  if (error) throw error;
  return leerLote(data);
}

export async function guardarMovimiento(
  cliente: ClienteMaun,
  movimiento: MovimientoNuevo,
): Promise<FilaDe<'movimientos'>> {
  const { data, error } = await cliente
    .from('movimientos')
    .upsert(movimiento, { onConflict: 'id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}
