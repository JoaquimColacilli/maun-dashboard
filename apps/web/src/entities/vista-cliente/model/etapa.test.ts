import { describe, expect, it } from 'vitest';

import { etapaDelMueble } from './etapa';

describe('etapaDelMueble', () => {
  it('hasta que se aprueba, el mueble es un plano', () => {
    expect(etapaDelMueble('estimativo')).toBe('plano');
    expect(etapaDelMueble('presupuesto')).toBe('plano');
    expect(etapaDelMueble('aprobado')).toBe('plano');
  });

  it('en fabricación está en el taller, entregado está terminado y pagado lleva la tilde', () => {
    expect(etapaDelMueble('fabricacion')).toBe('taller');
    expect(etapaDelMueble('entregado')).toBe('terminado');
    expect(etapaDelMueble('pagado')).toBe('pagado');
  });
});
