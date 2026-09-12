import {
  aplicarLote,
  guardarAjustes,
  guardarCambiosDeCliente,
  guardarClienteNuevo,
  guardarMovimiento,
  guardarNombreDelTaller,
  necesitaReconcile,
  replicaVacia,
  traerBootstrap,
  traerDelta,
  type CambiosDeAjustes,
  type CambiosDeCliente,
  type ClienteNuevo,
  type FilaDe,
  type MovimientoNuevo,
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

  // El reconcile reemplaza la copia entera, así que no corre mientras haya cambios en la cola:
  // se llevaría puestas las filas optimistas que todavía no llegaron al servidor.
  if (!previa || (necesitaReconcile(previa, ahora) && !hayPendientes)) {
    const lote = await traerBootstrap(cliente);
    return aplicarLote(replicaVacia(usuarioId), lote, 'reconcile', ahora);
  }

  const lote = await traerDelta(cliente, previa.cursor);
  // La réplica se vuelve a leer después del viaje a la base: la cola pudo haber agregado o sacado
  // filas mientras tanto, y mezclar sobre la foto vieja las borraría.
  const base = deEsteUsuario(leerReplica()) ?? previa;
  return aplicarLote(base, lote, 'delta', ahora);
}

export async function registrarMovimiento(
  movimiento: MovimientoNuevo,
): Promise<FilaDe<'movimientos'>> {
  return guardarMovimiento(clienteMaun(), movimiento);
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
