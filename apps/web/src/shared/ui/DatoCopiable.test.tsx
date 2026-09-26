import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/lib', async (original) => ({
  ...(await original<typeof import('@/shared/lib')>()),
  copiar: vi.fn().mockResolvedValue('copiado'),
}));

const { DatoCopiable } = await import('./DatoCopiable');

describe('copiar un dato', () => {
  it('antes de copiar muestra el ícono de copiar; al copiar, «Copiado» con una tilde que se dibuja', async () => {
    render(<DatoCopiable etiqueta="Alias" valor="maun.muebles" nombre="Copiar el alias" />);
    const boton = screen.getByRole('button', { name: 'Copiar el alias' });
    expect(boton.querySelector('svg.tilde')).toBeNull();
    expect(boton).toHaveTextContent('Copiar');

    fireEvent.click(boton);
    expect(await within(boton).findByText('Copiado')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Copiado');
    const tilde = boton.querySelector('svg.tilde');
    expect(tilde).toHaveAttribute('data-dibujar');
    expect(tilde).toHaveAttribute('aria-hidden', 'true');
  });
});
