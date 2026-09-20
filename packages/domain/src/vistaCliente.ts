import { esCuentaDeMercadoPago } from './cobro.ts';
import type { EstadoProyecto } from './estados.ts';
import { diasEntre } from './fechas.ts';
import { restar, sumarTodos, type Money } from './money.ts';
import { montoParaPegar, ofrece, type FormaDeCobro, type InstanciaDePago } from './pagos.ts';

export type HitoDelTrabajo = 'presupuesto' | 'aprobado' | 'fabricacion' | 'entregado' | 'pagado';

export type EstadoDelHito = 'pasado' | 'actual' | 'futuro';

export type FocoDeLaVista = 'saldo' | 'estado';

export interface PagoDelCliente {
  id: string;
  fecha: string;
  concepto: string;
  monto: Money;
}

export interface ArchivoDelCliente {
  id: string;
  nombre: string;
  tipo: string;
  ancho: number | null;
  alto: number | null;
  fecha: string;
  ruta: string;
  rutaMini: string;
}

export interface FechasDelTrabajo {
  presupuesto: string | null;
  aprobado: string | null;
  inicio: string | null;
  entregaPautada: string | null;
  entregado: string | null;
  cobro: string | null;
}

export interface CobroDelTaller {
  alias: string | null;
  cbu: string | null;
  titular: string | null;
  cuit: string | null;
  link: string | null;
}

export interface PagoOfrecido {
  instancia: InstanciaDePago;
  formas: readonly FormaDeCobro[];
  monto: Money | null;
}

export interface PagoPendiente {
  instancia: InstanciaDePago | null;
  formas: readonly FormaDeCobro[];
  monto: Money | null;
  siguiente: PagoOfrecido | null;
}

export interface TrabajoDelCliente {
  taller: string;
  cliente: string;
  trabajo: string;
  direccion: string;
  estado: EstadoProyecto;
  precio: Money | null;
  fechas: FechasDelTrabajo;
  pago: PagoPendiente;
  cobro: CobroDelTaller;
  pagos: readonly PagoDelCliente[];
  archivos: readonly ArchivoDelCliente[];
}

export function hayComoTransferir(cobro: CobroDelTaller): boolean {
  return cobro.alias !== null || cobro.cbu !== null || cobro.link !== null;
}

export interface PagoQueSigue {
  instancia: InstanciaDePago;
  monto: Money | null;
  nombre: string;
  comoSePaga: string;
}

export interface ComoPagar {
  instancia: InstanciaDePago;
  monto: Money | null;
  montoParaPegar: string | null;
  transferencia: boolean;
  link: string | null;
  mercadoPago: boolean;
  efectivo: boolean;
  faltanLosDatos: boolean;
  titulo: string;
  etiquetaDelImporte: string;
  pasos: string;
  enEfectivo: string;
  siguiente: PagoQueSigue | null;
}

const TITULO = 'Cómo pagar';

const ETIQUETA_DEL_IMPORTE: Readonly<Record<InstanciaDePago, string>> = {
  sena: 'Ahora, la seña',
  saldo: 'Ahora, el saldo',
};

const NOMBRE: Readonly<Record<InstanciaDePago, string>> = {
  sena: 'la seña',
  saldo: 'el saldo',
};

function comoSePaga(formas: readonly FormaDeCobro[]): string {
  const porTransferencia = ofrece(formas, 'transferencia');
  const enEfectivo = ofrece(formas, 'efectivo');
  if (porTransferencia && enEfectivo) return 'por transferencia o en efectivo';
  if (porTransferencia) return 'por transferencia';
  return 'en efectivo';
}

function elQueSigue(pago: PagoOfrecido | null): PagoQueSigue | null {
  if (pago === null) return null;
  return {
    instancia: pago.instancia,
    monto: pago.monto,
    nombre: NOMBRE[pago.instancia],
    comoSePaga: comoSePaga(pago.formas),
  };
}

export const O_POR_MERCADO_PAGO =
  'O pagá desde Mercado Pago, sin copiar nada: tocá el botón, escribí el monto de arriba y confirmá.';

export const PASOS_PARA_TRANSFERIR =
  'Copiá el alias, pegalo en Transferir en la app de tu banco o de tu billetera, escribí el monto y confirmá.';

export const PEDILE_LOS_DATOS =
  'Para transferir, pedile los datos de la cuenta al taller: todavía no los cargó.';

const SOLO_EFECTIVO: Readonly<Record<InstanciaDePago, string>> = {
  sena: 'La seña es en efectivo, en mano. Lo coordinás con el taller.',
  saldo: 'El saldo es en efectivo, en mano. Lo coordinás con el taller.',
};

