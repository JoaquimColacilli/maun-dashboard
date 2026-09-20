import { instanciasPendientes, type FormaDeCobro, type InstanciaDePago } from '@maun/domain';

import {
  formasDelTrabajo,
  senaDelProyecto,
  senaDelTaller,
  type ResumenDeProyecto,
} from '@/entities/proyecto';
import type { FilaDe } from '@/shared/api';

export interface FilaDeCobro {
  instancia: InstanciaDePago;
  formas: readonly FormaDeCobro[];
}

export const SIN_DATOS_PARA_TRANSFERIR =
  'Todavía no cargaste alias ni CBU, así que por ahora solo podés cobrar en efectivo.';

export const AL_MENOS_UNA = 'Dejá al menos una: si no, tu cliente no sabe cómo pagarte.';

export const NADA_QUE_COBRAR = 'Este trabajo ya está saldado: no queda nada por cobrar.';

export function filasDeCobro(
  resumen: ResumenDeProyecto,
  ajustes: FilaDe<'ajustes'> | undefined,
): readonly FilaDeCobro[] {
  const { proyecto } = resumen;
  const pendientes = instanciasPendientes({
    presupuesto: proyecto.presupuesto_centavos === null ? null : resumen.presupuesto,
    cobrado: resumen.cobrado,
    porcentajeDelTaller: senaDelTaller(ajustes),
    porcentajeDelTrabajo: senaDelProyecto(proyecto),
  });

  return pendientes.map((instancia) => ({
    instancia,
    formas: formasDelTrabajo(proyecto, instancia, ajustes),
  }));
}
