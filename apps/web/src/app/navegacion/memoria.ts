import type { Movimiento } from './politica';

export const CLAVE_DE_LA_MEMORIA = 'maun:movimientos';
export const TOPE_DE_LA_MEMORIA = 200;

const MOVIMIENTOS: readonly Movimiento[] = [
  'fundido',
  'empuje',
  'vuelta',
  'subida',
  'bajada',
  'tarjeta',
  'tarjeta-vuelta',
  'pestana-adelante',
  'pestana-atras',
];

function esMovimiento(valor: unknown): valor is Movimiento {
  return typeof valor === 'string' && (MOVIMIENTOS as readonly string[]).includes(valor);
}

export interface AlmacenDeLaMemoria {
  getItem: (clave: string) => string | null;
  setItem: (clave: string, valor: string) => void;
}

export interface Memoria {
  leer: (key: string) => Movimiento | undefined;
  anotar: (key: string, movimiento: Movimiento) => void;
}

function leerTodo(almacen: AlmacenDeLaMemoria | null): [string, Movimiento][] {
  try {
    const crudo: unknown = JSON.parse(almacen?.getItem(CLAVE_DE_LA_MEMORIA) ?? '[]');
    if (!Array.isArray(crudo)) return [];
    return crudo.filter(
      (par): par is [string, Movimiento] =>
        Array.isArray(par) && typeof par[0] === 'string' && esMovimiento(par[1]),
    );
  } catch {
    return [];
  }
}

export function memoriaEn(almacen: AlmacenDeLaMemoria | null): Memoria {
  return {
    leer: (key) => leerTodo(almacen).find(([clave]) => clave === key)?.[1],
    anotar: (key, movimiento) => {
      const otras = leerTodo(almacen).filter(([clave]) => clave !== key);
      const todas = [...otras, [key, movimiento] as [string, Movimiento]].slice(
        -TOPE_DE_LA_MEMORIA,
      );
      try {
        almacen?.setItem(CLAVE_DE_LA_MEMORIA, JSON.stringify(todas));
      } catch {
        return;
      }
    },
  };
}

function almacenDeLaSesion(): AlmacenDeLaMemoria | null {
  try {
    return globalThis.sessionStorage;
  } catch {
    return null;
  }
}

export function memoriaDeLaSesion(): Memoria {
  return memoriaEn(almacenDeLaSesion());
}
