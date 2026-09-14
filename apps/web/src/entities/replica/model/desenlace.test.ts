import { describe, expect, it } from 'vitest';

import { describirDesenlace } from './desenlace';

describe('describirDesenlace', () => {
  it('usa el vocabulario del indicador de sincronización, con un ícono por estado', () => {
    expect(describirDesenlace({ tipo: 'estado', estado: { tipo: 'sincronizado' } })).toEqual({
      icono: 'check',
      texto: 'Todo sincronizado.',
    });
    expect(
      describirDesenlace({ tipo: 'estado', estado: { tipo: 'sin-conexion', pendientes: 2 } }),
    ).toEqual({
      icono: 'cloud-off',
      texto: 'Sin conexión. 2 cambios se van a sincronizar cuando vuelva la señal.',
    });
    expect(
      describirDesenlace({ tipo: 'estado', estado: { tipo: 'pendiente', pendientes: 1 } }),
    ).toEqual({ icono: 'arrow-up-down', texto: 'Sincronizando 1 cambio…' });
  });

  it('un corte de red dice que no hay conexión, sin mostrar el error del navegador', () => {
    const { icono, texto } = describirDesenlace({
      tipo: 'fallo',
      error: new TypeError('Failed to fetch'),
    });
    expect(icono).toBe('triangle-alert');
    expect(texto).toBe(
      'No se pudo sincronizar. No hay conexión con el servidor. Probá de nuevo cuando vuelva la señal.',
    );
  });
});
