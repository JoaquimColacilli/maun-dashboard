import { describe, expect, it } from 'vitest';

import {
  catalogoDeNecesidades,
  claveDelNombre,
  cuentaDeLoQueHaceFalta,
  segmentosDeLoQueHaceFalta,
  sugerenciasDeNecesidad,
  SUGERENCIAS_MAXIMAS,
  TIPOS_DE_NECESIDAD,
  type NecesidadUsada,
  type ParaContar,
  type TipoDeNecesidad,
} from './necesidades.ts';

function usada(
  nombre: string,
  usadaEn: string,
  tipo: (typeof TIPOS_DE_NECESIDAD)[number] = 'herraje',
): NecesidadUsada {
  return { tipo, nombre, usadaEn };
}

const nombres = (catalogo: readonly { nombre: string }[]) =>
  catalogo.map((entrada) => entrada.nombre);

function item(tipo: TipoDeNecesidad, listo = false, id = ''): ParaContar & { id: string } {
  return { id, tipo, listo };
}

describe('los tres segmentos de lo que hace falta', () => {
  it('son materiales, herrajes y herramientas, en ese orden: los materiales primero', () => {
    expect(TIPOS_DE_NECESIDAD).toEqual(['material', 'herraje', 'herramienta']);
  });

  it('salen siempre los tres y en ese orden, aunque alguno esté vacío', () => {
    const segmentos = segmentosDeLoQueHaceFalta([item('herramienta'), item('herraje')]);
    expect(segmentos.map((segmento) => segmento.tipo)).toEqual(TIPOS_DE_NECESIDAD);
    expect(segmentos.map((segmento) => segmento.items.length)).toEqual([0, 1, 1]);
  });

  it('cada ítem cae en el segmento de su tipo, en el orden en que venía', () => {
    const [materiales, herrajes, herramientas] = segmentosDeLoQueHaceFalta([
      item('herraje', false, 'bisagras'),
      item('material', false, 'melamina'),
      item('herraje', true, 'pistones'),
      item('material', true, 'laca'),
      item('herramienta', false, 'sierra'),
    ]);
    expect(materiales?.items.map((cosa) => cosa.id)).toEqual(['melamina', 'laca']);
    expect(herrajes?.items.map((cosa) => cosa.id)).toEqual(['bisagras', 'pistones']);
    expect(herramientas?.items.map((cosa) => cosa.id)).toEqual(['sierra']);
  });

  it('cada segmento cuenta sus listos', () => {
    const segmentos = segmentosDeLoQueHaceFalta([
      item('material', true),
      item('material'),
      item('material', true),
      item('herraje'),
    ]);
    expect(segmentos.map((segmento) => [segmento.items.length, segmento.listos])).toEqual([
      [3, 2],
      [1, 0],
      [0, 0],
    ]);
  });
});

describe('la cuenta del encabezado', () => {
  it('sin nada cargado es cero de cero', () => {
    expect(cuentaDeLoQueHaceFalta([])).toEqual({ cuantas: 0, listas: 0 });
  });

  it('suma los materiales con los herrajes y las herramientas', () => {
    const cuenta = cuentaDeLoQueHaceFalta([
      item('material'),
      item('material', true),
      item('material'),
      item('herraje'),
      item('herraje', true),
      item('herraje'),
      item('herraje'),
      item('herramienta'),
      item('herramienta'),
    ]);
    expect(cuenta).toEqual({ cuantas: 9, listas: 2 });
  });

  it('es la suma de los segmentos: el encabezado y las subsecciones no pueden decir otra cosa', () => {
    const items = [item('material', true), item('herraje'), item('herramienta', true)];
    const segmentos = segmentosDeLoQueHaceFalta(items);
    const cuenta = cuentaDeLoQueHaceFalta(items);
    expect(cuenta.cuantas).toBe(segmentos.reduce((suma, s) => suma + s.items.length, 0));
    expect(cuenta.listas).toBe(segmentos.reduce((suma, s) => suma + s.listos, 0));
  });
});

describe('la clave de un nombre', () => {
  it('ignora mayúsculas, acentos y espacios de más', () => {
    expect(claveDelNombre('  Bisagras   Cazoleta ')).toBe('bisagras cazoleta');
    expect(claveDelNombre('TIRADORES')).toBe('tiradores');
    expect(claveDelNombre('Cajón')).toBe('cajon');
  });

  it('un nombre en blanco no tiene clave', () => {
    expect(claveDelNombre('   ')).toBe('');
  });
});

