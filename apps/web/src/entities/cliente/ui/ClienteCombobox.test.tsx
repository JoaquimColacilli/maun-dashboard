import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { Cliente } from '../model/catalogos';
import { CLIENTE_EN_BLANCO } from '../model/formulario';
import { ClienteCombobox } from './ClienteCombobox';

function cliente(id: string, nombre: string, zona = ''): Cliente {
  return {
    ...CLIENTE_EN_BLANCO,
    id,
    nombre,
    zona,
    household_id: 'h',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    deleted_at: null,
    version: 1,
  };
}

const CLIENTES = [
  cliente('1', 'Ana Gómez', 'Vicente López'),
  cliente('2', 'Bruno Díaz', 'Olivos'),
  cliente('3', 'Carla Núñez', 'Martínez'),
];

function montar(alElegir = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <ClienteCombobox clientes={CLIENTES} elegidoId={null} alElegir={alElegir} />
    </QueryClientProvider>,
  );
  return { input: screen.getByRole('combobox'), alElegir };
}

function resaltado(input: HTMLElement): string | null {
  const id = input.getAttribute('aria-activedescendant');
  if (id === null || id === '') return null;
  return document.getElementById(id)?.textContent ?? null;
}

describe('ClienteCombobox, solo con el teclado', () => {
  it('abre con la flecha, recorre la lista y el cursor de texto no se va del input', () => {
    const { input } = montar();
    input.focus();
    expect(document.activeElement).toBe(input);

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(resaltado(input)).toContain('Ana Gómez');
    expect(document.activeElement).toBe(input);

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(resaltado(input)).toContain('Bruno Díaz');
    expect(document.activeElement).toBe(input);

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(resaltado(input)).toContain('Ana Gómez');
    expect(document.activeElement).toBe(input);
  });

  it('filtra mientras se escribe y elige con Enter', () => {
    const { input, alElegir } = montar();
    fireEvent.change(input, { target: { value: 'car' } });

    expect(screen.getByText('Carla Núñez')).toBeInTheDocument();
    expect(screen.queryByText('Ana Gómez')).not.toBeInTheDocument();

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(alElegir).toHaveBeenCalledWith(expect.objectContaining({ nombre: 'Carla Núñez' }));
  });

  it('Escape cierra la lista sin elegir nada', () => {
    const { input, alElegir } = montar();
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).toHaveAttribute('aria-expanded', 'true');

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(alElegir).not.toHaveBeenCalled();
  });

  it('ofrece crear un cliente nuevo cuando el nombre no está, y no lo ofrece cuando ya está', () => {
    const { input, alElegir } = montar();

    fireEvent.change(input, { target: { value: 'Ana Gómez' } });
    expect(screen.queryByText('Crear «Ana Gómez»')).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'Delia Sosa' } });
    expect(screen.getByText('Crear «Delia Sosa»')).toBeInTheDocument();

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(alElegir).toHaveBeenCalledWith(
      expect.objectContaining({ nombre: 'Delia Sosa', cuit: '', telefono: '' }),
    );
  });

  it('con un cliente elegido muestra sus datos resumidos y deja cambiarlo', () => {
    const alElegir = vi.fn();
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <ClienteCombobox clientes={CLIENTES} elegidoId="2" alElegir={alElegir} />
      </QueryClientProvider>,
    );

    expect(screen.getByText('Bruno Díaz')).toBeInTheDocument();
    expect(screen.getByText('Olivos')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Cambiar el cliente/ }));
    expect(alElegir).toHaveBeenCalledWith(null);
  });
});
