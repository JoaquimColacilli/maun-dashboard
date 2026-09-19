import type { EstadoProyecto } from './estados.ts';
import { diasEntre } from './fechas.ts';
import { restar, sumarTodos, type Money } from './money.ts';

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

export interface TrabajoDelCliente {
  taller: string;
  cliente: string;
  trabajo: string;
  direccion: string;
  estado: EstadoProyecto;
  precio: Money | null;
  fechas: FechasDelTrabajo;
  pagos: readonly PagoDelCliente[];
  archivos: readonly ArchivoDelCliente[];
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
  quietoTexto: string;
  desdeTexto: string;
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

export const DIAS_SIN_NOVEDADES = 5;

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

function diasDesde(fecha: string, hoy: string): number {
  return Math.max(0, diasEntre(fecha, hoy));
}

function textoDeLoQuieto(eventos: readonly EventoDelCliente[], hoy: string): string {
  const ultimo = eventos[0];
  if (ultimo === undefined) return '';
  const dias = diasDesde(ultimo.fecha, hoy);
  if (dias < DIAS_SIN_NOVEDADES) return '';
  return `Hace ${String(dias)} días que no hay novedades. Es normal: un mueble a medida lleva semanas y no todos los días pasa algo que se vea.`;
}

function textoDeHaceCuanto(fecha: string | null, hoy: string): string {
  if (fecha === null) return '';
  const dias = diasDesde(fecha, hoy);
  if (dias === 0) return 'Desde hoy';
  return `Hace ${String(dias)} ${dias === 1 ? 'día' : 'días'}`;
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
    quietoTexto: textoDeLoQuieto(eventos, hoy),
    desdeTexto: textoDeHaceCuanto(fechaDe[hitoActual], hoy),
    foco:
      hitoIndex >= indiceDelHito('entregado') && saldo !== null && saldo > 0 ? 'saldo' : 'estado',
  };
}
