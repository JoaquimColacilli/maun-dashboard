import { describe, expect, it } from 'vitest';

import {
  analisisDeEntregas,
  cuentaDe,
  DIAS_DE_ACIERTO,
  fraseDeLasCumplidas,
  fraseDeLosAciertos,
  fraseDelDesvio,
  resumirDias,
  SIN_TIPO,
  UMBRAL_CUENTAS,
  UMBRAL_MEDIANA,
  UMBRAL_PORCENTAJE,
  type CambioDeFechaParaElAnalisis,
  type TrabajoParaElAnalisis,
} from './analitico.ts';
import { sumarDias } from './fechas.ts';

function trabajo(id: string, cambios: Partial<TrabajoParaElAnalisis> = {}): TrabajoParaElAnalisis {
  return {
    id,
    titulo: `Trabajo ${id}`,
    tipo: null,
    estado: 'entregado',
    inicio: '2026-09-01',
    listo: null,
    entregado: '2026-10-01',
    ...cambios,
  };
}

function cambio(
  id: string,
  proyectoId: string,
  cambios: Partial<CambioDeFechaParaElAnalisis> = {},
): CambioDeFechaParaElAnalisis {
  return {
    id,
    proyectoId,
    tipo: 'estimada',
    fecha: '2026-09-28',
    origen: 'taller',
    creadoEn: '2026-09-01T12:00:00Z',
    trabajosEnCurso: 2,
    ...cambios,
  };
}

function conDesvios(desvios: readonly number[]): {
  trabajos: TrabajoParaElAnalisis[];
  cambios: CambioDeFechaParaElAnalisis[];
} {
  return {
    trabajos: desvios.map((_, i) => trabajo(`t${String(i).padStart(2, '0')}`)),
    cambios: desvios.map((desvio, i) =>
      cambio(`c${String(i).padStart(2, '0')}`, `t${String(i).padStart(2, '0')}`, {
        fecha: sumarDias('2026-10-01', -desvio),
      }),
    ),
  };
}

describe('los umbrales', () => {
  it('son los del pedido: casos sueltos hasta 4, mediana desde 5, cuentas desde 10 y porcentajes desde 20', () => {
    expect(UMBRAL_MEDIANA).toBe(5);
    expect(UMBRAL_CUENTAS).toBe(10);
    expect(UMBRAL_PORCENTAJE).toBe(20);
    expect(DIAS_DE_ACIERTO).toBe(3);
  });
});

describe('resumirDias', () => {
  it('con menos de 5, solo los valores uno por uno', () => {
    expect(resumirDias([3, -1, 4, 0])).toEqual({ modo: 'casos', n: 4, valores: [3, -1, 4, 0] });
  });

  it('desde 5, la mediana, el rango y n', () => {
    expect(resumirDias([9, -2, 4, 1, 0])).toEqual({
      modo: 'mediana',
      n: 5,
      mediana: 1,
      minimo: -2,
      maximo: 9,
    });
  });

  it('con una cantidad par, la mediana es el promedio de los dos del medio', () => {
    expect(resumirDias([1, 2, 3, 4, 5, 6])).toMatchObject({ mediana: 3.5, n: 6 });
  });
});

describe('cuentaDe', () => {
  it('k de n, y el porcentaje recién desde 20', () => {
    expect(cuentaDe(7, 12)).toEqual({ k: 7, n: 12, porcentaje: null });
    expect(cuentaDe(15, 22)).toEqual({ k: 15, n: 22, porcentaje: 68 });
  });

  it('las frases de los aciertos y de las cumplidas', () => {
    expect(fraseDeLosAciertos(cuentaDe(7, 12))).toBe('Acertaste 7 de 12.');
    expect(fraseDeLasCumplidas(cuentaDe(9, 11))).toBe('Cumpliste 9 de 11 fechas comprometidas.');
    expect(fraseDeLosAciertos(cuentaDe(15, 22))).toBe('Acertaste 15 de 22 (68%).');
    expect(fraseDeLasCumplidas(cuentaDe(20, 20))).toBe(
      'Cumpliste 20 de 20 fechas comprometidas (100%).',
    );
  });
});

