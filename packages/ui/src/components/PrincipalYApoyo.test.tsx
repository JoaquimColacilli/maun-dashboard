import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { entraALaVista, PrincipalYApoyo } from './PrincipalYApoyo.tsx';

function Ficha({ apoyoPrimero }: { apoyoPrimero?: boolean }) {
  return (
    <PrincipalYApoyo apoyoPrimero={apoyoPrimero} apoyo={<p>Saldo y estado</p>}>
      <p>Pagos y gastos</p>
    </PrincipalYApoyo>
  );
}

function columnas() {
  const apoyo = screen.getByText('Saldo y estado').parentElement;
  const principal = screen.getByText('Pagos y gastos').parentElement;
  const grilla = apoyo?.parentElement;
  return { apoyo, principal, grilla };
}

describe('PrincipalYApoyo', () => {
  it('si en el celular el apoyo va antes, va antes en el DOM y a la izquierda', () => {
    render(<Ficha apoyoPrimero />);

    const { apoyo, principal, grilla } = columnas();
    expect(grilla?.firstElementChild).toBe(apoyo);
    expect(grilla?.lastElementChild).toBe(principal);
    expect(grilla).toHaveClass('@min-[52rem]/apoyo:grid-cols-[22.5rem_minmax(0,1fr)]');
  });

  it('si va después, va después en el DOM y a la derecha', () => {
    render(<Ficha />);

    const { apoyo, principal, grilla } = columnas();
    expect(grilla?.firstElementChild).toBe(principal);
    expect(grilla?.lastElementChild).toBe(apoyo);
    expect(grilla).toHaveClass('@min-[52rem]/apoyo:grid-cols-[minmax(0,1fr)_22.5rem]');
  });

  it('las dos columnas las decide el ancho del área de contenido, no el de la ventana', () => {
    render(<Ficha />);

    const { grilla } = columnas();
    expect(grilla?.parentElement).toHaveAttribute('data-reparto', 'apoyo');
    expect(grilla?.parentElement).toHaveClass('md:@container/apoyo');
    expect(grilla).toHaveClass('grid', 'grid-cols-1', 'items-start');
    expect(grilla?.className).not.toMatch(/(^|\s)(md|lg|xl):/);
  });

  it('nada reordena: ni order ni ubicar una columna en otro lugar', () => {
    render(<Ficha apoyoPrimero />);

    const { apoyo, principal, grilla } = columnas();
    for (const elemento of [apoyo, principal, grilla]) {
      expect(elemento?.className).not.toMatch(/order-|col-start|row-start|dense/);
    }
  });

  it('el apoyo se pega solo si entra en lo visible, y solo con las dos columnas', () => {
    render(<Ficha />);

    const { apoyo } = columnas();
    expect(apoyo).toHaveClass(
      '@min-[52rem]/apoyo:data-pegado:sticky',
      '@min-[52rem]/apoyo:data-pegado:top-5',
    );
    expect(apoyo).toHaveAttribute('data-pegado');
  });

  it('cada columna es su propio contexto posicionado, para que lo que lleva sr-only no se escape', () => {
    render(<Ficha />);

    const { apoyo, principal } = columnas();
    expect(apoyo).toHaveClass('relative');
    expect(principal).toHaveClass('relative');
  });

  it('entra si su alto más el aire de arriba y de abajo cabe en lo visible', () => {
    expect(entraALaVista(700, 800)).toBe(true);
    expect(entraALaVista(760, 800)).toBe(true);
    expect(entraALaVista(761, 800)).toBe(false);
    expect(entraALaVista(900, 800)).toBe(false);
  });

  it('la separación de una columna sobre otra la pone la pantalla, como la tenía', () => {
    render(
      <PrincipalYApoyo separacion="gap-y-4" apoyo={<p>Saldo y estado</p>}>
        <p>Pagos y gastos</p>
      </PrincipalYApoyo>,
    );

    const { grilla } = columnas();
    expect(grilla).toHaveClass('gap-y-4', '@min-[52rem]/apoyo:gap-x-11');
  });
});
