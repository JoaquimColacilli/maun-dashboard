import {
  calcularLiquidacion,
  centavos,
  estaLiquidado,
  puntosBasicos,
  type AjustesDeLiquidacion,
  type Distribucion,
  type Liquidacion,
  type Money,
  type Reapertura,
  type Tesoro,
} from '@maun/domain';

import {
  ajustesDe,
  dinero,
  liquidacionesDeLaReplica,
  totalesDelProyecto,
  type Replica,
} from '@/shared/api';

import type { Proyecto } from './catalogos';

export interface PiezaDelDespiece {
  id: 'diezmo' | 'sueldo' | 'fijos' | 'remanente';
  etiqueta: string;
  tesoro: Tesoro;
  monto: Money;
  falta: Money;
  parte: number;
}

export interface Despiece {
  modo: 'real' | 'proyeccion';
  cobrado: Money;
  gastos: Money;
  neta: Money;
  piezas: readonly PiezaDelDespiece[];
}

const AJUSTES_EN_CERO: AjustesDeLiquidacion = {
  sueldoMensual: centavos(0),
  costosFijos: centavos(0),
  sueldoTopeMensual: false,
  perdidoConSueldo: false,
  perdidoConDiezmo: true,
};

export function ajustesDeLaReplica(replica: Replica): AjustesDeLiquidacion {
  const ajustes = ajustesDe(replica);
  if (!ajustes) return AJUSTES_EN_CERO;
  return {
    sueldoMensual: dinero(ajustes.sueldo_mensual_centavos),
    costosFijos: dinero(ajustes.costos_fijos_centavos),
    sueldoTopeMensual: ajustes.sueldo_tope_mensual,
    perdidoConSueldo: ajustes.perdido_con_sueldo,
    perdidoConDiezmo: ajustes.perdido_con_diezmo,
  };
}

function reaperturaDe(proyecto: Proyecto): Reapertura | null {
  const {
    reapertura_fecha_cobro: fecha,
    reapertura_objetivo_sueldo_centavos: sueldo,
    reapertura_objetivo_fijos_centavos: fijos,
    reapertura_sueldo_mensual: mensual,
  } = proyecto;
  if (fecha === null || sueldo === null || fijos === null || mensual === null) return null;
  return {
    fecha,
    objetivoSueldo: dinero(sueldo),
    objetivoFijos: dinero(fijos),
    sueldoMensual: mensual,
  };
}

// La proyección se calcula como la va a calcular el cobro: con calcularLiquidacion del dominio, y
// contando las liquidaciones que ya lleva el mes (incluidas las que todavía están en la cola, que
// la réplica ya tiene aplicadas). No se porta el despiece del diseño, que reparte sobre el
// presupuesto en vez de sobre lo cobrado (ADR 0003 y 0011).
export function liquidacionProyectada(
  replica: Replica,
  proyecto: Proyecto,
  hoy: string,
): Liquidacion {
  const { cobrado, gastos } = totalesDelProyecto(replica, proyecto.id);
  return calcularLiquidacion({
    destino: 'cobrado',
    fecha: hoy,
    cobrado,
    gastos,
    ajustes: ajustesDeLaReplica(replica),
    reapertura: reaperturaDe(proyecto),
    liquidaciones: liquidacionesDeLaReplica(replica, proyecto.id),
  });
}

function piezasDe(distribucion: Distribucion): PiezaDelDespiece[] {
  const base = distribucion.neta > 0 ? distribucion.neta : 0;
  const parte = (monto: Money) => (base === 0 ? 0 : monto / base);

  return [
    {
      id: 'diezmo',
      etiqueta: 'Diezmo 10%',
      tesoro: 'diezmo',
      monto: distribucion.diezmo,
      falta: centavos(0),
      parte: parte(distribucion.diezmo),
    },
    {
      id: 'sueldo',
      etiqueta: 'Sueldo',
      tesoro: 'hogar',
      monto: distribucion.sueldo,
      falta: distribucion.faltaSueldo,
      parte: parte(distribucion.sueldo),
    },
    {
      id: 'fijos',
      etiqueta: 'Costos fijos',
      tesoro: 'maun',
      monto: distribucion.fijos,
      falta: distribucion.faltaFijos,
      parte: parte(distribucion.fijos),
    },
    {
      id: 'remanente',
      etiqueta: 'Remanente del taller',
      tesoro: 'maun',
      monto: distribucion.remanente,
      falta: centavos(0),
      parte: parte(distribucion.remanente > 0 ? distribucion.remanente : centavos(0)),
    },
  ];
}

// Un proyecto liquidado muestra lo que quedó congelado, no una cuenta nueva: los ajustes de hoy no
// reescriben un cobro viejo (ADR 0003). El resto muestra la proyección, atenuada.
export function despieceDelProyecto(replica: Replica, proyecto: Proyecto, hoy: string): Despiece {
  if (estaLiquidado(proyecto.estado) && proyecto.dist_cobrado_centavos !== null) {
    const congelada: Distribucion = {
      cobrado: dinero(proyecto.dist_cobrado_centavos),
      gastos: dinero(proyecto.dist_gastos_centavos ?? 0),
      diezmoBp: puntosBasicos(proyecto.dist_diezmo_bp ?? 0),
      topeSueldo: dinero(proyecto.dist_tope_sueldo_centavos ?? 0),
      topeFijos: dinero(proyecto.dist_tope_fijos_centavos ?? 0),
      neta: dinero(proyecto.dist_cobrado_centavos - (proyecto.dist_gastos_centavos ?? 0)),
      diezmo: dinero(proyecto.dist_diezmo_centavos ?? 0),
      sueldo: dinero(proyecto.dist_sueldo_centavos ?? 0),
      fijos: dinero(proyecto.dist_fijos_centavos ?? 0),
      remanente: dinero(proyecto.dist_remanente_centavos ?? 0),
      faltaSueldo: dinero(
        (proyecto.dist_tope_sueldo_centavos ?? 0) - (proyecto.dist_sueldo_centavos ?? 0),
      ),
      faltaFijos: dinero(
        (proyecto.dist_tope_fijos_centavos ?? 0) - (proyecto.dist_fijos_centavos ?? 0),
      ),
    };
    return {
      modo: 'real',
      cobrado: congelada.cobrado,
      gastos: congelada.gastos,
      neta: congelada.neta,
      piezas: piezasDe(congelada),
    };
  }

  const proyectada = liquidacionProyectada(replica, proyecto, hoy);
  return {
    modo: 'proyeccion',
    cobrado: proyectada.cobrado,
    gastos: proyectada.gastos,
    neta: proyectada.neta,
    piezas: piezasDe(proyectada),
  };
}
