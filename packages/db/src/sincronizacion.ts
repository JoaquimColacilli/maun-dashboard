import type { EstadoLiquidado, EstadoProyecto } from '@maun/domain';

import type { ClienteMaun } from './cliente.ts';
import type { Database, Json } from './database.types.ts';
import { leerLote, RespuestaInvalidaError, type FilaDe, type Lote } from './replica.ts';

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

// Las columnas de clientes que el usuario escribe, y que tienen grant en la base. Salen del tipo
// generado, no de una copia a mano.
export const COLUMNAS_DE_CLIENTE = [
  'nombre',
  'zona',
  'telefono',
  'email',
  'direccion',
  'origen_contacto',
  'origen_detalle',
  'condicion_fiscal',
  'cuit',
  'razon_social',
  'domicilio_fiscal',
  'notas',
] as const;

export type ColumnaDeCliente = (typeof COLUMNAS_DE_CLIENTE)[number];

export type DatosDeCliente = Pick<FilaDe<'clientes'>, ColumnaDeCliente>;

export type ClienteNuevo = DatosDeCliente & { id: string };

export type CambiosDeCliente = Partial<DatosDeCliente>;

export async function guardarClienteNuevo(
  cliente: ClienteMaun,
  nuevo: ClienteNuevo,
): Promise<FilaDe<'clientes'>> {
  const { data, error } = await cliente
    .from('clientes')
    .upsert(nuevo, { onConflict: 'id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function guardarCambiosDeCliente(
  cliente: ClienteMaun,
  id: string,
  cambios: CambiosDeCliente,
): Promise<FilaDe<'clientes'>> {
  const { data, error } = await cliente
    .from('clientes')
    .update(cambios)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Las columnas de proyectos que el usuario escribe, y que tienen grant en la base. Salen del tipo
// generado, no de una copia a mano. Las de la distribución no están: las escribe private.liquidar.
export const COLUMNAS_DE_PROYECTO = [
  'cliente_id',
  'titulo',
  'descripcion',
  'estado',
  'presupuesto_centavos',
  'forma_pago',
  'comprobante',
  'fecha_visita',
  'ultimo_contacto',
  'fecha_inicio',
  'entrega_estimada',
  'fecha_entrega',
  'direccion_entrega',
  'notas',
] as const;

export type ColumnaDeProyecto = (typeof COLUMNAS_DE_PROYECTO)[number];

export type DatosDeProyecto = Pick<FilaDe<'proyectos'>, ColumnaDeProyecto>;

export type CambiosDeProyecto = Partial<DatosDeProyecto>;

interface FilaHijaViva {
  id: string;
  fecha: string;
  monto_centavos: number;
  borrado?: false;
}

// La baja de una fila hija lleva solo su id: la base no mira nada más, y mandar el resto en blanco
// haría que jsonb_to_recordset intente castear una fecha vacía a date y corte la llamada entera.
export interface BajaDeFilaHija {
  id: string;
  borrado: true;
}

export type PagoParaGuardar = (FilaHijaViva & { concepto: string }) | BajaDeFilaHija;

export type GastoParaGuardar = (FilaHijaViva & { descripcion: string }) | BajaDeFilaHija;

// El proyecto es el agregado: sus pagos y sus gastos no se guardan sueltos. `version` es la que vio
// el cliente y va null en un alta. Las filas hijas que el usuario sacó del formulario viajan en el
// mismo array con `borrado`, y solo las que existían: la base nunca borra lo que el cliente no vio.
export interface ProyectoParaGuardar {
  id: string;
  version: number | null;
  datos: DatosDeProyecto;
  pagos: readonly PagoParaGuardar[];
  gastos: readonly GastoParaGuardar[];
}

export interface ProyectoGuardado {
  proyecto: FilaDe<'proyectos'>;
  pagos: readonly FilaDe<'pagos'>[];
  gastos: readonly FilaDe<'gastos'>[];
}

function filasDelAgregado<T extends 'pagos' | 'gastos'>(valor: unknown, tabla: T): FilaDe<T>[] {
  if (!Array.isArray(valor)) {
    throw new RespuestaInvalidaError(`guardar_proyecto no devolvió la lista de ${tabla}.`);
  }
  for (const fila of valor) {
    if (
      typeof fila !== 'object' ||
      fila === null ||
      typeof (fila as { id?: unknown }).id !== 'string'
    ) {
      throw new RespuestaInvalidaError(`Una fila de ${tabla} no trae id.`);
    }
  }
  return valor as FilaDe<T>[];
}

export function leerProyectoGuardado(valor: unknown): ProyectoGuardado {
  if (typeof valor !== 'object' || valor === null) {
    throw new RespuestaInvalidaError('guardar_proyecto no devolvió un objeto.');
  }
  const cuerpo = valor as Record<string, unknown>;
  const proyecto = cuerpo.proyecto;
  if (
    typeof proyecto !== 'object' ||
    proyecto === null ||
    typeof (proyecto as { id?: unknown }).id !== 'string'
  ) {
    throw new RespuestaInvalidaError('guardar_proyecto no devolvió el proyecto.');
  }
  return {
    proyecto: proyecto as FilaDe<'proyectos'>,
    pagos: filasDelAgregado(cuerpo.pagos, 'pagos'),
    gastos: filasDelAgregado(cuerpo.gastos, 'gastos'),
  };
}

export async function guardarProyecto(
  cliente: ClienteMaun,
  pedido: ProyectoParaGuardar,
): Promise<ProyectoGuardado> {
  const { data, error } = await cliente.rpc('guardar_proyecto', {
    p_proyecto: { id: pedido.id, version: pedido.version, ...pedido.datos } as unknown as Json,
    p_pagos: pedido.pagos as unknown as Json,
    p_gastos: pedido.gastos as unknown as Json,
  });
  if (error) throw error;
  return leerProyectoGuardado(data);
}

// La edición suelta de un proyecto, para lo que no toca la plata ni sus hijos: hoy, las notas de
// obra que se escriben en línea desde el detalle. Manda solo las columnas que cambiaron (ADR 0010),
// y gana la última escritura, que para texto libre es lo que corresponde.
export async function guardarCambiosDeProyecto(
  cliente: ClienteMaun,
  id: string,
  cambios: CambiosDeProyecto,
): Promise<FilaDe<'proyectos'>> {
  const { data, error } = await cliente
    .from('proyectos')
    .update(cambios)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// La baja de un proyecto y la de un cliente son lógicas y con la marca fijada al encolar, así el
// reenvío conserva la primera (ADR 0010). No hay grant de delete para el cliente.
export async function borrarCliente(
  cliente: ClienteMaun,
  id: string,
  borradoEn: string,
): Promise<FilaDe<'clientes'>> {
  const { data, error } = await cliente
    .from('clientes')
    .update({ deleted_at: borradoEn })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function borrarProyecto(
  cliente: ClienteMaun,
  id: string,
  borradoEn: string,
): Promise<FilaDe<'proyectos'>> {
  const { data, error } = await cliente
    .from('proyectos')
    .update({ deleted_at: borradoEn })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export interface PedidoDeLiquidacion {
  proyectoId: string;
  version: number;
  destino: EstadoLiquidado;
  fecha: string;
  cobradoCentavos: number;
  gastosCentavos: number;
  topeSueldoCentavos: number;
  topeFijosCentavos: number;
  diezmoBp: number;
  diezmoCentavos: number;
  sueldoCentavos: number;
  fijosCentavos: number;
  remanenteCentavos: number;
  sueldoPrevioCentavos: number;
  fijosPrevioCentavos: number;
}

export interface PedidoDeReversion {
  proyectoId: string;
  version: number;
  desde: EstadoLiquidado;
  hacia: EstadoProyecto;
}

export async function liquidarProyecto(
  cliente: ClienteMaun,
  pedido: PedidoDeLiquidacion,
): Promise<FilaDe<'proyectos'>> {
  const comun = {
    p_proyecto_id: pedido.proyectoId,
    p_version: pedido.version,
    p_cobrado_centavos: pedido.cobradoCentavos,
    p_gastos_centavos: pedido.gastosCentavos,
    p_tope_sueldo_centavos: pedido.topeSueldoCentavos,
    p_tope_fijos_centavos: pedido.topeFijosCentavos,
    p_diezmo_centavos: pedido.diezmoCentavos,
    p_sueldo_centavos: pedido.sueldoCentavos,
    p_fijos_centavos: pedido.fijosCentavos,
    p_remanente_centavos: pedido.remanenteCentavos,
    p_sueldo_previo_centavos: pedido.sueldoPrevioCentavos,
    p_fijos_previo_centavos: pedido.fijosPrevioCentavos,
  };

  const { data, error } =
    pedido.destino === 'cobrado'
      ? await cliente.rpc('cobrar_proyecto', { ...comun, p_fecha_cobro: pedido.fecha })
      : await cliente.rpc('cerrar_perdido', {
          ...comun,
          p_fecha: pedido.fecha,
          p_diezmo_bp: pedido.diezmoBp,
        });

  if (error) throw error;
  return data;
}

export async function revertirLiquidacion(
  cliente: ClienteMaun,
  pedido: PedidoDeReversion,
): Promise<FilaDe<'proyectos'>> {
  const { data, error } =
    pedido.desde === 'cobrado'
      ? await cliente.rpc('reabrir_proyecto', {
          p_proyecto_id: pedido.proyectoId,
          p_version: pedido.version,
        })
      : await cliente.rpc('reactivar_perdido', {
          p_proyecto_id: pedido.proyectoId,
          p_version: pedido.version,
          p_estado: pedido.hacia,
        });

  if (error) throw error;
  return data;
}
