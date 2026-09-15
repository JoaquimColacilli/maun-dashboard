import { describe, expect, it } from 'vitest';

import { COLUMNAS_DE_MARCAS } from '@/shared/api';

import type { Proyecto } from './catalogos';
import { cambiaAlgunaMarca, marcaDeImportante, marcaPuesta } from './marcas';

function fila(marcas: Partial<Proyecto> = {}): Proyecto {
  return {
    presupuesto_importante: false,
    visita_importante: false,
    entrega_importante: false,
    ...marcas,
  } as unknown as Proyecto;
}

describe('las marcas de importante de un trabajo', () => {
  it('marcar un evento cambia solo su columna', () => {
    for (const columna of COLUMNAS_DE_MARCAS) {
      expect(marcaDeImportante(columna, true)).toEqual({ [columna]: true });
      expect(marcaDeImportante(columna, false)).toEqual({ [columna]: false });
    }
  });

  it('dice si la marca cambia, para subir la versión solo cuando la base la sube', () => {
    expect(cambiaAlgunaMarca(fila(), { visita_importante: true })).toBe(true);
    expect(cambiaAlgunaMarca(fila({ visita_importante: true }), { visita_importante: true })).toBe(
      false,
    );
    expect(cambiaAlgunaMarca(fila(), {})).toBe(false);
  });

  it('una fila guardada en el dispositivo antes de que existieran las marcas no tiene ninguna puesta', () => {
    const vieja = {} as Proyecto;
    expect(marcaPuesta(vieja, 'entrega_importante')).toBe(false);
    expect(cambiaAlgunaMarca(vieja, { entrega_importante: false })).toBe(false);
    expect(marcaPuesta(fila({ entrega_importante: true }), 'entrega_importante')).toBe(true);
  });
});
