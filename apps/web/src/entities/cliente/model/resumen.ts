import { centavos, faseDe, type EstadoProyecto, type Money } from '@maun/domain';

import { filasDe, type FilaDe, type Replica } from '@/shared/api';

import type { Cliente } from './catalogos';

export type Proyecto = FilaDe<'proyectos'>;

const ESTADOS_CON_SALDO: readonly EstadoProyecto[] = ['en_curso', 'entregado'];

export interface ResumenDeCliente {
  cliente: Cliente;
  proyectos: readonly Proyecto[];
  enSeguimiento: number;
  facturados: number;
  ultimo: Proyecto | undefined;
  fechaDelUltimo: string | undefined;
  facturado: Money;
  saldo: Money;
}

// La fecha con la que se ordena el historial y se cuenta "el último trabajo": la primera que el
// proyecto tenga, de la más definitiva a la más tentativa.
export function fechaDelProyecto(proyecto: Proyecto): string | undefined {
  return (
    proyecto.fecha_cobro ??
    proyecto.fecha_entrega ??
    proyecto.fecha_inicio ??
    proyecto.fecha_visita ??
    proyecto.ultimo_contacto ??
    undefined
  );
}

export function cobradoDelProyecto(pagos: readonly FilaDe<'pagos'>[], proyectoId: string): number {
  let total = 0;
  for (const pago of pagos) {
    if (pago.proyecto_id === proyectoId) total += pago.monto_centavos;
  }
  return total;
}

function masReciente(uno: Proyecto, otro: Proyecto): number {
  const a = fechaDelProyecto(otro) ?? '';
  const b = fechaDelProyecto(uno) ?? '';
  if (a !== b) return a < b ? -1 : 1;
  return uno.id < otro.id ? 1 : -1;
}

export function resumenesDeClientes(replica: Replica): ResumenDeCliente[] {
  const pagos = filasDe(replica, 'pagos');
  const porCliente = new Map<string, Proyecto[]>();
  for (const proyecto of filasDe(replica, 'proyectos')) {
    const lista = porCliente.get(proyecto.cliente_id);
    if (lista) lista.push(proyecto);
    else porCliente.set(proyecto.cliente_id, [proyecto]);
  }

  return filasDe(replica, 'clientes').map((cliente) => {
    const proyectos = (porCliente.get(cliente.id) ?? []).sort(masReciente);

    let facturado = 0;
    let saldo = 0;
    let facturados = 0;
    for (const proyecto of proyectos) {
      if (faseDe(proyecto.estado) === 'seguimiento') continue;
      facturados += 1;
      facturado += proyecto.presupuesto_centavos ?? 0;
      if (!ESTADOS_CON_SALDO.includes(proyecto.estado)) continue;
      const falta = (proyecto.presupuesto_centavos ?? 0) - cobradoDelProyecto(pagos, proyecto.id);
      if (falta > 0) saldo += falta;
    }

    const ultimo = proyectos[0];
    return {
      cliente,
      proyectos,
      enSeguimiento: proyectos.length - facturados,
      facturados,
      ultimo,
      fechaDelUltimo: ultimo ? fechaDelProyecto(ultimo) : undefined,
      facturado: centavos(facturado),
      saldo: centavos(saldo),
    };
  });
}

export function resumenDeCliente(
  replica: Replica,
  clienteId: string,
): ResumenDeCliente | undefined {
  return resumenesDeClientes(replica).find((resumen) => resumen.cliente.id === clienteId);
}
