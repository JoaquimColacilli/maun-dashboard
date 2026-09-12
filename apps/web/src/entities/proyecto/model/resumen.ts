import { centavos, faseDe, type Fase, type Money } from '@maun/domain';

import { filasDe, totalesPorProyecto, type FilaDe, type Replica } from '@/shared/api';

import type { Gasto, Pago, Proyecto } from './catalogos';
import { urgenciaDeEntrega, type Urgencia } from './entrega';

export interface ResumenDeProyecto {
  proyecto: Proyecto;
  cliente: FilaDe<'clientes'> | undefined;
  nombreDelCliente: string;
  fase: Fase;
  presupuesto: Money;
  cobrado: Money;
  gastos: Money;
  saldo: Money | null;
  urgencia: Urgencia | undefined;
}

const SIN_CLIENTE = 'Cliente borrado';

function saldoDe(presupuesto: number | null, cobrado: number): Money | null {
  return presupuesto === null ? null : centavos(Math.max(0, presupuesto - cobrado));
}

export function resumenesDeProyectos(replica: Replica, hoy: string): ResumenDeProyecto[] {
  const totales = totalesPorProyecto(replica);
  const clientes = new Map(filasDe(replica, 'clientes').map((cliente) => [cliente.id, cliente]));

  return filasDe(replica, 'proyectos').map((proyecto) => {
    const cliente = clientes.get(proyecto.cliente_id);
    const { cobrado, gastos } = totales.get(proyecto.id) ?? {
      cobrado: centavos(0),
      gastos: centavos(0),
    };

    return {
      proyecto,
      cliente,
      nombreDelCliente: cliente?.nombre ?? SIN_CLIENTE,
      fase: faseDe(proyecto.estado),
      presupuesto: centavos(proyecto.presupuesto_centavos ?? 0),
      cobrado,
      gastos,
      saldo: saldoDe(proyecto.presupuesto_centavos, cobrado),
      urgencia: urgenciaDeEntrega(proyecto.entrega_estimada, proyecto.estado, hoy),
    };
  });
}

export function resumenDeProyecto(
  replica: Replica,
  proyectoId: string,
  hoy: string,
): ResumenDeProyecto | undefined {
  return resumenesDeProyectos(replica, hoy).find((resumen) => resumen.proyecto.id === proyectoId);
}

function delProyecto<T extends Pago | Gasto>(filas: readonly T[], proyectoId: string): T[] {
  return filas
    .filter((fila) => fila.proyecto_id === proyectoId)
    .sort((uno, otro) =>
      uno.fecha < otro.fecha ? -1 : uno.fecha > otro.fecha ? 1 : uno.id < otro.id ? -1 : 1,
    );
}

export function pagosDelProyecto(replica: Replica, proyectoId: string): Pago[] {
  return delProyecto(filasDe(replica, 'pagos'), proyectoId);
}

export function gastosDelProyecto(replica: Replica, proyectoId: string): Gasto[] {
  return delProyecto(filasDe(replica, 'gastos'), proyectoId);
}

export interface MetricasDeProyectos {
  total: number;
  enCurso: number;
  entregadosConSaldo: number;
  cobrados: number;
}

export function metricasDeProyectos(resumenes: readonly ResumenDeProyecto[]): MetricasDeProyectos {
  let total = 0;
  let enCurso = 0;
  let entregadosConSaldo = 0;
  let cobrados = 0;

  for (const resumen of resumenes) {
    if (resumen.fase !== 'seguimiento') total += 1;
    if (resumen.proyecto.estado === 'en_curso') enCurso += 1;
    if (resumen.proyecto.estado === 'entregado' && (resumen.saldo ?? 0) > 0) {
      entregadosConSaldo += 1;
    }
    if (resumen.proyecto.estado === 'cobrado') cobrados += 1;
  }

  return { total, enCurso, entregadosConSaldo, cobrados };
}