describe('la frase del desvío', () => {
  it('sin trabajos, con pocos, y desde la mediana en los dos sentidos', () => {
    expect(fraseDelDesvio(resumirDias([]))).toBe(
      'Todavía no entregaste ningún trabajo con una fecha estimada para comparar.',
    );
    expect(fraseDelDesvio(resumirDias([2]))).toBe(
      'Con un trabajo todavía son pocos para sacar una cuenta: miralos uno por uno.',
    );
    expect(fraseDelDesvio(resumirDias([2, 3, 4]))).toBe(
      'Con 3 trabajos todavía son pocos para sacar una cuenta: miralos uno por uno.',
    );
    expect(fraseDelDesvio(resumirDias([4, 4, 4, 5, 2]))).toBe(
      'Entregás, en la mediana, 4 días después de lo estimado.',
    );
    expect(fraseDelDesvio(resumirDias([1, 1, 1, 0, 2]))).toBe(
      'Entregás, en la mediana, 1 día después de lo estimado.',
    );
    expect(fraseDelDesvio(resumirDias([-3, -2, -1, -4, -2, -1]))).toBe(
      'Entregás, en la mediana, 2 días antes de lo estimado.',
    );
    expect(fraseDelDesvio(resumirDias([0, 1, -1, 0, 0]))).toBe(
      'Entregás, en la mediana, el mismo día que estimaste.',
    );
    expect(fraseDelDesvio(resumirDias([1, 2, 3, 4, 5, 6]))).toBe(
      'Entregás, en la mediana, 3,5 días después de lo estimado.',
    );
  });
});

