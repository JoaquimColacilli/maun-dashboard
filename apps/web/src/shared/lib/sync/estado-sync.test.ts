import { describe, expect, it } from 'vitest';

import { calcularEstadoSync, describirEstadoSync } from './estado-sync';

describe('calcularEstadoSync', () => {
  it('sin conexión manda aunque haya cambios pendientes', () => {
    expect(calcularEstadoSync(false, 3)).toEqual({ tipo: 'sin-conexion', pendientes: 3 });
    expect(calcularEstadoSync(false, 0, 2)).toEqual({ tipo: 'sin-conexion', pendientes: 0 });
  });

  it('con conexión y cambios en vuelo está pendiente', () => {
    expect(calcularEstadoSync(true, 2)).toEqual({ tipo: 'pendiente', pendientes: 2 });
    expect(calcularEstadoSync(true, 2, 1)).toEqual({ tipo: 'pendiente', pendientes: 2 });
  });

  it('sin cambios en vuelo, lo rechazado se muestra', () => {
    expect(calcularEstadoSync(true, 0, 1)).toEqual({ tipo: 'rechazado', rechazados: 1 });
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
    expect(describirEstadoSync({ tipo: 'sin-conexion', pendientes: 0 })).toBe(
      'Sin conexión. Estás viendo lo último que se sincronizó.',
    );
  });

  it('cuenta lo que está sincronizando', () => {
    expect(describirEstadoSync({ tipo: 'pendiente', pendientes: 1 })).toBe(
      'Sincronizando 1 cambio…',
    );
    expect(describirEstadoSync({ tipo: 'pendiente', pendientes: 4 })).toBe(
      'Sincronizando 4 cambios…',
    );
  });

  it('avisa lo que la base rechazó', () => {
    expect(describirEstadoSync({ tipo: 'rechazado', rechazados: 1 })).toBe(
      'Hay 1 cambio que no se pudo guardar.',
    );
    expect(describirEstadoSync({ tipo: 'rechazado', rechazados: 2 })).toBe(
      'Hay 2 cambios que no se pudieron guardar.',
    );
  });

  it('describe el estado sincronizado', () => {
    expect(describirEstadoSync({ tipo: 'sincronizado' })).toBe('Todo sincronizado.');
  });
});