const TAMBIEN_EFECTIVO: Readonly<Record<InstanciaDePago, string>> = {
  sena: 'La seña también la podés dejar en efectivo, en mano, coordinándolo con el taller.',
  saldo: 'El saldo también lo podés pagar en efectivo, en mano, coordinándolo con el taller.',
};

export function comoPagar(trabajo: TrabajoDelCliente): ComoPagar | null {
  const { instancia, formas, monto } = trabajo.pago;
  if (instancia === null) return null;

  const pideTransferencia = ofrece(formas, 'transferencia');
  const transferencia = pideTransferencia && hayComoTransferir(trabajo.cobro);
  const efectivo = ofrece(formas, 'efectivo');
  const link = transferencia ? trabajo.cobro.link : null;
  const cuenta = transferencia ? trabajo.cobro.cbu : null;

  return {
    instancia,
    monto,
    montoParaPegar: monto === null ? null : montoParaPegar(monto),
    transferencia,
    link,
    mercadoPago: link !== null || (cuenta !== null && esCuentaDeMercadoPago(cuenta)),
    efectivo,
    faltanLosDatos: pideTransferencia && !transferencia,
    titulo: TITULO,
    etiquetaDelImporte: ETIQUETA_DEL_IMPORTE[instancia],
    pasos: PASOS_PARA_TRANSFERIR,
    enEfectivo: transferencia ? TAMBIEN_EFECTIVO[instancia] : SOLO_EFECTIVO[instancia],
    siguiente: elQueSigue(trabajo.pago.siguiente),
  };
}

export interface HitoDeLaVista {
  id: HitoDelTrabajo;
  etiqueta: string;
  estado: EstadoDelHito;
  fecha: string | null;
  texto: string;
}

export interface EventoDelCliente {
  id: string;
  fecha: string;
  texto: string;
  hito: HitoDelTrabajo;
  monto: Money | null;
}

export interface VistaDelCliente {
  trabajo: TrabajoDelCliente;
  pagado: Money;
  saldo: Money | null;
  saldado: boolean;
  hitoActual: HitoDelTrabajo;
  hitoIndex: number;
  hitos: readonly HitoDeLaVista[];
  eventos: readonly EventoDelCliente[];
  sigue: string;
  foco: FocoDeLaVista;
}

export const HITOS: readonly { id: HitoDelTrabajo; etiqueta: string; futuro: string }[] = [
  { id: 'presupuesto', etiqueta: 'Presupuesto enviado', futuro: 'Te vamos a pasar el presupuesto' },
  {
    id: 'aprobado',
    etiqueta: 'Aprobado, seña cobrada',
    futuro: 'Cuando lo apruebes y dejes la seña',
  },
  { id: 'fabricacion', etiqueta: 'En fabricación', futuro: 'Vamos a empezar a fabricarlo' },
  { id: 'entregado', etiqueta: 'Entregado', futuro: 'Lo llevamos y lo instalamos' },
  { id: 'pagado', etiqueta: 'Pagado', futuro: 'Cuando esté saldado' },
];

const EN_CURSO: Readonly<Record<HitoDelTrabajo, string>> = {
  presupuesto: 'Estamos preparando tu presupuesto',
  aprobado: 'Recibimos la seña y ya estás en la cola del taller',
  fabricacion: 'Lo estamos fabricando',
  entregado: 'Ya está instalado en tu casa',
  pagado: 'Listo, está saldado',
};

const SIGUE: Readonly<Record<HitoDelTrabajo, string>> = {
  presupuesto: 'Lo próximo que vas a ver acá es el presupuesto.',
  aprobado: 'Lo próximo que vas a ver acá es el arranque de la fabricación.',
  fabricacion: 'Lo próximo que vas a ver acá es la entrega.',
  entregado: 'Lo próximo que vas a ver acá es el pago del saldo.',
  pagado: '',
};

function indiceDelHito(hito: HitoDelTrabajo): number {
  return HITOS.findIndex((uno) => uno.id === hito);
}

function hitoDelTrabajo(trabajo: TrabajoDelCliente, saldado: boolean, hoy: string): HitoDelTrabajo {
  if (trabajo.estado === 'cobrado') return 'pagado';
  if (trabajo.estado === 'entregado') return saldado ? 'pagado' : 'entregado';
  if (trabajo.estado === 'en_curso') {
    const inicio = trabajo.fechas.inicio;
    return inicio !== null && diasEntre(inicio, hoy) >= 0 ? 'fabricacion' : 'aprobado';
  }
  return 'presupuesto';
}

