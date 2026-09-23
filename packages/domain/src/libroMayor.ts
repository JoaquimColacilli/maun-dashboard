import { estaLiquidado, type EstadoProyecto } from './estados.ts';
import { mesDe } from './fechas.ts';
import { BASE_PUNTOS_BASICOS, CERO, centavos, restar, sumar, type Money } from './money.ts';

export const TESOROS = ['hogar', 'maun', 'diezmo', 'cocos'] as const;

export type Tesoro = (typeof TESOROS)[number];

export const CATEGORIA_DE_APERTURA = 'Apertura';

export type OrigenDeAsiento = 'manual' | 'pago' | 'gasto_proyecto' | 'distribucion';

export interface MovimientoDelLibro {
  id: string;
  fecha: string;
  tipo: string;
  tesoroOrigen: Tesoro | null;
  tesoroDestino: Tesoro | null;
  monto: Money;
  categoria: string;
  descripcion: string;
  proyectoId: string | null;
}

export interface PagoDelLibro {
  id: string;
  proyectoId: string;
  fecha: string;
  concepto: string;
  monto: Money;
  yaEnLaApertura: boolean;
}

export interface GastoDelLibro {
  id: string;
  proyectoId: string;
  fecha: string;
  descripcion: string;
  monto: Money;
}

export interface ProyectoDelLibro {
  id: string;
  titulo: string;
  estado: EstadoProyecto;
  fechaCobro: string | null;
  diezmo: Money;
  sueldo: Money;
  repartoYaEnLaApertura: boolean;
}

export interface DatosDelLibro {
  movimientos: readonly MovimientoDelLibro[];
  pagos: readonly PagoDelLibro[];
  gastos: readonly GastoDelLibro[];
  proyectos: readonly ProyectoDelLibro[];
}

export interface Asiento {
  origen: OrigenDeAsiento;
  asientoId: string;
  fecha: string;
  tesoro: Tesoro;
  contrapartida: Tesoro | null;
  monto: Money;
  concepto: string;
  categoria: string;
  descripcion: string;
  proyectoId: string | null;
  yaEnLaApertura: boolean;
}

export interface LineaDelLibro {
  origen: OrigenDeAsiento;
  asientoId: string;
  fecha: string;
  desde: Tesoro | null;
  hacia: Tesoro | null;
  monto: Money;
  concepto: string;
  categoria: string;
  descripcion: string;
  proyectoId: string | null;
  yaEnLaApertura: boolean;
}

export type SaldosPorTesoro = Readonly<Record<Tesoro, Money>>;

function negativo(importe: Money): Money {
  return restar(CERO, importe);
}

export function lineasDelLibro(datos: DatosDelLibro): LineaDelLibro[] {
  const lineas: LineaDelLibro[] = [];

  for (const movimiento of datos.movimientos) {
    lineas.push({
      origen: 'manual',
      asientoId: movimiento.id,
      fecha: movimiento.fecha,
      desde: movimiento.tesoroOrigen,
      hacia: movimiento.tesoroDestino,
      monto: movimiento.monto,
      concepto: movimiento.tipo,
      categoria: movimiento.categoria,
      descripcion: movimiento.descripcion,
      proyectoId: movimiento.proyectoId,
      yaEnLaApertura: false,
    });
  }

  const proyectos = new Map(datos.proyectos.map((proyecto) => [proyecto.id, proyecto]));

  for (const pago of datos.pagos) {
    if (!proyectos.has(pago.proyectoId)) continue;
    lineas.push({
      origen: 'pago',
      asientoId: pago.id,
      fecha: pago.fecha,
      desde: null,
      hacia: 'maun',
      monto: pago.monto,
      concepto: 'cobro',
      categoria: 'Cobro',
      descripcion: pago.concepto,
      proyectoId: pago.proyectoId,
      yaEnLaApertura: pago.yaEnLaApertura,
    });
  }

  for (const gasto of datos.gastos) {
    if (!proyectos.has(gasto.proyectoId)) continue;
    lineas.push({
      origen: 'gasto_proyecto',
      asientoId: gasto.id,
      fecha: gasto.fecha,
      desde: 'maun',
      hacia: null,
      monto: gasto.monto,
      concepto: 'gasto',
      categoria: 'Materiales',
      descripcion: gasto.descripcion,
      proyectoId: gasto.proyectoId,
      yaEnLaApertura: false,
    });
  }

  for (const proyecto of datos.proyectos) {
    if (!estaLiquidado(proyecto.estado) || proyecto.fechaCobro === null) continue;

    const escalones: readonly [Tesoro, Money, string][] = [
      ['diezmo', proyecto.diezmo, 'diezmo'],
      ['hogar', proyecto.sueldo, 'sueldo'],
    ];

    for (const [hacia, monto, concepto] of escalones) {
      if (monto === 0) continue;
      lineas.push({
        origen: 'distribucion',
        asientoId: proyecto.id,
        fecha: proyecto.fechaCobro,
        desde: 'maun',
        hacia,
        monto,
        concepto,
        categoria: 'Distribución',
        descripcion: proyecto.titulo,
        proyectoId: proyecto.id,
        yaEnLaApertura: proyecto.repartoYaEnLaApertura,
      });
    }
  }

  return lineas;
}

