import { centavos, vistaDelCliente, type TrabajoDelCliente } from '@maun/domain';
import { describe, expect, it } from 'vitest';

import { etapaDelDibujo } from './etapa';

const HOY = '2026-09-18';

function trabajo(cambios: Partial<TrabajoDelCliente> = {}): TrabajoDelCliente {
  return {
    taller: 'Taller MAUN',
    cliente: 'Marcela Duarte',
    trabajo: 'Placard 3 puertas',
    direccion: 'Olazábal 1240, Ituzaingó',
    estado: 'en_curso',
    precio: centavos(124_000_000),
    sena: centavos(62_000_000),
    fechas: {
      estimativo: null,
      presupuesto: '2026-08-01',
      aprobado: '2026-08-04',
      inicio: null,
      entregaPautada: null,
      listo: null,
      entregado: null,
      cobro: null,
      valeHasta: null,
    },
    visita: { dia: null, hecha: false },
    entrega: { comprometida: null, propuesta: null, respuesta: null },
    pago: { instancia: 'saldo', formas: [], monto: centavos(62_000_000), siguiente: null },
    cobro: { alias: null, cbu: null, titular: null, cuit: null, link: null },
    pagos: [],
    archivos: [],
    ...cambios,
  };
}

function dibujo(cambios: Partial<TrabajoDelCliente>) {
  return etapaDelDibujo(vistaDelCliente(trabajo(cambios), HOY));
}

describe('etapaDelDibujo', () => {
  it('antes del presupuesto dibuja el número estimado o la hoja que se está escribiendo', () => {
    expect(dibujo({ estado: 'presupuesto_estimativo', precio: null })).toBe('estimativo');
    expect(dibujo({ estado: 'contacto', precio: null })).toBe('preparando');
    expect(dibujo({ estado: 'a_presupuestar', precio: null })).toBe('preparando');
  });

  it('con el presupuesto mandado dibuja la hoja terminada', () => {
    expect(dibujo({ estado: 'presupuesto_enviado' })).toBe('presupuesto');
  });

  it('la plata va arriba del presupuesto solo cuando la seña está cubierta', () => {
    expect(dibujo({})).toBe('sena');
    expect(
      dibujo({
        pago: { instancia: 'sena', formas: [], monto: centavos(62_000_000), siguiente: null },
      }),
    ).toBe('presupuesto');
    expect(dibujo({ sena: centavos(0) })).toBe('presupuesto');
  });

  it('listo, la hoja del mes con el día rodeado, también con la entrega ya comprometida', () => {
    const lista = { ...trabajo().fechas, inicio: '2026-09-01', listo: '2026-09-17' };
    expect(dibujo({ fechas: lista })).toBe('listo');
    expect(
      dibujo({
        fechas: lista,
        entrega: {
          comprometida: { fecha: '2026-09-25', franja: 'manana' },
          propuesta: null,
          respuesta: null,
        },
      }),
    ).toBe('listo');
  });

  it('después sigue al trabajo: el taller, la casa y la casa con la tilde', () => {
    expect(dibujo({ fechas: { ...trabajo().fechas, inicio: '2026-09-01' } })).toBe('fabricacion');
    expect(
      dibujo({
        estado: 'entregado',
        fechas: { ...trabajo().fechas, inicio: '2026-09-01', entregado: '2026-09-16' },
      }),
    ).toBe('entregado');
    expect(dibujo({ estado: 'cobrado' })).toBe('pagado');
  });
});
