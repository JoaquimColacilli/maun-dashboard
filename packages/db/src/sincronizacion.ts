import type { EstadoLiquidado, EstadoProyecto } from '@maun/domain';

import type { ColumnaDeMarca } from './agenda.ts';
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

export const COLUMNAS_DE_AJUSTES = [
  'sueldo_mensual_centavos',
  'costos_fijos_centavos',
  'meta_cocos_centavos',
  'tasa_cocos_anual_bp',
  'sena_bp',
  'cobro_alias',
  'cobro_cbu',
  'cobro_titular',
  'cobro_cuit',
  'cobro_link',
  'resena_link',
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

export const COLUMNAS_DE_MOVIMIENTO = [
  'fecha',
  'tipo',
  'tesoro_origen',
  'tesoro_destino',
  'monto_centavos',
  'categoria',
  'descripcion',
] as const;

export type ColumnaDeMovimiento = (typeof COLUMNAS_DE_MOVIMIENTO)[number];

export type DatosDeMovimiento = Pick<FilaDe<'movimientos'>, ColumnaDeMovimiento>;

export type CambiosDeMovimiento = Partial<DatosDeMovimiento>;

export async function guardarCambiosDeMovimiento(
  cliente: ClienteMaun,
  id: string,
  cambios: CambiosDeMovimiento,
): Promise<FilaDe<'movimientos'>> {
  const { data, error } = await cliente
    .from('movimientos')
    .update(cambios)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function borrarMovimiento(
  cliente: ClienteMaun,
  id: string,
  borradoEn: string,
): Promise<FilaDe<'movimientos'>> {
  const { data, error } = await cliente
    .from('movimientos')
    .update({ deleted_at: borradoEn })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

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
  'vencimiento_presupuesto',
  'visita_hecha',
  'sena_bp',
  'entrega_hora',
  'visita_hora',
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

export interface BajaDeFilaHija {
  id: string;
  borrado: true;
}

export type PagoParaGuardar =
  (FilaHijaViva & { concepto: string; ya_en_la_apertura?: boolean }) | BajaDeFilaHija;

export type GastoParaGuardar = (FilaHijaViva & { descripcion: string }) | BajaDeFilaHija;

export type OpcionParaGuardar =
  | {
      id: string;
      descripcion: string;
      monto_centavos: number;
      aprobada: boolean;
      borrado?: false;
    }
  | BajaDeFilaHija;

export type NecesidadParaGuardar =
  | {
      id: string;
      tipo: FilaDe<'necesidades'>['tipo'];
      nombre: string;
      cantidad: number | null;
      listo: boolean;
      borrado?: false;
    }
  | BajaDeFilaHija;

export type ResultadoDelContacto = NonNullable<FilaDe<'proximos_contactos'>['resultado']>;

export type ProximoParaGuardar =
  | {
      id: string;
      fecha: string;
      nota: string;
      etapa_previa: FilaDe<'proximos_contactos'>['etapa_previa'];
      hecho_el: string | null;
      resultado: ResultadoDelContacto | null;
      respuesta: string;
      borrado?: false;
    }
  | BajaDeFilaHija;

export interface ProyectoParaGuardar {
  id: string;
  version: number | null;
  datos: DatosDeProyecto;
  pagos: readonly PagoParaGuardar[];
  gastos: readonly GastoParaGuardar[];
  opciones?: readonly OpcionParaGuardar[];
  necesidades?: readonly NecesidadParaGuardar[];
  proximos?: readonly ProximoParaGuardar[];
}

export interface ProyectoGuardado {
  proyecto: FilaDe<'proyectos'>;
  pagos: readonly FilaDe<'pagos'>[];
  gastos: readonly FilaDe<'gastos'>[];
  opciones: readonly FilaDe<'opciones_de_presupuesto'>[];
  necesidades: readonly FilaDe<'necesidades'>[];
  proximos: readonly FilaDe<'proximos_contactos'>[];
}

function filasDelAgregado<
  T extends 'pagos' | 'gastos' | 'opciones_de_presupuesto' | 'necesidades' | 'proximos_contactos',
>(valor: unknown, tabla: T): FilaDe<T>[] {
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
    opciones: filasDelAgregado(cuerpo.opciones_de_presupuesto, 'opciones_de_presupuesto'),
    necesidades: filasDelAgregado(cuerpo.necesidades, 'necesidades'),
    proximos: filasDelAgregado(cuerpo.proximos_contactos, 'proximos_contactos'),
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
    p_opciones: (pedido.opciones ?? null) as unknown as Json,
    p_necesidades: (pedido.necesidades ?? null) as unknown as Json,
    p_proximos: (pedido.proximos ?? null) as unknown as Json,
  });
  if (error) throw error;
  return leerProyectoGuardado(data);
}

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

export const COLUMNAS_DE_TAREAS = [
  'presupuesto_diseno',
  'presupuesto_despiece',
  'presupuesto_cotizacion',
  'presupuesto_pdf',
] as const;

export type ColumnaDeTarea = (typeof COLUMNAS_DE_TAREAS)[number];

export type CambiosDeTareas = Partial<Pick<FilaDe<'proyectos'>, ColumnaDeTarea>>;

export async function guardarTareasDelPresupuesto(
  cliente: ClienteMaun,
  id: string,
  cambios: CambiosDeTareas,
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

export const COLUMNAS_DE_COSTOS = [
  'costo_madera_centavos',
  'costo_herrajes_centavos',
  'costo_flete_centavos',
  'costo_ayudante_centavos',
] as const;

export type ColumnaDeCosto = (typeof COLUMNAS_DE_COSTOS)[number];

export type CambiosDeCostos = Partial<Pick<FilaDe<'proyectos'>, ColumnaDeCosto>>;

// Los costos estimados no entran por guardar_proyecto: son un update de sus columnas solas, como las
// marcas de la agenda. Así guardar el agregado no los pisa y ellos no pisan el agregado (ADR 0045).
export async function guardarCostosEstimados(
  cliente: ClienteMaun,
  id: string,
  cambios: CambiosDeCostos,
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

export const COLUMNAS_DE_FORMAS_DE_COBRO = ['cobro_sena', 'cobro_saldo'] as const;

export type ColumnaDeFormaDeCobro = (typeof COLUMNAS_DE_FORMAS_DE_COBRO)[number];

export type CambiosDeFormasDeCobro = Partial<Pick<FilaDe<'proyectos'>, ColumnaDeFormaDeCobro>>;

// Cómo te paga tampoco entra por guardar_proyecto: es un update de sus dos columnas solas, como los
// costos estimados y las marcas de la agenda (ADR 0053).
export async function guardarFormasDeCobro(
  cliente: ClienteMaun,
  id: string,
  cambios: CambiosDeFormasDeCobro,
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

export type CambiosDeMarcas = Partial<Pick<FilaDe<'proyectos'>, ColumnaDeMarca>>;

export async function guardarMarcasDeLaAgenda(
  cliente: ClienteMaun,
  id: string,
  cambios: CambiosDeMarcas,
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

export async function guardarMarcaDelProximoContacto(
  cliente: ClienteMaun,
  id: string,
  importante: boolean,
): Promise<FilaDe<'proximos_contactos'>> {
  const { data, error } = await cliente
    .from('proximos_contactos')
    .update({ importante })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

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

export const COLUMNAS_DE_ANOTACION = [
  'fecha',
  'hora',
  'texto',
  'categoria',
  'proyecto_id',
  'hecha',
  'importante',
] as const;

export type ColumnaDeAnotacion = (typeof COLUMNAS_DE_ANOTACION)[number];

export type DatosDeAnotacion = Pick<FilaDe<'anotaciones'>, ColumnaDeAnotacion>;

export type AnotacionNueva = DatosDeAnotacion & { id: string };

export type CambiosDeAnotacion = Partial<DatosDeAnotacion>;

export async function guardarAnotacionNueva(
  cliente: ClienteMaun,
  nueva: AnotacionNueva,
  restaurada = false,
): Promise<FilaDe<'anotaciones'>> {
  const fila: Database['public']['Tables']['anotaciones']['Insert'] = restaurada
    ? { ...nueva, deleted_at: null }
    : nueva;
  const { data, error } = await cliente
    .from('anotaciones')
    .upsert(fila, { onConflict: 'id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function guardarCambiosDeAnotacion(
  cliente: ClienteMaun,
  id: string,
  cambios: CambiosDeAnotacion,
): Promise<FilaDe<'anotaciones'>> {
  const { data, error } = await cliente
    .from('anotaciones')
    .update(cambios)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function borrarAnotacion(
  cliente: ClienteMaun,
  id: string,
  borradoEn: string,
): Promise<FilaDe<'anotaciones'>> {
  const { data, error } = await cliente
    .from('anotaciones')
    .update({ deleted_at: borradoEn })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export const COLUMNAS_DE_ARCHIVO = [
  'proyecto_id',
  'nombre',
  'tipo',
  'bytes',
  'ancho',
  'alto',
] as const;

export type ColumnaDeArchivo = (typeof COLUMNAS_DE_ARCHIVO)[number];

export type DatosDeArchivo = Pick<FilaDe<'archivos'>, ColumnaDeArchivo>;

export type ArchivoNuevo = DatosDeArchivo & { id: string };

export async function guardarArchivoNuevo(
  cliente: ClienteMaun,
  nuevo: ArchivoNuevo,
  restaurado = false,
): Promise<FilaDe<'archivos'>> {
  const fila: Database['public']['Tables']['archivos']['Insert'] = restaurado
    ? { ...nuevo, deleted_at: null }
    : nuevo;
  const { data, error } = await cliente
    .from('archivos')
    .upsert(fila, { onConflict: 'id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function borrarArchivo(
  cliente: ClienteMaun,
  id: string,
  borradoEn: string,
): Promise<FilaDe<'archivos'>> {
  const { data, error } = await cliente
    .from('archivos')
    .update({ deleted_at: borradoEn })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Una columna sola, como las marcas de la agenda: compartir un archivo no toca nada más de la fila.
export async function marcarArchivoParaElCliente(
  cliente: ClienteMaun,
  id: string,
  visible: boolean,
): Promise<FilaDe<'archivos'>> {
  const { data, error } = await cliente
    .from('archivos')
    .update({ visible_para_cliente: visible })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export interface EnlaceNuevo {
  id: string;
  proyecto_id: string;
  token_hash: string;
  token: string;
}

// Generar un link revoca el anterior antes de insertar el nuevo: el índice único parcial de «uno
// vivo por trabajo» se evalúa fila por fila y no se puede diferir (ADR 0043). Son dos llamadas
// seguidas y no una transacción: si la segunda falla, el trabajo queda sin link y se vuelve a
// intentar, que es el estado del que se venía.
export async function generarEnlacePublico(
  cliente: ClienteMaun,
  nuevo: EnlaceNuevo,
  revocar: { id: string; revocadoEn: string } | null,
): Promise<FilaDe<'enlaces_publicos'>[]> {
  const revocado =
    revocar === null ? [] : [await revocarEnlacePublico(cliente, revocar.id, revocar.revocadoEn)];

  const { data, error } = await cliente.from('enlaces_publicos').insert(nuevo).select().single();
  if (error) throw error;
  return [...revocado, data];
}

// Rellena el token de un enlace de los de antes, desde el aparato que todavía lo tiene guardado.
// El is('token', null) hace que no pise nunca uno ya guardado, así que repetirla no rompe nada y
// dos aparatos a la vez tampoco (ADR 0052).
export async function guardarElTokenDelEnlace(
  cliente: ClienteMaun,
  id: string,
  token: string,
): Promise<FilaDe<'enlaces_publicos'> | null> {
  const { data, error } = await cliente
    .from('enlaces_publicos')
    .update({ token })
    .eq('id', id)
    .is('token', null)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function revocarEnlacePublico(
  cliente: ClienteMaun,
  id: string,
  revocadoEn: string,
): Promise<FilaDe<'enlaces_publicos'>> {
  const { data, error } = await cliente
    .from('enlaces_publicos')
    .update({ revocado_at: revocadoEn })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export const COLUMNAS_DE_PREGUNTA = [
  'serie',
  'numero',
  'proyecto_id',
  'orden',
  'texto',
  'tipo',
  'escala',
  'obligatoria',
  'opciones',
  'archivada_at',
  'deleted_at',
] as const;

export type ColumnaDePregunta = (typeof COLUMNAS_DE_PREGUNTA)[number];

export type PreguntaParaGuardar = Pick<FilaDe<'preguntas'>, ColumnaDePregunta> & { id: string };

export async function guardarPregunta(
  cliente: ClienteMaun,
  pregunta: PreguntaParaGuardar,
): Promise<FilaDe<'preguntas'>> {
  const { data, error } = await cliente
    .from('preguntas')
    .upsert(pregunta, { onConflict: 'id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export interface EncuestaNueva {
  id: string;
  proyecto_id: string;
  token_hash: string;
  token: string;
}

export async function revocarEncuesta(
  cliente: ClienteMaun,
  id: string,
  revocadaEn: string,
): Promise<FilaDe<'encuestas_enviadas'>> {
  const { data, error } = await cliente
    .from('encuestas_enviadas')
    .update({ revocada_at: revocadaEn })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function mandarEncuesta(
  cliente: ClienteMaun,
  nueva: EncuestaNueva,
  revocar: { id: string; revocadaEn: string } | null,
): Promise<FilaDe<'encuestas_enviadas'>[]> {
  const revocada =
    revocar === null ? [] : [await revocarEncuesta(cliente, revocar.id, revocar.revocadaEn)];

  const { data, error } = await cliente.from('encuestas_enviadas').insert(nueva).select().single();
  if (error) throw error;
  return [...revocada, data];
}

export async function recordarEncuesta(
  cliente: ClienteMaun,
  id: string,
  recordadaEn: string,
): Promise<FilaDe<'encuestas_enviadas'>> {
  const { data, error } = await cliente
    .from('encuestas_enviadas')
    .update({ recordada_at: recordadaEn })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function marcarRespuestaLeida(
  cliente: ClienteMaun,
  id: string,
  leidaEn: string,
): Promise<FilaDe<'respuestas'>> {
  const { data, error } = await cliente
    .from('respuestas')
    .update({ leida_at: leidaEn })
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
  yaEnLaApertura?: boolean;
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
    p_ya_en_la_apertura: pedido.yaEnLaApertura ?? false,
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
