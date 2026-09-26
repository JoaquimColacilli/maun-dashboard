import { describe, expect, it } from 'vitest';

import tema from './styles/theme.css?raw';

function bloque(css: string, apertura: string): string {
  const desde = css.indexOf(apertura);
  if (desde < 0) return '';
  let profundidad = 0;
  for (let indice = css.indexOf('{', desde); indice < css.length; indice += 1) {
    if (css[indice] === '{') profundidad += 1;
    if (css[indice] === '}') profundidad -= 1;
    if (profundidad === 0) return css.slice(desde, indice + 1);
  }
  return '';
}

describe('el apretón', () => {
  const apreton = bloque(tema, '@utility apretable');

  it('hunde el control a 0,97 con el resorte de efectos rápidos, solo mientras se aprieta', () => {
    expect(tema).toContain('--escala-del-apreton: 0.97;');
    expect(apreton).toContain('&:active:not(:disabled)');
    expect(apreton).toContain('scale: var(--escala-del-apreton);');
    expect(apreton).toContain('scale var(--dur-efectos-rapidos) var(--resorte-efectos-rapidos)');
  });

  it('al soltar vuelve sin transición, y suma la que el elemento ya tenía', () => {
    const [, base = ''] = /@utility apretable \{\s*transition: ([^;]+);/.exec(apreton) ?? [];
    expect(base).toBe('var(--transicion-propia, scale 0s)');
    expect(apreton).toMatch(/transition:\s*var\(--transicion-propia, scale 0s\),\s*scale /);
  });

  it('con menos movimiento y en las páginas del cliente no se hunde', () => {
    expect(bloque(apreton, '@media (prefers-reduced-motion: reduce)')).toContain('scale: none;');
    expect(apreton).toMatch(
      /:where\(html\[data-vista='publica'\], \[data-quieta\]\) &:active:not\(:disabled\) \{\s*scale: none;/,
    );
  });
});

describe('con menos movimiento', () => {
  it('ninguna animación se repite: un loop sin guarda queda en su primer cuadro', () => {
    const barrido = bloque(
      bloque(tema, '@media (prefers-reduced-motion: reduce)'),
      '*,\n  *::before,',
    );
    expect(barrido).toContain('animation-duration: 0.01ms !important;');
    expect(barrido).toContain('animation-iteration-count: 1 !important;');
    expect(barrido).toContain('transition-duration: 0.01ms !important;');
  });
});