function fechasDeLosHitos(
  trabajo: TrabajoDelCliente,
  saldado: boolean,
): Readonly<Record<HitoDelTrabajo, string | null>> {
  const primerPago = trabajo.pagos[0];
  const ultimoPago = trabajo.pagos[trabajo.pagos.length - 1];
  return {
    presupuesto: trabajo.fechas.presupuesto,
    aprobado: trabajo.fechas.aprobado ?? primerPago?.fecha ?? null,
    fabricacion: trabajo.fechas.inicio,
    entregado: trabajo.fechas.entregado,
    pagado: trabajo.fechas.cobro ?? (saldado ? (ultimoPago?.fecha ?? null) : null),
  };
}

function textoDelPago(indice: number, esElUltimo: boolean, saldado: boolean): string {
  if (saldado && esElUltimo) {
    return indice === 0
      ? 'Recibimos el pago y quedó saldado'
      : 'Recibimos el saldo y quedó saldado';
  }
  if (indice === 0) return 'Recibimos tu seña y quedó aprobado';
  return 'Recibimos un adelanto';
}

interface EventoOrdenable extends EventoDelCliente {
  orden: number;
}

function eventosDelTrabajo(
  trabajo: TrabajoDelCliente,
  saldado: boolean,
): readonly EventoDelCliente[] {
  const eventos: EventoOrdenable[] = [];

  if (trabajo.fechas.presupuesto !== null) {
    eventos.push({
      id: 'presupuesto',
      fecha: trabajo.fechas.presupuesto,
      texto: 'Te pasamos el presupuesto',
      hito: 'presupuesto',
      monto: null,
      orden: 0,
    });
  }

  trabajo.pagos.forEach((pago, indice) => {
    const esElUltimo = indice === trabajo.pagos.length - 1;
    const cierra = saldado && esElUltimo;
    eventos.push({
      id: pago.id,
      fecha: pago.fecha,
      texto: textoDelPago(indice, esElUltimo, saldado),
      hito: cierra ? 'pagado' : 'aprobado',
      monto: pago.monto,
      orden: indice + 1,
    });
  });

  if (trabajo.fechas.inicio !== null) {
    eventos.push({
      id: 'inicio',
      fecha: trabajo.fechas.inicio,
      texto: 'Empezamos a fabricarlo en el taller',
      hito: 'fabricacion',
      monto: null,
      orden: trabajo.pagos.length + 1,
    });
  }

  if (trabajo.fechas.entregado !== null) {
    eventos.push({
      id: 'entregado',
      fecha: trabajo.fechas.entregado,
      texto: 'Lo llevamos y lo instalamos',
      hito: 'entregado',
      monto: null,
      orden: trabajo.pagos.length + 2,
    });
  }

  return eventos
    .sort((uno, otro) => {
      const porFecha = diasEntre(uno.fecha, otro.fecha);
      if (porFecha !== 0) return porFecha;
      const porHito = indiceDelHito(otro.hito) - indiceDelHito(uno.hito);
      return porHito === 0 ? otro.orden - uno.orden : porHito;
    })
    .map((evento) => ({
      id: evento.id,
      fecha: evento.fecha,
      texto: evento.texto,
      hito: evento.hito,
      monto: evento.monto,
    }));
}

export function vistaDelCliente(trabajo: TrabajoDelCliente, hoy: string): VistaDelCliente {
  const pagado = sumarTodos(trabajo.pagos.map((pago) => pago.monto));
  const saldo = trabajo.precio === null ? null : restar(trabajo.precio, pagado);
  const saldado = saldo !== null && saldo <= 0;

  const hitoActual = hitoDelTrabajo(trabajo, saldado, hoy);
  const hitoIndex = indiceDelHito(hitoActual);
  const fechaDe = fechasDeLosHitos(trabajo, saldado);

  const hitos: HitoDeLaVista[] = HITOS.map((hito, indice) => ({
    id: hito.id,
    etiqueta: hito.etiqueta,
    estado: indice < hitoIndex ? 'pasado' : indice === hitoIndex ? 'actual' : 'futuro',
    fecha: indice <= hitoIndex ? fechaDe[hito.id] : null,
    texto:
      indice === hitoIndex ? EN_CURSO[hito.id] : indice < hitoIndex ? hito.etiqueta : hito.futuro,
  }));

  const eventos = eventosDelTrabajo(trabajo, saldado);

  return {
    trabajo,
    pagado,
    saldo,
    saldado,
    hitoActual,
    hitoIndex,
    hitos,
    eventos,
    sigue: SIGUE[hitoActual],
    foco:
      hitoIndex >= indiceDelHito('entregado') && saldo !== null && saldo > 0 ? 'saldo' : 'estado',
  };
}
