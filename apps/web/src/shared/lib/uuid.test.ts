import { describe, expect, it } from 'vitest';

import { uuidv7 } from './uuid';

describe('uuidv7', () => {
  it('tiene la forma de un UUID versión 7', () => {
    expect(uuidv7()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('queda ordenado por tiempo: es lo que hace que los inserts caigan al final del índice', () => {
    const temprano = uuidv7(Date.parse('2026-09-11T12:00:00Z'));
    const tarde = uuidv7(Date.parse('2026-09-11T12:00:01Z'));
    expect(temprano < tarde).toBe(true);
  });

  it('dos ids del mismo milisegundo son distintos', () => {
    const ahora = Date.parse('2026-09-11T12:00:00Z');
    expect(uuidv7(ahora)).not.toBe(uuidv7(ahora));
  });

  it('guarda los milisegundos en los primeros 48 bits', () => {
    const ahora = Date.parse('2026-09-11T12:00:00Z');
    const marca = uuidv7(ahora).replace(/-/g, '').slice(0, 12);
    expect(Number.parseInt(marca, 16)).toBe(ahora);
  });
});
