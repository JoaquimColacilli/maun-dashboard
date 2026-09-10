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

  it('mientras carga queda deshabilitado y marcado como ocupado', () => {
    render(<Button cargando>Guardando…</Button>);
    const boton = screen.getByRole('button', { name: 'Guardando…' });
    expect(boton).toBeDisabled();
    expect(boton).toHaveAttribute('aria-busy', 'true');
  });
});
