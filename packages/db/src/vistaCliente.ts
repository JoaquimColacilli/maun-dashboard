import { esLinkDeMercadoPago, FORMAS_DE_COBRO, INSTANCIAS_DE_PAGO } from '@maun/domain';
import type {
  CobroDelTaller,
  ArchivoDelCliente,
  EstadoProyecto,
  FechasDelTrabajo,
  FormaDeCobro,
  InstanciaDePago,
  Money,
  PagoDelCliente,
  PagoOfrecido,
  PagoPendiente,
  TrabajoDelCliente,
  VisitaDelTrabajo,
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

function textoONada(valor: unknown, que: string): string | null {
  if (valor === null || valor === undefined) return null;
  const leido = texto(valor, que).trim();
  return leido === '' ? null : leido;
}

function linkDeCobro(valor: unknown): string | null {
  const leido = textoONada(valor, 'el link para pagar');
  return leido !== null && esLinkDeMercadoPago(leido) ? leido : null;
}

function cobro(valor: unknown): CobroDelTaller {
  if (valor === null || valor === undefined) {
    return { alias: null, cbu: null, titular: null, cuit: null, link: null };
  }
  const crudo = objeto(valor, 'los datos para transferir');
  return {
    alias: textoONada(crudo.alias, 'el alias del taller'),
    cbu: textoONada(crudo.cbu, 'el CBU del taller'),
    titular: textoONada(crudo.titular, 'el titular de la cuenta'),
    cuit: textoONada(crudo.cuit, 'el CUIT del titular'),
    link: linkDeCobro(crudo.link),
  };
}

function esForma(valor: unknown): valor is FormaDeCobro {
  return FORMAS_DE_COBRO.some((forma) => forma === valor);
}

const SIN_PAGO: PagoPendiente = { instancia: null, formas: [], monto: null, siguiente: null };

function instanciaDe(valor: unknown, que: string): InstanciaDePago | null {
  const leida = textoONada(valor, que);
  if (leida === null) return null;
  const conocida = INSTANCIAS_DE_PAGO.find((una) => una === leida);
  if (conocida === undefined) {
    throw new RespuestaInvalidaError('La vista del cliente devolvió un pago desconocido.');
  }
  return conocida;
}

function pagoOfrecido(valor: unknown): PagoOfrecido | null {
  if (valor === null || valor === undefined) return null;
  const crudo = objeto(valor, 'el pago que sigue');
  const instancia = instanciaDe(crudo.instancia, 'la instancia del pago que sigue');
  if (instancia === null) return null;
  const monto = numeroONada(crudo.monto_centavos, 'el importe del pago que sigue');
  return {
    instancia,
    formas: lista(crudo.formas, 'las formas del pago que sigue').filter(esForma),
    monto: monto === null ? null : dinero(monto),
  };
}

function pagoPendiente(valor: unknown): PagoPendiente {
  if (valor === null || valor === undefined) return SIN_PAGO;
  const crudo = objeto(valor, 'el pago que toca');
  const monto = numeroONada(crudo.monto_centavos, 'el importe del pago que toca');
  return {
    instancia: instanciaDe(crudo.instancia, 'la instancia del pago'),
    formas: lista(crudo.formas, 'las formas de pago').filter(esForma),
    monto: monto === null ? null : dinero(monto),
    siguiente: pagoOfrecido(crudo.siguiente),
  };
}

function fechas(valor: unknown): FechasDelTrabajo {
  const crudas = objeto(valor, 'las fechas');
  return {
    estimativo: fechaONada(crudas.estimativo, 'la fecha del estimativo'),
    presupuesto: fechaONada(crudas.presupuesto, 'la fecha del presupuesto'),
    aprobado: fechaONada(crudas.aprobado, 'la fecha de la aprobación'),
    inicio: fechaONada(crudas.inicio, 'la fecha de inicio'),
    entregaPautada: fechaONada(crudas.entrega_pautada, 'la entrega pautada'),
    entregado: fechaONada(crudas.entregado, 'la fecha de entrega'),
    cobro: fechaONada(crudas.cobro, 'la fecha de cobro'),
    valeHasta: fechaONada(crudas.vale_hasta, 'hasta cuándo vale el presupuesto'),
  };
}

function importeONada(valor: unknown, que: string): Money | null {
  const importe = numeroONada(valor, que);
  return importe === null ? null : dinero(importe);
}

const SIN_VISITA: VisitaDelTrabajo = { dia: null, hecha: false };

function visita(valor: unknown): VisitaDelTrabajo {
  if (valor === null || valor === undefined) return SIN_VISITA;
  const cruda = objeto(valor, 'la visita para medir');
  if (typeof cruda.hecha !== 'boolean') {
    throw new RespuestaInvalidaError('La vista del cliente no devolvió si ya se fue a medir.');
  }
  return { dia: fechaONada(cruda.dia, 'el día de la visita'), hecha: cruda.hecha };
}

export function leerVistaDelCliente(valor: unknown): TrabajoDelCliente {
  const cuerpo = objeto(valor, 'el trabajo');
  return {
    taller: texto(objeto(cuerpo.taller, 'el taller').nombre, 'el nombre del taller'),
    cliente: texto(objeto(cuerpo.cliente, 'el cliente').nombre, 'el nombre del cliente'),
    trabajo: texto(cuerpo.trabajo, 'el trabajo'),
    direccion: texto(cuerpo.direccion, 'la dirección'),
    estado: texto(cuerpo.estado, 'la etapa') as EstadoProyecto,
    precio: importeONada(cuerpo.precio_centavos, 'el precio'),
    sena: importeONada(cuerpo.sena_centavos, 'la seña'),
    fechas: fechas(cuerpo.fechas),
    visita: visita(cuerpo.visita),
    pago: pagoPendiente(cuerpo.pago),
    cobro: cobro(cuerpo.cobro),
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
