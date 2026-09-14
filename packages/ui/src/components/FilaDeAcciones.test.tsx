import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Button } from './Button.tsx';
import { FilaDeAcciones } from './FilaDeAcciones.tsx';

describe('FilaDeAcciones', () => {
  it('arma columnas automáticas con el mínimo del token, que colapsan las vacías', () => {
    render(
      <FilaDeAcciones>
        <Button>Ya lo entregué</Button>
        <Button variant="secundario">Volvió a presupuesto</Button>
      </FilaDeAcciones>,
    );

    const fila = screen.getByRole('button', { name: 'Ya lo entregué' }).parentElement;
    expect(fila).toHaveClass(
      'grid',
      'grid-cols-[repeat(auto-fit,minmax(min(var(--accion-min),100%),1fr))]',
      '*:w-full',
    );
    expect(fila).toHaveAttribute('data-fila-de-acciones');
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('suma lo que la pantalla necesita sin pisar la grilla', () => {
    render(
      <FilaDeAcciones className="mt-3">
        <Button>Reintentar</Button>
      </FilaDeAcciones>,
    );

    const fila = screen.getByRole('button', { name: 'Reintentar' }).parentElement;
    expect(fila).toHaveClass('mt-3', 'grid');
  });
});
