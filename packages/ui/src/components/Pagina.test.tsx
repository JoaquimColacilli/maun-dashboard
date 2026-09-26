import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Pagina } from './Pagina.tsx';

describe('Pagina', () => {
  it('pone el contenido adentro del molde de ancho y márgenes, centrado', () => {
    render(
      <Pagina>
        <h1>Diezmo</h1>
      </Pagina>,
    );

    const molde = screen.getByRole('heading', { name: 'Diezmo' }).parentElement;
    expect(molde).toHaveClass('max-w-content', 'mx-auto', 'px-(--page-pad-mobile)');
    expect(molde).toHaveAttribute('data-pagina');
  });

  it('suma lo que la pantalla necesita adentro sin pisar el molde', () => {
    render(
      <Pagina className="gap-4">
        <p>Contenido</p>
      </Pagina>,
    );

    const molde = screen.getByText('Contenido').parentElement;
    expect(molde).toHaveClass('gap-4', 'max-w-content');
  });

  it('una página del cliente lleva en el mismo molde la marca que la deja quieta', () => {
    const { rerender } = render(
      <Pagina>
        <p>Contenido</p>
      </Pagina>,
    );
    expect(screen.getByText('Contenido').parentElement).not.toHaveAttribute('data-quieta');

    rerender(
      <Pagina quieta>
        <p>Contenido</p>
      </Pagina>,
    );
    const molde = screen.getByText('Contenido').parentElement;
    expect(molde).toHaveAttribute('data-quieta');
    expect(molde).toHaveAttribute('data-pagina');
  });
});