describe('analisisDeEntregas', () => {
  it('cuenta los entregados y cobrados con su fecha, y dice cuántos no la tienen', () => {
    const analisis = analisisDeEntregas(
      [
        trabajo('a'),
        trabajo('b', { estado: 'cobrado', entregado: '2026-10-03' }),
        trabajo('c', { estado: 'en_curso' }),
        trabajo('d', { entregado: null }),
        trabajo('e', { entregado: '2026-09-29' }),
      ],
      [],
    );
    expect(analisis.trabajos.map((fila) => fila.id)).toEqual(['b', 'a', 'e']);
    expect(analisis.sinFecha).toBe(1);
  });

  it('el desvío es contra la primera estimada, con signo, aunque después se haya movido', () => {
    const analisis = analisisDeEntregas(
      [trabajo('a')],
      [
        cambio('c3', 'a', { fecha: '2026-10-05', creadoEn: '2026-09-20T00:00:00Z' }),
        cambio('c2', 'a', { fecha: '2026-09-28', creadoEn: '2026-09-02T00:00:00Z' }),
        cambio('c1', 'a', { fecha: '2026-09-25', creadoEn: '2026-09-02T00:00:00Z' }),
        cambio('c0', 'a', { fecha: null, tipo: 'comprometida', creadoEn: '2026-09-01T00:00:00Z' }),
      ],
    );
    expect(analisis.trabajos[0]).toMatchObject({
      primeraEstimada: '2026-09-25',
      desvio: 6,
      acierto: false,
      importada: false,
      cargaAlAprobar: 2,
    });
  });

  it('acierta con tres días o menos para cualquier lado', () => {
    const analisis = analisisDeEntregas(
      [trabajo('a'), trabajo('b')],
      [cambio('c1', 'a', { fecha: '2026-10-04' }), cambio('c2', 'b', { fecha: '2026-09-28' })],
    );
    expect(analisis.trabajos.map((fila) => [fila.id, fila.desvio, fila.acierto])).toEqual([
      ['b', 3, true],
      ['a', -3, true],
    ]);
  });

  it('cumple si entregó el día comprometido o antes, contra la primera comprometida', () => {
    const analisis = analisisDeEntregas(
      [trabajo('a'), trabajo('b'), trabajo('c')],
      [
        cambio('c1', 'a', { tipo: 'comprometida', fecha: '2026-10-01' }),
        cambio('c2', 'a', { tipo: 'comprometida', fecha: '2026-10-05', creadoEn: '2026-09-20' }),
        cambio('c3', 'b', { tipo: 'comprometida', fecha: '2026-09-30' }),
      ],
    );
    expect(analisis.trabajos.map((fila) => [fila.id, fila.comprometida, fila.cumplida])).toEqual([
      ['c', null, null],
      ['b', '2026-09-30', false],
      ['a', '2026-10-01', true],
    ]);
  });

  it('la demora cuenta desde el inicio y la fabricación hasta el listo', () => {
    const analisis = analisisDeEntregas(
      [trabajo('a', { listo: '2026-09-25' }), trabajo('b', { inicio: null })],
      [],
    );
    expect(analisis.trabajos.map((fila) => [fila.id, fila.demora, fila.fabricacion])).toEqual([
      ['b', null, null],
      ['a', 30, 24],
    ]);
  });

  it('las importadas van marcadas y la cuenta lo dice', () => {
    const analisis = analisisDeEntregas(
      [trabajo('a')],
      [cambio('c1', 'a', { origen: 'importada', trabajosEnCurso: null })],
    );
    expect(analisis.trabajos[0]).toMatchObject({ importada: true, cargaAlAprobar: null });
    expect(analisis.precision.importadas).toBe(1);
  });

  it('con 4 trabajos, los casos uno por uno y ninguna cuenta', () => {
    const { trabajos, cambios } = conDesvios([1, 2, 5, -1]);
    const { precision } = analisisDeEntregas(trabajos, cambios);
    expect(precision.desvio).toMatchObject({ modo: 'casos', n: 4 });
    expect(precision.aciertos).toBeNull();
    expect(precision.cumplidas).toBeNull();
    expect(precision.frase).toBe(
      'Con 4 trabajos todavía son pocos para sacar una cuenta: miralos uno por uno.',
    );
  });

  it('con 6, la mediana con el rango, y todavía sin los k de n', () => {
    const { trabajos, cambios } = conDesvios([4, 4, 2, 6, 10, -1]);
    const { precision } = analisisDeEntregas(trabajos, cambios);
    expect(precision.desvio).toEqual({ modo: 'mediana', n: 6, mediana: 4, minimo: -1, maximo: 10 });
    expect(precision.aciertos).toBeNull();
  });

  it('con 12, además los k de n de los aciertos y de las comprometidas cumplidas', () => {
    const desvios = [0, 1, 2, 3, 4, 5, 6, 7, -1, -2, -3, -4];
    const { trabajos, cambios } = conDesvios(desvios);
    const comprometidas = trabajos.map((uno, i) =>
      cambio(`k${String(i)}`, uno.id, {
        tipo: 'comprometida',
        fecha: i < 9 ? '2026-10-01' : '2026-09-30',
      }),
    );
    const { precision } = analisisDeEntregas(trabajos, [...cambios, ...comprometidas]);
    expect(precision.aciertos).toEqual({ k: 7, n: 12, porcentaje: null });
    expect(precision.cumplidas).toEqual({ k: 9, n: 12, porcentaje: null });
  });

  it('agrupa por tipo sin mayúsculas ni acentos, con el nombre más usado, y deja aparte los sin tipo', () => {
    const analisis = analisisDeEntregas(
      [
        trabajo('a', { tipo: 'Cocina' }),
        trabajo('z', { tipo: 'cocína ' }),
        trabajo('c', { tipo: 'Cocina' }),
        trabajo('d', { tipo: 'Placard' }),
        trabajo('e', { tipo: 'Vestidor' }),
        trabajo('f', { tipo: 'vestidor' }),
        trabajo('g', { tipo: '  ' }),
        trabajo('h'),
        trabajo('i', { tipo: 'Rack' }),
      ],
      [],
    );
    expect(analisis.porTipo.map((grupo) => [grupo.nombre, grupo.trabajos])).toEqual([
      ['Cocina', 3],
      ['vestidor', 2],
      ['Placard', 1],
      ['Rack', 1],
    ]);
    expect(analisis.sinTipo).toMatchObject({ nombre: SIN_TIPO, trabajos: 2 });
    expect(analisis.porTipo[0]?.demora).toEqual({ modo: 'casos', n: 3, valores: [30, 30, 30] });
  });

  it('sin trabajos sin tipo, no hay grupo sin tipo', () => {
    expect(analisisDeEntregas([trabajo('a', { tipo: 'Rack' })], []).sinTipo).toBeNull();
  });

  it('la demora según los trabajos en curso al aprobar, en tres grupos, y vacía sin conteos', () => {
    const cargas = [0, 1, 2, 3, 4, 7];
    const trabajos = cargas.map((_, i) => trabajo(`t${String(i)}`));
    const cambios = cargas.map((carga, i) =>
      cambio(`c${String(i)}`, `t${String(i)}`, { trabajosEnCurso: carga }),
    );
    const analisis = analisisDeEntregas(trabajos, cambios);
    expect(analisis.porCarga.map((grupo) => [grupo.nombre, grupo.demora.n])).toEqual([
      ['0 o 1', 2],
      ['2 o 3', 2],
      ['4 o más', 2],
    ]);
    const sinConteos = analisisDeEntregas(trabajos, []);
    expect(sinConteos.porCarga.every((grupo) => grupo.demora.n === 0)).toBe(true);
  });
});
