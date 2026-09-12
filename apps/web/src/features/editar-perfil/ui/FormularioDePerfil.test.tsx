import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ProveedorDeSesion } from '@/entities/sesion';

import { FormularioDePerfil } from './FormularioDePerfil';

function montar(nombre: string) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <ProveedorDeSesion sesion={{ usuarioId: 'u1', email: 'taller@maun.com.ar', nombre }}>
        <FormularioDePerfil />
      </ProveedorDeSesion>
    </QueryClientProvider>,
  );
}

describe('el formulario de perfil', () => {
  it('muestra el nombre, el mail y las iniciales del nombre', () => {
    const { container } = montar('Joaquim Colacilli');

    expect(screen.getByLabelText('Tu nombre')).toHaveValue('Joaquim Colacilli');
    expect(screen.getByText('taller@maun.com.ar')).toBeInTheDocument();
    expect(container.querySelector('[aria-hidden="true"]')?.textContent).toBe('JC');
  });

  it('sin nombre usa la inicial del mail y lo dice', () => {
    const { container } = montar('');

    expect(screen.getByText('Todavía sin nombre')).toBeInTheDocument();
    expect(container.querySelector('[aria-hidden="true"]')?.textContent).toBe('T');
  });

  it('guardar se habilita recién cuando el nombre cambia', () => {
    montar('Joaquim');
    const boton = screen.getByRole('button', { name: 'Guardar el nombre' });
    expect(boton).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Tu nombre'), { target: { value: 'Joaquim C.' } });
    expect(boton).toBeEnabled();

    fireEvent.change(screen.getByLabelText('Tu nombre'), { target: { value: ' Joaquim ' } });
    expect(boton).toBeDisabled();
  });

  it('un nombre larguísimo avisa en el campo y no se manda', () => {
    montar('');
    fireEvent.change(screen.getByLabelText('Tu nombre'), { target: { value: 'a'.repeat(61) } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar el nombre' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Hasta 60 letras.');
  });
});
