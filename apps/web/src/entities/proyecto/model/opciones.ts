import {
  calcularSena,
  centavos,
  puntosBasicos,
  SENA_HABITUAL,
  type Money,
  type PuntosBasicos,
  type SenaDelTrabajo,
} from '@maun/domain';

import { ajustesDe, filasDe, type FilaDe, type Replica } from '@/shared/api';

import type { Proyecto } from './catalogos';

export type OpcionDePresupuesto = FilaDe<'opciones_de_presupuesto'>;

// Una réplica guardada antes de que existieran las columnas no las trae, igual que con la visita
// hecha y las marcas (ADR 0042). Hasta el próximo reconcile se lee el valor de siempre.
type ConSena = { sena_bp?: number | null };

export function senaDelTaller(ajustes: FilaDe<'ajustes'> | undefined): PuntosBasicos {
  const bp = (ajustes as ConSena | undefined)?.sena_bp;
  return bp === undefined || bp === null ? SENA_HABITUAL : puntosBasicos(bp);
}

export function senaDelProyecto(proyecto: Proyecto): PuntosBasicos | null {
  const bp = (proyecto as ConSena).sena_bp;
  return bp === undefined || bp === null ? null : puntosBasicos(bp);
}

export function opcionesDelProyecto(replica: Replica, proyectoId: string): OpcionDePresupuesto[] {
  return filasDe(replica, 'opciones_de_presupuesto')
    .filter((opcion) => opcion.proyecto_id === proyectoId)
    .sort((una, otra) => (una.id < otra.id ? -1 : 1));
}

export function opcionAprobada(
  opciones: readonly OpcionDePresupuesto[],
): OpcionDePresupuesto | undefined {
  return opciones.find((opcion) => opcion.aprobada);
}

export function senaDelTrabajo(
  replica: Replica,
  proyecto: Proyecto,
  cobrado: Money,
): SenaDelTrabajo {
  return calcularSena({
    presupuesto:
      proyecto.presupuesto_centavos === null ? null : centavos(proyecto.presupuesto_centavos),
    cobrado,
    porcentajeDelTaller: senaDelTaller(ajustesDe(replica)),
    porcentajeDelTrabajo: senaDelProyecto(proyecto),
  });
}
