import type { EstadoDelDiezmo } from '@maun/domain';

import { formatearPesos } from '@/shared/lib';

export interface FraseDelDiezmo {
  verbo: string;
  importe: string | null;
  frase: string;
  detalle: string;
}

export function fraseDelDiezmo(estado: EstadoDelDiezmo): FraseDelDiezmo {
  if (estado.situacion === 'debe') {
    const importe = formatearPesos(estado.importe);
    return {
      verbo: 'Debés',
      importe,
      frase: `Debés ${importe}`,
      detalle: 'de lo que ya cobraste y todavía no diste',
    };
  }
  if (estado.situacion === 'pago-de-mas') {
    const importe = formatearPesos(estado.importe);
    return {
      verbo: 'Pagaste de más',
      importe,
      frase: `Pagaste ${importe} de más`,
      detalle: 'se descuenta de lo próximo que se genere',
    };
  }
  return {
    verbo: 'Estás al día',
    importe: null,
    frase: 'Estás al día',
    detalle: 'todo lo generado ya está pagado',
  };
}
