import { describe, expect, it } from 'vitest';

import { CLAVE_DE_LA_MEMORIA, memoriaEn, TOPE_DE_LA_MEMORIA } from './memoria';

function almacen() {
  const valores = new Map<string, string>();
  return {
    getItem: (clave: string) => valores.get(clave) ?? null,
    setItem: (clave: string, valor: string) => {
      valores.set(clave, valor);
    },
  };
}

describe('la memoria de los movimientos', () => {
  it('guarda un movimiento por entrada y el último pisa al anterior', () => {
    const memoria = memoriaEn(almacen());
    memoria.anotar('a', 'empuje');
    memoria.anotar('b', 'tarjeta');
    memoria.anotar('a', 'fundido');
    expect(memoria.leer('a')).toBe('fundido');
    expect(memoria.leer('b')).toBe('tarjeta');
    expect(memoria.leer('c')).toBeUndefined();
  });

  it('tiene un tope y olvida lo más viejo', () => {
    const memoria = memoriaEn(almacen());
    for (let indice = 0; indice <= TOPE_DE_LA_MEMORIA; indice += 1) {
      memoria.anotar(`k${String(indice)}`, 'empuje');
    }
    expect(memoria.leer('k0')).toBeUndefined();
    expect(memoria.leer(`k${String(TOPE_DE_LA_MEMORIA)}`)).toBe('empuje');
  });

  it('descarta lo que no entiende y anda sin almacén', () => {
    const roto = almacen();
    roto.setItem(CLAVE_DE_LA_MEMORIA, '{"no":"es una lista"}');
    expect(memoriaEn(roto).leer('a')).toBeUndefined();
    roto.setItem(
      CLAVE_DE_LA_MEMORIA,
      JSON.stringify([
        ['a', 'salto-mortal'],
        ['b', 'vuelta'],
      ]),
    );
    expect(memoriaEn(roto).leer('a')).toBeUndefined();
    expect(memoriaEn(roto).leer('b')).toBe('vuelta');
    const sinAlmacen = memoriaEn(null);
    sinAlmacen.anotar('a', 'empuje');
    expect(sinAlmacen.leer('a')).toBeUndefined();
  });
});
