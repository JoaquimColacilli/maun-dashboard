import { describe, expect, it } from 'vitest';

import {
  CLAVE_DE_LA_CAMARA_LENTA,
  leerLaCamaraLenta,
  type AlmacenDeLaCamaraLenta,
} from './camara-lenta';

function almacen(inicial: Record<string, string> = {}): AlmacenDeLaCamaraLenta & {
  valores: Map<string, string>;
} {
  const valores = new Map(Object.entries(inicial));
  return {
    valores,
    getItem: (clave) => valores.get(clave) ?? null,
    setItem: (clave, valor) => {
      valores.set(clave, valor);
    },
    removeItem: (clave) => {
      valores.delete(clave);
    },
  };
}

const url = (camino: string) => new URL(camino, 'https://maun.test');

describe('la cámara lenta', () => {
  it('se prende con el parámetro, se recuerda en la sesión y la dirección queda sin él', () => {
    const guardado = almacen();
    expect(
      leerLaCamaraLenta(url('/proyectos?etapa=historial&camara-lenta#arriba'), guardado),
    ).toEqual({ activa: true, direccionLimpia: '/proyectos?etapa=historial#arriba' });
    expect(guardado.valores.get(CLAVE_DE_LA_CAMARA_LENTA)).toBe('1');
    expect(leerLaCamaraLenta(url('/clientes'), guardado)).toEqual({
      activa: true,
      direccionLimpia: null,
    });
  });

  it('se apaga con camara-lenta=0 o =no', () => {
    const guardado = almacen({ [CLAVE_DE_LA_CAMARA_LENTA]: '1' });
    expect(leerLaCamaraLenta(url('/?camara-lenta=0'), guardado)).toEqual({
      activa: false,
      direccionLimpia: '/',
    });
    expect(guardado.valores.has(CLAVE_DE_LA_CAMARA_LENTA)).toBe(false);
    guardado.valores.set(CLAVE_DE_LA_CAMARA_LENTA, '1');
    expect(leerLaCamaraLenta(url('/?camara-lenta=no'), guardado).activa).toBe(false);
  });

  it('sin almacén, o con uno que falla, anda igual sin recordar', () => {
    expect(leerLaCamaraLenta(url('/?camara-lenta'), null)).toEqual({
      activa: true,
      direccionLimpia: '/',
    });
    const roto: AlmacenDeLaCamaraLenta = {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('bloqueado');
      },
      removeItem: () => {
        throw new Error('bloqueado');
      },
    };
    expect(leerLaCamaraLenta(url('/?camara-lenta'), roto).activa).toBe(true);
    expect(leerLaCamaraLenta(url('/'), roto).activa).toBe(false);
  });
});
