export type Punto = readonly [number, number];

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
