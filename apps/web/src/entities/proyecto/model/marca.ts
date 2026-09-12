import type { NombreDeIcono } from '@/shared/ui';

import type { OperacionDeLiquidacion } from '../api/liquidacion';

const EN_CURSO: Readonly<Record<OperacionDeLiquidacion, string>> = {
  cobro: 'Cobrado, sin confirmar',
  cierre: 'Cerrado, sin confirmar',
  reapertura: 'Reabierto, sin confirmar',
  reactivacion: 'Reactivado, sin confirmar',
};

const CONFIRMANDO: Readonly<Record<OperacionDeLiquidacion, string>> = {
  cobro: 'Confirmando el cobro…',
  cierre: 'Confirmando el cierre…',
  reapertura: 'Confirmando la reapertura…',
  reactivacion: 'Confirmando la reactivación…',
};

export interface MarcaDeSincronizacion {
  texto: string;
  icono: NombreDeIcono;
  tono: string;
}

export function marcaDeLiquidacion(
  enVuelo: { operacion: OperacionDeLiquidacion; enPausa: boolean } | undefined,
  hayRechazo: boolean,
): MarcaDeSincronizacion | undefined {
  if (enVuelo) {
    return enVuelo.enPausa
      ? { texto: EN_CURSO[enVuelo.operacion], icono: 'cloud-off', tono: 'text-atencion' }
      : { texto: CONFIRMANDO[enVuelo.operacion], icono: 'arrow-up-down', tono: 'text-text-2' };
  }
  if (hayRechazo) {
    return { texto: 'El servidor lo rechazó', icono: 'triangle-alert', tono: 'text-alerta' };
  }
  return undefined;
}
