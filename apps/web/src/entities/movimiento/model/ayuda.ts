import { CERO, restar, sumar, type Money, type SaldosPorTesoro } from '@maun/domain';

import { formatearPesos } from '@/shared/lib';

import type { ClaseDeMovimiento } from './clases';

export interface ContextoDeAyuda {
  saldos: SaldosPorTesoro;
  metaCocos: Money;
  monto: Money;
}

function comoQueda(saldo: Money, nombre: string): string {
  return saldo < 0
    ? `${nombre} queda en ${formatearPesos(saldo)}, o sea en negativo`
    : `${nombre} queda en ${formatearPesos(saldo)}`;
}

function despuesDelPago(saldo: Money): string {
  if (saldo > 0) return `Después de este pago te van a quedar ${formatearPesos(saldo)} por pagar`;
  if (saldo < 0) return `Con este pago te pasás ${formatearPesos(restar(CERO, saldo))}`;
  return 'Con este pago quedás al día';
}

export function ayudaDelMovimiento(clase: ClaseDeMovimiento, contexto: ContextoDeAyuda): string {
  const { saldos, monto, metaCocos } = contexto;

  switch (clase) {
    case 'ingreso_hogar':
      return `Entra al hogar y no pasa por el taller ni por el diezmo. ${comoQueda(sumar(saldos.hogar, monto), 'El hogar')}.`;
    case 'ingreso_maun':
      return `Entra a la caja del taller. Esto es para un cobro suelto: lo que viene de un trabajo cargado se anota en el trabajo, así queda atado a su reparto. ${comoQueda(sumar(saldos.maun, monto), 'El taller')}.`;
    case 'gasto_hogar':
      return `Sale del hogar. ${comoQueda(restar(saldos.hogar, monto), 'El hogar')}.`;
    case 'gasto_maun':
      return `Sale de la caja del taller. Si es de un mueble puntual conviene cargarlo como gasto del trabajo, así se descuenta de esa ganancia. ${comoQueda(restar(saldos.maun, monto), 'El taller')}.`;
    case 'pago_diezmo':
      return `Sale de lo que el diezmo tiene apartado. ${despuesDelPago(restar(saldos.diezmo, monto))}.`;
    case 'aporte_cocos':
      return `Pasa de la caja del taller al fondo de Cocos. Cocos queda en ${formatearPesos(sumar(saldos.cocos, monto))} de la meta de ${formatearPesos(metaCocos)}.`;
    case 'retiro_cocos':
      return `Sale de Cocos y vuelve a la caja del taller: no se va del taller, cambia de bolsillo. Cocos queda en ${formatearPesos(restar(saldos.cocos, monto))}.`;
    case 'gasto_cocos':
      return `Sale de Cocos y se va. ${comoQueda(restar(saldos.cocos, monto), 'Cocos')}.`;
  }
}
