import {
  catalogoDeNecesidades,
  claveDelNombre,
  sugerenciasDeNecesidad,
  type NombreDelCatalogo,
  type TipoDeNecesidad,
} from '@maun/domain';

import { filasDe, type FilaDe, type NecesidadParaGuardar, type Replica } from '@/shared/api';

export type Necesidad = FilaDe<'necesidades'>;

export interface TipoDeLaLista {
  tipo: TipoDeNecesidad;
  titulo: string;
  agregar: string;
  campo: string;
  cuantos: string;
  listo: string;
  listos: string;
  placeholder: string;
  ejemploDeCantidad: string;
  ayuda: string;
}

export const LISTAS_DEL_TRABAJO: readonly TipoDeLaLista[] = [
  {
    tipo: 'herraje',
    titulo: 'Herrajes necesarios',
    agregar: 'Agregar el herraje',
    campo: 'Qué herraje hace falta',
    cuantos: 'Cuántos herrajes',
    listo: 'Listo',
    listos: 'listos',
    placeholder: 'Bisagras, pistones, tiradores…',
    ejemploDeCantidad: '6',
    ayuda: 'Lo que hay que pedir para este trabajo. La cantidad es opcional.',
  },
  {
    tipo: 'herramienta',
    titulo: 'Herramientas necesarias',
    agregar: 'Agregar la herramienta',
    campo: 'Qué herramienta hace falta',
    cuantos: 'Cuántas herramientas',
    listo: 'Lista',
    listos: 'listas',
    placeholder: 'Sierra circular, lijadora de banda…',
    ejemploDeCantidad: '1',
    ayuda: 'Lo que hay que tener a mano el día que lo hagas. La cantidad es opcional.',
  },
];

export function nombreConCantidad(necesidad: Pick<Necesidad, 'nombre' | 'cantidad'>): string {
  return necesidad.cantidad === null
    ? necesidad.nombre
    : `${String(necesidad.cantidad)} ${necesidad.nombre}`;
}

export function necesidadesDelProyecto(replica: Replica, proyectoId: string): Necesidad[] {
  return filasDe(replica, 'necesidades')
    .filter((necesidad) => necesidad.proyecto_id === proyectoId)
    .sort((una, otra) => (una.id < otra.id ? -1 : 1));
}

export function necesidadesPorTipo(
  necesidades: readonly Necesidad[],
  tipo: TipoDeNecesidad,
): Necesidad[] {
  return necesidades.filter((necesidad) => necesidad.tipo === tipo);
}

export function cuantasListas(necesidades: readonly Necesidad[]): number {
  return necesidades.filter((necesidad) => necesidad.listo).length;
}

// El catálogo no es una tabla: son los nombres distintos que ya usó en todo el taller, sacados de las
// mismas filas de la réplica. Funciona sin señal y no necesita pantalla de administración (ADR 0045).
export function catalogoDelTaller(replica: Replica, tipo: TipoDeNecesidad): NombreDelCatalogo[] {
  return catalogoDeNecesidades(
    filasDe(replica, 'necesidades').map((necesidad) => ({
      tipo: necesidad.tipo,
      nombre: necesidad.nombre,
      usadaEn: necesidad.created_at,
    })),
    tipo,
  );
}

export function sugerenciasParaEscribir(
  catalogo: readonly NombreDelCatalogo[],
  escrito: string,
  yaCargados: readonly Necesidad[],
): NombreDelCatalogo[] {
  const puestos = new Set(yaCargados.map((necesidad) => claveDelNombre(necesidad.nombre)));
  return sugerenciasDeNecesidad(catalogo, escrito).filter(
    (entrada) => !puestos.has(claveDelNombre(entrada.nombre)),
  );
}

export function comoViajan(necesidades: readonly Necesidad[]): NecesidadParaGuardar[] {
  return necesidades.map((necesidad) => ({
    id: necesidad.id,
    tipo: necesidad.tipo,
    nombre: necesidad.nombre,
    cantidad: necesidad.cantidad,
    listo: necesidad.listo,
  }));
}

export function conUnaNecesidadMas(
  necesidades: readonly Necesidad[],
  nueva: { id: string; tipo: TipoDeNecesidad; nombre: string; cantidad: number | null },
): NecesidadParaGuardar[] {
  return [
    ...comoViajan(necesidades),
    {
      id: nueva.id,
      tipo: nueva.tipo,
      nombre: nueva.nombre.trim(),
      cantidad: nueva.cantidad,
      listo: false,
    },
  ];
}

export function conUnaNecesidadTildada(
  necesidades: readonly Necesidad[],
  id: string,
  listo: boolean,
): NecesidadParaGuardar[] {
  return comoViajan(necesidades).map((necesidad) =>
    necesidad.id === id ? { ...necesidad, listo } : necesidad,
  );
}

export function conUnaNecesidadEditada(
  necesidades: readonly Necesidad[],
  id: string,
  cambios: { nombre: string; cantidad: number | null },
): NecesidadParaGuardar[] {
  return comoViajan(necesidades).map((necesidad) =>
    necesidad.id === id && necesidad.borrado !== true
      ? { ...necesidad, nombre: cambios.nombre, cantidad: cambios.cantidad }
      : necesidad,
  );
}

export function sinUnaNecesidad(
  necesidades: readonly Necesidad[],
  id: string,
): NecesidadParaGuardar[] {
  return [
    ...comoViajan(necesidades).filter((necesidad) => necesidad.id !== id),
    { id, borrado: true },
  ];
}

export function conUnaNecesidadDeVuelta(
  necesidades: readonly Necesidad[],
  vuelve: Necesidad,
): NecesidadParaGuardar[] {
  return [
    ...comoViajan(necesidades).filter((necesidad) => necesidad.id !== vuelve.id),
    {
      id: vuelve.id,
      tipo: vuelve.tipo,
      nombre: vuelve.nombre,
      cantidad: vuelve.cantidad,
      listo: vuelve.listo,
    },
  ];
}
