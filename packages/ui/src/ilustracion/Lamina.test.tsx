import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Ilustracion } from './Ilustracion.tsx';
import { Lamina } from './Lamina.tsx';

describe('Lamina', () => {
  it('es el lugar del dibujo: no se lee y suma las clases de quien la ubica', () => {
    const { container } = render(
      <Lamina className="h-44">
        <Ilustracion nombre="sin-proyectos" />
      </Lamina>,
    );
    const lamina = container.firstElementChild;

    expect(lamina).toHaveAttribute('aria-hidden', 'true');
    expect(lamina).toHaveAttribute('data-lamina');
    expect(lamina).toHaveClass('lamina', 'h-44');
    expect(lamina?.querySelectorAll('svg.ilustracion')).toHaveLength(1);
  });
});
