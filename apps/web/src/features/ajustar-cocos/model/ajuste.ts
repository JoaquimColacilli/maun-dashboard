import { restar, type Money, type Tesoro } from '@maun/domain';

export interface AjusteDeCocos {
  diferencia: Money;
  monto: Money;
  concepto: string;
  origen: Tesoro | null;
  destino: Tesoro | null;
}

export function ajusteDeCocos(calculado: Money, real: Money): AjusteDeCocos | null {
  const diferencia = restar(real, calculado);
  if (diferencia === 0) return null;

  const suma = diferencia > 0;
  return {
    diferencia,
    monto: suma ? diferencia : restar(calculado, real),
    concepto: suma
      ? 'Ajuste de Cocos (intereses o depósito)'
      : 'Ajuste de Cocos (retiro o corrección)',
    origen: suma ? null : 'cocos',
    destino: suma ? 'cocos' : null,
  };
}
