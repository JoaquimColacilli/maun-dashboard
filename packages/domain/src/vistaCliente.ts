import { esCuentaDeMercadoPago } from './cobro.ts';
import type { EstadoProyecto } from './estados.ts';
import { diasEntre } from './fechas.ts';
import { restar, sumarTodos, type Money } from './money.ts';
import { montoParaPegar, ofrece, type FormaDeCobro, type InstanciaDePago } from './pagos.ts';

export type HitoDelTrabajo =
  'estimativo' | 'presupuesto' | 'aprobado' | 'fabricacion' | 'entregado' | 'pagado';

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
  estimativo: string | null;
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

export interface VisitaDelTrabajo {
  dia: string | null;
  hecha: boolean;
}

export interface TrabajoDelCliente {
  taller: string;
  cliente: string;
  trabajo: string;
  direccion: string;
  estado: EstadoProyecto;
  precio: Money | null;
  fechas: FechasDelTrabajo;
  visita: VisitaDelTrabajo;
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
  const pago = trabajo.pago as PagoPendiente | undefined;
  const cobro = trabajo.cobro as CobroDelTaller | undefined;
  if (pago === undefined || cobro === undefined) return null;

  const { instancia, formas, monto } = pago;
  if (instancia === null) return null;

  const pideTransferencia = ofrece(formas, 'transferencia');
  const transferencia = pideTransferencia && hayComoTransferir(cobro);
  const efectivo = ofrece(formas, 'efectivo');
  const link = transferencia ? cobro.link : null;
  const cuenta = transferencia ? cobro.cbu : null;

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
    siguiente: elQueSigue(pago.siguiente),
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

export type EstadoDelRelevamiento = 'pendiente' | 'hecho';

export interface RelevamientoDeLaVista {
  estado: EstadoDelRelevamiento;
  texto: string;
  detalle: string;
  fecha: string | null;
}

export interface VistaDelCliente {
  trabajo: TrabajoDelCliente;
  pagado: Money;
  saldo: Money | null;
  saldado: boolean;
  hitoActual: HitoDelTrabajo;
  hitoIndex: number;
  hitos: readonly HitoDeLaVista[];
  relevamiento: RelevamientoDeLaVista | null;
  eventos: readonly EventoDelCliente[];
  sigue: string;
  foco: FocoDeLaVista;
}

interface HitoDelCamino {
  id: HitoDelTrabajo;
  etiqueta: string;
  futuro: string;
}

export const HITO_DEL_ESTIMATIVO: HitoDelCamino = {
  id: 'estimativo',
  etiqueta: 'Te pasamos un número estimado',
  futuro: 'Te pasamos un número estimado',
};

export const HITOS: readonly HitoDelCamino[] = [
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

const ORDEN_DE_LOS_HITOS: readonly HitoDelTrabajo[] = [
  'estimativo',
  ...HITOS.map((hito) => hito.id),
];

const EN_CURSO: Readonly<Record<HitoDelTrabajo, string>> = {
  estimativo: 'Te pasamos un número estimado',
  presupuesto: 'Estamos preparando tu presupuesto',
  aprobado: 'Recibimos la seña y ya estás en la cola del taller',
  fabricacion: 'Lo estamos fabricando',
  entregado: 'Ya está instalado en tu casa',
  pagado: 'Listo, está saldado',
};

export const PRESUPUESTO_MANDADO = 'Te pasamos el presupuesto';

export const SIGUE: Readonly<Record<HitoDelTrabajo, string>> = {
  estimativo: 'Si seguimos adelante, lo próximo que vas a ver acá es el presupuesto.',
  presupuesto: 'Lo próximo que vas a ver acá es el presupuesto.',
  aprobado: 'Lo próximo que vas a ver acá es el arranque de la fabricación.',
  fabricacion: 'Lo próximo que vas a ver acá es la entrega.',
  entregado: 'Lo próximo que vas a ver acá es el pago del saldo.',
  pagado: '',
};

export const SIGUE_CON_EL_PRESUPUESTO_MANDADO = 'Lo próximo es que lo apruebes y dejes la seña.';

export const SIGUE_FALTA_MEDIR: Readonly<Record<'estimativo' | 'presupuesto', string>> = {
  estimativo: 'Si seguimos adelante, lo próximo es ir a medir para pasarte el presupuesto.',
  presupuesto: 'Lo próximo es ir a medir, para poder pasarte el presupuesto.',
};

export const RELEVAMIENTO = 'Relevamiento técnico';

export const FALTA_MEDIR = 'Falta ir a medir para poder presupuestarte.';

export const YA_FUIMOS_A_MEDIR = 'Ya fuimos a medir.';

export const QUEDAMOS_EN_IR = 'Quedamos en ir el';

const ESPERAN_LA_VISITA: readonly EstadoProyecto[] = [
  'contacto',
  'presupuesto_estimativo',
  'relevamiento',
];

const TODAVIA_ANTES_DE_LA_VISITA: readonly EstadoProyecto[] = ['contacto', 'relevamiento'];

const SIN_VISITA: VisitaDelTrabajo = { dia: null, hecha: false };

function posicionDelHito(hito: HitoDelTrabajo): number {
  return ORDEN_DE_LOS_HITOS.indexOf(hito);
}

export function llegoAl(vista: VistaDelCliente, hito: HitoDelTrabajo): boolean {
  return posicionDelHito(vista.hitoActual) >= posicionDelHito(hito);
}

function fechaDelEstimativo(trabajo: TrabajoDelCliente): string | null {
  return (trabajo.fechas as Partial<FechasDelTrabajo>).estimativo ?? null;
}

export function tuvoEstimativo(trabajo: TrabajoDelCliente): boolean {
  return trabajo.estado === 'presupuesto_estimativo' || fechaDelEstimativo(trabajo) !== null;
}

export function relevamientoDelTrabajo(
  trabajo: TrabajoDelCliente,
  hoy: string,
): RelevamientoDeLaVista | null {
  const visita = (trabajo.visita as VisitaDelTrabajo | undefined) ?? SIN_VISITA;
  const dia = visita.dia;
  const yaPaso = dia !== null && dia < hoy && !TODAVIA_ANTES_DE_LA_VISITA.includes(trabajo.estado);
  if (visita.hecha || yaPaso) {
    return { estado: 'hecho', texto: RELEVAMIENTO, detalle: YA_FUIMOS_A_MEDIR, fecha: dia };
  }
  if (dia === null && !ESPERAN_LA_VISITA.includes(trabajo.estado)) return null;
  return {
    estado: 'pendiente',
    texto: RELEVAMIENTO,
    detalle: FALTA_MEDIR,
    fecha: dia !== null && dia >= hoy ? dia : null,
  };
}

function hitoDelTrabajo(trabajo: TrabajoDelCliente, saldado: boolean, hoy: string): HitoDelTrabajo {
  if (trabajo.estado === 'cobrado') return 'pagado';
  if (trabajo.estado === 'entregado') return saldado ? 'pagado' : 'entregado';
  if (trabajo.estado === 'en_curso') {
    const inicio = trabajo.fechas.inicio;
    return inicio !== null && diasEntre(inicio, hoy) >= 0 ? 'fabricacion' : 'aprobado';
  }
  if (trabajo.estado === 'presupuesto_estimativo') return 'estimativo';
  return 'presupuesto';
}

function textoEnCurso(hito: HitoDelTrabajo, trabajo: TrabajoDelCliente): string {
  if (hito === 'presupuesto' && trabajo.estado === 'presupuesto_enviado') {
    return PRESUPUESTO_MANDADO;
  }
  return EN_CURSO[hito];
}

function loQueSigue(
  hito: HitoDelTrabajo,
  trabajo: TrabajoDelCliente,
  relevamiento: RelevamientoDeLaVista | null,
): string {
  if (hito === 'presupuesto' && trabajo.estado === 'presupuesto_enviado') {
    return SIGUE_CON_EL_PRESUPUESTO_MANDADO;
  }
  if ((hito === 'estimativo' || hito === 'presupuesto') && relevamiento?.estado === 'pendiente') {
    return SIGUE_FALTA_MEDIR[hito];
  }
  return SIGUE[hito];
}

function fechasDeLosHitos(
  trabajo: TrabajoDelCliente,
  saldado: boolean,
): Readonly<Record<HitoDelTrabajo, string | null>> {
  const primerPago = trabajo.pagos[0];
  const ultimoPago = trabajo.pagos[trabajo.pagos.length - 1];
  return {
    estimativo: fechaDelEstimativo(trabajo),
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

export const TE_PASAMOS_EL_ESTIMATIVO = 'Te pasamos un número estimado';

export const FUIMOS_A_MEDIR = 'Fuimos a medir';

function eventosDelTrabajo(
  trabajo: TrabajoDelCliente,
  saldado: boolean,
  relevamiento: RelevamientoDeLaVista | null,
): readonly EventoDelCliente[] {
  const eventos: EventoOrdenable[] = [];

  const estimativo = fechaDelEstimativo(trabajo);
  if (estimativo !== null) {
    eventos.push({
      id: 'estimativo',
      fecha: estimativo,
      texto: TE_PASAMOS_EL_ESTIMATIVO,
      hito: 'estimativo',
      monto: null,
      orden: -2,
    });
  }

  if (relevamiento?.estado === 'hecho' && relevamiento.fecha !== null) {
    eventos.push({
      id: 'relevamiento',
      fecha: relevamiento.fecha,
      texto: FUIMOS_A_MEDIR,
      hito: 'presupuesto',
      monto: null,
      orden: -1,
    });
  }

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
      const porHito = posicionDelHito(otro.hito) - posicionDelHito(uno.hito);
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
  const camino = tuvoEstimativo(trabajo) ? [HITO_DEL_ESTIMATIVO, ...HITOS] : HITOS;
  const hitoIndex = camino.findIndex((hito) => hito.id === hitoActual);
  const fechaDe = fechasDeLosHitos(trabajo, saldado);
  const relevamiento = relevamientoDelTrabajo(trabajo, hoy);

  const hitos: HitoDeLaVista[] = camino.map((hito, indice) => ({
    id: hito.id,
    etiqueta: hito.etiqueta,
    estado: indice < hitoIndex ? 'pasado' : indice === hitoIndex ? 'actual' : 'futuro',
    fecha: indice <= hitoIndex ? fechaDe[hito.id] : null,
    texto:
      indice === hitoIndex
        ? textoEnCurso(hito.id, trabajo)
        : indice < hitoIndex
          ? hito.etiqueta
          : hito.futuro,
  }));

  const eventos = eventosDelTrabajo(trabajo, saldado, relevamiento);
  const entregado = posicionDelHito(hitoActual) >= posicionDelHito('entregado');

  return {
    trabajo,
    pagado,
    saldo,
    saldado,
    hitoActual,
    hitoIndex,
    hitos,
    relevamiento,
    eventos,
    sigue: loQueSigue(hitoActual, trabajo, relevamiento),
    foco: entregado && saldo !== null && saldo > 0 ? 'saldo' : 'estado',
  };
}
