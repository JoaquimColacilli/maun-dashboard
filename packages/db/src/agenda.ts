import type { CategoriaDerivada, CategoriaPropia, DatosDeLaAgenda } from '@maun/domain';

import { filasDe, type FilaDe, type Replica } from './replica.ts';

export interface FilasDeLaAgenda {
  proyectos: readonly FilaDe<'proyectos'>[];
  clientes: readonly FilaDe<'clientes'>[];
  anotaciones: readonly FilaDe<'anotaciones'>[];
}

export const COLUMNAS_DE_MARCAS = [
  'presupuesto_importante',
  'visita_importante',
  'entrega_importante',
] as const;

export type ColumnaDeMarca = (typeof COLUMNAS_DE_MARCAS)[number];

export const COLUMNA_DE_LA_MARCA: Readonly<Record<CategoriaDerivada, ColumnaDeMarca>> = {
  presupuesto: 'presupuesto_importante',
  visita: 'visita_importante',
  entrega: 'entrega_importante',
};

type FilaQuizasSinLoHechoNiLasMarcas = Partial<
  Pick<FilaDe<'proyectos'>, 'visita_hecha' | ColumnaDeMarca>
>;

export function visitaHecha(proyecto: FilaDe<'proyectos'>): boolean {
  return (proyecto as FilaQuizasSinLoHechoNiLasMarcas).visita_hecha === true;
}

export function marcadaComoImportante(
  proyecto: FilaDe<'proyectos'>,
  categoria: CategoriaDerivada,
): boolean {
  return (proyecto as FilaQuizasSinLoHechoNiLasMarcas)[COLUMNA_DE_LA_MARCA[categoria]] === true;
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
      visitaHecha: visitaHecha(proyecto),
      entregaEstimada: proyecto.entrega_estimada,
      vencimientoPresupuesto: proyecto.vencimiento_presupuesto,
      direccionEntrega: proyecto.direccion_entrega,
      importante: {
        presupuesto: marcadaComoImportante(proyecto, 'presupuesto'),
        visita: marcadaComoImportante(proyecto, 'visita'),
        entrega: marcadaComoImportante(proyecto, 'entrega'),
      },
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
