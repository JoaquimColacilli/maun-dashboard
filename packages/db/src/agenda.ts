import type { CategoriaDelTrabajo, CategoriaPropia, DatosDeLaAgenda } from '@maun/domain';

import { filasDe, type FilaDe, type Replica } from './replica.ts';

export interface FilasDeLaAgenda {
  proyectos: readonly FilaDe<'proyectos'>[];
  clientes: readonly FilaDe<'clientes'>[];
  anotaciones: readonly FilaDe<'anotaciones'>[];
  proximos_contactos?: readonly FilaDe<'proximos_contactos'>[];
}

export const COLUMNAS_DE_MARCAS = [
  'presupuesto_importante',
  'visita_importante',
  'entrega_importante',
] as const;

export type ColumnaDeMarca = (typeof COLUMNAS_DE_MARCAS)[number];

export const COLUMNA_DE_LA_MARCA: Readonly<Record<CategoriaDelTrabajo, ColumnaDeMarca>> = {
  presupuesto: 'presupuesto_importante',
  visita: 'visita_importante',
  entrega: 'entrega_importante',
};

export const COLUMNAS_DE_LA_FECHA = [
  'vencimiento_presupuesto',
  'fecha_visita',
  'entrega_estimada',
] as const;

export type ColumnaDeLaFecha = (typeof COLUMNAS_DE_LA_FECHA)[number];

// De dónde sale la fecha de cada evento derivado, que es también la única columna donde esa fecha
// puede vivir: arrastrarlo en la agenda escribe acá (ADR 0045).
export const COLUMNA_DE_LA_FECHA: Readonly<Record<CategoriaDelTrabajo, ColumnaDeLaFecha>> = {
  presupuesto: 'vencimiento_presupuesto',
  visita: 'fecha_visita',
  entrega: 'entrega_estimada',
};

type FilaQuizasSinLoHechoNiLasMarcas = Partial<
  Pick<FilaDe<'proyectos'>, 'visita_hecha' | 'entrega_hora' | 'visita_hora' | ColumnaDeMarca>
>;

export function visitaHecha(proyecto: FilaDe<'proyectos'>): boolean {
  return (proyecto as FilaQuizasSinLoHechoNiLasMarcas).visita_hecha === true;
}

export function marcadaComoImportante(
  proyecto: FilaDe<'proyectos'>,
  categoria: CategoriaDelTrabajo,
): boolean {
  return (proyecto as FilaQuizasSinLoHechoNiLasMarcas)[COLUMNA_DE_LA_MARCA[categoria]] === true;
}

function horaSinSegundos(hora: string | null | undefined): string | null {
  return hora === null || hora === undefined ? null : hora.slice(0, 5);
}

export function horaDeLaEntrega(proyecto: FilaDe<'proyectos'>): string | null {
  return horaSinSegundos((proyecto as FilaQuizasSinLoHechoNiLasMarcas).entrega_hora);
}

export function horaDeLaVisita(proyecto: FilaDe<'proyectos'>): string | null {
  return horaSinSegundos((proyecto as FilaQuizasSinLoHechoNiLasMarcas).visita_hora);
}

export function datosDeLaAgenda(filas: FilasDeLaAgenda): DatosDeLaAgenda {
  return {
    proyectos: filas.proyectos.map((proyecto) => ({
      id: proyecto.id,
      clienteId: proyecto.cliente_id,
      titulo: proyecto.titulo,
      estado: proyecto.estado,
      fechaVisita: proyecto.fecha_visita,
      visitaHora: horaDeLaVisita(proyecto),
      visitaHecha: visitaHecha(proyecto),
      entregaEstimada: proyecto.entrega_estimada,
      entregaHora: horaDeLaEntrega(proyecto),
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
    proximos: (filas.proximos_contactos ?? [])
      .filter((proximo) => proximo.deleted_at === null)
      .map((proximo) => ({
        id: proximo.id,
        proyectoId: proximo.proyecto_id,
        fecha: proximo.fecha,
        hechoEl: proximo.hecho_el,
        nota: proximo.nota,
        importante: proximo.importante,
      })),
  };
}

export function datosDeLaAgendaDeLaReplica(replica: Replica): DatosDeLaAgenda {
  return datosDeLaAgenda({
    proyectos: filasDe(replica, 'proyectos'),
    clientes: filasDe(replica, 'clientes'),
    anotaciones: filasDe(replica, 'anotaciones'),
    proximos_contactos: filasDe(replica, 'proximos_contactos'),
  });
}
