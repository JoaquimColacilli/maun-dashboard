import { CERO, restar, type Money, type SueldoDelMes } from '@maun/domain';

import { formatearPesos } from '@/shared/lib';

export function faltaDelSueldo({
  pagado,
  esperado,
}: Pick<SueldoDelMes, 'pagado' | 'esperado'>): Money {
  return pagado >= esperado ? CERO : restar(esperado, pagado);
}

export interface FraseDelSueldo {
  texto: string;
  detalle: string | undefined;
}

function quienLoPago(cobros: number): string {
  return cobros > 1 ? `los ${String(cobros)} cobros del mes pagaron` : 'el cobro del mes pagó';
}

export function fraseDelSueldo({ pagado, esperado, cobros }: SueldoDelMes): FraseDelSueldo {
  return {
    texto: `${formatearPesos(pagado)} de ${formatearPesos(esperado)}`,
    detalle:
      pagado > esperado
        ? `Ya está cubierto: ${quienLoPago(cobros)} ${formatearPesos(pagado)}.`
        : undefined,
  };
}
