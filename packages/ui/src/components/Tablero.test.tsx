import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CeldaAncha, Tablero } from './Tablero.tsx';

describe('Tablero', () => {
  it('reparte tarjetas del mismo peso en filas, con tantas columnas como entren', () => {
    render(
      <Tablero tarjetaMinima="20rem" como="ul" etiqueta="Trabajos" className="list-none gap-3">
        <li>Placard</li>
        <li>Mesada</li>
      </Tablero>,
    );

    const lista = screen.getByRole('list', { name: 'Trabajos' });
    expect(lista).toHaveClass(
      'grid',
      'list-none',
      'gap-3',
      '@min-[1px]/tablero:grid-cols-[repeat(auto-fill,minmax(min(var(--tarjeta-minima),100%),1fr))]',
    );
    expect(lista.style.getPropertyValue('--tarjeta-minima')).toBe('20rem');
    expect(lista.parentElement).toHaveAttribute('data-reparto', 'tablero');
    expect(lista.parentElement).toHaveClass('md:@container/tablero');
  });

  it('con pocas tarjetas fijas, las estira a todo el ancho en vez de dejar lugares vacíos', () => {
    render(
      <Tablero tarjetaMinima="13rem" completar etiqueta="Tesoros" como="section">
        <button type="button">Hogar</button>
      </Tablero>,
    );

    expect(screen.getByRole('region', { name: 'Tesoros' })).toHaveClass(
      '@min-[1px]/tablero:grid-cols-[repeat(auto-fit,minmax(min(var(--tarjeta-minima),100%),1fr))]',
    );
  });

  it('en el celular queda la grilla que traía la pantalla', () => {
    render(
      <Tablero tarjetaMinima="13rem" completar etiqueta="Tesoros" className="grid-cols-2 gap-2.5">
        <button type="button">Hogar</button>
      </Tablero>,
    );

    const tablero = screen.getByRole('button', { name: 'Hogar' }).parentElement;
    expect(tablero).toHaveClass('grid-cols-2', 'gap-2.5');
    expect(tablero?.className).not.toMatch(/(^|\s)(md|lg|xl):grid-cols/);
  });

  it('con pocas tarjetas que tienen que ir juntas, van todas en una fila o de a dos, nunca tres y una sola', () => {
    render(
      <Tablero enUnaFila etiqueta="Tesoros" como="section" className="grid-cols-2 gap-2.5">
        <button type="button">Hogar</button>
        <button type="button">Maun</button>
        <button type="button">Diezmo</button>
        <button type="button">Cocos</button>
      </Tablero>,
    );

    const tesoros = screen.getByRole('region', { name: 'Tesoros' });
    expect(tesoros).toHaveClass(
      'grid-cols-2',
      '@min-[54rem]/tablero:grid-flow-col',
      '@min-[54rem]/tablero:grid-cols-none',
      '@min-[54rem]/tablero:auto-cols-fr',
    );
    expect(tesoros.className).not.toMatch(/auto-fit|auto-fill|dense/);
  });

  it('las tarjetas de una fila miden lo mismo: el tablero no les cambia la alineación', () => {
    render(
      <Tablero tarjetaMinima="20rem" como="ul" etiqueta="Trabajos">
        <li>Placard</li>
      </Tablero>,
    );

    expect(screen.getByRole('list', { name: 'Trabajos' }).className).not.toMatch(/items-/);
  });

  it('una tarjeta mucho más alta que sus vecinas va sola, a todo el ancho', () => {
    render(
      <Tablero tarjetaMinima="20rem">
        <CeldaAncha>
          <p>Accesos</p>
        </CeldaAncha>
      </Tablero>,
    );

    expect(screen.getByText('Accesos').parentElement).toHaveClass('col-span-full', 'min-w-0');
  });
});
