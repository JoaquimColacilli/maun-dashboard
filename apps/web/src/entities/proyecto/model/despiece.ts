import {
  calcularLiquidacion,
  centavos,
  esAnteriorALaApertura,
  estaLiquidado,
  puntosBasicos,
  sumar,
  type AjustesDeLiquidacion,
  type Distribucion,
  type EstadoLiquidado,
  type Liquidacion,
  type Money,
  type Reapertura,
  type Tesoro,
} from '@maun/domain';

import {
  ajustesDe,
  dinero,
  filasDe,
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

export function reaperturaDe(proyecto: Proyecto): Reapertura | null {
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

export function fechaDelCobroPropuesta(
  replica: Replica,
  proyecto: Proyecto,
  hoy: string,
  pagoFinal: string | null = null,
): string {
  const reapertura = reaperturaDe(proyecto);
  if (reapertura !== null) return reapertura.fecha;

  let ultima: string | null = pagoFinal !== null && pagoFinal !== '' ? pagoFinal : null;
  for (const pago of filasDe(replica, 'pagos')) {
    if (pago.proyecto_id !== proyecto.id) continue;
    if (ultima === null || pago.fecha > ultima) ultima = pago.fecha;
  }
  if (ultima === null || ultima > hoy) return hoy;
  return ultima;
}

export function repartoEnLaAperturaPropuesto(
  proyecto: Proyecto,
  fecha: string,
  apertura: string | null,
): boolean {
  if (!esAnteriorALaApertura(fecha, apertura)) return false;
  if (reaperturaDe(proyecto) === null) return true;
  return (proyecto as Partial<Proyecto>).reparto_ya_en_la_apertura === true;
}

export interface OpcionesDeProyeccion {
  destino?: EstadoLiquidado;
  pagoExtra?: Money;
}

export function liquidacionProyectada(
  replica: Replica,
  proyecto: Proyecto,
  fecha: string,
  { destino = 'cobrado', pagoExtra = centavos(0) }: OpcionesDeProyeccion = {},
): Liquidacion {
  const { cobrado, gastos } = totalesDelProyecto(replica, proyecto.id);
  return calcularLiquidacion({
    destino,
    fecha,
    cobrado: sumar(cobrado, pagoExtra),
    gastos,
    ajustes: ajustesDeLaReplica(replica),
    reapertura: reaperturaDe(proyecto),
    liquidaciones: liquidacionesDeLaReplica(replica, proyecto.id),
  });
}

export function despieceDeLaLiquidacion(liquidacion: Liquidacion): Despiece {
  return {
    modo: 'proyeccion',
    cobrado: liquidacion.cobrado,
    gastos: liquidacion.gastos,
    neta: liquidacion.neta,
    piezas: piezasDe(liquidacion),
  };
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

  const proyectada = liquidacionProyectada(
    replica,
    proyecto,
    fechaDelCobroPropuesta(replica, proyecto, hoy),
  );
  return {
    modo: 'proyeccion',
    cobrado: proyectada.cobrado,
    gastos: proyectada.gastos,
    neta: proyectada.neta,
    piezas: piezasDe(proyectada),
  };
}