describe('el catálogo sale de lo que ya usó', () => {
  it('la primera vez no sugiere nada, y eso está bien', () => {
    expect(catalogoDeNecesidades([], 'herraje')).toEqual([]);
  });

  it('no mezcla herrajes con herramientas', () => {
    const usadas = [
      usada('Bisagras', '2026-09-01'),
      usada('Sierra Circular', '2026-09-01', 'herramienta'),
    ];
    expect(nombres(catalogoDeNecesidades(usadas, 'herraje'))).toEqual(['Bisagras']);
    expect(nombres(catalogoDeNecesidades(usadas, 'herramienta'))).toEqual(['Sierra Circular']);
  });

  it('cada segmento tiene su catálogo: escribiendo un material no aparece una herramienta', () => {
    const usadas = [
      usada('Laca poliuretánica', '2026-09-02', 'material'),
      usada('Lijadora de banda', '2026-09-03', 'herramienta'),
      usada('Lija 120', '2026-09-04', 'material'),
      usada('Lengüeta', '2026-09-05', 'herraje'),
    ];
    expect(nombres(sugerenciasDeNecesidad(catalogoDeNecesidades(usadas, 'material'), 'l'))).toEqual(
      ['Lija 120', 'Laca poliuretánica'],
    );
    expect(
      nombres(sugerenciasDeNecesidad(catalogoDeNecesidades(usadas, 'herramienta'), 'l')),
    ).toEqual(['Lijadora de banda']);
    expect(nombres(sugerenciasDeNecesidad(catalogoDeNecesidades(usadas, 'herraje'), 'l'))).toEqual([
      'Lengüeta',
    ]);
  });

  it('el mismo nombre en dos segmentos son dos entradas, una en cada catálogo', () => {
    const usadas = [
      usada('Cinta de embalar', '2026-09-01', 'material'),
      usada('Cinta de embalar', '2026-09-02', 'herramienta'),
    ];
    expect(catalogoDeNecesidades(usadas, 'material')).toEqual([
      { nombre: 'Cinta de embalar', veces: 1, ultimaVez: '2026-09-01' },
    ]);
    expect(catalogoDeNecesidades(usadas, 'herramienta')).toEqual([
      { nombre: 'Cinta de embalar', veces: 1, ultimaVez: '2026-09-02' },
    ]);
  });

  it('junta el mismo nombre escrito distinto y lo cuenta una vez por fila', () => {
    const catalogo = catalogoDeNecesidades(
      [
        usada('bisagras', '2026-09-01'),
        usada('Bisagras', '2026-09-05'),
        usada('Pistones', '2026-09-03'),
      ],
      'herraje',
    );
    expect(catalogo).toEqual([
      { nombre: 'Bisagras', veces: 2, ultimaVez: '2026-09-05' },
      { nombre: 'Pistones', veces: 1, ultimaVez: '2026-09-03' },
    ]);
  });

  it('se queda con la última forma en que lo escribió, venga en el orden que venga', () => {
    const alDerecho = catalogoDeNecesidades(
      [usada('bisagras', '2026-09-01'), usada('Bisagras', '2026-09-05')],
      'herraje',
    );
    const alReves = catalogoDeNecesidades(
      [usada('Bisagras', '2026-09-05'), usada('bisagras', '2026-09-01')],
      'herraje',
    );
    expect(nombres(alDerecho)).toEqual(['Bisagras']);
    expect(nombres(alReves)).toEqual(['Bisagras']);
    expect(alReves[0]?.ultimaVez).toBe('2026-09-05');
  });

  it('ordena por lo más usado, y a igual uso por lo más reciente', () => {
    const catalogo = catalogoDeNecesidades(
      [
        usada('Tarugos', '2026-09-01'),
        usada('Bisagras', '2026-09-02'),
        usada('Bisagras', '2026-09-03'),
        usada('Tiradores', '2026-09-09'),
      ],
      'herraje',
    );
    expect(nombres(catalogo)).toEqual(['Bisagras', 'Tiradores', 'Tarugos']);
  });

  it('a igual uso y misma fecha desempata por orden alfabético, para que la lista no baile', () => {
    const catalogo = catalogoDeNecesidades(
      [usada('Zócalo', '2026-09-01'), usada('Ángulo', '2026-09-01')],
      'herraje',
    );
    expect(nombres(catalogo)).toEqual(['Ángulo', 'Zócalo']);
  });

  it('descarta un nombre que quedó en blanco', () => {
    expect(catalogoDeNecesidades([usada('   ', '2026-09-01')], 'herraje')).toEqual([]);
  });
});

describe('las sugerencias', () => {
  const catalogo = catalogoDeNecesidades(
    [
      usada('Bisagras', '2026-09-05'),
      usada('Bisagras', '2026-09-06'),
      usada('Bisagras de Cazoleta', '2026-09-04'),
      usada('Tiradores', '2026-09-03'),
      usada('Tarugos', '2026-09-02'),
      usada('Pistones', '2026-09-01'),
      usada('Guías', '2026-08-30'),
      usada('Zócalos', '2026-08-29'),
    ],
    'herraje',
  );

  it('sin nada escrito ofrece lo más usado, hasta el tope', () => {
    expect(sugerenciasDeNecesidad(catalogo, '')).toHaveLength(SUGERENCIAS_MAXIMAS);
    expect(nombres(sugerenciasDeNecesidad(catalogo, ''))[0]).toBe('Bisagras');
  });

  it('lo que empieza con lo escrito va antes de lo que solo lo contiene', () => {
    expect(nombres(sugerenciasDeNecesidad(catalogo, 'bisagras'))).toEqual(['Bisagras de Cazoleta']);
    expect(nombres(sugerenciasDeNecesidad(catalogo, 'cazoleta'))).toEqual(['Bisagras de Cazoleta']);
  });

  it('no sugiere lo que ya está escrito igual', () => {
    expect(nombres(sugerenciasDeNecesidad(catalogo, 'BISAGRAS'))).not.toContain('Bisagras');
  });

  it('ignora acentos al buscar', () => {
    expect(nombres(sugerenciasDeNecesidad(catalogo, 'gui'))).toEqual(['Guías']);
    expect(nombres(sugerenciasDeNecesidad(catalogo, 'zocal'))).toEqual(['Zócalos']);
  });

  it('con algo que no usó nunca no sugiere nada', () => {
    expect(sugerenciasDeNecesidad(catalogo, 'melamina')).toEqual([]);
  });

  it('respeta un tope propio', () => {
    expect(sugerenciasDeNecesidad(catalogo, '', 2)).toHaveLength(2);
    expect(sugerenciasDeNecesidad(catalogo, 'a', 1)).toHaveLength(1);
  });
});
