import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { avisarEnPantalla, descartarDePantalla, vaciarAvisosEnPantalla } from '@/shared/lib';

import { Avisos } from './Avisos';

afterEach(() => {
  act(() => {
    vaciarAvisosEnPantalla();
  });
  vi.useRealTimers();
});

function montar(): void {
  render(
    <MemoryRouter>
      <QueryClientProvider client={new QueryClient()}>
        <Avisos />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

function tarjetaDe(texto: string): HTMLElement {
  const tarjeta = screen.getByText(texto).closest<HTMLElement>('.aviso-en-pantalla');
  if (tarjeta === null) throw new Error(`no está el aviso «${texto}»`);
  return tarjeta;
}

describe('los avisos en pantalla', () => {
  it('uno nuevo entra con su clase, adentro del status, y se puede tocar', () => {
    montar();
    act(() => {
      avisarEnPantalla({ clave: 'a', tono: 'hecho', texto: 'Movimiento guardado.' });
    });
    const tarjeta = tarjetaDe('Movimiento guardado.');
    expect(screen.getByRole('status')).toContainElement(tarjeta);
    expect(tarjeta).not.toHaveAttribute('inert');
    expect(tarjeta).toHaveClass('pointer-events-auto');
  });

  it('el que se va queda en su lugar, inerte, hasta que termina su fundido', () => {
    montar();
    let id = 0;
    act(() => {
      id = avisarEnPantalla({ clave: 'a', tono: 'hecho', texto: 'Movimiento guardado.' });
      avisarEnPantalla({ clave: 'b', tono: 'hecho', texto: 'Cliente guardado.' });
    });
    act(() => {
      descartarDePantalla(id);
    });
    const saliendo = tarjetaDe('Movimiento guardado.');
    expect(saliendo).toHaveAttribute('inert');
    expect(saliendo).toHaveAttribute('data-saliendo');
    expect(saliendo).toHaveClass('pointer-events-none');
    const tarjetas = [...document.querySelectorAll('.aviso-en-pantalla')];
    expect(tarjetas.indexOf(saliendo)).toBe(0);

    fireEvent.transitionEnd(saliendo, { propertyName: 'translate' });
    expect(saliendo).toBeInTheDocument();
    fireEvent.transitionEnd(saliendo, { propertyName: 'opacity' });
    expect(screen.queryByText('Movimiento guardado.')).not.toBeInTheDocument();
    expect(screen.getByText('Cliente guardado.')).toBeInTheDocument();
  });

  it('si la transición no termina, se va igual con el respaldo de las hojas', () => {
    vi.useFakeTimers();
    montar();
    let id = 0;
    act(() => {
      id = avisarEnPantalla({ clave: 'a', tono: 'error', texto: 'No se guardó el cliente.' });
    });
    act(() => {
      descartarDePantalla(id);
    });
    expect(screen.getByRole('alert', { hidden: true })).toHaveAttribute('inert');
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(screen.queryByText('No se guardó el cliente.')).not.toBeInTheDocument();
  });

  it('un aviso que cambia de estado se reemplaza en su lugar: no sale ni vuelve a entrar', () => {
    montar();
    act(() => {
      avisarEnPantalla({ clave: 'a', tono: 'en-cola', texto: 'Contacto anotado sin señal.' });
    });
    const antes = tarjetaDe('Contacto anotado sin señal.');
    act(() => {
      avisarEnPantalla({ clave: 'a', tono: 'hecho', texto: 'Contacto guardado.' });
    });
    expect(tarjetaDe('Contacto guardado.')).toBe(antes);
    expect(antes).not.toHaveAttribute('data-saliendo');
    expect(screen.queryByText('Contacto anotado sin señal.')).not.toBeInTheDocument();
  });
});
