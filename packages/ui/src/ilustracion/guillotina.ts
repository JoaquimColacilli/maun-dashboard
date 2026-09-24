export interface Rectangulo {
  x: number;
  y: number;
  largo: number;
  ancho: number;
}

export interface Ubicada<T> extends Rectangulo {
  pieza: T;
}

interface ConParte {
  parte: number;
}

function suma(lista: readonly ConParte[]): number {
  return lista.reduce((total, pieza) => total + pieza.parte, 0);
}

function mejorCorte(lista: readonly ConParte[]): number {
  const total = suma(lista);
  let mejor = 1;
  let diferencia = Number.POSITIVE_INFINITY;
  let acumulado = 0;
  for (let indice = 1; indice < lista.length; indice += 1) {
    acumulado += lista[indice - 1]?.parte ?? 0;
    const esta = Math.abs(total - 2 * acumulado);
    if (esta < diferencia) {
      diferencia = esta;
      mejor = indice;
    }
  }
  return mejor;
}

export function cortar<T extends ConParte>(
  lista: readonly T[],
  zona: Rectangulo,
  sierra: number,
): Ubicada<T>[] {
  const [unica] = lista;
  if (lista.length === 1 && unica !== undefined) return [{ ...zona, pieza: unica }];
  if (lista.length === 0) return [];
  const indice = mejorCorte(lista);
  const primeras = lista.slice(0, indice);
  const resto = lista.slice(indice);
  const proporcion = suma(primeras) / suma(lista);
  if (zona.largo >= zona.ancho) {
    const util = zona.largo - sierra;
    const primero = util * proporcion;
    return [
      ...cortar(primeras, { ...zona, largo: primero }, sierra),
      ...cortar(resto, { ...zona, x: zona.x + primero + sierra, largo: util - primero }, sierra),
    ];
  }
  const util = zona.ancho - sierra;
  const primero = util * proporcion;
  return [
    ...cortar(primeras, { ...zona, ancho: primero }, sierra),
    ...cortar(resto, { ...zona, y: zona.y + primero + sierra, ancho: util - primero }, sierra),
  ];
}
