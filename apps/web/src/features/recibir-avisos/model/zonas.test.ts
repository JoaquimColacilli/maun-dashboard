import { describe, expect, it } from 'vitest';

import { desfaseDeLaZona, opcionesDeZona } from './zonas';

const SEPTIEMBRE = new Date(Date.UTC(2026, 8, 14, 12));
const ENERO = new Date(Date.UTC(2026, 0, 14, 12));

describe('desfaseDeLaZona', () => {
  it('lo calcula para la fecha, con el horario de verano de cada lugar', () => {
    expect(desfaseDeLaZona('America/Argentina/Buenos_Aires', SEPTIEMBRE)).toBe('GMT−3');
    expect(desfaseDeLaZona('Europe/Madrid', SEPTIEMBRE)).toBe('GMT+2');
    expect(desfaseDeLaZona('Europe/Madrid', ENERO)).toBe('GMT+1');
  });
});

describe('opcionesDeZona', () => {
  it('ofrece las zonas de la lista con su desfase', () => {
    const opciones = opcionesDeZona(null, SEPTIEMBRE);
    expect(opciones).toHaveLength(6);
    expect(opciones[0]).toEqual({
      id: 'America/Argentina/Buenos_Aires',
      etiqueta: 'Argentina (GMT−3)',
    });
  });

  it('una zona guardada que no está en la lista se suma al final', () => {
    const opciones = opcionesDeZona('America/Mexico_City', SEPTIEMBRE);
    expect(opciones).toHaveLength(7);
    expect(opciones.at(-1)).toEqual({
      id: 'America/Mexico_City',
      etiqueta: 'America/Mexico City (GMT−6)',
    });
    expect(opcionesDeZona('Europe/Madrid', SEPTIEMBRE)).toHaveLength(6);
  });
});
