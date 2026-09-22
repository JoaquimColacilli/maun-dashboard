import { HITO_DEL_ESTIMATIVO, HITOS, NOTA_DEL_RELEVAMIENTO } from '@maun/domain';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AyudaDeLaVista } from './AyudaDeLaVista';

function abrir(): void {
  render(<AyudaDeLaVista />);
  fireEvent.click(screen.getByRole('button', { name: 'Cómo lo ve tu cliente' }));
}

function tocar(nombre: string): void {
  fireEvent.click(screen.getByRole('button', { name: nombre }));
}

describe('la ayuda de la vista del cliente', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('abre el modal en la primera lámina', () => {
    abrir();

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('El enlace y la pantalla');
    expect(screen.getByText('1 de 7')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Atrás' })).toBeDisabled();
  });

  it('avanza y vuelve con los dos botones', () => {
    abrir();

    tocar('Siguiente');
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Antes del presupuesto');

    tocar('Siguiente');
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent(
      'El presupuesto y la aprobación',
    );

    tocar('Atrás');
    tocar('Atrás');
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('El enlace y la pantalla');
  });

  it('explica cada paso y la nota con el mismo nombre que le muestra la pantalla al cliente', () => {
    abrir();

    const leido = screen.getByRole('dialog').textContent;
    for (const hito of [HITO_DEL_ESTIMATIVO, ...HITOS]) {
      expect(leido).toContain(hito.etiqueta);
    }
    expect(leido).toContain(NOTA_DEL_RELEVAMIENTO.pendiente.titulo);
  });

  it('deja ver una lámina por vez', () => {
    abrir();

    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(1);
    tocar('Siguiente');
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(1);
  });

  it('la última lámina cierra el modal', () => {
    abrir();

    while (screen.queryByRole('button', { name: 'Siguiente' }) !== null) {
      tocar('Siguiente');
    }
    tocar('Listo');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
