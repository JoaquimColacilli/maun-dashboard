import { describe, expect, it } from 'vitest';

import {
  conElDia,
  conLaFranja,
  diasQueSiguenSirviendo,
  estaElegido,
  llegoAlMaximo,
  mesesDelCalendario,
} from './calendario';

const HOY = '2026-09-25';

describe('el calendario de la entrega', () => {
  it('va de pasado mañana a dentro de 30 días, sin domingos, en los meses que toca', () => {
    const meses = mesesDelCalendario(HOY);
    expect(meses.map((mes) => mes.mes)).toEqual(['2026-09', '2026-10']);

    const celdas = meses.flatMap((mes) => mes.semanas.flat()).filter((celda) => !celda.fuera);
    const elegibles = celdas.filter((celda) => celda.sePuede).map((celda) => celda.fecha);
    expect(elegibles[0]).toBe('2026-09-28');
    expect(elegibles.at(-1)).toBe('2026-10-24');
    expect(elegibles).not.toContain('2026-09-27');
    expect(elegibles).not.toContain('2026-10-04');
    expect(elegibles).toHaveLength(24);
  });

  it('solo muestra las semanas que tienen algún día del rango', () => {
    const [septiembre, octubre] = mesesDelCalendario(HOY);
    expect(septiembre?.semanas).toHaveLength(1);
    expect(septiembre?.semanas[0]?.[0]?.fecha).toBe('2026-09-28');
    expect(octubre?.semanas.at(-1)?.[0]?.fecha).toBe('2026-10-19');
  });
});

describe('los días elegidos', () => {
  it('tocar un día lo suma con la mañana y la tarde, en orden, y tocarlo de nuevo lo saca', () => {
    let dias = conElDia([], '2026-10-02');
    dias = conElDia(dias, '2026-09-29');
    expect(dias).toEqual([
      { fecha: '2026-09-29', franjas: ['manana', 'tarde'] },
      { fecha: '2026-10-02', franjas: ['manana', 'tarde'] },
    ]);
    expect(estaElegido(dias, '2026-09-29')).toBe(true);
    expect(conElDia(dias, '2026-09-29')).toEqual([
      { fecha: '2026-10-02', franjas: ['manana', 'tarde'] },
    ]);
  });

  it('no pasa de diez', () => {
    let dias = conElDia([], '2026-09-28');
    for (const fecha of [
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
    ]) {
      dias = conElDia(dias, fecha);
    }
    expect(llegoAlMaximo(dias)).toBe(true);
    expect(conElDia(dias, '2026-10-09')).toHaveLength(10);
    expect(conElDia(dias, '2026-10-08')).toHaveLength(9);
  });

  it('las franjas se prenden y se apagan, siempre en orden, y sin ninguna el día se va', () => {
    const dias = conElDia([], '2026-09-29');
    const soloTarde = conLaFranja(dias, '2026-09-29', 'manana');
    expect(soloTarde).toEqual([{ fecha: '2026-09-29', franjas: ['tarde'] }]);
    expect(conLaFranja(soloTarde, '2026-09-29', 'manana')).toEqual([
      { fecha: '2026-09-29', franjas: ['manana', 'tarde'] },
    ]);
    expect(conLaFranja(soloTarde, '2026-09-29', 'tarde')).toEqual([]);
    expect(conLaFranja(soloTarde, '2026-10-01', 'tarde')).toEqual(soloTarde);
  });

  it('al cambiar sus días, quedan los que todavía se pueden elegir', () => {
    expect(
      diasQueSiguenSirviendo(
        [
          { fecha: '2026-10-02', franjas: ['tarde'] },
          { fecha: '2026-09-26', franjas: ['manana'] },
          { fecha: '2026-09-28', franjas: ['manana'] },
        ],
        HOY,
      ),
    ).toEqual([
      { fecha: '2026-09-28', franjas: ['manana'] },
      { fecha: '2026-10-02', franjas: ['tarde'] },
    ]);
  });
});
