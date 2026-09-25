import {
  analisisDeEntregas,
  fechaDeApertura,
  saldosDelLibro,
  type AnalisisDeEntregas,
  type CambioDeFechaParaElAnalisis,
  type DatosDelLibro,
  type EstadoLiquidado,
  type LiquidacionRegistrada,
  type Money,
  type SaldosPorTesoro,
  type TrabajoParaElAnalisis,
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
      yaEnLaApertura: (pago as Partial<typeof pago>).ya_en_la_apertura === true,
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
      repartoYaEnLaApertura:
        (proyecto as Partial<typeof proyecto>).reparto_ya_en_la_apertura === true,
    })),
  };
}

export function saldosDeLaReplica(replica: Replica): SaldosPorTesoro {
  return saldosDelLibro(datosDelLibro(replica));
}

export function aperturaDeLaReplica(replica: Replica): string | null {
  return fechaDeApertura(datosDelLibro(replica).movimientos);
}

export interface TotalesDelProyecto {
  cobrado: Money;
  gastos: Money;
}

export function totalesPorProyecto(replica: Replica): Map<string, TotalesDelProyecto> {
  const cobrado = new Map<string, number>();
  const gastos = new Map<string, number>();

  for (const pago of filasDe(replica, 'pagos')) {
    cobrado.set(pago.proyecto_id, (cobrado.get(pago.proyecto_id) ?? 0) + pago.monto_centavos);
  }
  for (const gasto of filasDe(replica, 'gastos')) {
    gastos.set(gasto.proyecto_id, (gastos.get(gasto.proyecto_id) ?? 0) + gasto.monto_centavos);
  }

  const totales = new Map<string, TotalesDelProyecto>();
  for (const proyecto of filasDe(replica, 'proyectos')) {
    totales.set(proyecto.id, {
      cobrado: dinero(cobrado.get(proyecto.id) ?? 0),
      gastos: dinero(gastos.get(proyecto.id) ?? 0),
    });
  }
  return totales;
}

export function totalesDelProyecto(replica: Replica, proyectoId: string): TotalesDelProyecto {
  return totalesPorProyecto(replica).get(proyectoId) ?? { cobrado: dinero(0), gastos: dinero(0) };
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
    dist_sueldo_mensual: sueldoMensual,
  } = proyecto;

  if (estado !== 'cobrado' && estado !== 'perdido') return undefined;
  if (
    fecha === null ||
    liquidadaEn === null ||
    sueldo === null ||
    fijos === null ||
    objetivoSueldo === null ||
    objetivoFijos === null ||
    sueldoMensual === null
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
    sueldoMensual,
  };
}

export function liquidacionesDeLaReplica(
  replica: Replica,
  excepto?: string,
): LiquidacionRegistrada[] {
  const liquidaciones: LiquidacionRegistrada[] = [];
  for (const proyecto of filasDe(replica, 'proyectos')) {
    if (proyecto.id === excepto) continue;
    const liquidacion = liquidacionDe(proyecto);
    if (liquidacion) liquidaciones.push(liquidacion);
  }
  return liquidaciones;
}

export interface DatosDelAnalisis {
  trabajos: TrabajoParaElAnalisis[];
  cambios: CambioDeFechaParaElAnalisis[];
}

export function datosDelAnalisis(replica: Replica): DatosDelAnalisis {
  return {
    trabajos: filasDe(replica, 'proyectos').map((proyecto) => {
      const quizas = proyecto as Partial<typeof proyecto>;
      return {
        id: proyecto.id,
        titulo: proyecto.titulo,
        tipo: quizas.tipo_de_proyecto ?? null,
        estado: proyecto.estado,
        inicio: proyecto.fecha_inicio,
        listo: quizas.listo_el ?? null,
        entregado: proyecto.fecha_entrega,
      };
    }),
    cambios: filasDe(replica, 'cambios_de_fecha').map((cambio) => ({
      id: cambio.id,
      proyectoId: cambio.proyecto_id,
      tipo: cambio.tipo,
      fecha: cambio.fecha,
      origen: cambio.origen,
      creadoEn: cambio.created_at,
      trabajosEnCurso: cambio.trabajos_en_curso,
    })),
  };
}

export function analisisDeLaReplica(replica: Replica): AnalisisDeEntregas {
  const { trabajos, cambios } = datosDelAnalisis(replica);
  return analisisDeEntregas(trabajos, cambios);
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
