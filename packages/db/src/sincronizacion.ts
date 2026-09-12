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

// Las cuatro columnas de ajustes que el usuario escribe, y que tienen grant en la base. Salen del
// tipo generado (no de una copia a mano) y se mandan de a las que cambiaron, no la fila entera.
export const COLUMNAS_DE_AJUSTES = [
  'sueldo_mensual_centavos',
  'costos_fijos_centavos',
  'meta_cocos_centavos',
  'tasa_cocos_anual_bp',
] as const;

export type ColumnaDeAjustes = (typeof COLUMNAS_DE_AJUSTES)[number];

export type CambiosDeAjustes = Partial<Pick<FilaDe<'ajustes'>, ColumnaDeAjustes>>;

export async function guardarAjustes(
  cliente: ClienteMaun,
  id: string,
  cambios: CambiosDeAjustes,
): Promise<FilaDe<'ajustes'>> {
  const { data, error } = await cliente
    .from('ajustes')
    .update(cambios)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function guardarNombreDelTaller(
  cliente: ClienteMaun,
  id: string,
  nombre: string,
): Promise<FilaDe<'households'>> {
  const { data, error } = await cliente
    .from('households')
    .update({ nombre })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
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
