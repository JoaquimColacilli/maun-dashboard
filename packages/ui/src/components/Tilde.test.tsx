import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import tema from '../styles/theme.css?raw';
import { Tilde } from './Tilde.tsx';

describe('la tilde', () => {
  it('es un trazo con pathLength 1 en el color del texto, y no se lee', () => {
    const { container } = render(<Tilde />);
    const dibujo = container.querySelector('svg');
    expect(dibujo).toHaveAttribute('aria-hidden', 'true');
    expect(dibujo).toHaveAttribute('stroke', 'currentColor');
    expect(dibujo?.querySelector('path')).toHaveAttribute('pathLength', '1');
    expect(dibujo).not.toHaveAttribute('data-dibujar');
  });

  it('se dibuja solo cuando se lo piden', () => {
    const { container } = render(<Tilde dibujar tamano={14} />);
    const dibujo = container.querySelector('svg');
    expect(dibujo).toHaveAttribute('data-dibujar');
    expect(dibujo).toHaveAttribute('width', '14');
  });

  it('se dibuja con maun-trazo, y la línea del tachado corre un escalón después', () => {
    const [, tilde = ''] = /\.tilde\[data-dibujar\] path \{([^}]*)\}/.exec(tema) ?? [];
    expect(tilde).toContain('stroke-dasharray: 1;');
    expect(tilde).toContain(
      'animation: maun-trazo var(--dur-efectos) var(--resorte-efectos) both;',
    );
    const [, linea = ''] = /\.tachado-que-corre \{([^}]*)\}/.exec(tema) ?? [];
    expect(linea).toContain(
      'animation: maun-tachado var(--dur-efectos) var(--resorte-efectos) var(--dur-escalon) both;',
    );
    const [, copia = ''] = /\.linea-del-tachado \{([^}]*)\}/.exec(tema) ?? [];
    expect(copia).toContain('color: transparent;');
    expect(copia).toContain('text-decoration-line: line-through;');
    expect(tema).toMatch(/@keyframes maun-tachado \{\s*from \{\s*clip-path: inset\(0 100% 0 0\);/);
    expect(tema).toMatch(
      /:where\(html\[data-vista='publica'\], \[data-quieta\]\) :is\(\.tilde path, \.tachado-que-corre\) \{\s*animation: none !important;/,
    );
  });
});
