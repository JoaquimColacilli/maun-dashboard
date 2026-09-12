import type { Database } from './database.types.ts';

export const TABLAS_REPLICADAS = [
  'households',
  'household_members',
  'ajustes',
  'clientes',
  'proyectos',
  'pagos',
  'gastos',
  'movimientos',
] as const;

export type TablaReplicada = (typeof TABLAS_REPLICADAS)[number];

export type FilaDe<T extends TablaReplicada> = Database['public']['Tables'][T]['Row'];

export interface FilaSincronizable {
  id: string;
  version: number;
  deleted_at: string | null;
}

export interface Replica {
  readonly usuarioId: string;
  readonly cursor: string;
  readonly reconciliadoEn: string;
  readonly tablas: { readonly [T in TablaReplicada]: Readonly<Record<string, FilaDe<T>>> };
}

export interface Lote {
  readonly cursor: string;
  readonly filas: { readonly [T in TablaReplicada]: readonly FilaDe<T>[] };
}

export type ModoDeSincronizacion = 'reconcile' | 'delta';

export const HORAS_ENTRE_RECONCILES = 24;

export class RespuestaInvalidaError extends Error {
  override readonly name = 'RespuestaInvalidaError';
}

type TablasMutables = Record<string, Record<string, FilaSincronizable>>;

function filasCrudas(replica: Replica, tabla: TablaReplicada): Record<string, FilaSincronizable> {
  return replica.tablas[tabla];
}

function esFilaSincronizable(valor: unknown): valor is FilaSincronizable {
  if (typeof valor !== 'object' || valor === null) return false;
  const fila = valor as Record<string, unknown>;
  return (
    typeof fila.id === 'string' &&
    Number.isInteger(fila.version) &&
    (fila.deleted_at === null || typeof fila.deleted_at === 'string')
  );
}

export function leerLote(valor: unknown): Lote {
  if (typeof valor !== 'object' || valor === null) {
    throw new RespuestaInvalidaError('La sincronización no devolvió un objeto.');
  }

  const cuerpo = valor as Record<string, unknown>;
  if (typeof cuerpo.cursor !== 'string') {
    throw new RespuestaInvalidaError('La sincronización no devolvió el cursor.');
  }

  const filas: Record<string, readonly FilaSincronizable[]> = {};
  for (const tabla of TABLAS_REPLICADAS) {
    const lista = cuerpo[tabla];
    if (!Array.isArray(lista)) {
      throw new RespuestaInvalidaError(`La sincronización no devolvió la tabla ${tabla}.`);
    }
    for (const fila of lista) {
      if (!esFilaSincronizable(fila)) {
        throw new RespuestaInvalidaError(`Una fila de ${tabla} no trae id, version y deleted_at.`);
      }
    }
    filas[tabla] = lista as readonly FilaSincronizable[];
  }

  return { cursor: cuerpo.cursor, filas } as Lote;
}

export function replicaVacia(usuarioId: string): Replica {
  const tablas: TablasMutables = {};
  for (const tabla of TABLAS_REPLICADAS) tablas[tabla] = {};
  return { usuarioId, cursor: '', reconciliadoEn: '', tablas } as Replica;
}

// `ahora` es el reloj del cliente, y es a propósito: `reconciliadoEn` solo se compara contra
// Date.now() para saber cuándo toca el próximo reconcile. Guardar acá el cursor del servidor
// mezclaría dos relojes, y con el del cliente atrasado la resta nunca llegaría a 24 horas.
export function aplicarLote(
  replica: Replica,
  lote: Lote,
  modo: ModoDeSincronizacion,
  ahora: number,
): Replica {
  const tablas: TablasMutables = {};

  for (const tabla of TABLAS_REPLICADAS) {
    const filas =
      modo === 'reconcile'
        ? new Map<string, FilaSincronizable>()
        : new Map(Object.entries(filasCrudas(replica, tabla)));

    for (const fila of lote.filas[tabla] as readonly FilaSincronizable[]) {
      if (fila.deleted_at !== null) {
        filas.delete(fila.id);
        continue;
      }
      // Una fila más vieja no pisa a la más nueva: cubre un delta que llega tarde, fuera de orden.
      // El solape de cinco minutos vuelve a traer la misma version, y esa sí se aplica: es la del
      // servidor, que manda sobre la copia optimista.
      const existente = filas.get(fila.id);
      if (existente && existente.version > fila.version) continue;
      filas.set(fila.id, fila);
    }

    tablas[tabla] = Object.fromEntries(filas);
  }

  return {
    usuarioId: replica.usuarioId,
    cursor: lote.cursor,
    reconciliadoEn: modo === 'reconcile' ? new Date(ahora).toISOString() : replica.reconciliadoEn,
    tablas,
  } as Replica;
}

export function aplicarFilaLocal<T extends TablaReplicada>(
  replica: Replica,
  tabla: T,
  fila: FilaDe<T>,
): Replica {
  const filas = new Map(Object.entries(filasCrudas(replica, tabla)));
  const cruda = fila as FilaSincronizable;

  if (cruda.deleted_at !== null) filas.delete(cruda.id);
  else filas.set(cruda.id, cruda);

  return {
    ...replica,
    tablas: { ...replica.tablas, [tabla]: Object.fromEntries(filas) },
  };
}

export function quitarFilaLocal(replica: Replica, tabla: TablaReplicada, id: string): Replica {
  const filas = new Map(Object.entries(filasCrudas(replica, tabla)));
  if (!filas.delete(id)) return replica;

  return {
    ...replica,
    tablas: { ...replica.tablas, [tabla]: Object.fromEntries(filas) },
  };
}

export function filasDe<T extends TablaReplicada>(replica: Replica, tabla: T): FilaDe<T>[] {
  const filas = Object.values(replica.tablas[tabla]);
  return filas.sort((a, b) => {
    const izquierda = (a as FilaSincronizable).id;
    const derecha = (b as FilaSincronizable).id;
    return izquierda < derecha ? -1 : izquierda > derecha ? 1 : 0;
  });
}

export function filaPorId<T extends TablaReplicada>(
  replica: Replica,
  tabla: T,
  id: string,
): FilaDe<T> | undefined {
  return replica.tablas[tabla][id];
}

export function cantidadDe(replica: Replica, tabla: TablaReplicada): number {
  return Object.keys(replica.tablas[tabla]).length;
}

export function tieneAcceso(replica: Replica): boolean {
  return cantidadDe(replica, 'households') > 0;
}

export function householdDe(replica: Replica): FilaDe<'households'> | undefined {
  return filasDe(replica, 'households')[0];
}

export function ajustesDe(replica: Replica): FilaDe<'ajustes'> | undefined {
  return filasDe(replica, 'ajustes')[0];
}

// Un taller recién creado trae los ajustes en cero: la cascada no tiene con qué repartir y la app
// tiene que pedirlos. Es la misma condición que dibuja el estado vacío del diseño.
export function faltaConfigurar(ajustes: FilaDe<'ajustes'> | undefined): boolean {
  if (!ajustes) return false;
  return (
    ajustes.sueldo_mensual_centavos === 0 &&
    ajustes.costos_fijos_centavos === 0 &&
    ajustes.meta_cocos_centavos === 0 &&
    ajustes.tasa_cocos_anual_bp === 0
  );
}

export function necesitaReconcile(replica: Replica | undefined, ahora: number): boolean {
  if (!replica || replica.reconciliadoEn === '') return true;
  const marca = Date.parse(replica.reconciliadoEn);
  if (Number.isNaN(marca)) return true;
  return ahora - marca >= HORAS_ENTRE_RECONCILES * 60 * 60 * 1000;
}
