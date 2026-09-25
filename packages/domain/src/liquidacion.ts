import { calcularDistribucion, DIEZMO, type Distribucion } from './cascada.ts';
import type { EstadoLiquidado } from './estados.ts';
import { mesDe } from './fechas.ts';
import {
  CERO,
  esNegativo,
  maximo,
  puntosBasicos,
  restar,
  sumar,
  type Money,
  type PuntosBasicos,
} from './money.ts';

export const SIN_DIEZMO: PuntosBasicos = puntosBasicos(0);

export interface Objetivos {
  sueldo: Money;
  fijos: Money;
  sueldoMensual: boolean;
}

export interface LiquidadoDelMes {
  sueldo: Money;
  fijos: Money;
}

export interface Topes {
  topeSueldo: Money;
  topeFijos: Money;
}

export interface AjustesDeLiquidacion {
  sueldoMensual: Money;
  costosFijos: Money;
  sueldoTopeMensual: boolean;
  perdidoConSueldo: boolean;
  perdidoConDiezmo: boolean;
}

export interface Reapertura {
  fecha: string;
  objetivoSueldo: Money;
  objetivoFijos: Money;
  sueldoMensual: boolean;
}

export interface LiquidacionRegistrada {
  estado: EstadoLiquidado;
  fecha: string;
  liquidadaEn: number;
  sueldo: Money;
  fijos: Money;
  objetivoSueldo: Money;
  objetivoFijos: Money;
  sueldoMensual: boolean;
}

export interface PlanDeLiquidacion {
  fecha: string;
  diezmoBp: PuntosBasicos;
  objetivos: Objetivos;
}

export interface EntradaLiquidacion {
  destino: EstadoLiquidado;
  fecha: string;
  cobrado: Money;
  gastos: Money;
  ajustes: AjustesDeLiquidacion;
  reapertura: Reapertura | null;
  liquidaciones: readonly LiquidacionRegistrada[];
}

export interface Liquidacion extends Distribucion {
  destino: EstadoLiquidado;
  fecha: string;
  objetivos: Objetivos;
  previo: LiquidadoDelMes;
}

export interface EscalonDelMes {
  objetivo: Money;
  liquidado: Money;
  falta: Money;
}

export interface ResumenDelMes {
  sueldo: EscalonDelMes;
  fijos: EscalonDelMes;
}

export interface SueldoDelMes {
  pagado: Money;
  esperado: Money;
  cobros: number;
}

const FORMATO_MES = /^\d{4}-(0[1-9]|1[0-2])$/;

function exigirNoNegativo(nombre: string, importe: Money): void {
  if (esNegativo(importe)) {
    throw new RangeError(`${nombre} no puede ser negativo.`);
  }
}

function exigirMes(mes: string): void {
  if (!FORMATO_MES.test(mes)) {
    throw new RangeError(`Un mes va como AAAA-MM: ${mes} no.`);
  }
}

function faltante(objetivo: Money, liquidado: Money): Money {
  return maximo(CERO, restar(objetivo, liquidado));
}

export function topesDeLaLiquidacion(objetivos: Objetivos, previo: LiquidadoDelMes): Topes {
  exigirNoNegativo('El objetivo de sueldo', objetivos.sueldo);
  exigirNoNegativo('El objetivo de costos fijos', objetivos.fijos);
  exigirNoNegativo('El sueldo ya liquidado en el mes', previo.sueldo);
  exigirNoNegativo('Los costos fijos ya liquidados en el mes', previo.fijos);

  return {
    topeSueldo: objetivos.sueldoMensual
      ? faltante(objetivos.sueldo, previo.sueldo)
      : objetivos.sueldo,
    topeFijos: faltante(objetivos.fijos, previo.fijos),
  };
}

export function liquidadoDelMes(
  liquidaciones: readonly LiquidacionRegistrada[],
  mes: string,
): LiquidadoDelMes {
  exigirMes(mes);
  let sueldo = CERO;
  let fijos = CERO;
  for (const liquidacion of liquidaciones) {
    if (mesDe(liquidacion.fecha) === mes) {
      sueldo = sumar(sueldo, liquidacion.sueldo);
      fijos = sumar(fijos, liquidacion.fijos);
    }
  }
  return { sueldo, fijos };
}

