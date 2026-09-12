import type { EstadoProyecto, Liquidacion, Money } from '@maun/domain';

import {
  COLUMNAS_DE_PROYECTO,
  dinero,
  type DatosDeProyecto,
  type PedidoDeLiquidacion,
  type PedidoDeReversion,
} from '@/shared/api';

import type { Proyecto } from './catalogos';

// guardar_proyecto escribe la fila entera (ADR 0015), así que registrar el pago final desde la
// pantalla de cobro tiene que mandar las columnas como están, sin tocarlas.
export function datosActualesDelProyecto(proyecto: Proyecto): DatosDeProyecto {
  const datos = {} as Record<string, unknown>;
  for (const columna of COLUMNAS_DE_PROYECTO) datos[columna] = proyecto[columna];
  return datos as DatosDeProyecto;
}

export interface DiferenciaDelAjuste {
  id: 'sueldo' | 'fijos';
  etiqueta: string;
  esperado: Money;
  quedo: Money;
  yaLlevabaElMes: Money;
}

export interface AjusteDeLaLiquidacion {
  diferencias: readonly DiferenciaDelAjuste[];
  remanenteEsperado: Money;
  remanenteQuedo: Money;
}

// Lo que viaja a cobrar_proyecto o a cerrar_perdido es exactamente lo que se le mostró al usuario,
// más el acumulado del mes que la app vio. Si ese acumulado no es el de la base, la liquidación
// vuelve ajustada en vez de rechazada (ADR 0011 y 0016).
export function pedidoDeLiquidacion(
  proyecto: Proyecto,
  liquidacion: Liquidacion,
): PedidoDeLiquidacion {
  return {
    proyectoId: proyecto.id,
    version: proyecto.version,
    destino: liquidacion.destino,
    fecha: liquidacion.fecha,
    cobradoCentavos: liquidacion.cobrado,
    gastosCentavos: liquidacion.gastos,
    topeSueldoCentavos: liquidacion.topeSueldo,
    topeFijosCentavos: liquidacion.topeFijos,
    diezmoBp: liquidacion.diezmoBp,
    diezmoCentavos: liquidacion.diezmo,
    sueldoCentavos: liquidacion.sueldo,
    fijosCentavos: liquidacion.fijos,
    remanenteCentavos: liquidacion.remanente,
    sueldoPrevioCentavos: liquidacion.previo.sueldo,
    fijosPrevioCentavos: liquidacion.previo.fijos,
  };
}

export function pedidoDeReversion(proyecto: Proyecto, hacia: EstadoProyecto): PedidoDeReversion {
  return {
    proyectoId: proyecto.id,
    version: proyecto.version,
    desde: proyecto.estado === 'perdido' ? 'perdido' : 'cobrado',
    hacia,
  };
}

// La fila que la app escribe en su réplica antes de que el servidor conteste: la misma que va a
// escribir private.liquidar. La versión sube acá también, así una reapertura hecha a continuación y
// sin señal manda la versión que el servidor va a tener cuando la cola llegue.
export function filaLiquidada(
  proyecto: Proyecto,
  liquidacion: Liquidacion,
  liquidadaEn: string,
): Proyecto {
  return {
    ...proyecto,
    estado: liquidacion.destino,
    version: proyecto.version + 1,
    updated_at: liquidadaEn,
    fecha_cobro: liquidacion.fecha,
    dist_cobrado_centavos: liquidacion.cobrado,
    dist_gastos_centavos: liquidacion.gastos,
    dist_diezmo_bp: liquidacion.diezmoBp,
    dist_tope_sueldo_centavos: liquidacion.topeSueldo,
    dist_tope_fijos_centavos: liquidacion.topeFijos,
    dist_diezmo_centavos: liquidacion.diezmo,
    dist_sueldo_centavos: liquidacion.sueldo,
    dist_fijos_centavos: liquidacion.fijos,
    dist_remanente_centavos: liquidacion.remanente,
    dist_objetivo_sueldo_centavos: liquidacion.objetivos.sueldo,
    dist_objetivo_fijos_centavos: liquidacion.objetivos.fijos,
    dist_sueldo_mensual: liquidacion.objetivos.sueldoMensual,
    dist_sueldo_previo_centavos: liquidacion.previo.sueldo,
    dist_fijos_previo_centavos: liquidacion.previo.fijos,
    dist_liquidado_at: liquidadaEn,
    reapertura_objetivo_sueldo_centavos: null,
    reapertura_objetivo_fijos_centavos: null,
    reapertura_sueldo_mensual: null,
    reapertura_fecha_cobro: null,
  };
}

