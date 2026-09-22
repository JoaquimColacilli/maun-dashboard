import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { caracteresDe, MontoQueEntra } from './MontoQueEntra.tsx';

describe('el monto que entra en su caja', () => {
  it('se muestra entero, tal como viene formateado', () => {
    render(<MontoQueEntra>{'$ 1.506.291,84'}</MontoQueEntra>);
    expect(screen.getByText('$ 1.506.291,84')).toHaveClass('text-monto-que-entra');
  });

  it('le dice a la regla cuántos caracteres tiene que hacer entrar', () => {
    render(<MontoQueEntra>{'$ 12.345.678,90'}</MontoQueEntra>);
    expect(screen.getByText('$ 12.345.678,90').style.getPropertyValue('--caracteres')).toBe('15');
  });

  it('en una fila de tarjetas usa el largo del más largo, para que todas tengan la misma letra', () => {
    render(<MontoQueEntra caracteres={16}>{'$ 0'}</MontoQueEntra>);
    expect(screen.getByText('$ 0').style.getPropertyValue('--caracteres')).toBe('16');
  });

  it('una tarjeta topea en la letra grande de la computadora; un destacado, en la más grande', () => {
    render(
      <>
        <MontoQueEntra>{'$ 1'}</MontoQueEntra>
        <MontoQueEntra tamano="destacado">{'$ 2'}</MontoQueEntra>
      </>,
    );
    expect(screen.getByText('$ 1').style.getPropertyValue('--monto-maximo')).toBe(
      'var(--text-money-lg-desktop)',
    );
    expect(screen.getByText('$ 2').style.getPropertyValue('--monto-maximo')).toBe(
      'var(--text-money-xl)',
    );
  });
});

describe('cuántos caracteres tiene un monto', () => {
  it('cuenta caracteres, no unidades de UTF-16', () => {
    expect(caracteresDe('$ 1.506.291,84')).toBe(14);
    expect(caracteresDe('-$ 12.345.678,90')).toBe(16);
  });

  it('de varios, el más largo', () => {
    expect(caracteresDe('$ 0', '$ 12.345.678,90', '$ 150.000')).toBe(15);
  });

  it('nunca menos de uno, para no dividir por cero', () => {
    expect(caracteresDe('')).toBe(1);
    expect(caracteresDe()).toBe(1);
  });
});
