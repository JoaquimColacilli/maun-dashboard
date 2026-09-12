import { describe, expect, it } from 'vitest';

import { formatearPesos, parsearPesos, parsearPesosDesdeCero, pesosEditables } from './plata';

const sinEspacios = (texto: string) => texto.replace(/\s/gu, '');

describe('formatearPesos', () => {
  it('muestra los pesos sin decimales cuando son redondos', () => {
    expect(sinEspacios(formatearPesos(180000000))).toBe('$1.800.000');
    expect(sinEspacios(formatearPesos(0))).toBe('$0');
  });

  it('muestra los centavos cuando los hay', () => {
    expect(sinEspacios(formatearPesos(123456))).toBe('$1.234,56');
  });

  it('muestra el signo de lo negativo', () => {
    expect(sinEspacios(formatearPesos(-50000))).toBe('-$500');
  });
});

describe('parsearPesos', () => {
  it('lee lo que escribe una persona en Argentina', () => {
    expect(parsearPesos('1.234,56')).toBe(123456);
    expect(parsearPesos('1.800.000')).toBe(180000000);
    expect(parsearPesos('$ 12.500')).toBe(1250000);
    expect(parsearPesos('350')).toBe(35000);
    expect(parsearPesos('350,5')).toBe(35050);
  });

  it('acepta el punto decimal de un teclado numérico', () => {
    expect(parsearPesos('1234.56')).toBe(123456);
  });

  it('rechaza lo que no es un importe cargable', () => {
    expect(parsearPesos('')).toBeUndefined();
    expect(parsearPesos('abc')).toBeUndefined();
    expect(parsearPesos('0')).toBeUndefined();
    expect(parsearPesos('-100')).toBeUndefined();
    expect(parsearPesos('1,234')).toBeUndefined();
    expect(parsearPesos('12,,5')).toBeUndefined();
  });
});

describe('pesosEditables', () => {
  it('escribe en el input lo que parsearPesos sabe volver a leer', () => {
    expect(sinEspacios(pesosEditables(180000000))).toBe('1.800.000');
    expect(pesosEditables(0)).toBe('0');
    expect(parsearPesosDesdeCero(pesosEditables(123456))).toBe(123456);
  });
});

describe('parsearPesosDesdeCero', () => {
  it('acepta el cero, que en un objetivo es una respuesta', () => {
    expect(parsearPesosDesdeCero('0')).toBe(0);
    expect(parsearPesosDesdeCero('1.800.000')).toBe(180000000);
  });

  it('sigue rechazando lo que no es un importe', () => {
    expect(parsearPesosDesdeCero('')).toBeUndefined();
    expect(parsearPesosDesdeCero('-100')).toBeUndefined();
    expect(parsearPesosDesdeCero('abc')).toBeUndefined();
  });
});
