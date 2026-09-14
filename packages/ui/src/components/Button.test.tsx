import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Button } from './Button.tsx';

describe('Button', () => {
  it('no envía formularios salvo que se pida', () => {
    render(<Button>Guardá los cambios</Button>);
    expect(screen.getByRole('button', { name: 'Guardá los cambios' })).toHaveAttribute(
      'type',
      'button',
    );
  });

  it('el alto de cada tamaño es un mínimo: una etiqueta que no entra en un renglón lo agranda', () => {
    render(
      <>
        <Button size="grande">Entrar</Button>
        <Button>Reactivar y deshacer el reparto</Button>
        <Button size="chico">Borrarlo</Button>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Entrar' })).toHaveClass('min-h-field');
    expect(screen.getByRole('button', { name: 'Reactivar y deshacer el reparto' })).toHaveClass(
      'min-h-button',
      'text-center',
    );
    expect(screen.getByRole('button', { name: 'Borrarlo' })).toHaveClass('min-h-button-sm');
    expect(screen.getByRole('button', { name: 'Borrarlo' })).not.toHaveClass('h-button-sm');
  });

  it('mientras carga queda deshabilitado y marcado como ocupado', () => {
    render(<Button cargando>Guardando…</Button>);
    const boton = screen.getByRole('button', { name: 'Guardando…' });
    expect(boton).toBeDisabled();
    expect(boton).toHaveAttribute('aria-busy', 'true');
  });
});
