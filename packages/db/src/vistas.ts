import {
  saldosDelLibro,
  type DatosDelLibro,
  type EstadoLiquidado,
  type LiquidacionRegistrada,
  type Money,
  type SaldosPorTesoro,
} from '@maun/domain';

import { dinero } from './dinero.ts';
import { ajustesDe, filasDe, type FilaDe, type Replica } from './replica.ts';

export function datosDelLibro(replica: Replica): DatosDelLibro {
  return {
    movimientos: filasDe(replica, 'movimientos').map((movimiento) => ({
      id: movimiento.id,
      fecha: movimiento.fecha,
      tipo: movimiento.tipo,
      tesoroOrigen: movimiento.tesoro_origen,
      tesoroDestino: movimiento.tesoro_destino,
      monto: dinero(movimiento.monto_centavos),
      categoria: movimiento.categoria,
      descripcion: movimiento.descripcion,
      proyectoId: movimiento.proyecto_id,
    })),
    pagos: filasDe(replica, 'pagos').map((pago) => ({
      id: pago.id,
      proyectoId: pago.proyecto_id,
      fecha: pago.fecha,
      concepto: pago.concepto,
      monto: dinero(pago.monto_centavos),
    })),
    gastos: filasDe(replica, 'gastos').map((gasto) => ({
      id: gasto.id,
      proyectoId: gasto.proyecto_id,
      fecha: gasto.fecha,
      descripcion: gasto.descripcion,
      monto: dinero(gasto.monto_centavos),
    })),
    proyectos: filasDe(replica, 'proyectos').map((proyecto) => ({
      id: proyecto.id,
      titulo: proyecto.titulo,
      estado: proyecto.estado,
      fechaCobro: proyecto.fecha_cobro,
      diezmo: dinero(proyecto.dist_diezmo_centavos ?? 0),
      sueldo: dinero(proyecto.dist_sueldo_centavos ?? 0),
    })),
  };
}

export function saldosDeLaReplica(replica: Replica): SaldosPorTesoro {
  return saldosDelLibro(datosDelLibro(replica));
}

function liquidacionDe(proyecto: FilaDe<'proyectos'>): LiquidacionRegistrada | undefined {
  const {
    estado,
    fecha_cobro: fecha,
    dist_liquidado_at: liquidadaEn,
    dist_sueldo_centavos: sueldo,
    dist_fijos_centavos: fijos,
    dist_objetivo_sueldo_centavos: objetivoSueldo,
    dist_objetivo_fijos_centavos: objetivoFijos,
  } = proyecto;

  if (estado !== 'cobrado' && estado !== 'perdido') return undefined;
  if (
    fecha === null ||
    liquidadaEn === null ||
    sueldo === null ||
    fijos === null ||
    objetivoSueldo === null ||
    objetivoFijos === null
  ) {
    return undefined;
  }

  return {
    estado: estado satisfies EstadoLiquidado,
    fecha,
    liquidadaEn: Date.parse(liquidadaEn),
    sueldo: dinero(sueldo),
    fijos: dinero(fijos),
    objetivoSueldo: dinero(objetivoSueldo),
    objetivoFijos: dinero(objetivoFijos),
  };
}

export function liquidacionesDeLaReplica(replica: Replica): LiquidacionRegistrada[] {
  const liquidaciones: LiquidacionRegistrada[] = [];
  for (const proyecto of filasDe(replica, 'proyectos')) {
    const liquidacion = liquidacionDe(proyecto);
    if (liquidacion) liquidaciones.push(liquidacion);
  }
  return liquidaciones;
}

export function objetivosDeLaReplica(replica: Replica): {
  sueldoMensual: Money;
  costosFijos: Money;
} {
  const ajustes = ajustesDe(replica);
  return {
    sueldoMensual: dinero(ajustes?.sueldo_mensual_centavos ?? 0),
    costosFijos: dinero(ajustes?.costos_fijos_centavos ?? 0),
  };
}
