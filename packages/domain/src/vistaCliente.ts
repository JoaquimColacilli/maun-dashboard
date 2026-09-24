import type { EstadoProyecto } from './estados.ts';
import { diasEntre, entregaEstimada } from './fechas.ts';
import { restar, sumarTodos, type Money } from './money.ts';
import { montoParaPegar, ofrece, type FormaDeCobro, type InstanciaDePago } from './pagos.ts';
import { vencioElPresupuesto } from './vigencia.ts';

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
  valeHasta: string | null;
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
  sena: Money | null;
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

export interface CuentaParaTransferir {
  alias: string | null;
  cbu: string | null;
  titular: string | null;
  cuit: string | null;
}

export interface ComoPagar {
  instancia: InstanciaDePago;
  monto: Money | null;
  montoParaPegar: string | null;
  transferencia: boolean;
  cuenta: CuentaParaTransferir;
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

const SIN_CUENTA: CuentaParaTransferir = { alias: null, cbu: null, titular: null, cuit: null };

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

  return {
    instancia,
    monto,
    montoParaPegar: monto === null ? null : montoParaPegar(monto),
    transferencia,
    cuenta: transferencia
      ? { alias: cobro.alias, cbu: cobro.cbu, titular: cobro.titular, cuit: cobro.cuit }
      : SIN_CUENTA,
    link,
    mercadoPago: transferencia,
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
  fecha: string | null;
}

export interface NotaDelRelevamiento {
  estado: EstadoDelRelevamiento;
  etiqueta: string;
  titulo: string;
  lineas: readonly string[];
  resumen: string;
}

export interface FormatosDeFecha {
  larga: (fecha: string) => string;
  corta: (fecha: string) => string;
  enUnaFrase: (fecha: string) => string;
}

export type SenaDeLaVista =
  | { situacion: 'sin-presupuesto' }
  | { situacion: 'falta'; sena: Money; aCuenta: Money; falta: Money }
  | { situacion: 'cubierta'; sena: Money; aCuenta: Money };

export type ProyeccionDeLaEntrega =
  | { situacion: 'sin-fecha' }
  | { situacion: 'vigente'; senarAntesDe: string; listoPara: string }
  | { situacion: 'vencida'; vencio: string };

export type EntregaDelTrabajo =
  { situacion: 'pautada'; fecha: string | null } | { situacion: 'entregado'; fecha: string };

export interface DatosDelTrabajo {
  direccion: string | null;
  inicio: string | null;
  entrega: EntregaDelTrabajo;
  sena: SenaDeLaVista;
}

interface LoComunDeLaVista {
  taller: string;
  cliente: string;
  titulo: string;
  hitoActual: HitoDelTrabajo;
  hitoIndex: number;
  hitos: readonly HitoDeLaVista[];
  relevamiento: RelevamientoDeLaVista | null;
  eventos: readonly EventoDelCliente[];
  sigue: string;
  pagos: readonly PagoDelCliente[];
  pagado: Money;
  archivos: readonly ArchivoDelCliente[];
  comoPagar: ComoPagar | null;
}

export interface VistaAntesDelPresupuesto extends LoComunDeLaVista {
  etapa: 'antes-del-presupuesto';
}

export interface VistaEsperandoLaSena extends LoComunDeLaVista {
  etapa: 'esperando-la-sena';
  presupuesto: Money | null;
  sena: SenaDeLaVista;
  proyeccion: ProyeccionDeLaEntrega;
}

export type EtapaAprobada = 'aprobado' | 'fabricacion' | 'entregado' | 'pagado';

export interface VistaAprobada extends LoComunDeLaVista {
  etapa: EtapaAprobada;
  precio: Money | null;
  saldo: Money | null;
  saldado: boolean;
  foco: FocoDeLaVista;
  datos: DatosDelTrabajo;
}

export type VistaDelCliente = VistaAntesDelPresupuesto | VistaEsperandoLaSena | VistaAprobada;

export type EtapaDeLaVista = VistaDelCliente['etapa'];

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

export const APROBADO_SIN_LA_SENA = 'Aprobado';

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

export const TITULAR_DEL_APROBADO: Readonly<Record<SenaDeLaVista['situacion'], string>> = {
  cubierta: EN_CURSO.aprobado,
  falta: 'Lo aprobaste y falta la seña para entrar en la cola del taller',
  'sin-presupuesto': 'Lo aprobaste y ya estás en la cola del taller',
};

export const SIGUE: Readonly<Record<HitoDelTrabajo, string>> = {
  estimativo: 'Si seguimos adelante, lo próximo que vas a ver acá es el presupuesto.',
  presupuesto: 'Lo próximo que vas a ver acá es el presupuesto.',
  aprobado: 'Lo próximo que vas a ver acá es el arranque de la fabricación.',
  fabricacion: 'Lo próximo que vas a ver acá es la entrega.',
  entregado: 'Lo próximo que vas a ver acá es el pago del saldo.',
  pagado: '',
};

export const SIGUE_CON_EL_PRESUPUESTO_MANDADO = 'Lo próximo es que lo apruebes y dejes la seña.';

export const SIGUE_FALTA_LA_SENA = 'Lo próximo es que dejes la seña.';

export const SIGUE_FALTA_MEDIR: Readonly<Record<'estimativo' | 'presupuesto', string>> = {
  estimativo: 'Si seguimos adelante, lo próximo es ir a medir para pasarte el presupuesto.',
  presupuesto: 'Lo próximo es ir a medir, para poder pasarte el presupuesto.',
};

export const NOTA_DEL_RELEVAMIENTO: Readonly<
  Record<EstadoDelRelevamiento, { etiqueta: string; titulo: string }>
> = {
  pendiente: {
    etiqueta: 'Por qué el número todavía puede cambiar',
    titulo: 'El número todavía puede cambiar',
  },
  hecho: {
    etiqueta: 'De dónde sale este número',
    titulo: 'El número ya está tomado de las medidas reales',
  },
};

export const FALTA_MEDIR_DEL_ESTIMADO: readonly string[] = [
  'Lo que te pasamos es un estimado, sacado de lo que hablamos.',
  'Para cerrarlo tenemos que ir a tu casa a tomar las medidas.',
];

export const SIN_FECHA_PARA_LA_VISITA = 'Todavía no tenemos fecha para la visita.';

export const CERRANDO_EL_PRESUPUESTO = 'Con esas medidas estamos cerrando el presupuesto final.';

export const ARMAMOS_EL_PRESUPUESTO = 'Con esas medidas armamos el presupuesto final.';

export const RESUMEN_FALTA_MEDIR = 'Número estimado, falta ir a medir';

export const TE_PASAMOS_EL_ESTIMATIVO = 'Te pasamos un número estimado';

export const FUIMOS_A_MEDIR = 'Fuimos a medir';

export const TE_PASAMOS_EL_PRESUPUESTO = 'Te pasamos el presupuesto';

export const RECIBIMOS_TU_PAGO = 'Recibimos tu pago';

export const APROBASTE_EL_PRESUPUESTO = 'Aprobaste el presupuesto';

export const EMPEZAMOS_A_FABRICARLO = 'Empezamos a fabricarlo en el taller';

export const LO_LLEVAMOS_Y_LO_INSTALAMOS = 'Lo llevamos y lo instalamos';

export const COORDINAMOS_LA_ENTREGA =
  'Cuando lo apruebes y dejes la seña, coordinamos la fecha de entrega.';

export const VAMOS_TOMANDO_LOS_TRABAJOS =
  'Vamos tomando los trabajos a medida que entran las señas.';

const HITOS_DEL_PRESUPUESTO: readonly HitoDelTrabajo[] = ['estimativo', 'presupuesto'];

const APROBADOS: readonly EstadoProyecto[] = ['en_curso', 'entregado', 'cobrado'];

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

export function estaAprobada(vista: VistaDelCliente): vista is VistaAprobada {
  return vista.etapa !== 'antes-del-presupuesto' && vista.etapa !== 'esperando-la-sena';
}

function fechasDe(trabajo: TrabajoDelCliente): Partial<FechasDelTrabajo> {
  return trabajo.fechas;
}

function fechaDelEstimativo(trabajo: TrabajoDelCliente): string | null {
  return fechasDe(trabajo).estimativo ?? null;
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
  if (visita.hecha || yaPaso) return { estado: 'hecho', fecha: dia };
  if (dia === null && !ESPERAN_LA_VISITA.includes(trabajo.estado)) return null;
  return { estado: 'pendiente', fecha: dia !== null && dia >= hoy ? dia : null };
}

export function proyeccionDeLaEntrega(
  valeHasta: string | null,
  hoy: string,
): ProyeccionDeLaEntrega {
  if (valeHasta === null) return { situacion: 'sin-fecha' };
  if (vencioElPresupuesto(valeHasta, hoy)) return { situacion: 'vencida', vencio: valeHasta };
  return {
    situacion: 'vigente',
    senarAntesDe: valeHasta,
    listoPara: entregaEstimada(valeHasta),
  };
}

export function textoDeLaProyeccion(
  proyeccion: ProyeccionDeLaEntrega,
  formatos: Pick<FormatosDeFecha, 'enUnaFrase'>,
): readonly string[] {
  switch (proyeccion.situacion) {
    case 'sin-fecha':
      return [COORDINAMOS_LA_ENTREGA];
    case 'vencida':
      return [
        `Este presupuesto venció el ${formatos.enUnaFrase(proyeccion.vencio)}. Hablá con el taller para actualizarlo.`,
      ];
    case 'vigente':
      return [
        `Si dejás la seña antes del ${formatos.enUnaFrase(proyeccion.senarAntesDe)}, podríamos tenerlo listo para el ${formatos.enUnaFrase(proyeccion.listoPara)}.`,
        VAMOS_TOMANDO_LOS_TRABAJOS,
      ];
  }
}

function senaDelTrabajo(trabajo: TrabajoDelCliente, pagado: Money): SenaDeLaVista {
  const sena = (trabajo.sena as Money | null | undefined) ?? null;
  const pago = trabajo.pago as PagoPendiente | undefined;
  if (sena === null || pago === undefined) return { situacion: 'sin-presupuesto' };
  if (pago.instancia !== 'sena') return { situacion: 'cubierta', sena, aCuenta: pagado };
  return pago.monto === null
    ? { situacion: 'sin-presupuesto' }
    : { situacion: 'falta', sena, aCuenta: pagado, falta: pago.monto };
}

function empezoAFabricarse(trabajo: TrabajoDelCliente, hoy: string): boolean {
  const inicio = fechasDe(trabajo).inicio ?? null;
  return inicio !== null && diasEntre(inicio, hoy) >= 0;
}

function etapaDeLaVista(trabajo: TrabajoDelCliente, saldado: boolean, hoy: string): EtapaDeLaVista {
  switch (trabajo.estado) {
    case 'cobrado':
      return 'pagado';
    case 'entregado':
      return saldado ? 'pagado' : 'entregado';
    case 'en_curso':
      return empezoAFabricarse(trabajo, hoy) ? 'fabricacion' : 'aprobado';
    case 'presupuesto_enviado':
      return 'esperando-la-sena';
    default:
      return 'antes-del-presupuesto';
  }
}

function yaSeEntrego(etapa: EtapaDeLaVista): boolean {
  return etapa === 'entregado' || etapa === 'pagado';
}

function hitoDeLaEtapa(etapa: EtapaDeLaVista, trabajo: TrabajoDelCliente): HitoDelTrabajo {
  if (etapa !== 'antes-del-presupuesto' && etapa !== 'esperando-la-sena') return etapa;
  return trabajo.estado === 'presupuesto_estimativo' ? 'estimativo' : 'presupuesto';
}

interface Contexto {
  trabajo: TrabajoDelCliente;
  aprobado: boolean;
  sena: SenaDeLaVista['situacion'];
  relevamiento: RelevamientoDeLaVista | null;
}

function textoEnCurso(hito: HitoDelTrabajo, { trabajo, sena }: Contexto): string {
  if (hito === 'presupuesto' && trabajo.estado === 'presupuesto_enviado') {
    return PRESUPUESTO_MANDADO;
  }
  if (hito === 'aprobado') return TITULAR_DEL_APROBADO[sena];
  return EN_CURSO[hito];
}

function loQueSigue(hito: HitoDelTrabajo, { trabajo, sena, relevamiento }: Contexto): string {
  if (hito === 'presupuesto' && trabajo.estado === 'presupuesto_enviado') {
    return SIGUE_CON_EL_PRESUPUESTO_MANDADO;
  }
  if ((hito === 'estimativo' || hito === 'presupuesto') && relevamiento?.estado === 'pendiente') {
    return SIGUE_FALTA_MEDIR[hito];
  }
  if (hito === 'aprobado' && sena === 'falta') return SIGUE_FALTA_LA_SENA;
  return SIGUE[hito];
}

function etiquetaDelHito(hito: HitoDelCamino, { aprobado, sena }: Contexto): string {
  return hito.id === 'aprobado' && aprobado && sena !== 'cubierta'
    ? APROBADO_SIN_LA_SENA
    : hito.etiqueta;
}

function fechasDeLosHitos(
  trabajo: TrabajoDelCliente,
  saldado: boolean,
): Readonly<Record<HitoDelTrabajo, string | null>> {
  const fechas = fechasDe(trabajo);
  const ultimoPago = trabajo.pagos[trabajo.pagos.length - 1];
  return {
    estimativo: fechaDelEstimativo(trabajo),
    presupuesto: fechas.presupuesto ?? null,
    aprobado: fechas.aprobado ?? null,
    fabricacion: fechas.inicio ?? null,
    entregado: fechas.entregado ?? null,
    pagado: fechas.cobro ?? (saldado ? (ultimoPago?.fecha ?? null) : null),
  };
}

function textoDelPago(cantidad: number, esElUltimo: boolean, saldado: boolean): string {
  if (!saldado || !esElUltimo) return RECIBIMOS_TU_PAGO;
  return cantidad === 1
    ? 'Recibimos el pago y quedó saldado'
    : 'Recibimos el saldo y quedó saldado';
}

interface EventoOrdenable extends EventoDelCliente {
  orden: number;
}

function eventosDelTrabajo(
  { trabajo, aprobado, relevamiento }: Contexto,
  etapa: EtapaDeLaVista,
  saldado: boolean,
  hoy: string,
): readonly EventoDelCliente[] {
  const eventos: EventoOrdenable[] = [];
  const fechas = fechasDe(trabajo);
  const cantidad = trabajo.pagos.length;

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

  const presupuesto = fechas.presupuesto ?? null;
  if (presupuesto !== null) {
    eventos.push({
      id: 'presupuesto',
      fecha: presupuesto,
      texto: TE_PASAMOS_EL_PRESUPUESTO,
      hito: 'presupuesto',
      monto: null,
      orden: 0,
    });
  }

  trabajo.pagos.forEach((pago, indice) => {
    const esElUltimo = indice === cantidad - 1;
    eventos.push({
      id: pago.id,
      fecha: pago.fecha,
      texto: textoDelPago(cantidad, esElUltimo, saldado),
      hito: saldado && esElUltimo ? 'pagado' : aprobado ? 'aprobado' : 'presupuesto',
      monto: pago.monto,
      orden: indice + 1,
    });
  });

  const aprobadoEl = fechas.aprobado ?? null;
  if (aprobado && aprobadoEl !== null) {
    eventos.push({
      id: 'aprobado',
      fecha: aprobadoEl,
      texto: APROBASTE_EL_PRESUPUESTO,
      hito: 'aprobado',
      monto: null,
      orden: cantidad + 1,
    });
  }

  const inicio = fechas.inicio ?? null;
  if (aprobado && inicio !== null && empezoAFabricarse(trabajo, hoy)) {
    eventos.push({
      id: 'inicio',
      fecha: inicio,
      texto: EMPEZAMOS_A_FABRICARLO,
      hito: 'fabricacion',
      monto: null,
      orden: cantidad + 2,
    });
  }

  const entregado = fechas.entregado ?? null;
  if (yaSeEntrego(etapa) && entregado !== null) {
    eventos.push({
      id: 'entregado',
      fecha: entregado,
      texto: LO_LLEVAMOS_Y_LO_INSTALAMOS,
      hito: 'entregado',
      monto: null,
      orden: cantidad + 3,
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

function datosDelTrabajo(
  trabajo: TrabajoDelCliente,
  etapa: EtapaDeLaVista,
  sena: SenaDeLaVista,
): DatosDelTrabajo {
  const fechas = fechasDe(trabajo);
  const entregado = fechas.entregado ?? null;
  const direccion = trabajo.direccion.trim();
  return {
    direccion: direccion === '' ? null : direccion,
    inicio: fechas.inicio ?? null,
    entrega:
      entregado !== null && yaSeEntrego(etapa)
        ? { situacion: 'entregado', fecha: entregado }
        : { situacion: 'pautada', fecha: fechas.entregaPautada ?? null },
    sena,
  };
}

export function vistaDelCliente(trabajo: TrabajoDelCliente, hoy: string): VistaDelCliente {
  const aprobado = APROBADOS.includes(trabajo.estado);
  const pagado = sumarTodos(trabajo.pagos.map((pago) => pago.monto));
  const saldo = aprobado && trabajo.precio !== null ? restar(trabajo.precio, pagado) : null;
  const saldado = saldo !== null && saldo <= 0;
  const sena = senaDelTrabajo(trabajo, pagado);
  const relevamiento = relevamientoDelTrabajo(trabajo, hoy);
  const contexto: Contexto = { trabajo, aprobado, sena: sena.situacion, relevamiento };

  const etapa = etapaDeLaVista(trabajo, saldado, hoy);
  const hitoActual = hitoDeLaEtapa(etapa, trabajo);
  const camino = tuvoEstimativo(trabajo) ? [HITO_DEL_ESTIMATIVO, ...HITOS] : HITOS;
  const hitoIndex = camino.findIndex((hito) => hito.id === hitoActual);
  const llegoAlFinal = hitoIndex === camino.length - 1;
  const fechaDe = fechasDeLosHitos(trabajo, saldado);

  const hitos: HitoDeLaVista[] = camino.map((hito, indice) => {
    const etiqueta = etiquetaDelHito(hito, contexto);
    return {
      id: hito.id,
      etiqueta,
      estado:
        indice < hitoIndex || llegoAlFinal ? 'pasado' : indice === hitoIndex ? 'actual' : 'futuro',
      fecha: indice <= hitoIndex ? fechaDe[hito.id] : null,
      texto:
        indice === hitoIndex
          ? textoEnCurso(hito.id, contexto)
          : indice < hitoIndex
            ? etiqueta
            : hito.futuro,
    };
  });

  const comun = {
    taller: trabajo.taller,
    cliente: trabajo.cliente,
    titulo: trabajo.trabajo,
    hitoActual,
    hitoIndex,
    hitos,
    relevamiento,
    eventos: eventosDelTrabajo(contexto, etapa, saldado, hoy),
    sigue: loQueSigue(hitoActual, contexto),
    pagos: trabajo.pagos,
    pagado,
    archivos: trabajo.archivos,
    comoPagar: comoPagar(trabajo),
  };

  if (etapa === 'antes-del-presupuesto') return { ...comun, etapa };

  if (etapa === 'esperando-la-sena') {
    return {
      ...comun,
      etapa,
      presupuesto: trabajo.precio,
      sena,
      proyeccion: proyeccionDeLaEntrega(fechasDe(trabajo).valeHasta ?? null, hoy),
    };
  }

  return {
    ...comun,
    etapa,
    precio: trabajo.precio,
    saldo,
    saldado,
    foco: yaSeEntrego(etapa) && saldo !== null && saldo > 0 ? 'saldo' : 'estado',
    datos: datosDelTrabajo(trabajo, etapa, sena),
  };
}

export function notaDelRelevamiento(
  vista: VistaDelCliente,
  formatos: Pick<FormatosDeFecha, 'larga' | 'corta'>,
): NotaDelRelevamiento | null {
  const { relevamiento } = vista;
  if (relevamiento === null || !HITOS_DEL_PRESUPUESTO.includes(vista.hitoActual)) return null;
  const { fecha } = relevamiento;
  const mandado = vista.etapa === 'esperando-la-sena';

  if (relevamiento.estado === 'hecho') {
    return {
      estado: 'hecho',
      ...NOTA_DEL_RELEVAMIENTO.hecho,
      lineas: [
        fecha === null ? 'Ya fuimos a medir.' : `${FUIMOS_A_MEDIR} el ${formatos.larga(fecha)}.`,
        mandado ? ARMAMOS_EL_PRESUPUESTO : CERRANDO_EL_PRESUPUESTO,
      ],
      resumen: fecha === null ? 'Ya fuimos a medir' : `Medido el ${formatos.corta(fecha)}`,
    };
  }

  const conEstimativo = vista.hitos.some((hito) => hito.id === 'estimativo');
  if (mandado || !conEstimativo) return null;
  return {
    estado: 'pendiente',
    ...NOTA_DEL_RELEVAMIENTO.pendiente,
    lineas: [
      ...FALTA_MEDIR_DEL_ESTIMADO,
      fecha === null ? SIN_FECHA_PARA_LA_VISITA : `Quedamos en ir el ${formatos.larga(fecha)}.`,
    ],
    resumen: RESUMEN_FALTA_MEDIR,
  };
}
