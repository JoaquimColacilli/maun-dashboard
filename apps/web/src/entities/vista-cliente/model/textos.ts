import {
  estaAprobada,
  type EntregaDelTrabajo,
  type SenaDeLaVista,
  type VistaAprobada,
  type VistaDelCliente,
} from '@maun/domain';

import { fechaLarga, formatearPesos } from '@/shared/lib';

export const SIN_PAGOS_APROBADO =
  'Todavía no hay ningún pago registrado. Lo primero es la seña: apenas el taller la anote, la vas a ver acá.';

export const LOS_PAGOS_LOS_ANOTA_EL_TALLER =
  'Los pagos aparecen acá cuando el taller los anota, no en el momento en que transferís.';

export const EL_PAGO_SE_COORDINA = 'Para pagar, escribile al taller y lo coordinan entre ustedes.';

export const NO_QUEDA_NADA = 'Gracias. No queda nada pendiente.';

export const A_CUENTA_DE_LA_SENA = 'A cuenta de la seña';

export const QUEDA_A_CUENTA = 'Lo que pagaste queda a cuenta de la seña.';

export const LA_SENA_YA_ESTA_CUBIERTA = 'Con lo que pagaste ya está cubierta la seña.';

export const A_CONFIRMAR = 'A confirmar';

export function sinPagosTodavia(vista: VistaDelCliente): string {
  if (vista.pagos.length > 0) return '';
  return estaAprobada(vista) ? SIN_PAGOS_APROBADO : '';
}

// El pie solo manda a hablar con el taller cuando arriba no quedó ninguna forma concreta de pagar:
// con el bloque de cómo pagar a la vista, repetirlo sería decirle que coordine algo que ya sabe.
export function pieDeLosPagos(vista: VistaDelCliente, hayComoPagar: boolean): string {
  if (estaAprobada(vista) && vista.saldado) return NO_QUEDA_NADA;
  if (hayComoPagar) return LOS_PAGOS_LOS_ANOTA_EL_TALLER;
  return `${EL_PAGO_SE_COORDINA} ${LOS_PAGOS_LOS_ANOTA_EL_TALLER}`;
}

export function lineaDeLaSena(sena: SenaDeLaVista, pagado: number): string {
  switch (sena.situacion) {
    case 'falta':
      return sena.aCuenta > 0
        ? `Lo que pagaste queda a cuenta de la seña: te quedan ${formatearPesos(sena.falta)} para completarla.`
        : '';
    case 'cubierta':
      return LA_SENA_YA_ESTA_CUBIERTA;
    case 'sin-presupuesto':
      return pagado > 0 ? QUEDA_A_CUENTA : '';
  }
}

export function textoDeLaSenaAcordada(sena: SenaDeLaVista): string {
  switch (sena.situacion) {
    case 'cubierta':
      return `${formatearPesos(sena.sena)} · pagada`;
    case 'falta':
      return `${formatearPesos(sena.sena)} · te faltan ${formatearPesos(sena.falta)}`;
    case 'sin-presupuesto':
      return A_CONFIRMAR;
  }
}

export function textoDelTotalPagado(vista: VistaAprobada): string | null {
  if (!vista.saldado || vista.precio === null) return null;
  return `${formatearPesos(vista.precio)} · pagado`;
}

export function claveDeLaEntrega(entrega: EntregaDelTrabajo): string {
  return entrega.situacion === 'entregado' ? 'Entregado' : 'Entrega pautada';
}

export function valorDeLaEntrega(entrega: EntregaDelTrabajo, hoy: string): string {
  return entrega.fecha === null ? A_CONFIRMAR : fechaLarga(entrega.fecha, hoy);
}

export function bajadaDeLaEntrega(entrega: EntregaDelTrabajo, hoy: string): string {
  if (entrega.fecha === null) return '';
  return entrega.situacion === 'entregado'
    ? `Entregado el ${fechaLarga(entrega.fecha, hoy)}`
    : `Entrega pautada para el ${fechaLarga(entrega.fecha, hoy)}`;
}

export interface SaldoDeLaVista {
  etiqueta: string;
  texto: string;
  tono: string;
}

export function saldoDeLaVista(vista: VistaAprobada): SaldoDeLaVista {
  if (vista.saldo === null) return { etiqueta: 'Falta el presupuesto', texto: '—', tono: '' };
  if (vista.saldado)
    return { etiqueta: 'Está saldado', texto: formatearPesos(0), tono: 'text-hogar' };
  return { etiqueta: 'Te falta pagar', texto: formatearPesos(vista.saldo), tono: '' };
}
