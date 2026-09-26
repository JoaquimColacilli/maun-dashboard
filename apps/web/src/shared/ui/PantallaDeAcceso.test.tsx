import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PantallaDeAcceso } from './PantallaDeAcceso';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('el panel de las pantallas de acceso', () => {
  it('lleva el logotipo de NUMA, en el color del panel, y no el nombre del taller', () => {
    vi.stubGlobal('matchMedia', (consulta: string) => ({
      matches: false,
      media: consulta,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    render(
      <PantallaDeAcceso titulo="Entrar">
        <p>Formulario</p>
      </PantallaDeAcceso>,
    );
    const panel = screen.getByRole('complementary');
    const marca = within(panel).getByRole('img', { name: 'NUMA' });
    expect(marca).toHaveAttribute('stroke', 'currentColor');
    expect(panel).toHaveClass('text-sobre-marca');
    expect(marca.parentElement).toHaveClass('h-[30px]');
    expect(panel).not.toHaveTextContent('MAUN');
  });
});
