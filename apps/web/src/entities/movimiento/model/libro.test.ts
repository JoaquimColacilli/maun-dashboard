import { centavos, type LineaDelLibro } from '@maun/domain';
import { describe, expect, it } from 'vitest';

import { agruparPorDia, efectoDeLaLinea, type LineaDelTaller } from './libro';

function linea(extra: Partial<LineaDelTaller> = {}): LineaDelTaller {
  const base: LineaDelLibro = {
    origen: 'distribucion',
    asientoId: 'p',
    fecha: '2026-07-10',
    concepto: 'sueldo',
    desde: 'maun',
    hacia: 'hogar',
    monto: centavos(50_000_000),
    categoria: '',
    descripcion: '',
    proyectoId: 'p',
    yaEnLaApertura: false,
  };
  return {
    ...base,
    clave: 'distribucion:p:sueldo',
    etiqueta: 'Sueldo del reparto',
    detalle: '',
    proyectoTitulo: 'Placard',
    sentido: 'mueve',
    tesoroPrincipal: 'hogar',
    bloqueo: 'del-proyecto',
    ...extra,
  };
}

describe('efectoDeLaLinea', () => {
  it('una línea que ya estaba en los saldos de la apertura no mueve ningún tesoro', () => {
    const marcada = linea({ yaEnLaApertura: true });
    expect(efectoDeLaLinea(marcada, 'hogar')).toBe(0);
    expect(efectoDeLaLinea(marcada, 'maun')).toBe(0);
    expect(efectoDeLaLinea(marcada, 'todos')).toBe(0);
  });

  it('la misma línea sin marcar sí los mueve', () => {
    const comun = linea();
    expect(efectoDeLaLinea(comun, 'hogar')).toBe(50_000_000);
    expect(efectoDeLaLinea(comun, 'maun')).toBe(-50_000_000);
  });

  it('el neto del día no cuenta lo que ya estaba en los saldos', () => {
    const [dia] = agruparPorDia(
      [linea({ yaEnLaApertura: true }), linea({ clave: 'otra', monto: centavos(1_000) })],
      'hogar',
    );
    expect(dia?.neto).toBe(1_000);
  });
});
