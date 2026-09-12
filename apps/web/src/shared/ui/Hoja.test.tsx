import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ConSalida, Hoja } from './Hoja';

function Prueba({ alCerrar = () => undefined }: { alCerrar?: () => void }) {
  const [abierta, setAbierta] = useState(true);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setAbierta(!abierta);
        }}
      >
        Alternar
      </button>
      <ConSalida valor={abierta}>
        {() => (
          <Hoja
            titulo="Cargar un movimiento"
            alCerrar={() => {
              alCerrar();
              setAbierta(false);
            }}
          >
            <p>Contenido</p>
          </Hoja>
        )}
      </ConSalida>
    </>
  );
}

describe('la hoja', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('se abre como diálogo modal con el título como nombre', () => {
    render(<Prueba />);

    const hoja = screen.getByRole('dialog', { name: 'Cargar un movimiento' });
    expect(hoja).toHaveAttribute('open');
  });

  it('Escape pide cerrarla, y se queda montada mientras sale', () => {
    const alCerrar = vi.fn();
    render(<Prueba alCerrar={alCerrar} />);
    const hoja = screen.getByRole('dialog', { name: 'Cargar un movimiento' });

    fireEvent(hoja, new Event('cancel', { cancelable: true }));

    expect(alCerrar).toHaveBeenCalledOnce();
    expect(hoja).not.toHaveAttribute('open');
    expect(screen.getByText('Contenido')).toBeInTheDocument();

    fireEvent.transitionEnd(hoja);
    expect(screen.queryByText('Contenido')).not.toBeInTheDocument();
  });

  it('si la transición no avisa, se desmonta igual al rato', () => {
    render(<Prueba />);

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.getByText('Contenido')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.queryByText('Contenido')).not.toBeInTheDocument();
  });

  it('se puede volver a abrir mientras sale', () => {
    render(<Prueba />);

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Alternar' }));

    expect(screen.getByRole('dialog', { name: 'Cargar un movimiento' })).toHaveAttribute('open');
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByText('Contenido')).toBeInTheDocument();
  });
});
