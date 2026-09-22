import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Pagina } from './Pagina.tsx';

describe('Pagina', () => {
  it('pone el contenido adentro del molde de ancho y márgenes', () => {
    render(
      <Pagina>
        <h1>Diezmo</h1>
      </Pagina>,
    );

    const molde = screen.getByRole('heading', { name: 'Diezmo' }).parentElement;
    expect(molde).toHaveClass('max-w-content', 'px-(--page-pad-mobile)');
  });

  it('arranca donde lo dice el marco y deja el aire sobrante a la derecha', () => {
    render(
      <Pagina>
        <h1>Inicio</h1>
      </Pagina>,
    );

    const molde = screen.getByRole('heading', { name: 'Inicio' }).parentElement;
    expect(molde).toHaveClass('ms-(--inicio-de-la-pagina)', 'me-auto');
    expect(molde).not.toHaveClass('mx-auto');
  });

  it.each([
    ['formulario', 'max-w-formulario'],
    ['ficha', 'max-w-ficha'],
    ['tablero', 'max-w-tablero'],
    ['lista', 'max-w-content'],
  ] as const)('con el ancho de %s el tope es %s', (ancho, tope) => {
    render(
      <Pagina ancho={ancho}>
        <h1>Pantalla</h1>
      </Pagina>,
    );

    const molde = screen.getByRole('heading', { name: 'Pantalla' }).parentElement;
    expect(molde).toHaveClass(tope);
    expect(molde).toHaveAttribute('data-pagina', ancho);
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
});
