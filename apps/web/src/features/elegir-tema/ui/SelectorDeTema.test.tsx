import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SelectorDeTema } from './SelectorDeTema';

describe('el selector de tema', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('arranca en «como el sistema» y dice cómo se ve ahora', () => {
    render(<SelectorDeTema />);

    expect(screen.getByRole('radio', { name: 'Como el sistema' })).toBeChecked();
    expect(screen.getByText('Ahora se ve oscuro, porque así está el sistema.')).toBeInTheDocument();
  });

  it('elegir claro lo aplica en la raíz y marca la opción', () => {
    render(<SelectorDeTema />);

    fireEvent.click(screen.getByRole('radio', { name: 'Claro' }));

    expect(document.documentElement.dataset.theme).toBe('light');
    expect(screen.getByRole('radio', { name: 'Claro' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Como el sistema' })).not.toBeChecked();
  });

  it('los tres estados son un solo grupo con nombre, para recorrerlo con las flechas', () => {
    render(<SelectorDeTema />);

    const grupo = screen.getByRole('group', { name: 'Tema' });
    expect(grupo).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
  });
});