export function asientosDeLaLinea(linea: LineaDelLibro): Asiento[] {
  const comun = {
    origen: linea.origen,
    asientoId: linea.asientoId,
    fecha: linea.fecha,
    concepto: linea.concepto,
    categoria: linea.categoria,
    descripcion: linea.descripcion,
    proyectoId: linea.proyectoId,
    yaEnLaApertura: linea.yaEnLaApertura,
  };

  const asientos: Asiento[] = [];
  if (linea.hacia !== null) {
    asientos.push({
      ...comun,
      tesoro: linea.hacia,
      contrapartida: linea.desde,
      monto: linea.monto,
    });
  }
  if (linea.desde !== null) {
    asientos.push({
      ...comun,
      tesoro: linea.desde,
      contrapartida: linea.hacia,
      monto: negativo(linea.monto),
    });
  }
  return asientos;
}

export function asientosDelLibro(datos: DatosDelLibro): Asiento[] {
  return lineasDelLibro(datos).flatMap(asientosDeLaLinea);
}

export function mueveLosTesoros(asiento: Asiento): boolean {
  return !asiento.yaEnLaApertura;
}

export function saldosPorTesoro(asientos: readonly Asiento[]): SaldosPorTesoro {
  const saldos: Record<Tesoro, Money> = { hogar: CERO, maun: CERO, diezmo: CERO, cocos: CERO };
  for (const asiento of asientos.filter(mueveLosTesoros)) {
    saldos[asiento.tesoro] = sumar(saldos[asiento.tesoro], asiento.monto);
  }
  return saldos;
}

export function fechaDeApertura(movimientos: readonly MovimientoDelLibro[]): string | null {
  let apertura: string | null = null;
  for (const movimiento of movimientos) {
    if (movimiento.tipo !== 'ajuste' || movimiento.categoria !== CATEGORIA_DE_APERTURA) continue;
    if (apertura === null || movimiento.fecha < apertura) apertura = movimiento.fecha;
  }
  return apertura;
}

export function esAnteriorALaApertura(fecha: string, apertura: string | null): boolean {
  return apertura !== null && fecha < apertura;
}

export function saldosDelLibro(datos: DatosDelLibro): SaldosPorTesoro {
  return saldosPorTesoro(asientosDelLibro(datos));
}

export function asientosDelMes(asientos: readonly Asiento[], mes: string): Asiento[] {
  return asientos.filter((asiento) => mesDe(asiento.fecha) === mes);
}

export interface EntradasYSalidas {
  entro: Money;
  salio: Money;
}

export function entradasYSalidas(asientos: readonly Asiento[], tesoro: Tesoro): EntradasYSalidas {
  let entro = CERO;
  let salio = CERO;

  for (const asiento of asientos) {
    if (asiento.tesoro !== tesoro) continue;
    if (asiento.monto >= 0) entro = sumar(entro, asiento.monto);
    else salio = sumar(salio, negativo(asiento.monto));
  }

  return { entro, salio };
}

export type SituacionDelDiezmo = 'debe' | 'al-dia' | 'pago-de-mas';

export interface EstadoDelDiezmo {
  situacion: SituacionDelDiezmo;
  importe: Money;
  generado: Money;
  pagado: Money;
}

export function estadoDelDiezmo(asientos: readonly Asiento[]): EstadoDelDiezmo {
  const { entro, salio } = entradasYSalidas(asientos.filter(mueveLosTesoros), 'diezmo');
  const saldo = restar(entro, salio);
  return {
    situacion: saldo > 0 ? 'debe' : saldo < 0 ? 'pago-de-mas' : 'al-dia',
    importe: saldo < 0 ? negativo(saldo) : saldo,
    generado: entro,
    pagado: salio,
  };
}

export function proyeccionCocos(saldo: Money, tasaAnualBp: number, dias: number): Money {
  if (!Number.isInteger(tasaAnualBp) || tasaAnualBp < 0) {
    throw new RangeError(`La tasa anual va en puntos básicos enteros: ${String(tasaAnualBp)} no.`);
  }
  if (dias <= 0 || tasaAnualBp === 0) return saldo;
  const factor = (1 + tasaAnualBp / BASE_PUNTOS_BASICOS) ** (dias / 365);
  return centavos(Math.round(saldo * factor));
}
