import { describe, expect, it } from 'vitest';

import { hayCambiosEnElContacto, valoresDelContacto } from './contacto';

describe('hayCambiosEnElContacto', () => {
  const iniciales = valoresDelContacto(undefined, undefined, '2026-09-15');

  it('recién abierta, o tocando solo espacios, no hay nada que perder', () => {
    expect(hayCambiosEnElContacto(iniciales, iniciales, '', undefined)).toBe(false);
    expect(hayCambiosEnElContacto(iniciales, { ...iniciales, notas: '  ' }, '', undefined)).toBe(
      false,
    );
  });

  it('cualquier campo escrito o elegido cuenta, y el teléfono cuenta si difiere del del cliente', () => {
    for (const cambio of [
      { clienteId: 'c1' },
      { titulo: 'Placard' },
      { visita: '2026-09-20' },
      { sena: 5_000_000 },
      { notas: 'Llamar a la tarde' },
      { vencimiento: '2026-09-22' },
    ]) {
      expect(hayCambiosEnElContacto(iniciales, { ...iniciales, ...cambio }, '', undefined)).toBe(
        true,
      );
    }
    expect(hayCambiosEnElContacto(iniciales, iniciales, '11 5555-0000', '11 5555-0000 ')).toBe(
      false,
    );
    expect(hayCambiosEnElContacto(iniciales, iniciales, '11 5555-0000', '11 4444-0000')).toBe(true);
  });
});
