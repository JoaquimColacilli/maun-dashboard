import { HITOS, type VistaDelCliente } from '@maun/domain';

const APROBADO = HITOS.findIndex((hito) => hito.id === 'aprobado');

export const SIN_PAGOS_APROBADO =
  'Todavía no hay ningún pago registrado. Lo primero es la seña: apenas el taller la anote, la vas a ver acá.';

export const LOS_PAGOS_LOS_ANOTA_EL_TALLER =
  'Los pagos aparecen acá cuando el taller los anota, no en el momento en que transferís.';

export const EL_SALDO_SE_COORDINA =
  'El saldo lo arreglás directamente con el taller: escribile para acordar cómo y cuándo.';

export const NO_QUEDA_NADA = 'Gracias. No queda nada pendiente.';

export function sinPagosTodavia(vista: VistaDelCliente): string {
  if (vista.trabajo.pagos.length > 0) return '';
  return vista.hitoIndex >= APROBADO ? SIN_PAGOS_APROBADO : '';
}

export function pieDeLosPagos(vista: VistaDelCliente, hayDatosParaTransferir: boolean): string {
  if (vista.saldado) return NO_QUEDA_NADA;
  if (hayDatosParaTransferir) return LOS_PAGOS_LOS_ANOTA_EL_TALLER;
  return `${EL_SALDO_SE_COORDINA} ${LOS_PAGOS_LOS_ANOTA_EL_TALLER}`;
}
