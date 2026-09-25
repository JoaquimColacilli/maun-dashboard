export type Punto = readonly [number, number];

export type Punto3 = readonly [number, number, number];

export interface Volumen {
  x: number;
  y: number;
  z: number;
  largo: number;
  ancho: number;
  alto: number;
}

const COSENO = Math.sqrt(3) / 2;
const SENO = 0.5;

export function redondear(valor: number): number {
  return Math.round(valor * 100) / 100;
}

export function iso(x: number, y: number, z: number): Punto {
  return [redondear((x - y) * COSENO), redondear((x + y) * SENO - z)];
}

export function puntos(...lista: readonly Punto[]): string {
  return lista.map(([x, y]) => `${String(x)},${String(y)}`).join(' ');
}

export function recorrido(...lista: readonly Punto[]): string {
  return lista
    .map(([x, y], indice) => `${indice === 0 ? 'M' : 'L'}${String(x)} ${String(y)}`)
    .join('');
}

function matriz(a: number, b: number, c: number, d: number, e: number, f: number): string {
  return `matrix(${[a, b, c, d, e, f].map((valor) => String(redondear(valor))).join(' ')})`;
}

export function planoDelPiso(z: number): string {
  return matriz(COSENO, SENO, -COSENO, SENO, 0, -z);
}

export function planoDeFrente(y: number): string {
  return matriz(COSENO, SENO, 0, 1, -y * COSENO, y * SENO);
}

export function planoDeCostado(x: number): string {
  return matriz(-COSENO, SENO, 0, 1, x * COSENO, x * SENO);
}

export function planoInclinado(arriba: Punto3, abajo: Punto3): string {
  const [, y0, z0] = arriba;
  const [, y1, z1] = abajo;
  const caida = Math.hypot(y1 - y0, z1 - z0);
  const dy = (y1 - y0) / caida;
  const dz = (z1 - z0) / caida;
  const [e, f] = iso(...arriba);
  return matriz(COSENO, SENO, -dy * COSENO, dy * SENO - dz, e, f);
}

export interface Limites {
  izquierda: number;
  derecha: number;
  arriba: number;
  abajo: number;
}

export function limites(volumenes: readonly Volumen[]): Limites {
  const esquinas = volumenes.flatMap(({ x, y, z, largo, ancho, alto }) => [
    iso(x, y, z + alto),
    iso(x + largo, y, z),
    iso(x + largo, y, z + alto),
    iso(x + largo, y + ancho, z),
    iso(x, y + ancho, z),
    iso(x, y + ancho, z + alto),
  ]);
  return {
    izquierda: Math.min(...esquinas.map(([x]) => x)),
    derecha: Math.max(...esquinas.map(([x]) => x)),
    arriba: Math.min(...esquinas.map(([, y]) => y)),
    abajo: Math.max(...esquinas.map(([, y]) => y)),
  };
}

export function encerrar(lista: readonly Punto3[]): Limites {
  const vistos = lista.map(([x, y, z]) => iso(x, y, z));
  return {
    izquierda: Math.min(...vistos.map(([x]) => x)),
    derecha: Math.max(...vistos.map(([x]) => x)),
    arriba: Math.min(...vistos.map(([, y]) => y)),
    abajo: Math.max(...vistos.map(([, y]) => y)),
  };
}

export function unir(...lista: readonly Limites[]): Limites {
  return {
    izquierda: Math.min(...lista.map((limite) => limite.izquierda)),
    derecha: Math.max(...lista.map((limite) => limite.derecha)),
    arriba: Math.min(...lista.map((limite) => limite.arriba)),
    abajo: Math.max(...lista.map((limite) => limite.abajo)),
  };
}

export function correr(limite: Limites, x: number, y: number): Limites {
  return {
    izquierda: limite.izquierda + x,
    derecha: limite.derecha + x,
    arriba: limite.arriba + y,
    abajo: limite.abajo + y,
  };
}
