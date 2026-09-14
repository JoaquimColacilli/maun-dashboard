import { describe, expect, it } from 'vitest';

import type { FilaDe } from '@/shared/api';

import {
  anotacionNueva,
  erroresDeLaAnotacion,
  esFecha,
  fechaDelParametro,
  hayErrores,
  trabajosParaAnotar,
  valoresIniciales,
} from './anotacion';

describe('la hoja de anotar', () => {
  it('arranca vacía, en materiales, sin marcar y en el día que le pasan', () => {
    expect(valoresIniciales('2026-09-16')).toEqual({
      texto: '',
      categoria: 'materiales',
      fecha: '2026-09-16',
      hora: '',
      proyectoId: '',
      importante: false,
    });
  });

  it('pide el texto, no deja pasar de 500 caracteres y pide un día que exista', () => {
    expect(erroresDeLaAnotacion(valoresIniciales('2026-09-16'))).toEqual({
      texto: 'Escribí qué hay que hacer.',
    });
    expect(
      erroresDeLaAnotacion({ ...valoresIniciales('2026-09-16'), texto: 'a'.repeat(501) }).texto,
    ).toBe('No puede pasar de 500 caracteres.');
    expect(erroresDeLaAnotacion({ ...valoresIniciales('2026-02-30'), texto: 'Algo' })).toEqual({
      fecha: 'Elegí el día.',
    });
    expect(hayErrores({})).toBe(false);
    expect(hayErrores({ texto: 'x' })).toBe(true);
  });

  it('arma la anotación: texto sin espacios de más, y hora y trabajo vacíos van como null', () => {
    expect(
      anotacionNueva('n1', {
        ...valoresIniciales('2026-09-16'),
        texto: '  Comprar melamina  ',
        categoria: 'materiales',
      }),
    ).toEqual({
      id: 'n1',
      fecha: '2026-09-16',
      hora: null,
      texto: 'Comprar melamina',
      categoria: 'materiales',
      proyecto_id: null,
      hecha: false,
      importante: false,
    });
    expect(
      anotacionNueva('n2', {
        texto: 'Retirar el pulpo',
        categoria: 'taller',
        fecha: '2026-09-08',
        hora: '15:00',
        proyectoId: 'p1',
        importante: true,
      }),
    ).toMatchObject({ hora: '15:00', proyecto_id: 'p1', importante: true, categoria: 'taller' });
  });

  it('la fecha que llega por la dirección se usa solo si es una fecha que existe', () => {
    expect(esFecha('2026-09-16')).toBe(true);
    expect(esFecha('2026-02-30')).toBe(false);
    expect(esFecha('mañana')).toBe(false);
    expect(esFecha(null)).toBe(false);
    expect(fechaDelParametro('2026-09-20', '2026-09-14')).toBe('2026-09-20');
    expect(fechaDelParametro('cualquier cosa', '2026-09-14')).toBe('2026-09-14');
  });

  it('ofrece los trabajos que siguen abiertos, con su cliente, en orden alfabético', () => {
    const proyecto = (id: string, titulo: string, estado: string, cliente = 'c1') =>
      ({ id, titulo, estado, cliente_id: cliente }) as unknown as FilaDe<'proyectos'>;
    const clientes = [{ id: 'c1', nombre: 'Villalba' }] as unknown as FilaDe<'clientes'>[];

    expect(
      trabajosParaAnotar(
        [
          proyecto('p1', 'Vestidor', 'en_curso'),
          proyecto('p2', 'Biblioteca', 'a_presupuestar'),
          proyecto('p3', 'Vanitory', 'cobrado'),
          proyecto('p4', 'Mesa', 'perdido'),
          proyecto('p5', 'Alacena', 'contacto', 'otro'),
        ],
        clientes,
      ),
    ).toEqual([
      { id: 'p5', etiqueta: 'Alacena' },
      { id: 'p2', etiqueta: 'Biblioteca — Villalba' },
      { id: 'p1', etiqueta: 'Vestidor — Villalba' },
    ]);
  });
});
