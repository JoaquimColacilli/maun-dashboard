import {
  aplicarLote,
  borrarAnotacion,
  borrarCliente,
  borrarMovimiento,
  borrarProyecto,
  guardarAjustes,
  guardarAnotacionNueva,
  guardarCambiosDeAnotacion,
  guardarCambiosDeCliente,
  guardarCambiosDeMovimiento,
  guardarCambiosDeProyecto,
  guardarClienteNuevo,
  guardarMovimiento,
  guardarNombreDelTaller,
  guardarProyecto,
  guardarTareasDelPresupuesto,
  liquidarProyecto,
  necesitaReconcile,
  replicaVacia,
  revertirLiquidacion,
  traerBootstrap,
  traerDelta,
  type AnotacionNueva,
  type CambiosDeAjustes,
  type CambiosDeAnotacion,
  type CambiosDeCliente,
  type CambiosDeMovimiento,
  type CambiosDeProyecto,
  type CambiosDeTareas,
  type ClienteNuevo,
  type FilaDe,
  type MovimientoNuevo,
  type PedidoDeLiquidacion,
  type PedidoDeReversion,
  type ProyectoGuardado,
  type ProyectoParaGuardar,
  type Replica,
} from '@maun/db';

import { clienteMaun } from './cliente';

export interface PedidoDeSincronizacion {
  leerReplica: () => Replica | undefined;
  usuarioId: string;
  ahora: number;
  hayPendientes: boolean;
}

export async function sincronizar({
  leerReplica,
  usuarioId,
  ahora,
  hayPendientes,
}: PedidoDeSincronizacion): Promise<Replica> {
  const cliente = clienteMaun();
  const deEsteUsuario = (replica: Replica | undefined) =>
    replica && replica.usuarioId === usuarioId ? replica : undefined;

  const previa = deEsteUsuario(leerReplica());

  if (!previa || (necesitaReconcile(previa, ahora) && !hayPendientes)) {
    const lote = await traerBootstrap(cliente);
    return aplicarLote(replicaVacia(usuarioId), lote, 'reconcile', ahora);
  }

  const lote = await traerDelta(cliente, previa.cursor);
  const base = deEsteUsuario(leerReplica()) ?? previa;
  return aplicarLote(base, lote, 'delta', ahora);
}

export async function registrarMovimiento(
  movimiento: MovimientoNuevo,
): Promise<FilaDe<'movimientos'>> {
  return guardarMovimiento(clienteMaun(), movimiento);
}

export async function editarMovimiento(
  id: string,
  cambios: CambiosDeMovimiento,
): Promise<FilaDe<'movimientos'>> {
  return guardarCambiosDeMovimiento(clienteMaun(), id, cambios);
}

export async function darDeBajaMovimiento(
  id: string,
  borradoEn: string,
): Promise<FilaDe<'movimientos'>> {
  return borrarMovimiento(clienteMaun(), id, borradoEn);
}

export async function editarAjustes(
  id: string,
  cambios: CambiosDeAjustes,
): Promise<FilaDe<'ajustes'>> {
  return guardarAjustes(clienteMaun(), id, cambios);
}

export async function renombrarTaller(id: string, nombre: string): Promise<FilaDe<'households'>> {
  return guardarNombreDelTaller(clienteMaun(), id, nombre);
}

export async function crearCliente(nuevo: ClienteNuevo): Promise<FilaDe<'clientes'>> {
  return guardarClienteNuevo(clienteMaun(), nuevo);
}

export async function editarCliente(
  id: string,
  cambios: CambiosDeCliente,
): Promise<FilaDe<'clientes'>> {
  return guardarCambiosDeCliente(clienteMaun(), id, cambios);
}

export async function guardarElProyecto(pedido: ProyectoParaGuardar): Promise<ProyectoGuardado> {
  return guardarProyecto(clienteMaun(), pedido);
}

export async function editarProyecto(
  id: string,
  cambios: CambiosDeProyecto,
): Promise<FilaDe<'proyectos'>> {
  return guardarCambiosDeProyecto(clienteMaun(), id, cambios);
}

export async function marcarTareasDelPresupuesto(
  id: string,
  cambios: CambiosDeTareas,
): Promise<FilaDe<'proyectos'>> {
  return guardarTareasDelPresupuesto(clienteMaun(), id, cambios);
}

export async function darDeBajaCliente(id: string, borradoEn: string): Promise<FilaDe<'clientes'>> {
  return borrarCliente(clienteMaun(), id, borradoEn);
}

export async function darDeBajaProyecto(
  id: string,
  borradoEn: string,
): Promise<FilaDe<'proyectos'>> {
  return borrarProyecto(clienteMaun(), id, borradoEn);
}

export async function crearAnotacion(
  nueva: AnotacionNueva,
  restaurada = false,
): Promise<FilaDe<'anotaciones'>> {
  return guardarAnotacionNueva(clienteMaun(), nueva, restaurada);
}

export async function editarAnotacion(
  id: string,
  cambios: CambiosDeAnotacion,
): Promise<FilaDe<'anotaciones'>> {
  return guardarCambiosDeAnotacion(clienteMaun(), id, cambios);
}

export async function darDeBajaAnotacion(
  id: string,
  borradoEn: string,
): Promise<FilaDe<'anotaciones'>> {
  return borrarAnotacion(clienteMaun(), id, borradoEn);
}

export async function liquidarElProyecto(
  pedido: PedidoDeLiquidacion,
): Promise<FilaDe<'proyectos'>> {
  return liquidarProyecto(clienteMaun(), pedido);
}

export async function revertirLaLiquidacion(
  pedido: PedidoDeReversion,
): Promise<FilaDe<'proyectos'>> {
  return revertirLiquidacion(clienteMaun(), pedido);
}
