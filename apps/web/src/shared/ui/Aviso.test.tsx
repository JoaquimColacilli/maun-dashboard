import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Aviso } from './Aviso';

describe('Aviso', () => {
  it('lleva su lámina afuera del alerta, con un solo h1 adentro y las acciones abajo', () => {
    const { container } = render(
      <Aviso titulo="No pudimos leer tus datos" mensaje="Se cortó algo." detalle="Nada guardado.">
        <button type="button">Reintentar</button>
      </Aviso>,
    );

    const alerta = screen.getByRole('alert');
    expect(within(alerta).getByRole('heading', { level: 1 })).toHaveTextContent(
      'No pudimos leer tus datos',
    );
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(within(alerta).getByText('Se cortó algo.')).toBeInTheDocument();
    expect(within(alerta).getByText('Nada guardado.')).toBeInTheDocument();

    const lamina = container.querySelector('[data-lamina]');
    expect(lamina).not.toBeNull();
    expect(lamina).toHaveAttribute('aria-hidden', 'true');
    expect(lamina?.querySelector('svg.ilustracion')).not.toBeNull();
    expect(alerta.querySelector('svg, [data-lamina]')).toBeNull();
    expect(alerta.contains(lamina)).toBe(false);

    const reintentar = screen.getByRole('button', { name: 'Reintentar' });
    expect(alerta.contains(reintentar)).toBe(false);
    expect(container.querySelectorAll('main')).toHaveLength(1);
  });
});
