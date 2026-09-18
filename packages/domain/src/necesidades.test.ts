import { describe, expect, it } from 'vitest';

import {
  catalogoDeNecesidades,
  claveDelNombre,
  sugerenciasDeNecesidad,
  SUGERENCIAS_MAXIMAS,
  TIPOS_DE_NECESIDAD,
  type NecesidadUsada,
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
