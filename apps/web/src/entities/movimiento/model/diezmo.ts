import type { EstadoDelDiezmo } from '@maun/domain';

import { formatearPesos } from '@/shared/lib';

export interface FraseDelDiezmo {
  antes: string;
  importe: string | null;
  despues: string;
  frase: string;
  detalle: string;
}

export function fraseDelDiezmo(estado: EstadoDelDiezmo): FraseDelDiezmo {
  if (estado.situacion === 'debe') {
    const importe = formatearPesos(estado.importe);
    return {
      antes: 'Debés',
      importe,
      despues: '',
      frase: `Debés ${importe}`,
      detalle: 'de lo que ya cobraste y todavía no diste',
    };
  }
  if (estado.situacion === 'pago-de-mas') {
    const importe = formatearPesos(estado.importe);
    return {
      antes: 'Pagaste',
      importe,
      despues: 'de más',
      frase: `Pagaste ${importe} de más`,
      detalle: 'se descuenta de lo próximo que se genere',
    };
  }
  return {
    antes: 'Estás al día',
    importe: null,
    despues: '',
    frase: 'Estás al día',
    detalle: 'todo lo generado ya está pagado',
  };
}
