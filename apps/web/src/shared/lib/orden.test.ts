import { describe, expect, it } from 'vitest';

import { alternar, criterioPorId, ordenar, type Criterio } from './orden';

interface Fila {
  id: string;
  nombre: string;
  plata: number;
  fecha: string | undefined;
}

const POR_NOMBRE: Criterio<Fila> = {
  id: 'nombre',
  etiqueta: 'Nombre',
  tipo: 'texto',
  leer: (fila) => fila.nombre,
  inicial: 'asc',
};

const POR_PLATA: Criterio<Fila> = {
  id: 'plata',
  etiqueta: 'Plata',
  tipo: 'numero',
  leer: (fila) => fila.plata,
  inicial: 'desc',
};

const POR_FECHA: Criterio<Fila> = {
  id: 'fecha',
  etiqueta: 'Fecha',
  tipo: 'fecha',
  leer: (fila) => fila.fecha,
  inicial: 'asc',
};

const FILAS: Fila[] = [
  { id: '1', nombre: 'ávila', plata: 250_000, fecha: '2026-09-30' },
  { id: '2', nombre: 'Zapata', plata: 1_000_000, fecha: undefined },
  { id: '3', nombre: 'Benítez', plata: 90_000, fecha: '2026-02-01' },
  { id: '4', nombre: 'acuña', plata: 1_000_000, fecha: '2026-10-01' },
];

const nombres = (filas: readonly Fila[]) => filas.map((fila) => fila.nombre);
const desempate = (fila: Fila) => fila.id;

describe('ordenar por texto', () => {
  it('usa la collation del español: los acentos y las mayúsculas no mandan', () => {
    expect(nombres(ordenar(FILAS, POR_NOMBRE, 'asc', desempate))).toEqual([
      'acuña',
      'ávila',
      'Benítez',
      'Zapata',
    ]);
  });

  it('al revés da exactamente lo mismo dado vuelta', () => {
    expect(nombres(ordenar(FILAS, POR_NOMBRE, 'desc', desempate))).toEqual([
      'Zapata',
      'Benítez',
      'ávila',
      'acuña',
    ]);
  });
});

describe('ordenar por plata', () => {
  it('compara los centavos como números, no como texto', () => {
    expect(nombres(ordenar(FILAS, POR_PLATA, 'desc', desempate))).toEqual([
      'Zapata',
      'acuña',
      'ávila',
      'Benítez',
    ]);
  });

  it('desempata siempre igual, así la lista no baila al reordenar', () => {
    const unaVez = ordenar(FILAS, POR_PLATA, 'desc', desempate);
    const otraVez = ordenar([...FILAS].reverse(), POR_PLATA, 'desc', desempate);
    expect(nombres(unaVez)).toEqual(nombres(otraVez));
  });
});

describe('ordenar por fecha', () => {
  it('la más próxima primero, y el que no tiene fecha queda al final', () => {
    expect(nombres(ordenar(FILAS, POR_FECHA, 'asc', desempate))).toEqual([
      'Benítez',
      'ávila',
      'acuña',
      'Zapata',
    ]);
  });

  it('al invertir, el que no tiene fecha sigue al final y no salta al principio', () => {
    expect(nombres(ordenar(FILAS, POR_FECHA, 'desc', desempate))).toEqual([
      'acuña',
      'ávila',
      'Benítez',
      'Zapata',
    ]);
  });
});

describe('la lista que entra', () => {
  it('no se muta', () => {
    const original = nombres(FILAS);
    ordenar(FILAS, POR_NOMBRE, 'asc', desempate);
    expect(nombres(FILAS)).toEqual(original);
  });
});

describe('alternar y criterioPorId', () => {
  it('alternar da la vuelta el sentido', () => {
    expect(alternar('asc')).toBe('desc');
    expect(alternar('desc')).toBe('asc');
  });

  it('criterioPorId encuentra el criterio, y avisa cuando no está', () => {
    expect(criterioPorId([POR_NOMBRE, POR_PLATA], 'plata')).toBe(POR_PLATA);
    expect(criterioPorId([POR_NOMBRE, POR_PLATA], 'inventado')).toBeUndefined();
  });
});
