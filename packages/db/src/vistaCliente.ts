import type {
  ArchivoDelCliente,
  EstadoProyecto,
  FechasDelTrabajo,
  PagoDelCliente,
  TrabajoDelCliente,
} from '@maun/domain';

import type { ClienteMaun } from './cliente.ts';
import { dinero } from './dinero.ts';
import { RespuestaInvalidaError } from './replica.ts';

function objeto(valor: unknown, que: string): Record<string, unknown> {
  if (typeof valor !== 'object' || valor === null) {
    throw new RespuestaInvalidaError(`La vista del cliente no devolvió ${que}.`);
  }
  return valor as Record<string, unknown>;
}

function texto(valor: unknown, que: string): string {
  if (typeof valor !== 'string') {
    throw new RespuestaInvalidaError(`La vista del cliente no devolvió ${que}.`);
  }
  return valor;
}

function fechaONada(valor: unknown, que: string): string | null {
  if (valor === null || valor === undefined) return null;
  return texto(valor, que);
}

function numeroONada(valor: unknown, que: string): number | null {
  if (valor === null || valor === undefined) return null;
  if (typeof valor !== 'number') {
    throw new RespuestaInvalidaError(`La vista del cliente no devolvió ${que}.`);
  }
  return valor;
}

function lista(valor: unknown, que: string): unknown[] {
  if (!Array.isArray(valor)) {
    throw new RespuestaInvalidaError(`La vista del cliente no devolvió ${que}.`);
  }
  return valor;
}

function pagos(valor: unknown): PagoDelCliente[] {
  return lista(valor, 'los pagos').map((fila) => {
    const pago = objeto(fila, 'un pago');
    const monto = numeroONada(pago.monto_centavos, 'el importe de un pago');
    if (monto === null) throw new RespuestaInvalidaError('Un pago vino sin importe.');
    return {
      id: texto(pago.id, 'el id de un pago'),
      fecha: texto(pago.fecha, 'la fecha de un pago'),
      concepto: texto(pago.concepto, 'el concepto de un pago'),
      monto: dinero(monto),
    };
  });
}

function archivos(valor: unknown): ArchivoDelCliente[] {
  return lista(valor, 'los archivos').map((fila) => {
    const archivo = objeto(fila, 'un archivo');
    return {
      id: texto(archivo.id, 'el id de un archivo'),
      nombre: texto(archivo.nombre, 'el nombre de un archivo'),
      tipo: texto(archivo.tipo, 'el tipo de un archivo'),
      ancho: numeroONada(archivo.ancho, 'el ancho de un archivo'),
      alto: numeroONada(archivo.alto, 'el alto de un archivo'),
      fecha: texto(archivo.fecha, 'la fecha de un archivo'),
      ruta: texto(archivo.ruta, 'la ruta de un archivo'),
      rutaMini: texto(archivo.ruta_mini, 'la ruta de la miniatura de un archivo'),
    };
  });
}

function fechas(valor: unknown): FechasDelTrabajo {
  const crudas = objeto(valor, 'las fechas');
  return {
    presupuesto: fechaONada(crudas.presupuesto, 'la fecha del presupuesto'),
    aprobado: fechaONada(crudas.aprobado, 'la fecha de la aprobación'),
    inicio: fechaONada(crudas.inicio, 'la fecha de inicio'),
    entregaPautada: fechaONada(crudas.entrega_pautada, 'la entrega pautada'),
    entregado: fechaONada(crudas.entregado, 'la fecha de entrega'),
    cobro: fechaONada(crudas.cobro, 'la fecha de cobro'),
  };
}

export function leerVistaDelCliente(valor: unknown): TrabajoDelCliente {
  const cuerpo = objeto(valor, 'el trabajo');
  return {
    taller: texto(objeto(cuerpo.taller, 'el taller').nombre, 'el nombre del taller'),
    cliente: texto(objeto(cuerpo.cliente, 'el cliente').nombre, 'el nombre del cliente'),
    trabajo: texto(cuerpo.trabajo, 'el trabajo'),
    direccion: texto(cuerpo.direccion, 'la dirección'),
    estado: texto(cuerpo.estado, 'la etapa') as EstadoProyecto,
    precio: (() => {
      const precio = numeroONada(cuerpo.precio_centavos, 'el precio');
      return precio === null ? null : dinero(precio);
    })(),
    fechas: fechas(cuerpo.fechas),
    pagos: pagos(cuerpo.pagos),
    archivos: archivos(cuerpo.archivos),
  };
}

export async function traerVistaDelCliente(
  cliente: ClienteMaun,
  proyectoId: string,
): Promise<TrabajoDelCliente> {
  const { data, error } = await cliente.rpc('vista_del_cliente', { p_proyecto_id: proyectoId });
  if (error) throw error;
  return leerVistaDelCliente(data);
}

export async function traerVistaCompartida(
  cliente: ClienteMaun,
  token: string,
): Promise<TrabajoDelCliente> {
  const { data, error } = await cliente.rpc('vista_compartida', { p_token: token });
  if (error) throw error;
  return leerVistaDelCliente(data);
}
