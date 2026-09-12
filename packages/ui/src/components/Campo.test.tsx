import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Campo } from './Campo.tsx';

describe('Campo', () => {
  it('asocia la etiqueta con el input', () => {
    render(<Campo etiqueta="Email" defaultValue="vos@taller.com.ar" />);
    expect(screen.getByLabelText('Email')).toHaveValue('vos@taller.com.ar');
  });

  it('anuncia el error y marca el input como inválido', () => {
    render(<Campo etiqueta="Email" error="Escribí un mail válido." />);

    expect(screen.getByRole('alert')).toHaveTextContent('Escribí un mail válido.');
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Escribí un mail válido.');
  });

  it('describe el campo con la ayuda cuando no hay error', () => {
    render(<Campo etiqueta="Contraseña" ayuda="Al menos 6 caracteres." />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toHaveAccessibleDescription(
      'Al menos 6 caracteres.',
    );
  });
});
