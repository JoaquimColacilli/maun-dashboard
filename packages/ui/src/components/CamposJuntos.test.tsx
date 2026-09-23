import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CamposJuntos } from './CamposJuntos.tsx';

describe('CamposJuntos', () => {
  it('en el celular los deja uno abajo del otro, con la separación de la columna', () => {
    render(
      <CamposJuntos separacion="gap-5">
        <label>Alias</label>
        <label>CVU</label>
      </CamposJuntos>,
    );

    const fila = screen.getByText('Alias').parentElement;
    expect(fila).toHaveClass('grid', 'grid-cols-1', 'gap-5');
    expect(fila?.parentElement).toHaveAttribute('data-reparto', 'campos');
    expect(fila?.parentElement).toHaveClass('md:@container/campos', 'relative');
  });

  it('los pone en un renglón cuando entran todos con su ancho mínimo, según su contenedor', () => {
    render(
      <CamposJuntos>
        <label>Titular</label>
        <label>CUIT</label>
      </CamposJuntos>,
    );

    expect(screen.getByText('Titular').parentElement).toHaveClass(
      '@min-[33rem]/campos:grid-cols-2',
    );
  });

  it('con tres, recién los junta cuando entran los tres', () => {
    render(
      <CamposJuntos columnas={3} campoMinimo="12rem">
        <label>Sueldo</label>
        <label>Costos fijos</label>
        <label>Meta</label>
      </CamposJuntos>,
    );

    const fila = screen.getByText('Sueldo').parentElement;
    expect(fila).toHaveClass('@min-[38rem]/campos:grid-cols-3');
    expect(fila?.className).not.toMatch(/grid-cols-2/);
  });

  it('con muchos de a tres, si no entran los tres pueden ir de a dos', () => {
    render(
      <CamposJuntos columnas={3} deADos campoMinimo="12rem">
        <label>Nombre</label>
        <label>Sueldo</label>
        <label>Costos fijos</label>
        <label>Meta</label>
      </CamposJuntos>,
    );

    expect(screen.getByText('Nombre').parentElement).toHaveClass(
      '@min-[25rem]/campos:grid-cols-2',
      '@min-[38rem]/campos:grid-cols-3',
    );
  });
});
