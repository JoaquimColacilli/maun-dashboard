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

  it('la herramienta de una cabecera tiene un alto y un ancho mínimos, y deshabilitada conserva su forma', () => {
    render(
      <>
        <Button variant="herramienta" size="herramienta" aria-label="Editar">
          <span aria-hidden>✎</span>
        </Button>
        <Button variant="herramienta" size="herramienta" aria-label="Borrar" disabled>
          <span aria-hidden>✕</span>
        </Button>
      </>,
    );
    const editar = screen.getByRole('button', { name: 'Editar' });
    expect(editar).toHaveClass('min-h-11', 'min-w-11', 'rounded-pill', 'border', 'border-hairline');
    expect(editar).not.toHaveClass('h-11');

    const borrar = screen.getByRole('button', { name: 'Borrar' });
    expect(borrar).toBeDisabled();
    expect(borrar).toHaveClass('min-h-11', 'min-w-11', 'rounded-pill', 'border', 'border-hairline');
    expect(borrar).not.toHaveClass('bg-hairline', 'px-[18px]');
  });

  it('mientras carga queda deshabilitado y marcado como ocupado', () => {
    render(<Button cargando>Guardando…</Button>);
    const boton = screen.getByRole('button', { name: 'Guardando…' });
    expect(boton).toBeDisabled();
    expect(boton).toHaveAttribute('aria-busy', 'true');
  });
});