// Reabrir un cobro guarda la foto del cobro original; reactivar un perdido no guarda nada, porque un
// lead que revive es un lead vivo y un cierre posterior es otro evento (ADR 0011).
export function filaRevertida(
  proyecto: Proyecto,
  hacia: EstadoProyecto,
  revertidaEn: string,
): Proyecto {
  const desdeUnCobro = proyecto.estado === 'cobrado';
  return {
    ...proyecto,
    estado: hacia,
    version: proyecto.version + 1,
    updated_at: revertidaEn,
    reapertura_objetivo_sueldo_centavos: desdeUnCobro
      ? proyecto.dist_objetivo_sueldo_centavos
      : null,
    reapertura_objetivo_fijos_centavos: desdeUnCobro ? proyecto.dist_objetivo_fijos_centavos : null,
    reapertura_sueldo_mensual: desdeUnCobro ? proyecto.dist_sueldo_mensual : null,
    reapertura_fecha_cobro: desdeUnCobro ? proyecto.fecha_cobro : null,
    fecha_cobro: null,
    dist_cobrado_centavos: null,
    dist_gastos_centavos: null,
    dist_diezmo_bp: null,
    dist_tope_sueldo_centavos: null,
    dist_tope_fijos_centavos: null,
    dist_diezmo_centavos: null,
    dist_sueldo_centavos: null,
    dist_fijos_centavos: null,
    dist_remanente_centavos: null,
    dist_objetivo_sueldo_centavos: null,
    dist_objetivo_fijos_centavos: null,
    dist_sueldo_mensual: null,
    dist_sueldo_previo_centavos: null,
    dist_fijos_previo_centavos: null,
    dist_liquidado_at: null,
  };
}

// La base no devuelve una marca de «ajustada»: devuelve la fila congelada. Comparando el acumulado
// que quedó congelado contra el que se mandó, la app sabe que otra liquidación del mes se llevó una
// parte, y con los escalones tiene la diferencia en plata.
export function ajusteDeLaLiquidacion(
  fila: Proyecto,
  pedido: PedidoDeLiquidacion,
): AjusteDeLaLiquidacion | undefined {
  const sueldoPrevio = fila.dist_sueldo_previo_centavos;
  const fijosPrevio = fila.dist_fijos_previo_centavos;
  if (sueldoPrevio === null || fijosPrevio === null) return undefined;
  if (sueldoPrevio === pedido.sueldoPrevioCentavos && fijosPrevio === pedido.fijosPrevioCentavos) {
    return undefined;
  }

  const escalones: readonly {
    id: 'sueldo' | 'fijos';
    etiqueta: string;
    esperado: number;
    quedo: number | null;
    previo: number;
  }[] = [
    {
      id: 'sueldo',
      etiqueta: 'Sueldo',
      esperado: pedido.sueldoCentavos,
      quedo: fila.dist_sueldo_centavos,
      previo: sueldoPrevio,
    },
    {
      id: 'fijos',
      etiqueta: 'Costos fijos',
      esperado: pedido.fijosCentavos,
      quedo: fila.dist_fijos_centavos,
      previo: fijosPrevio,
    },
  ];

  const diferencias = escalones
    .filter((escalon) => (escalon.quedo ?? 0) !== escalon.esperado)
    .map((escalon) => ({
      id: escalon.id,
      etiqueta: escalon.etiqueta,
      esperado: dinero(escalon.esperado),
      quedo: dinero(escalon.quedo ?? 0),
      yaLlevabaElMes: dinero(escalon.previo),
    }));

  if (diferencias.length === 0) return undefined;

  return {
    diferencias,
    remanenteEsperado: dinero(pedido.remanenteCentavos),
    remanenteQuedo: dinero(fila.dist_remanente_centavos ?? 0),
  };
}
