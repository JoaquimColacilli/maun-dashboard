import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CasillaDeLaApertura, TEXTO_DE_LA_APERTURA } from './CasillaDeLaApertura';

describe('CasillaDeLaApertura', () => {
  it('solo aparece si la fecha es de antes de la apertura', () => {
    const { rerender } = render(
      <CasillaDeLaApertura fecha="2026-09-14" apertura="2026-09-14" marcada alCambiar={vi.fn()} />,
    );
    expect(screen.queryByRole('checkbox')).toBeNull();

    rerender(
      <CasillaDeLaApertura fecha="2026-07-20" apertura="2026-09-14" marcada alCambiar={vi.fn()} />,
    );
    expect(screen.getByRole('checkbox', { name: TEXTO_DE_LA_APERTURA })).toBeChecked();
  });

  it('en un taller sin apertura no aparece nunca', () => {
    render(<CasillaDeLaApertura fecha="2020-01-01" apertura={null} marcada alCambiar={vi.fn()} />);
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('mientras el día está a medio escribir tampoco', () => {
    render(<CasillaDeLaApertura fecha="" apertura="2026-09-14" marcada alCambiar={vi.fn()} />);
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('destildarla avisa el valor nuevo', () => {
    const alCambiar = vi.fn();
    render(
      <CasillaDeLaApertura
        fecha="2026-07-20"
        apertura="2026-09-14"
        marcada
        alCambiar={alCambiar}
      />,
    );
    fireEvent.click(screen.getByRole('checkbox'));
    expect(alCambiar).toHaveBeenCalledWith(false);
  });
});
