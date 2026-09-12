import type { Tesoro, TipoMovimiento } from '@/shared/api';

export type FormaDelLado = 'ninguno' | 'libre' | 'fijo' | 'opcional';

export interface LadosDelTipo {
  origen: FormaDelLado;
  destino: FormaDelLado;
  origenFijo?: Tesoro;
  destinoFijo?: Tesoro;
}

// Es la restricción movimientos_forma_segun_tipo de la base, escrita en TypeScript. Cuando los
// movimientos tengan modelo en @maun/domain, esta tabla se muda ahí con su test gemelo (ADR 0012).
export const LADOS_POR_TIPO: Readonly<Record<TipoMovimiento, LadosDelTipo>> = {
  ingreso: { origen: 'ninguno', destino: 'libre' },
  gasto: { origen: 'libre', destino: 'ninguno' },
  transferencia: { origen: 'libre', destino: 'libre' },
  pago_diezmo: { origen: 'fijo', origenFijo: 'diezmo', destino: 'ninguno' },
  aporte_cocos: { origen: 'libre', destino: 'fijo', destinoFijo: 'cocos' },
  // La base pide exactamente un lado, sin decir cuál: un ajuste puede sumar o restar.
  ajuste: { origen: 'opcional', destino: 'opcional' },
};

export const NOMBRE_DEL_TIPO: Readonly<Record<TipoMovimiento, string>> = {
  ingreso: 'Ingreso',
  gasto: 'Gasto',
  transferencia: 'Transferencia',
  pago_diezmo: 'Pago de diezmo',
  aporte_cocos: 'Aporte a Cocos',
  ajuste: 'Ajuste',
};

export const NOMBRE_DEL_TESORO: Readonly<Record<Tesoro, string>> = {
  hogar: 'Hogar',
  maun: 'Maun',
  diezmo: 'Diezmo',
  cocos: 'Cocos',
};

export interface Lados {
  origen: Tesoro | null;
  destino: Tesoro | null;
}

function ladoDe(forma: FormaDelLado, fijo: Tesoro | undefined, elegido: Tesoro | null) {
  if (forma === 'ninguno') return null;
  if (forma === 'fijo') return fijo ?? null;
  return elegido;
}

export function ladosDe(tipo: TipoMovimiento, elegido: Lados): Lados {
  const forma = LADOS_POR_TIPO[tipo];
  return {
    origen: ladoDe(forma.origen, forma.origenFijo, elegido.origen),
    destino: ladoDe(forma.destino, forma.destinoFijo, elegido.destino),
  };
}

export function ladosPorDefecto(tipo: TipoMovimiento): Lados {
  const forma = LADOS_POR_TIPO[tipo];
  return {
    origen: forma.origen === 'ninguno' ? null : (forma.origenFijo ?? 'maun'),
    destino:
      forma.destino === 'ninguno' || forma.destino === 'opcional'
        ? null
        : (forma.destinoFijo ?? 'hogar'),
  };
}

export function faltaUnLado(tipo: TipoMovimiento, lados: Lados): boolean {
  const forma = LADOS_POR_TIPO[tipo];
  const cuantos = Number(lados.origen !== null) + Number(lados.destino !== null);

  if (forma.origen === 'opcional' && forma.destino === 'opcional') return cuantos !== 1;
  if (forma.origen !== 'ninguno' && lados.origen === null) return true;
  if (forma.destino !== 'ninguno' && lados.destino === null) return true;
  return lados.origen !== null && lados.origen === lados.destino;
}
