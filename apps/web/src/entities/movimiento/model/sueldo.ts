import type { SueldoDelMes } from '@maun/domain';

import { formatearPesos } from '@/shared/lib';

export interface FraseDelSueldo {
  texto: string;
  detalle: string | undefined;
}

export function fraseDelSueldo({
  pagado,
  esperado,
  cobros,
  porCobro,
}: SueldoDelMes): FraseDelSueldo {
  return {
    texto: `${formatearPesos(pagado)} de ${formatearPesos(esperado)}`,
    detalle:
      porCobro && cobros > 1
        ? `${String(cobros)} cobros este mes, y cada uno paga su propio sueldo.`
        : undefined,
  };
}
