import { randomUUID } from 'node:crypto';

import { centavos, type EstadoProyecto, type Money } from '@maun/domain';

import type { Tesoro, TipoMovimiento } from '../../src/enums.ts';
import { agruparClientes, claveDelCliente, type GrupoDeClientes } from './clientes.ts';
import {
  TIPOS_QUE_ENTRAN,
  type EstadoViejo,
  type GastoViejo,
  type MovimientoViejo,
  type ProyectoViejo,
  type SistemaViejo,
  type TipoQueEntra,
} from './entrada.ts';

export const TESOROS_EN_ORDEN = [
  'hogar',
  'maun',
  'diezmo',
  'cocos',
] as const satisfies readonly Tesoro[];

export const PRESUPUESTO_DE_RELLENO = 100;

export type Saldos = Record<Tesoro, number>;

export interface ClienteAImportar extends GrupoDeClientes {
  id: string;
}

export interface ProyectoAImportar {
  viejo: ProyectoViejo;
  id: string;
  clienteId: string;
  clienteNombre: string;
  estado: EstadoProyecto;
  presupuesto: Money | null;
  presupuestoDeRelleno: boolean;
  liquidar: boolean;
  fechaDeCobro: string | null;
  origenDeLaFechaDeCobro: string;
  ultimoContacto: string | null;
  gastosAImportar: GastoViejo[];
  insumosANotas: number;
  notas: string;
  cobrado: Money;
  gastos: Money;
}

export interface MovimientoAImportar {
  viejo: MovimientoViejo;
  id: string;
  tipo: TipoMovimiento;
  origen: Tesoro | null;
  destino: Tesoro | null;
  monto: Money;
  categoria: string;
  descripcion: string;
  fecha: string;
}

export interface RepartoViejo {
  diezmo: number;
  sueldo: number;
  fijos: number;
}

export interface SaldosViejos extends Saldos {
  diezmoGenerado: number;
  diezmoPagado: number;
}

export interface Plan {
  sistema: SistemaViejo;
  clientes: ClienteAImportar[];
  proyectos: ProyectoAImportar[];
  movimientos: MovimientoAImportar[];
  descartados: MovimientoViejo[];
  repartoViejo: Map<string, RepartoViejo>;
  saldosViejos: SaldosViejos;
  avisos: string[];
}

export const ESTADO_NUEVO: Record<EstadoViejo, EstadoProyecto> = {
  presupuestado: 'presupuesto_enviado',
  en_curso: 'en_curso',
  entregado: 'entregado',
  cobrado: 'cobrado',
};

interface Lados {
  tipo: TipoMovimiento;
  origen: Tesoro | null;
  destino: Tesoro | null;
}

const LADOS: Record<TipoQueEntra, (monto: number) => Lados> = {
  ingreso_hogar: () => ({ tipo: 'ingreso', origen: null, destino: 'hogar' }),
  ingreso_maun: () => ({ tipo: 'ingreso', origen: null, destino: 'maun' }),
  gasto_hogar: () => ({ tipo: 'gasto', origen: 'hogar', destino: null }),
  gasto_maun: () => ({ tipo: 'gasto', origen: 'maun', destino: null }),
  pago_diezmo: () => ({ tipo: 'pago_diezmo', origen: 'diezmo', destino: null }),
  transfer_cocos: () => ({ tipo: 'aporte_cocos', origen: 'maun', destino: 'cocos' }),
  gasto_cocos: () => ({ tipo: 'gasto', origen: 'cocos', destino: null }),
  cocos_a_maun: () => ({ tipo: 'transferencia', origen: 'cocos', destino: 'maun' }),
  ajuste_cocos: (monto) =>
    monto > 0
      ? { tipo: 'ajuste', origen: null, destino: 'cocos' }
      : { tipo: 'ajuste', origen: 'cocos', destino: null },
};

export function ladosDelTipo(tipo: TipoQueEntra, monto: number): Lados {
  return LADOS[tipo](monto);
}

export function saldosEnCero(): Saldos {
  return { hogar: 0, maun: 0, diezmo: 0, cocos: 0 };
}

