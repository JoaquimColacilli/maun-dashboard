import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Avatar, colorDelNombre, inicialesDelNombre } from './Avatar.tsx';

describe('Avatar', () => {
  it('muestra la inicial del nombre y la del apellido', () => {
    const { container } = render(<Avatar nombre="Joaquim Colacilli" />);
    expect(container.textContent).toBe('JC');
  });

  it('con una sola palabra muestra una inicial, y con acentos y ñ también', () => {
    expect(inicialesDelNombre('taller@maun.com.ar')).toBe('T');
    expect(inicialesDelNombre('  Ñandú   Álvarez ')).toBe('ÑÁ');
    expect(inicialesDelNombre('')).toBe('');
  });

  it('el mismo nombre da siempre el mismo color, sin importar mayúsculas ni espacios', () => {
    expect(colorDelNombre('Joaquim Colacilli')).toBe(colorDelNombre('  joaquim colacilli '));
    expect(colorDelNombre('Joaquim Colacilli')).toBeGreaterThanOrEqual(0);
    expect(colorDelNombre('Joaquim Colacilli')).toBeLessThan(6);
  });

  it('queda fuera del árbol de accesibilidad: el nombre ya está escrito al lado', () => {
    const { container } = render(<Avatar nombre="Joaquim" />);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });
});
