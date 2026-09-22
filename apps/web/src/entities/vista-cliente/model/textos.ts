import { llegoAl, type VistaDelCliente } from '@maun/domain';

export const SIN_PAGOS_APROBADO =
  'Todavía no hay ningún pago registrado. Lo primero es la seña: apenas el taller la anote, la vas a ver acá.';

export const LOS_PAGOS_LOS_ANOTA_EL_TALLER =
  'Los pagos aparecen acá cuando el taller los anota, no en el momento en que transferís.';

export const EL_PAGO_SE_COORDINA = 'Para pagar, escribile al taller y lo coordinan entre ustedes.';

export const NO_QUEDA_NADA = 'Gracias. No queda nada pendiente.';

export function sinPagosTodavia(vista: VistaDelCliente): string {
  if (vista.trabajo.pagos.length > 0) return '';
  return llegoAl(vista, 'aprobado') ? SIN_PAGOS_APROBADO : '';
}

// El pie solo manda a hablar con el taller cuando arriba no quedó ninguna forma concreta de pagar:
// con el bloque de cómo pagar a la vista, repetirlo sería decirle que coordine algo que ya sabe.
export function pieDeLosPagos(vista: VistaDelCliente, hayComoPagar: boolean): string {
  if (vista.saldado) return NO_QUEDA_NADA;
  if (hayComoPagar) return LOS_PAGOS_LOS_ANOTA_EL_TALLER;
  return `${EL_PAGO_SE_COORDINA} ${LOS_PAGOS_LOS_ANOTA_EL_TALLER}`;
}
