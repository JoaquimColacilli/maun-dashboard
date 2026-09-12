export type Sentido = 'asc' | 'desc';

export type TipoDeOrden = 'texto' | 'numero' | 'fecha';

export interface Criterio<T> {
  id: string;
  etiqueta: string;
  tipo: TipoDeOrden;
  leer: (fila: T) => string | number | undefined;
  inicial: Sentido;
}

const TEXTO = new Intl.Collator('es', { sensitivity: 'base', numeric: true });

function comparar(tipo: TipoDeOrden, uno: string | number, otro: string | number): number {
  if (typeof uno === 'number' && typeof otro === 'number') return uno - otro;
  const izquierda = String(uno);
  const derecha = String(otro);
  if (tipo === 'texto') return TEXTO.compare(izquierda, derecha);
  return izquierda < derecha ? -1 : izquierda > derecha ? 1 : 0;
}

export function alternar(sentido: Sentido): Sentido {
  return sentido === 'asc' ? 'desc' : 'asc';
}

export function criterioPorId<T>(
  criterios: readonly Criterio<T>[],
  id: string,
): Criterio<T> | undefined {
  return criterios.find((criterio) => criterio.id === id);
}

export function ordenar<T>(
  filas: readonly T[],
  criterio: Criterio<T>,
  sentido: Sentido,
  desempate: (fila: T) => string,
): T[] {
  const signo = sentido === 'asc' ? 1 : -1;

  return [...filas].sort((uno, otro) => {
    const izquierda = criterio.leer(uno);
    const derecha = criterio.leer(otro);

    if (izquierda === undefined || derecha === undefined) {
      if (izquierda !== derecha) return izquierda === undefined ? 1 : -1;
      return TEXTO.compare(desempate(uno), desempate(otro));
    }

    const resultado = comparar(criterio.tipo, izquierda, derecha);
    return resultado === 0 ? TEXTO.compare(desempate(uno), desempate(otro)) : resultado * signo;
  });
}
