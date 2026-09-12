import type { EstadoProyecto, Fase } from '@maun/domain';

import { criterioPorId, ordenar, type Criterio, type Sentido } from '@/shared/lib';

import { ESTADO } from './catalogos';
import type { ResumenDeProyecto } from './resumen';

function sinAcentos(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

// La réplica está en memoria: la búsqueda responde desde la primera letra y no hay debounce, igual
// que en Clientes. Busca por cliente, que es como el dueño se acuerda de un trabajo, y por título.
export function buscarProyectos(
  resumenes: readonly ResumenDeProyecto[],
  consulta: string,
): ResumenDeProyecto[] {
  const texto = sinAcentos(consulta.trim());
  if (texto === '') return [...resumenes];

  return resumenes.filter(
    (resumen) =>
      sinAcentos(resumen.nombreDelCliente).includes(texto) ||
      sinAcentos(resumen.proyecto.titulo).includes(texto),
  );
}

export function filtrarPorEtapa(
  resumenes: readonly ResumenDeProyecto[],
  etapa: Fase,
): ResumenDeProyecto[] {
  return resumenes.filter((resumen) => resumen.fase === etapa);
}

export function filtrarPorEstado(
  resumenes: readonly ResumenDeProyecto[],
  estado: EstadoProyecto | 'todos',
): ResumenDeProyecto[] {
  return estado === 'todos'
    ? [...resumenes]
    : resumenes.filter((resumen) => resumen.proyecto.estado === estado);
}

// Las columnas de la tabla de escritorio son las mismas que las opciones de la hoja del celular:
// una sola lista de criterios para los dos anchos, o son dos ordenamientos que se desincronizan.
export const CRITERIOS: readonly Criterio<ResumenDeProyecto>[] = [
  {
    id: 'cliente',
    etiqueta: 'Cliente',
    tipo: 'texto',
    leer: (resumen) => resumen.nombreDelCliente,
    inicial: 'asc',
  },
  {
    id: 'trabajo',
    etiqueta: 'Trabajo',
    tipo: 'texto',
    leer: (resumen) => resumen.proyecto.titulo,
    inicial: 'asc',
  },
  {
    id: 'presupuesto',
    etiqueta: 'Presupuesto',
    tipo: 'numero',
    leer: (resumen) =>
      resumen.proyecto.presupuesto_centavos === null ? undefined : resumen.presupuesto,
    inicial: 'desc',
  },
  {
    id: 'cobrado',
    etiqueta: 'Cobrado',
    tipo: 'numero',
    leer: (resumen) => resumen.cobrado,
    inicial: 'desc',
  },
  {
    id: 'saldo',
    etiqueta: 'Saldo',
    tipo: 'numero',
    leer: (resumen) => resumen.saldo,
    inicial: 'desc',
  },
  {
    id: 'entrega',
    etiqueta: 'Entrega estimada',
    tipo: 'fecha',
    leer: (resumen) => resumen.proyecto.entrega_estimada ?? undefined,
    inicial: 'asc',
  },
  {
    id: 'estado',
    etiqueta: 'Estado',
    tipo: 'texto',
    leer: (resumen) => ESTADO[resumen.proyecto.estado].etiqueta,
    inicial: 'asc',
  },
];

export const ORDEN_POR_DEFECTO = 'entrega';

export function ordenarProyectos(
  resumenes: readonly ResumenDeProyecto[],
  ordenId: string,
  sentido: Sentido,
): ResumenDeProyecto[] {
  const criterio = criterioPorId(CRITERIOS, ordenId);
  if (criterio === undefined) return [...resumenes];
  return ordenar(resumenes, criterio, sentido, (resumen) => resumen.proyecto.id);
}
