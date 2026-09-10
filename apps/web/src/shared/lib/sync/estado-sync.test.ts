import { describe, expect, it } from 'vitest';

import { calcularEstadoSync, describirEstadoSync } from './estado-sync';

describe('calcularEstadoSync', () => {
  it('sin conexión manda aunque haya cambios pendientes', () => {
    expect(calcularEstadoSync(false, 3)).toEqual({ tipo: 'sin-conexion', pendientes: 3 });
  });

  it('con conexión y cambios en vuelo está pendiente', () => {
    expect(calcularEstadoSync(true, 2)).toEqual({ tipo: 'pendiente', pendientes: 2 });
  });

  it('con conexión y sin cambios está sincronizado', () => {
    expect(calcularEstadoSync(true, 0)).toEqual({ tipo: 'sincronizado' });
  });
});

describe('describirEstadoSync', () => {
  it('no dice que algo se guardó si está en cola', () => {
    expect(describirEstadoSync({ tipo: 'sin-conexion', pendientes: 3 })).toBe(
      'Sin conexión. 3 cambios se van a sincronizar cuando vuelva la señal.',
    );
    expect(describirEstadoSync({ tipo: 'sin-conexion', pendientes: 1 })).toBe(
      'Sin conexión. 1 cambio se va a sincronizar cuando vuelva la señal.',
    );
  });

  it('describe el estado sincronizado', () => {
    expect(describirEstadoSync({ tipo: 'sincronizado' })).toBe('Todo sincronizado.');
  });
});