export function saldosDelSistemaViejo(movimientos: readonly MovimientoViejo[]): SaldosViejos {
  const saldos = { ...saldosEnCero(), diezmoGenerado: 0, diezmoPagado: 0 };
  for (const { tipo, monto } of movimientos) {
    switch (tipo) {
      case 'ingreso_hogar':
      case 'sueldo_hogar':
        saldos.hogar += monto;
        break;
      case 'ingreso_maun':
        saldos.maun += monto;
        break;
      case 'gasto_hogar':
        saldos.hogar -= monto;
        break;
      case 'gasto_maun':
      case 'fijos_maun':
        saldos.maun -= monto;
        break;
      case 'diezmo_generado':
        saldos.diezmoGenerado += monto;
        saldos.maun -= monto;
        break;
      case 'pago_diezmo':
        saldos.diezmoPagado += monto;
        break;
      case 'transfer_cocos':
        saldos.maun -= monto;
        saldos.cocos += monto;
        break;
      case 'gasto_cocos':
        saldos.cocos -= monto;
        break;
      case 'cocos_a_maun':
        saldos.cocos -= monto;
        saldos.maun += monto;
        break;
      case 'ajuste_cocos':
        saldos.cocos += monto;
        break;
    }
  }
  saldos.diezmo = saldos.diezmoPagado - saldos.diezmoGenerado;
  return saldos;
}

function suma(montos: readonly Money[]): Money {
  return centavos(montos.reduce((total, monto) => total + monto, 0));
}

function fechaDeCobro(proyecto: ProyectoViejo, corte: string): { fecha: string; origen: string } {
  const ultimoPago = proyecto.pagos
    .map((pago) => pago.fecha)
    .sort()
    .at(-1);
  if (ultimoPago !== undefined) return { fecha: ultimoPago, origen: 'el último pago' };
  if (proyecto.entrega !== null) return { fecha: proyecto.entrega, origen: 'la entrega estimada' };
  if (proyecto.inicio !== null) return { fecha: proyecto.inicio, origen: 'el inicio' };
  if (proyecto.alta !== null) return { fecha: proyecto.alta, origen: 'el alta del proyecto' };
  return { fecha: corte, origen: 'el día del corte' };
}

function estadoQueEntra(viejo: ProyectoViejo, deRelleno: boolean): EstadoProyecto {
  if (viejo.estado === 'cobrado') return 'entregado';
  if (deRelleno) return 'a_presupuestar';
  return ESTADO_NUEVO[viejo.estado];
}

export function notasDeLosInsumos(gastos: readonly GastoViejo[]): string {
  if (gastos.length === 0) return '';
  return [
    'Del sistema viejo, anotado como insumos:',
    ...gastos.map((gasto) => `- ${gasto.fecha}: ${gasto.descripcion}`),
  ].join('\n');
}

export interface OpcionesDelPlan {
  separar?: readonly string[];
  insumosComoNotas?: readonly string[];
  corte: string;
  nuevoId?: () => string;
}