export function planDeLiquidacion(
  destino: EstadoLiquidado,
  fecha: string,
  ajustes: AjustesDeLiquidacion,
  reapertura: Reapertura | null,
): PlanDeLiquidacion {
  if (destino === 'perdido') {
    return {
      fecha,
      diezmoBp: ajustes.perdidoConDiezmo ? DIEZMO : SIN_DIEZMO,
      objetivos: {
        sueldo: ajustes.perdidoConSueldo ? ajustes.sueldoMensual : CERO,
        fijos: ajustes.costosFijos,
        sueldoMensual: ajustes.sueldoTopeMensual,
      },
    };
  }

  if (reapertura !== null) {
    return {
      fecha,
      diezmoBp: DIEZMO,
      objetivos: {
        sueldo: reapertura.objetivoSueldo,
        fijos: reapertura.objetivoFijos,
        sueldoMensual: reapertura.sueldoMensual,
      },
    };
  }

  return {
    fecha,
    diezmoBp: DIEZMO,
    objetivos: {
      sueldo: ajustes.sueldoMensual,
      fijos: ajustes.costosFijos,
      sueldoMensual: ajustes.sueldoTopeMensual,
    },
  };
}

export function calcularLiquidacion(entrada: EntradaLiquidacion): Liquidacion {
  const plan = planDeLiquidacion(
    entrada.destino,
    entrada.fecha,
    entrada.ajustes,
    entrada.reapertura,
  );
  const previo = liquidadoDelMes(entrada.liquidaciones, mesDe(plan.fecha));
  const distribucion = calcularDistribucion({
    cobrado: entrada.cobrado,
    gastos: entrada.gastos,
    diezmoBp: plan.diezmoBp,
    ...topesDeLaLiquidacion(plan.objetivos, previo),
  });

  return {
    ...distribucion,
    destino: entrada.destino,
    fecha: plan.fecha,
    objetivos: plan.objetivos,
    previo,
  };
}

function masReciente(
  liquidaciones: readonly LiquidacionRegistrada[],
): LiquidacionRegistrada | undefined {
  let reciente: LiquidacionRegistrada | undefined;
  for (const liquidacion of liquidaciones) {
    if (reciente === undefined || liquidacion.liquidadaEn > reciente.liquidadaEn) {
      reciente = liquidacion;
    }
  }
  return reciente;
}

export function resumenDelMes(
  liquidaciones: readonly LiquidacionRegistrada[],
  mes: string,
  ajustes: Pick<AjustesDeLiquidacion, 'sueldoMensual' | 'costosFijos'>,
  mesEnCurso: string,
): ResumenDelMes {
  exigirMes(mesEnCurso);
  const liquidado = liquidadoDelMes(liquidaciones, mes);
  const delMes = liquidaciones.filter((liquidacion) => mesDe(liquidacion.fecha) === mes);
  const cerrado = mes < mesEnCurso;

  const ultimaConSueldo = cerrado
    ? masReciente(
        delMes.filter(
          (liquidacion) => liquidacion.estado === 'cobrado' || liquidacion.objetivoSueldo > 0,
        ),
      )
    : undefined;
  const ultima = cerrado ? masReciente(delMes) : undefined;

  const objetivoSueldo = ultimaConSueldo?.objetivoSueldo ?? ajustes.sueldoMensual;
  const objetivoFijos = ultima?.objetivoFijos ?? ajustes.costosFijos;

  return {
    sueldo: {
      objetivo: objetivoSueldo,
      liquidado: liquidado.sueldo,
      falta: faltante(objetivoSueldo, liquidado.sueldo),
    },
    fijos: {
      objetivo: objetivoFijos,
      liquidado: liquidado.fijos,
      falta: faltante(objetivoFijos, liquidado.fijos),
    },
  };
}

export function sueldoDelMes(
  liquidaciones: readonly LiquidacionRegistrada[],
  mes: string,
  ajustes: Pick<AjustesDeLiquidacion, 'sueldoMensual' | 'costosFijos'>,
  mesEnCurso: string,
): SueldoDelMes {
  const resumen = resumenDelMes(liquidaciones, mes, ajustes, mesEnCurso);
  const cobros = liquidaciones.filter(
    (liquidacion) => mesDe(liquidacion.fecha) === mes && liquidacion.sueldo > 0,
  ).length;

  return {
    pagado: resumen.sueldo.liquidado,
    esperado: resumen.sueldo.objetivo,
    cobros,
  };
}
