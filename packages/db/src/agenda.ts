import type { CategoriaPropia, DatosDeLaAgenda } from '@maun/domain';

import { filasDe, type FilaDe, type Replica } from './replica.ts';

export interface FilasDeLaAgenda {
  proyectos: readonly FilaDe<'proyectos'>[];
  clientes: readonly FilaDe<'clientes'>[];
  anotaciones: readonly FilaDe<'anotaciones'>[];
}

function horaSinSegundos(hora: string | null): string | null {
  return hora === null ? null : hora.slice(0, 5);
}

export function datosDeLaAgenda(filas: FilasDeLaAgenda): DatosDeLaAgenda {
  return {
    proyectos: filas.proyectos.map((proyecto) => ({
      id: proyecto.id,
      clienteId: proyecto.cliente_id,
      titulo: proyecto.titulo,
      estado: proyecto.estado,
      fechaVisita: proyecto.fecha_visita,
      entregaEstimada: proyecto.entrega_estimada,
      vencimientoPresupuesto: proyecto.vencimiento_presupuesto,
      direccionEntrega: proyecto.direccion_entrega,
    })),
    clientes: filas.clientes.map((cliente) => ({
      id: cliente.id,
      nombre: cliente.nombre,
      zona: cliente.zona,
    })),
    anotaciones: filas.anotaciones.map((anotacion) => ({
      id: anotacion.id,
      fecha: anotacion.fecha,
      hora: horaSinSegundos(anotacion.hora),
      texto: anotacion.texto,
      categoria: anotacion.categoria satisfies CategoriaPropia,
      proyectoId: anotacion.proyecto_id,
      hecha: anotacion.hecha,
      importante: anotacion.importante,
    })),
  };
}

export function datosDeLaAgendaDeLaReplica(replica: Replica): DatosDeLaAgenda {
  return datosDeLaAgenda({
    proyectos: filasDe(replica, 'proyectos'),
    clientes: filasDe(replica, 'clientes'),
    anotaciones: filasDe(replica, 'anotaciones'),
  });
}