export function armarPlan(sistema: SistemaViejo, opciones: OpcionesDelPlan): Plan {
  const separar = opciones.separar ?? [];
  const insumosComoNotas = opciones.insumosComoNotas ?? [];
  const nuevoId = opciones.nuevoId ?? randomUUID;
  const avisos: string[] = [];

  for (const id of insumosComoNotas) {
    const proyecto = sistema.proyectos.find((viejo) => viejo.id === id);
    if (proyecto === undefined) {
      throw new Error(
        `--insumos-como-notas ${id}: no hay ningún proyecto con ese id en ${sistema.claves.proyectos}.`,
      );
    }
    if (proyecto.estado === 'cobrado') {
      throw new Error(
        `--insumos-como-notas ${id}: ${proyecto.donde} está cobrado, y sacarle los insumos le cambiaría la distribución.`,
      );
    }
  }

  const clientes = agruparClientes(
    sistema.proyectos.map((proyecto) => proyecto.cliente),
    separar,
  ).map((grupo) => ({ ...grupo, id: nuevoId() }));
  const clientePorClave = new Map(clientes.map((cliente) => [cliente.clave, cliente]));

  const proyectos = sistema.proyectos.map((viejo): ProyectoAImportar => {
    const cliente = clientePorClave.get(claveDelCliente(viejo.cliente, separar));
    if (cliente === undefined)
      throw new Error(`${viejo.donde}: su cliente no quedó en ningún grupo.`);

    const liquidar = viejo.estado === 'cobrado';
    const cobro = liquidar ? fechaDeCobro(viejo, opciones.corte) : null;
    if (cobro !== null && cobro.origen !== 'el último pago') {
      avisos.push(
        `${viejo.donde}: está cobrado y no tiene pagos; la fecha de cobro sale de ${cobro.origen} (${cobro.fecha}).`,
      );
    }

    const deRelleno =
      viejo.estado === 'presupuestado' && viejo.presupuesto === PRESUPUESTO_DE_RELLENO;
    if (deRelleno) {
      avisos.push(
        `${viejo.donde}: el presupuesto de $1 es relleno, porque el sistema viejo no dejaba guardar sin presupuesto. Entra sin presupuesto y a presupuestar.`,
      );
    }

    const aNotas = insumosComoNotas.includes(viejo.id);
    const gastosAImportar = aNotas ? [] : viejo.gastos;
    if (aNotas) {
      avisos.push(
        `${viejo.donde}: sus ${String(viejo.gastos.length)} insumos no entran como gastos; su texto va a las notas del proyecto (--insumos-como-notas).`,
      );
    }

    let ultimoContacto: string | null = null;
    if (viejo.estado === 'presupuestado') {
      ultimoContacto = viejo.alta ?? viejo.inicio;
      if (ultimoContacto === null) {
        avisos.push(
          `${viejo.donde}: no se sabe cuándo se presupuestó (ni el id ni el inicio tienen fecha); Seguimiento va a contar la espera desde hoy.`,
        );
      }
    }

    return {
      viejo,
      id: nuevoId(),
      clienteId: cliente.id,
      clienteNombre: cliente.nombre,
      estado: estadoQueEntra(viejo, deRelleno),
      presupuesto: deRelleno ? null : viejo.presupuesto,
      presupuestoDeRelleno: deRelleno,
      liquidar,
      fechaDeCobro: cobro?.fecha ?? null,
      origenDeLaFechaDeCobro: cobro?.origen ?? '',
      ultimoContacto,
      gastosAImportar,
      insumosANotas: aNotas ? viejo.gastos.length : 0,
      notas: aNotas ? notasDeLosInsumos(viejo.gastos) : '',
      cobrado: suma(viejo.pagos.map((pago) => pago.monto)),
      gastos: suma(gastosAImportar.map((gasto) => gasto.monto)),
    };
  });

  const idsViejos = new Set(sistema.proyectos.map((proyecto) => proyecto.id));
  const repartoViejo = new Map<string, RepartoViejo>();
  const movimientos: MovimientoAImportar[] = [];
  const descartados: MovimientoViejo[] = [];

  for (const viejo of sistema.movimientos) {
    if (viejo.descarte !== null) {
      descartados.push(viejo);
      if (viejo.proyectoId !== null) {
        if (!idsViejos.has(viejo.proyectoId)) {
          avisos.push(
            `${viejo.donde}: es de un proyecto (${viejo.proyectoId}) que ya no está en ${sistema.claves.proyectos}. No entra, pero el sistema viejo lo contaba en sus saldos.`,
          );
        }
        const reparto = repartoViejo.get(viejo.proyectoId) ?? { diezmo: 0, sueldo: 0, fijos: 0 };
        if (viejo.tipo === 'diezmo_generado') reparto.diezmo += viejo.monto;
        if (viejo.tipo === 'sueldo_hogar') reparto.sueldo += viejo.monto;
        if (viejo.tipo === 'fijos_maun') reparto.fijos += viejo.monto;
        repartoViejo.set(viejo.proyectoId, reparto);
      }
      continue;
    }

    const tipo = TIPOS_QUE_ENTRAN.find((entra) => entra === viejo.tipo);
    if (tipo === undefined)
      throw new Error(`${viejo.donde}: el tipo no entra y no tiene motivo de descarte.`);
    movimientos.push({
      viejo,
      id: nuevoId(),
      ...ladosDelTipo(tipo, viejo.monto),
      monto: centavos(Math.abs(viejo.monto)),
      categoria: viejo.categoria,
      descripcion: viejo.concepto,
      fecha: viejo.fecha,
    });
  }

  return {
    sistema,
    clientes,
    proyectos,
    movimientos,
    descartados,
    repartoViejo,
    saldosViejos: saldosDelSistemaViejo(sistema.movimientos),
    avisos: [...sistema.avisos, ...avisos],
  };
}
